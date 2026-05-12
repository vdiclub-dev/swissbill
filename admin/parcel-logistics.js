(function(){
    'use strict';

    var BASE = { name:'Colixo Yvonand', lat:46.8006, lng:6.7416 };
    var PARCEL_STATUSES = ['planned','ready_to_load','loaded','out_for_delivery','delivered','failed','returned'];
    var SERVICE_LABELS = {
        standard:'Standard',
        express:'Express',
        eco:'Eco',
        prio:'Prioritaire',
        priority:'Prioritaire',
        same_day:'Same day',
        vinologue:'Vinologue'
    };

    function db(){
        return window.SUPABASE_CLIENT || window.supabaseClient || window.db || null;
    }
    function esc(v){
        return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){
            return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
        });
    }
    function ref(o){
        return o.order_number || String(o.id || '').slice(0,8).toUpperCase();
    }
    function serviceLevel(o){
        var raw = o.service_level || o.service_type || o.speed || 'standard';
        return SERVICE_LABELS[String(raw).toLowerCase()] || raw || 'Standard';
    }
    function quantity(o){
        var q = parseInt(o.parcel_count || o.quantity || o.nb_colis || 1, 10);
        return isFinite(q) && q > 0 ? q : 1;
    }
    function num(v){
        var n = parseFloat(v);
        return isFinite(n) ? n : null;
    }
    function haversineKm(a,b){
        if(!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
        var R=6371, dLat=(b.lat-a.lat)*Math.PI/180, dLng=(b.lng-a.lng)*Math.PI/180;
        var s1=Math.sin(dLat/2), s2=Math.sin(dLng/2);
        var aa=s1*s1+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*s2*s2;
        return 2*R*Math.atan2(Math.sqrt(aa),Math.sqrt(1-aa));
    }
    function baseFor(route, stops){
        var lat = num(route && (route.base_lat || route.depart_lat || route.start_lat));
        var lng = num(route && (route.base_lng || route.depart_lng || route.start_lng));
        if(lat != null && lng != null) return { name:route.nom || route.name || BASE.name, lat:lat, lng:lng };
        var first = (stops || []).find(function(s){ return num(s.pickup_lat) != null && num(s.pickup_lng) != null; });
        if(first) return { name:'Départ tournée', lat:num(first.pickup_lat), lng:num(first.pickup_lng) };
        return BASE;
    }
    function stopPoint(o){
        var lat = num(o.delivery_lat), lng = num(o.delivery_lng);
        return lat != null && lng != null ? { lat:lat, lng:lng } : null;
    }
    function stopKey(o){
        return [
            String(o.delivery_address || '').trim().toLowerCase(),
            String(o.destinataire_nom || o.client_name || '').trim().toLowerCase()
        ].join('|') || String(o.id || '');
    }
    function tokenFor(o, index){
        var raw = [o.id || ref(o), o.tournee_id || '', index || 1].join(':');
        try { return btoa(unescape(encodeURIComponent(raw))).replace(/=+$/,''); }
        catch(e){ return raw.replace(/[^a-z0-9]/gi,'').slice(0,32); }
    }
    function normalizeStops(routeStops, route){
        var base = baseFor(route || {}, routeStops || []);
        return (routeStops || []).map(function(o, i){
            var d = haversineKm(base, stopPoint(o));
            return Object.assign({}, o, {
                _original_index:i,
                _distance_from_base: d == null ? -1 : d,
                _manual_order: num(o.stop_number || o.delivery_order || o.sequence_order || o.sort_order)
            });
        });
    }

    function calculateLoadingOrder(routeStops, options){
        options = options || {};
        var route = options.route || {};
        var mode = options.mode || route.optimization_mode || route.type_optimisation || 'regional';
        var stops = normalizeStops(routeStops, route);
        var ordered;

        if(mode === 'manual'){
            ordered = stops.slice().sort(function(a,b){
                var ao = a._manual_order == null ? 9999 : a._manual_order;
                var bo = b._manual_order == null ? 9999 : b._manual_order;
                return ao - bo || a._original_index - b._original_index;
            });
        } else if(mode === 'urban' || mode === 'time_windows'){
            ordered = stops.slice().sort(function(a,b){
                var at = a.delivery_time_from || a.time_window_start || a.scheduled_at || '';
                var bt = b.delivery_time_from || b.time_window_start || b.scheduled_at || '';
                return String(at).localeCompare(String(bt)) || a._original_index - b._original_index;
            });
        } else {
            ordered = stops.slice().sort(function(a,b){
                return (b._distance_from_base - a._distance_from_base) || a._original_index - b._original_index;
            });
        }

        var totalStops = ordered.length;
        return ordered.map(function(o, idx){
            return Object.assign({}, o, {
                stop_number: idx + 1,
                loading_order: totalStops - idx,
                logistics_zone: o.logistics_zone || o.zone_logistique || (route && route.zone) || 'Nationale',
                service_level: serviceLevel(o),
                distance_from_base_km: o._distance_from_base >= 0 ? Math.round(o._distance_from_base * 10) / 10 : null
            });
        });
    }

    function groupParcelsByStop(routeStops){
        var groups = {};
        (routeStops || []).forEach(function(o){
            var key = stopKey(o);
            if(!groups[key]) groups[key] = { key:key, address:o.delivery_address || '', recipient:o.destinataire_nom || o.client_name || '', orders:[], parcels:[], totalParcels:0 };
            groups[key].orders.push(o);
            var q = quantity(o);
            groups[key].totalParcels += q;
            for(var i=1;i<=q;i++){
                groups[key].parcels.push({
                    order:o,
                    index:i,
                    total:q,
                    stop_number:o.stop_number,
                    loading_order:o.loading_order,
                    parcel_id:ref(o)+'-'+String(i).padStart(2,'0'),
                    scan_token:tokenFor(o,i)
                });
            }
        });
        return Object.keys(groups).map(function(k){ return groups[k]; });
    }

    function qrUrl(parcel){
        var origin = location.origin || 'https://www.colixo.ch';
        return origin + '/admin/driver-app.html?scan=' + encodeURIComponent(parcel.order.id) + '&token=' + encodeURIComponent(parcel.scan_token);
    }
    function labelMeta(order, parcel){
        return {
            route: order.tournee_nom || order.route_name || order.tournee_id || '—',
            stop: order.stop_number || parcel.stop_number || '—',
            loading: order.loading_order || parcel.loading_order || '—',
            zone: order.logistics_zone || 'Nationale',
            service: order.service_level || serviceLevel(order),
            parcelText: 'Colis ' + parcel.index + '/' + parcel.total,
            parcelId: parcel.parcel_id,
            token: parcel.scan_token
        };
    }
    function generateParcelLabel(order, parcel){
        parcel = parcel || { index:1, total:quantity(order), parcel_id:ref(order)+'-01', scan_token:tokenFor(order,1), stop_number:order.stop_number, loading_order:order.loading_order };
        var m = labelMeta(order, parcel);
        return '<section class="parcel-label">'
            +'<div class="pl-head"><div><div class="pl-brand">COL<span>I</span>XO</div><div class="pl-small">Étiquette colis intelligente</div></div><div class="pl-ref">'+esc(ref(order))+'</div></div>'
            +'<div class="pl-main">'
                +'<div class="pl-left">'
                    +'<div class="pl-row big"><b>Tournée</b><strong>'+esc(m.route)+'</strong></div>'
                    +'<div class="pl-grid">'
                        +'<div><b>Stop</b><strong>'+esc(m.stop)+'</strong></div>'
                        +'<div><b>Chargement</b><strong>'+esc(m.loading)+'</strong></div>'
                        +'<div><b>Zone</b><strong>'+esc(m.zone)+'</strong></div>'
                        +'<div><b>Service</b><strong>'+esc(m.service)+'</strong></div>'
                    +'</div>'
                    +'<div class="pl-dest"><b>Destinataire</b><strong>'+esc(order.destinataire_nom || order.client_name || '—')+'</strong><span>'+esc(order.delivery_address || 'Adresse manquante')+'</span></div>'
                    +'<div class="pl-foot"><strong>'+esc(m.parcelText)+'</strong><span>ID '+esc(m.parcelId)+'</span></div>'
                +'</div>'
                +'<div class="pl-qr"><div class="qr" data-qr="'+esc(qrUrl(parcel))+'"></div><code>'+esc(m.token)+'</code></div>'
            +'</div>'
        +'</section>';
    }

    async function getRoute(routeId){
        var client = db();
        if(!client) throw new Error('Supabase non chargé');
        var rt = await client.from('tournees').select('*').eq('id', routeId).maybeSingle();
        return rt.data || { id:routeId, nom:routeId };
    }
    async function getRouteStops(routeId){
        var client = db();
        if(!client) throw new Error('Supabase non chargé');
        var res = await client.from('transport_orders_simple').select('*').eq('tournee_id', routeId);
        if(res.error) throw res.error;
        return res.data || [];
    }
    async function getPreparedRoute(routeId, options){
        var route = await getRoute(routeId);
        var stops = await getRouteStops(routeId);
        var ordered = calculateLoadingOrder(stops, Object.assign({ route:route }, options || {})).map(function(o){
            return Object.assign(o, { tournee_nom:route.nom || route.name || route.id });
        });
        return { route:route, stops:ordered, groups:groupParcelsByStop(ordered) };
    }
    function openPrintDoc(title, body, extraClass){
        var styles = '<style>'
            +'body{margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111}.print-actions{position:sticky;top:0;background:#111;color:#fff;padding:10px 14px;display:flex;gap:10px;align-items:center;z-index:5}.print-actions button{border:0;border-radius:7px;padding:9px 13px;font-weight:700;cursor:pointer}.sheet{padding:12px}.parcel-label{width:148mm;height:105mm;background:#fff;margin:0 auto 10mm;border:1px solid #111;page-break-after:always;padding:8mm;box-sizing:border-box}.pl-head{display:flex;justify-content:space-between;border-bottom:3px solid #e8311a;padding-bottom:4mm}.pl-brand{font-size:28px;font-weight:900;letter-spacing:-1px}.pl-brand span{color:#e8311a}.pl-small{font-size:10px;text-transform:uppercase;color:#555}.pl-ref{font-size:30px;font-weight:900;color:#e8311a}.pl-main{display:grid;grid-template-columns:1fr 34mm;gap:6mm;margin-top:5mm}.pl-row,.pl-dest{border:1px solid #d1d5db;border-radius:8px;padding:7px;margin-bottom:6px}.pl-row b,.pl-grid b,.pl-dest b{display:block;font-size:9px;color:#666;text-transform:uppercase;letter-spacing:.8px}.pl-row strong{font-size:18px}.pl-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px}.pl-grid div{border:1px solid #d1d5db;border-radius:8px;padding:7px}.pl-grid strong{display:block;font-size:20px;margin-top:2px}.pl-dest strong{display:block;font-size:19px;margin:3px 0}.pl-dest span{font-size:14px;white-space:pre-wrap}.pl-foot{display:flex;justify-content:space-between;align-items:center;border-top:2px solid #111;padding-top:7px;font-size:16px}.pl-foot span{font-size:12px}.pl-qr{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:7px}.qr{width:112px;height:112px}.pl-qr code{font-size:9px;word-break:break-all;text-align:center}.list{background:#fff;margin:14px auto;padding:20px;max-width:980px;border-radius:10px}.list h1{margin:0 0 4px}.list table{width:100%;border-collapse:collapse;margin-top:14px}.list th,.list td{border-bottom:1px solid #e5e7eb;text-align:left;padding:9px;font-size:13px}.list th{background:#f9fafb;text-transform:uppercase;font-size:10px;color:#666}.pill{display:inline-block;border-radius:99px;padding:3px 8px;background:#fee2e2;color:#991b1b;font-weight:700}.warn{color:#b45309;font-weight:700}.ok{color:#15803d;font-weight:700}@media print{.print-actions{display:none}.sheet{padding:0}.list{box-shadow:none;border-radius:0;margin:0;max-width:none}.parcel-label{margin:0;page-break-after:always}@page{size:A6 landscape;margin:4mm}}'
            +'</style>';
        var qrcodeScript = '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script><script>window.onload=function(){document.querySelectorAll(".qr").forEach(function(el){new QRCode(el,{text:el.dataset.qr,width:112,height:112,correctLevel:QRCode.CorrectLevel.L});});};<\/script>';
        var w = window.open('', '_blank', 'width=1100,height=900');
        w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title>'+styles+'</head><body class="'+(extraClass||'')+'"><div class="print-actions"><button onclick="window.print()">Imprimer</button><strong>'+esc(title)+'</strong></div>'+body+qrcodeScript+'</body></html>');
        w.document.close();
    }

    async function generateRouteLabels(routeId, options){
        var data = await getPreparedRoute(routeId, options);
        var labels = [];
        data.groups.forEach(function(g){
            g.parcels.forEach(function(p){ labels.push(generateParcelLabel(p.order, p)); });
        });
        openPrintDoc('Étiquettes tournée ' + (data.route.nom || routeId), '<main class="sheet">'+labels.join('')+'</main>');
        return labels.length;
    }
    function listHtml(title, route, stops, sortKey){
        var sorted = stops.slice().sort(function(a,b){ return (a[sortKey] || 0) - (b[sortKey] || 0); });
        var rows = sorted.map(function(o){
            return '<tr><td><span class="pill">'+esc(o[sortKey] || '—')+'</span></td><td>'+esc(ref(o))+'</td><td>'+esc(o.stop_number || '—')+'</td><td>'+esc(o.loading_order || '—')+'</td><td>'+esc(o.service_level || serviceLevel(o))+'</td><td>'+esc(o.destinataire_nom || o.client_name || '—')+'<br><small>'+esc(o.delivery_address || '—')+'</small></td><td>'+esc(quantity(o))+'</td><td>'+esc(o.status || 'planned')+'</td></tr>';
        }).join('');
        return '<section class="list"><h1>'+esc(title)+'</h1><div>Tournée : <strong>'+esc(route.nom || route.id)+'</strong></div><table><thead><tr><th>Tri</th><th>Commande</th><th>Stop</th><th>Chargement</th><th>Service</th><th>Livraison</th><th>Colis</th><th>Statut</th></tr></thead><tbody>'+rows+'</tbody></table></section>';
    }
    async function generateDriverLoadingList(routeId, options){
        var data = await getPreparedRoute(routeId, options);
        openPrintDoc('Liste de chargement ' + (data.route.nom || routeId), listHtml('Liste de chargement chauffeur', data.route, data.stops, 'loading_order'));
        return data.stops;
    }
    async function generateDriverDeliveryList(routeId, options){
        var data = await getPreparedRoute(routeId, options);
        openPrintDoc('Liste de livraison ' + (data.route.nom || routeId), listHtml('Liste de livraison chauffeur', data.route, data.stops, 'stop_number'));
        return data.stops;
    }
    async function scanParcelForLoading(orderId, routeId){
        var wrong = await detectWrongRouteParcel(orderId, routeId);
        if(wrong.wrong) return wrong;
        var client = db();
        var res = await client.from('transport_orders_simple').update({ status:'loaded' }).eq('id', orderId).select('*').maybeSingle();
        if(res.error) throw res.error;
        return { ok:true, order:res.data };
    }
    async function detectWrongRouteParcel(orderId, routeId){
        var client = db();
        var res = await client.from('transport_orders_simple').select('id,order_number,tournee_id,status').eq('id', orderId).maybeSingle();
        if(res.error) throw res.error;
        if(!res.data) return { wrong:true, reason:'not_found' };
        if(String(res.data.tournee_id || '') !== String(routeId || '')) return { wrong:true, reason:'wrong_route', order:res.data };
        return { wrong:false, order:res.data };
    }
    async function detectMissingParcels(routeId){
        var stops = await getRouteStops(routeId);
        return stops.filter(function(o){ return ['loaded','out_for_delivery','delivered'].indexOf(o.status) < 0; });
    }
    async function validateLoadedParcels(routeId){
        var missing = await detectMissingParcels(routeId);
        return { ok:missing.length === 0, missing:missing, count:missing.length };
    }

    window.ColixoParcelLogistics = {
        statuses: PARCEL_STATUSES,
        calculateLoadingOrder: calculateLoadingOrder,
        groupParcelsByStop: groupParcelsByStop,
        generateParcelLabel: generateParcelLabel,
        generateRouteLabels: generateRouteLabels,
        generateDriverLoadingList: generateDriverLoadingList,
        generateDriverDeliveryList: generateDriverDeliveryList,
        scanParcelForLoading: scanParcelForLoading,
        validateLoadedParcels: validateLoadedParcels,
        detectMissingParcels: detectMissingParcels,
        detectWrongRouteParcel: detectWrongRouteParcel,
        getPreparedRoute: getPreparedRoute
    };
    window.generateParcelLabel = generateParcelLabel;
    window.generateRouteLabels = generateRouteLabels;
    window.calculateLoadingOrder = calculateLoadingOrder;
    window.groupParcelsByStop = groupParcelsByStop;
    window.generateDriverLoadingList = generateDriverLoadingList;
    window.generateDriverDeliveryList = generateDriverDeliveryList;
    window.scanParcelForLoading = scanParcelForLoading;
    window.validateLoadedParcels = validateLoadedParcels;
    window.detectMissingParcels = detectMissingParcels;
    window.detectWrongRouteParcel = detectWrongRouteParcel;
})();
