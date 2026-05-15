(function(){
    'use strict';

    var db = null;
    var state = {
        orders: [],
        regions: [],
        zones: [],
        postalZones: [],
        linehauls: [],
        partners: [],
        vehicles: [],
        pickupClients: [],
        pickupSchedules: [],
        pickups: [],
        routes: [],
        routeStops: [],
        suggestions: [],
        activeTab: 'orders',
        map: null,
        mapLayer: null
    };

    var REGION_FALLBACK = [
        { code:'ROM', name:'Suisse romande', base_lat:46.8006, base_lng:6.7416 },
        { code:'ALE', name:'Suisse alémanique', base_lat:47.3769, base_lng:8.5417 },
        { code:'TIC', name:'Tessin', base_lat:46.1956, base_lng:9.0238 },
        { code:'GRI', name:'Grisons', base_lat:46.8508, base_lng:9.5320 },
        { code:'NAT', name:'Zones industrielles nationales', base_lat:47.3497, base_lng:7.9033 }
    ];
    var ZONE_COLORS = {
        ROM_VD_GE:'#2563eb',
        ROM_NE_JU_FR:'#0891b2',
        ROM_VS:'#f59e0b',
        ALE_ZH_AG:'#7c3aed',
        ALE_BE_BS_BL_SO:'#d97706',
        ALE_OST:'#0ea5e9',
        TIC_MAIN:'#db2777',
        GRI_MAIN:'#64748b',
        NAT_INDUSTRIAL:'#111827'
    };
    var ZONE_FALLBACK = [
        { code:'ROM_VD_GE', region_code:'ROM', name:'Vaud / Genève', color_hex:ZONE_COLORS.ROM_VD_GE, service_24h:true, direct_colixo:true },
        { code:'ROM_NE_JU_FR', region_code:'ROM', name:'Neuchâtel / Jura / Fribourg', color_hex:ZONE_COLORS.ROM_NE_JU_FR, service_24h:true, direct_colixo:true },
        { code:'ROM_VS', region_code:'ROM', name:'Valais', color_hex:ZONE_COLORS.ROM_VS, service_24h:false, direct_colixo:false, default_partner_required:true },
        { code:'ALE_ZH_AG', region_code:'ALE', name:'Zurich / Argovie', color_hex:ZONE_COLORS.ALE_ZH_AG, service_24h:true, direct_colixo:false, default_partner_required:true },
        { code:'ALE_BE_BS_BL_SO', region_code:'ALE', name:'Berne / Bâle / Soleure', color_hex:ZONE_COLORS.ALE_BE_BS_BL_SO, service_24h:true, direct_colixo:false, default_partner_required:true },
        { code:'ALE_OST', region_code:'ALE', name:'Suisse orientale', color_hex:ZONE_COLORS.ALE_OST, service_24h:false, direct_colixo:false, default_partner_required:true },
        { code:'TIC_MAIN', region_code:'TIC', name:'Tessin', color_hex:ZONE_COLORS.TIC_MAIN, service_24h:false, direct_colixo:false, default_partner_required:true },
        { code:'GRI_MAIN', region_code:'GRI', name:'Grisons', color_hex:ZONE_COLORS.GRI_MAIN, service_24h:false, direct_colixo:false, default_partner_required:true }
    ];
    var POSTAL_FALLBACK = [
        [1000,1499,'ROM','ROM_VD_GE'], [1500,2999,'ROM','ROM_NE_JU_FR'],
        [3000,4999,'ALE','ALE_BE_BS_BL_SO'], [5000,5999,'ALE','ALE_ZH_AG'],
        [6000,6499,'ALE','ALE_OST'], [6500,6999,'TIC','TIC_MAIN'],
        [7000,7999,'GRI','GRI_MAIN'], [8000,8999,'ALE','ALE_ZH_AG'], [9000,9999,'ALE','ALE_OST']
    ].map(function(r){ return { postcode_from:r[0], postcode_to:r[1], region_code:r[2], zone_code:r[3] }; });

    function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    function safeColor(v){
        var c = String(v || '').trim();
        return /^#[0-9a-f]{6}$/i.test(c) ? c : '#ff8a00';
    }
    function zoneColor(code){
        var zone = (state.zones || []).find(function(z){ return z.code === code; }) || {};
        return safeColor(zone.color_hex || ZONE_COLORS[code] || '#ff8a00');
    }
    function routeColor(route){
        route = route || {};
        return safeColor(route.color_hex || zoneColor(route.zone_code || route.destination_zone_code || route.load_group));
    }
    function zoneBadge(code, label){
        var text = label || code || '—';
        var color = zoneColor(code);
        return '<span class="zone-badge" style="--zone-color:'+esc(color)+'"><span></span>'+esc(text)+'</span>';
    }
    function missingColumn(error, names){
        var msg = String(error && error.message || error || '');
        return names.some(function(name){ return msg.indexOf("'"+name+"'") >= 0 || msg.indexOf('"'+name+'"') >= 0 || msg.indexOf(name+' column') >= 0; });
    }
    function ref(o){ return o.order_number || o.external_reference || String(o.id || '').slice(0,8).toUpperCase(); }
    function todayIso(){ return new Date().toISOString().slice(0,10); }
    function parseDate(v){ return v ? new Date(v) : new Date(); }
    function service(o){ return String(o.service_level || o.service_type || o.speed || '48h').toLowerCase().replace('standard','48h').replace('prio','24h').replace('priority','24h'); }
    function qty(o){ var q=parseInt(o.parcel_count || o.quantity || o.nb_colis || 1,10); return isFinite(q)&&q>0?q:1; }
    function weight(o){ var n=parseFloat(o.weight_kg || o.weight || 0); return isFinite(n)?n:0; }
    function pickupQty(p){ var q=parseInt(p.estimated_parcels || p.parcel_count || 1,10); return isFinite(q)&&q>0?q:1; }
    function pickupRef(p){ return 'RAM-'+String(p.id || '').slice(0,8).toUpperCase(); }
    function pickupClientName(id){
        var row = (state.pickupClients || []).find(function(c){ return String(c.id) === String(id); });
        if(!row) return id ? 'Client '+String(id).slice(0,8) : 'Client non renseigné';
        return row.company_name || row.nom || row.name || row.email || 'Client';
    }
    function pickupDayIndex(date){ var d = date.getDay(); return d === 0 ? 7 : d; }
    function pickupDays(schedule){ return Array.isArray(schedule.days_of_week) ? schedule.days_of_week.map(Number).filter(Boolean) : []; }
    function pickupScheduleMatches(schedule, date){
        if(schedule.is_active === false) return false;
        if(schedule.frequency_type === 'daily') return true;
        return pickupDays(schedule).indexOf(pickupDayIndex(date)) >= 0;
    }
    function cleanTime(v){ return String(v || '').slice(0,5); }
    function pickupEndAt(p){
        if(!p.pickup_date || !p.time_window_end) return null;
        return new Date(p.pickup_date+'T'+cleanTime(p.time_window_end)+':00');
    }
    function pickupAlertCount(){
        var now = new Date();
        return (state.pickups || []).filter(function(p){
            var done = ['picked_up','failed','cancelled'].indexOf(String(p.status || '')) >= 0;
            if(done) return false;
            var end = pickupEndAt(p);
            return !p.assigned_driver_id || (end && end.getTime() < now.getTime()+45*60000);
        }).length;
    }
    function toast(msg, ok){
        var el = document.getElementById('toast');
        if(!el) return;
        el.textContent = msg;
        el.style.color = ok === false ? '#fca5a5' : '#fff';
        el.classList.add('show');
        clearTimeout(toast._t);
        toast._t = setTimeout(function(){ el.classList.remove('show'); }, 4200);
    }
    async function safeSelect(table, fallback, query){
        try{
            var q = db.from(table).select('*');
            if(query) q = query(q);
            var res = await q;
            if(res.error) throw res.error;
            return res.data || fallback || [];
        }catch(e){
            console.warn('[dispatch-national] '+table, e.message || e);
            return fallback || [];
        }
    }
    async function safeFirstAvailable(sources){
        for(var i=0;i<sources.length;i++){
            var src = sources[i];
            try{
                var q = db.from(src.table).select('*');
                if(src.query) q = src.query(q);
                var res = await q;
                if(res.error) throw res.error;
                if((res.data || []).length || i === sources.length - 1){
                    return (res.data || []).map(src.normalize || function(r){ return r; });
                }
            }catch(e){
                console.warn('[dispatch-national] '+src.table, e.message || e);
            }
        }
        return [];
    }
    function normalizePickupClient(row){
        var r = Object.assign({}, row || {});
        r.company_name = r.company_name || r.nom || r.name || r.raison_sociale || r.email || 'Client';
        return r;
    }
    function nextBusinessDay(date){
        var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        d.setDate(d.getDate()+1);
        while(d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate()+1);
        return d;
    }
    function addBusinessHours(date, hours){
        var d = new Date(date);
        d.setHours(18,0,0,0);
        if(hours <= 24) return d;
        var extraDays = Math.ceil((hours - 24) / 24);
        while(extraDays > 0){
            d.setDate(d.getDate()+1);
            if(d.getDay() !== 0 && d.getDay() !== 6) extraDays--;
        }
        return d;
    }
    function extractPostcode(address){
        var m = String(address || '').match(/\b([1-9]\d{3})\b/);
        return m ? m[1] : '';
    }
    function haversine(a,b){
        if(!a || !b || a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
        var R=6371, dLat=(b.lat-a.lat)*Math.PI/180, dLng=(b.lng-a.lng)*Math.PI/180;
        var s1=Math.sin(dLat/2), s2=Math.sin(dLng/2);
        var aa=s1*s1+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*s2*s2;
        return 2*R*Math.atan2(Math.sqrt(aa),Math.sqrt(1-aa));
    }

    function normalizeSwissPostcode(value){
        var m = String(value || '').match(/\b([1-9]\d{3})\b/);
        return m ? m[1] : null;
    }

    function findPostalZone(postcode){
        var pc = parseInt(normalizeSwissPostcode(postcode), 10);
        if(!pc) return null;
        return (state.postalZones || []).find(function(z){
            var from = parseInt(z.postcode_from,10), to = parseInt(z.postcode_to,10);
            return pc >= from && pc <= to;
        }) || null;
    }

    function assignOriginAndDestinationZones(order){
        var pickupPc = normalizeSwissPostcode(order.pickup_postcode || order.pickup_postal || order.pickup_npa || order.pickup_zip || extractPostcode(order.pickup_address));
        var deliveryPc = normalizeSwissPostcode(order.delivery_postcode || order.delivery_postal || order.delivery_npa || order.delivery_zip || extractPostcode(order.delivery_address));
        var origin = findPostalZone(pickupPc);
        var dest = findPostalZone(deliveryPc);
        return Object.assign({}, order, {
            pickup_postcode: pickupPc || order.pickup_postcode || '',
            delivery_postcode: deliveryPc || order.delivery_postcode || '',
            service_level: service(order),
            origin_region_code: order.origin_region_code || (origin && origin.region_code) || 'ROM',
            destination_region_code: order.destination_region_code || (dest && dest.region_code) || 'ROM',
            origin_zone_code: order.origin_zone_code || (origin && origin.zone_code) || '',
            destination_zone_code: order.destination_zone_code || (dest && dest.zone_code) || ''
        });
    }

    function calculateLatestDeliveryDate(order){
        var pickup = parseDate(order.pickup_date || order.created_at || Date.now());
        var start = nextBusinessDay(pickup);
        var lvl = service(order);
        if(lvl === 'express') return addBusinessHours(start, 12);
        if(lvl === '24h') return addBusinessHours(start, 24);
        return addBusinessHours(start, 48);
    }

    function calculatePriorityScore(order){
        var score = 10;
        var lvl = service(order);
        if(lvl === '24h') score += 35;
        if(lvl === 'express') score += 70;
        var latest = order.latest_delivery_date ? new Date(order.latest_delivery_date) : calculateLatestDeliveryDate(order);
        var hoursLeft = (latest.getTime() - Date.now()) / 36e5;
        if(hoursLeft < 0) score += 100;
        else if(hoursLeft < 8) score += 55;
        else if(hoursLeft < 18) score += 25;
        if(order.destination_region_code !== order.origin_region_code) score += 10;
        return Math.round(score);
    }

    function groupBy(list, keyFn){
        return (list || []).reduce(function(acc, row){
            var k = keyFn(row) || 'INCONNU';
            if(!acc[k]) acc[k] = [];
            acc[k].push(row);
            return acc;
        }, {});
    }
    function groupOrdersByDestinationRegion(orders){ return groupBy(orders, function(o){ return o.destination_region_code; }); }
    function groupOrdersByDestinationZone(orders){ return groupBy(orders, function(o){ return o.destination_zone_code; }); }

    function findAvailableLinehaul(originRegion, destinationRegion, serviceLevel){
        return (state.linehauls || []).find(function(l){
            var levels = l.service_levels || [];
            return l.active !== false
                && l.origin_region_code === originRegion
                && l.destination_region_code === destinationRegion
                && (!levels.length || levels.indexOf(serviceLevel) >= 0 || levels.indexOf('48h') >= 0);
        }) || null;
    }

    function findAvailablePartner(destinationZone, serviceLevel){
        return (state.partners || []).find(function(p){
            var zones = p.zone_codes || [];
            var levels = p.service_levels || [];
            return p.active !== false
                && zones.indexOf(destinationZone) >= 0
                && (!levels.length || levels.indexOf(serviceLevel) >= 0 || (serviceLevel === '48h' && levels.indexOf('standard') >= 0));
        }) || null;
    }

    function suggestDispatchDecision(order){
        var o = assignOriginAndDestinationZones(order);
        o.latest_delivery_date = o.latest_delivery_date || calculateLatestDeliveryDate(o).toISOString();
        o.priority_score = calculatePriorityScore(o);
        var zone = state.zones.find(function(z){ return z.code === o.destination_zone_code; }) || {};
        var lvl = service(o);
        if(lvl === 'express'){
            if(zone.service_express !== true){
                return { type:'manual_express', label:'Express non couvert', reason:'Express non activé sur cette zone', order:o, requires_admin:true };
            }
            if(zone.direct_colixo === true && zone.default_partner_required !== true){
                return { type:'local_route', label:'Colixo direct express', reason:'Zone express livrée par Colixo, validation dispatch obligatoire', order:o, requires_admin:true };
            }
            var expressPartner = findAvailablePartner(o.destination_zone_code, 'express');
            if(expressPartner){
                return { type:'partner', label:'Transporteur express', reason:'Express couvert par '+expressPartner.name+', validation dispatch obligatoire', order:o, partner:expressPartner, requires_admin:true };
            }
            return { type:'manual_express', label:'Express à valider', reason:'Zone express active mais aucun transporteur configuré', order:o, requires_admin:true };
        }
        if(lvl === '24h' && zone.service_24h === false){
            return { type:'manual', label:'24h non couvert', reason:'24h non activé sur cette zone', order:o, requires_admin:true };
        }
        if(o.origin_region_code === o.destination_region_code && zone.direct_colixo !== false){
            return { type:'local_route', label:'Tournée locale', reason:'Origine et destination dans la même région', order:o };
        }
        var linehaul = findAvailableLinehaul(o.origin_region_code, o.destination_region_code, lvl);
        if(linehaul){
            return { type:'linehaul', label:'Ligne nationale', reason:'Ligne disponible '+linehaul.name, order:o, linehaul:linehaul };
        }
        var partner = findAvailablePartner(o.destination_zone_code, lvl);
        if(partner){
            return { type:'partner', label:'Partenaire régional', reason:'Zone couverte par '+partner.name, order:o, partner:partner };
        }
        return { type:'manual', label:'Décision manuelle', reason:'Aucune ligne ou partenaire configuré', order:o, requires_admin:true };
    }

    function suggestNationalRoutes(){
        var decisions = state.orders.map(suggestDispatchDecision);
        state.suggestions = decisions;
        return {
            local: groupBy(decisions.filter(function(d){ return d.type === 'local_route'; }), function(d){ return d.order.destination_zone_code; }),
            linehaul: groupBy(decisions.filter(function(d){ return d.type === 'linehaul'; }), function(d){ return d.order.origin_region_code+'>'+d.order.destination_region_code; }),
            partner: groupBy(decisions.filter(function(d){ return d.type === 'partner'; }), function(d){ return d.partner && d.partner.id; }),
            manual: decisions.filter(function(d){ return d.requires_admin; })
        };
    }

    async function loadPendingOrders(){
        var rows = await safeSelect('transport_orders_simple', [], function(q){
            return q.in('status', ['pending','planned','ready_to_load']).order('created_at', { ascending:false }).limit(800);
        });
        state.orders = rows.map(function(o){
            var withZones = assignOriginAndDestinationZones(o);
            withZones.latest_delivery_date = withZones.latest_delivery_date || calculateLatestDeliveryDate(withZones).toISOString();
            withZones.priority_score = withZones.priority_score || calculatePriorityScore(withZones);
            return withZones;
        });
        return state.orders;
    }

    function pickupPayloadFromSchedule(schedule, dateIso){
        var pc = normalizeSwissPostcode(schedule.pickup_address || '');
        var zone = findPostalZone(pc) || {};
        return {
            schedule_id:schedule.id,
            client_id:schedule.client_id || null,
            pickup_date:dateIso,
            pickup_address:schedule.pickup_address,
            pickup_postcode:pc || null,
            pickup_city:schedule.pickup_city || '',
            pickup_lat:schedule.pickup_lat || null,
            pickup_lng:schedule.pickup_lng || null,
            origin_region_code:zone.region_code || null,
            origin_zone_code:zone.zone_code || null,
            contact_name:schedule.contact_name || null,
            contact_phone:schedule.contact_phone || null,
            time_window_start:schedule.time_window_start,
            time_window_end:schedule.time_window_end,
            estimated_parcels:schedule.estimated_parcels || 1,
            estimated_weight_kg:schedule.estimated_weight_kg || 0,
            package_type:schedule.package_type || 'colis',
            priority:schedule.priority || 'normal',
            driver_notes:schedule.driver_notes || null,
            source:'recurring',
            badge:'RAMASSE RECURRENTE',
            status:'pending',
            dispatch_status:'pending'
        };
    }

    async function ensureTodayPickups(){
        var date = todayIso();
        var today = new Date(date+'T12:00:00');
        var schedules = (state.pickupSchedules || []).filter(function(s){ return pickupScheduleMatches(s, today); });
        if(!schedules.length) return 0;
        var existing = await safeSelect('pickups', [], function(q){ return q.eq('pickup_date', date).limit(2000); });
        var existingBySchedule = {};
        existing.forEach(function(p){ if(p.schedule_id) existingBySchedule[p.schedule_id] = true; });
        var payloads = schedules.filter(function(s){ return !existingBySchedule[s.id]; }).map(function(s){ return pickupPayloadFromSchedule(s, date); });
        if(!payloads.length) return 0;
        var res = await db.from('pickups').insert(payloads);
        if(res.error) {
            console.warn('[dispatch-national] pickups insert', res.error.message || res.error);
            return 0;
        }
        return payloads.length;
    }

    async function loadPickupData(){
        state.pickupClients = await safeFirstAvailable([
            { table:'clients', query:function(q){ return q.limit(3000); }, normalize:normalizePickupClient },
            { table:'entreprises', query:function(q){ return q.limit(3000); }, normalize:normalizePickupClient }
        ]);
        state.pickupSchedules = await safeSelect('pickup_schedules', [], function(q){ return q.limit(3000); });
        await ensureTodayPickups();
        state.pickups = await safeSelect('pickups', [], function(q){
            return q.eq('pickup_date', todayIso()).neq('status', 'cancelled').order('time_window_start', { ascending:true }).limit(2000);
        });
        return state.pickups;
    }

    async function createLocalRouteFromZone(zoneCode){
        var orders = state.orders.filter(function(o){ return o.destination_zone_code === zoneCode; });
        var pickups = state.pickups.filter(function(p){ return (p.origin_zone_code || '') === zoneCode && !p.assigned_route_id; });
        if(!orders.length && !pickups.length) throw new Error('Aucun colis ou ramasse pour la zone '+zoneCode);
        var zone = state.zones.find(function(z){ return z.code === zoneCode; }) || {};
        var firstTask = orders[0] || pickups[0] || {};
        var routePayload = {
            name:'Route '+zoneCode+' '+todayIso(),
            route_type:'local',
            route_date:todayIso(),
            origin_region_code:firstTask.origin_region_code || firstTask.destination_region_code || zone.region_code || 'ROM',
            destination_region_code:firstTask.destination_region_code || firstTask.origin_region_code || zone.region_code || 'ROM',
            zone_code:zoneCode,
            color_hex:zoneColor(zoneCode),
            dispatch_status:'draft',
            optimization_mode:'regional',
            base_lat:zone.center_lat || null,
            base_lng:zone.center_lng || null
        };
        var fullRoutePayload = Object.assign({}, routePayload);
        var insert = await db.from('routes').insert([routePayload]).select('*').single();
        if(insert.error && missingColumn(insert.error, ['origin_region_code','destination_region_code','zone_code','color_hex','dispatch_status','optimization_mode','base_lat','base_lng'])){
            routePayload = {
                name:fullRoutePayload.name,
                route_type:fullRoutePayload.route_type,
                route_date:fullRoutePayload.route_date
            };
            insert = await db.from('routes').insert([routePayload]).select('*').single();
        }
        if(insert.error && missingColumn(insert.error, ['route_type','route_date'])){
            routePayload = { name:fullRoutePayload.name };
            insert = await db.from('routes').insert([routePayload]).select('*').single();
        }
        if(insert.error) throw insert.error;
        insert.data = Object.assign({}, fullRoutePayload, insert.data || {});
        if(orders.length){
            await db.from('transport_orders_simple').update({
                assigned_route_id:insert.data.id,
                dispatch_status:'route_suggested',
                dispatch_decision:{ type:'local_route', zone_code:zoneCode, route_id:insert.data.id }
            }).in('id', orders.map(function(o){ return o.id; }));
        }
        if(pickups.length){
            await db.from('pickups').update({
                assigned_route_id:insert.data.id,
                dispatch_status:'route_suggested',
                status:'planned'
            }).in('id', pickups.map(function(p){ return p.id; }));
        }
        await generateRouteStops(insert.data.id);
        toast('Tournée locale créée pour '+zoneCode, true);
        await refreshAll();
        return insert.data;
    }

    async function createLinehaulBatch(originRegion, destinationRegion){
        var orders = state.orders.filter(function(o){ return o.origin_region_code === originRegion && o.destination_region_code === destinationRegion; });
        var linehaul = findAvailableLinehaul(originRegion, destinationRegion, '48h');
        if(!linehaul) throw new Error('Aucune ligne nationale configurée');
        await db.from('transport_orders_simple').update({
            assigned_linehaul_id:linehaul.id,
            dispatch_status:'linehaul_suggested',
            dispatch_decision:{ type:'linehaul', linehaul_id:linehaul.id, origin_region:originRegion, destination_region:destinationRegion }
        }).in('id', orders.map(function(o){ return o.id; }));
        toast('Lot ligne nationale proposé', true);
        await refreshAll();
        return { linehaul:linehaul, orders:orders };
    }

    async function assignOrdersToPartner(partnerId, orders){
        var ids = (orders || []).map(function(o){ return typeof o === 'string' ? o : o.id; });
        if(!partnerId || !ids.length) throw new Error('Partenaire ou colis manquant');
        var res = await db.from('transport_orders_simple').update({
            assigned_partner_id:partnerId,
            dispatch_status:'partner_assigned',
            dispatch_decision:{ type:'partner', partner_id:partnerId, validated_by:'admin' }
        }).in('id', ids);
        if(res.error) throw res.error;
        toast(ids.length+' colis affecté(s) au partenaire', true);
        await refreshAll();
    }

    async function assignVehicleToRoute(routeId, vehicleId){
        var res = await db.from('routes').update({ vehicle_id:vehicleId, dispatch_status:'vehicle_assigned' }).eq('id', routeId);
        if(res.error) throw res.error;
        toast('Véhicule affecté à la route', true);
        await refreshAll();
    }

    async function generateRouteStops(routeId){
        var route = state.routes.find(function(r){ return r.id === routeId; }) || {};
        if(!route.id){
            var routeRes = await db.from('routes').select('*').eq('id', routeId).maybeSingle();
            if(routeRes.error) throw routeRes.error;
            route = routeRes.data || {};
        }
        var orders = state.orders.filter(function(o){ return o.assigned_route_id === routeId || o.destination_zone_code === route.zone_code; });
        var pickups = state.pickups.filter(function(p){ return p.assigned_route_id === routeId || p.origin_zone_code === route.zone_code; });
        var color = routeColor(route);
        var deliveryStops = orders.map(function(o){ return {
            route_id:routeId,
            order_id:o.id,
            order_table:'transport_orders_simple',
            stop_type:'delivery',
            service_level:service(o),
            address:o.delivery_address,
            postcode:o.delivery_postcode,
            city:o.delivery_city,
            recipient_name:o.destinataire_nom || o.client_name,
            parcel_count:qty(o),
            lat:o.delivery_lat,
            lng:o.delivery_lng,
            status:'planned',
            load_group:o.destination_zone_code || route.zone_code || 'default',
            zone_code:o.destination_zone_code || route.zone_code || null,
            logistics_zone:o.destination_zone_code || route.zone_code || 'default',
            color_hex:color || zoneColor(o.destination_zone_code || route.zone_code)
        }; });
        var pickupStops = pickups.map(function(p){ return {
            route_id:routeId,
            order_id:p.id,
            order_table:'pickups',
            pickup_id:p.id,
            stop_type:'pickup',
            service_level:p.priority || 'pickup',
            address:p.pickup_address,
            postcode:p.pickup_postcode,
            city:p.pickup_city,
            recipient_name:pickupClientName(p.client_id),
            parcel_count:pickupQty(p),
            lat:p.pickup_lat,
            lng:p.pickup_lng,
            status:'planned',
            load_group:p.origin_zone_code || route.zone_code || 'pickup',
            zone_code:p.origin_zone_code || route.zone_code || null,
            logistics_zone:p.origin_zone_code || route.zone_code || 'pickup',
            color_hex:'#f97316',
            time_window_start:p.time_window_start,
            time_window_end:p.time_window_end
        }; });
        var stops = calculateLoadOrder(deliveryStops.concat(pickupStops));
        await db.from('route_stops').delete().eq('route_id', routeId);
        if(stops.length){
            var res = await db.from('route_stops').insert(stops);
            if(res.error && missingColumn(res.error, ['zone_code','logistics_zone','color_hex','stop_type','pickup_id','time_window_start','time_window_end'])){
                var compatible = stops.map(function(s){
                    var copy = Object.assign({}, s);
                    delete copy.zone_code;
                    delete copy.logistics_zone;
                    delete copy.color_hex;
                    delete copy.stop_type;
                    delete copy.pickup_id;
                    delete copy.time_window_start;
                    delete copy.time_window_end;
                    return copy;
                });
                res = await db.from('route_stops').insert(compatible);
            }
            if(res.error) throw res.error;
            if(pickups.length){
                await db.from('pickups').update({ status:'planned', dispatch_status:'route_suggested', assigned_route_id:routeId }).in('id', pickups.map(function(p){ return p.id; }));
            }
        }
        return stops;
    }

    function calculateLoadOrder(routeStops){
        var base = { lat:46.8006, lng:6.7416 };
        var ordered = (routeStops || []).slice().sort(function(a,b){
            var ad = haversine(base, { lat:a.lat, lng:a.lng }) || 0;
            var bd = haversine(base, { lat:b.lat, lng:b.lng }) || 0;
            return bd - ad;
        });
        var total = ordered.length;
        return ordered.map(function(s,i){
            return Object.assign({}, s, {
                stop_number:i+1,
                loading_order:total-i,
                qr_token:(s.order_id || '')+'-'+(i+1)+'-'+Date.now().toString(36)
            });
        });
    }

    function getDriverCurrentPosition(){
        return new Promise(function(resolve){
            if(!navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(function(pos){
                resolve({ lat:pos.coords.latitude, lng:pos.coords.longitude, accuracy:pos.coords.accuracy });
            }, function(){ resolve(null); }, { enableHighAccuracy:true, timeout:6000, maximumAge:30000 });
        });
    }

    async function calculateLiveETA(routeId){
        var stops = (state.routeStops || []).filter(function(s){ return s.route_id === routeId && ['delivered','failed','returned'].indexOf(s.status) < 0; });
        var min = stops.length * 18;
        return { route_id:routeId, remaining_stops:stops.length, estimated_minutes:min, eta_at:new Date(Date.now()+min*60000).toISOString() };
    }

    async function detectTrafficDelay(routeId){
        var eta = await calculateLiveETA(routeId);
        var planned = eta.remaining_stops * 14;
        var delay = eta.estimated_minutes - planned;
        return { route_id:routeId, delay_minutes:Math.max(0, delay), significant:delay >= 12 };
    }

    async function suggestRouteReoptimization(routeId){
        var delay = await detectTrafficDelay(routeId);
        if(!delay.significant) return { proposed:false, reason:'Gain inférieur au seuil', delay:delay };
        var route = state.routes.find(function(r){ return r.id === routeId; });
        if(route && (route.order_locked || route.reoptimization_blocked)) return { proposed:false, reason:'Ordre verrouillé par dispatch', delay:delay };
        var stops = (state.routeStops || []).filter(function(s){ return s.route_id === routeId; });
        var byGroup = groupBy(stops, function(s){ return s.load_group || 'default'; });
        var group = Object.keys(byGroup).sort(function(a,b){ return byGroup[b].length - byGroup[a].length; })[0];
        var reordered = await reorderStopsWithinLoadGroup(routeId, group);
        return { proposed:true, gain_minutes:Math.min(25, delay.delay_minutes), load_group:group, stops:reordered, delay:delay };
    }

    async function reorderStopsWithinLoadGroup(routeId, loadGroup){
        var stops = (state.routeStops || []).filter(function(s){ return s.route_id === routeId; });
        var target = stops.filter(function(s){ return (s.load_group || 'default') === (loadGroup || 'default') && ['delivered','failed','returned'].indexOf(s.status) < 0; });
        target.sort(function(a,b){
            var as = service(a) === 'express' ? -2 : service(a) === '24h' ? -1 : 0;
            var bs = service(b) === 'express' ? -2 : service(b) === '24h' ? -1 : 0;
            return as - bs || (a.stop_number || 0) - (b.stop_number || 0);
        });
        return target.map(function(s,i){ return Object.assign({}, s, { proposed_stop_number:i+1 }); });
    }

    async function validateReoptimizationImpact(routeId){
        var proposal = await suggestRouteReoptimization(routeId);
        if(!proposal.proposed) return Object.assign({ ok:false }, proposal);
        var risky = proposal.stops.filter(function(s){
            var order = state.orders.find(function(o){ return o.id === s.order_id; });
            return order && service(order) !== '48h' && new Date(order.latest_delivery_date || calculateLatestDeliveryDate(order)).getTime() < Date.now()+60*60000;
        });
        return { ok:risky.length === 0, proposal:proposal, risky:risky };
    }

    async function notifyDriverReoptimization(routeId){
        var impact = await validateReoptimizationImpact(routeId);
        var route = state.routes.find(function(r){ return r.id === routeId; });
        if(route){
            await db.from('routes').update({ reoptimization_pending:impact, estimated_gain_min:impact.proposal && impact.proposal.gain_minutes }).eq('id', routeId);
        }
        toast(impact.ok ? 'Proposition envoyée au chauffeur' : 'Réoptimisation à valider manuellement', impact.ok);
        return impact;
    }

    async function acceptReoptimizedRoute(routeId){
        var impact = await validateReoptimizationImpact(routeId);
        if(!impact.ok) throw new Error('Impact non valide pour les délais prioritaires');
        for(var i=0;i<impact.proposal.stops.length;i++){
            await db.from('route_stops').update({ stop_number:impact.proposal.stops[i].proposed_stop_number }).eq('id', impact.proposal.stops[i].id);
        }
        await db.from('routes').update({ reoptimization_pending:{}, dispatch_status:'reoptimized' }).eq('id', routeId);
        await refreshAll();
        return true;
    }

    async function rejectReoptimizedRoute(routeId){
        await db.from('routes').update({ reoptimization_pending:{ rejected_at:new Date().toISOString() } }).eq('id', routeId);
        toast('Réoptimisation refusée', true);
    }

    async function lockRouteOrder(routeId){
        await db.from('routes').update({ order_locked:true, reoptimization_blocked:true }).eq('id', routeId);
        toast('Ordre de route verrouillé', true);
        await refreshAll();
    }

    async function refreshAll(){
        await loadReferenceData();
        await loadPendingOrders();
        await loadPickupData();
        state.routes = await safeSelect('routes', []);
        state.routeStops = await safeSelect('route_stops', []);
        suggestNationalRoutes();
        renderNationalDispatchDashboard();
        renderRegionOverview();
    }

    async function loadReferenceData(){
        state.regions = await safeSelect('logistics_regions', REGION_FALLBACK);
        state.zones = await safeSelect('logistics_zones', ZONE_FALLBACK);
        state.postalZones = await safeSelect('postal_zones', POSTAL_FALLBACK);
        state.linehauls = await safeSelect('linehauls', []);
        state.partners = await safeSelect('delivery_partners', []);
        state.vehicles = await safeSelect('vehicles', []);
    }

    function renderNationalDispatchDashboard(){
        var orders = state.orders;
        var byRegion = groupOrdersByDestinationRegion(orders);
        var byZone = groupOrdersByDestinationZone(orders);
        var risky = orders.filter(function(o){ return new Date(o.latest_delivery_date).getTime() < Date.now()+12*36e5; });
        var kpis = [
            [orders.length, 'Colis en attente'],
            [Object.keys(byRegion).length, 'Régions'],
            [Object.keys(byZone).length, 'Zones'],
            [orders.filter(function(o){return service(o)==='48h';}).length, '48h'],
            [orders.filter(function(o){return service(o)==='24h';}).length, '24h'],
            [orders.filter(function(o){return service(o)==='express';}).length, 'Express'],
            [state.pickups.length, 'Ramasses'],
            [pickupAlertCount(), 'Alertes ramasse'],
            [risky.length, 'Proches délai']
        ];
        document.getElementById('kpis').innerHTML = kpis.map(function(k){ return '<div class="kpi"><b>'+k[0]+'</b><span>'+esc(k[1])+'</span></div>'; }).join('');
        renderActiveTab();
        renderRouteMap();
    }

    function renderRegionOverview(){
        var byRegion = groupOrdersByDestinationRegion(state.orders);
        var codes = state.regions.map(function(r){ return r.code; });
        Object.keys(byRegion).forEach(function(code){ if(codes.indexOf(code) < 0) codes.push(code); });
        var html = codes.map(function(code){
            var reg = state.regions.find(function(r){ return r.code === code; }) || { name:code };
            var zones = state.zones.filter(function(z){ return z.region_code === code; });
            var count = byRegion[code] ? byRegion[code].length : 0;
            return '<div class="rec-card"><div class="rec-head"><div><div class="rec-title">'+esc(reg.name)+'</div><div class="rec-meta">'+code+' · '+count+' colis · '+zones.length+' zone(s)</div></div><span class="pill p-national">'+code+'</span></div>'
                +'<div class="mini-tags">'+zones.map(function(z){ return zoneBadge(z.code); }).join('')+'</div></div>';
        }).join('') || '<div class="empty">Aucune région configurée.</div>';
        var el = document.getElementById('regionOverview');
        if(el) el.innerHTML = html;
    }

    function renderOpsOverview(){
        var serviceCards = [
            ['48h', 'Livraison 48h depuis le jour ouvrable suivant la prise en charge.', 'p-48h'],
            ['24h', 'Prioritaire si la zone, la ligne et le cut-off le permettent.', 'p-24h'],
            ['Express', 'Alerte rouge avec validation manuelle dispatch obligatoire.', 'p-express']
        ].map(function(c){
            return '<div class="overview-card"><span class="pill '+c[2]+'">'+c[0]+'</span><strong>'+c[0]+'</strong><p>'+c[1]+'</p></div>';
        }).join('');
        var networkCards = [
            [state.regions.length, 'Régions nationales', 'Suisse romande, alémanique, Tessin, Grisons, zones industrielles.'],
            [state.zones.length, 'Zones logistiques', 'Chaque NPA est rattaché à une zone de livraison.'],
            [state.postalZones.length, 'Règles NPA', 'Plages de codes postaux suisses prêtes pour le routage.'],
            [state.linehauls.length, 'Lignes nationales', 'À compléter avec les transferts inter-régions réels.'],
            [state.partners.length, 'Partenaires', 'À connecter pour les zones non couvertes Colixo.'],
            [state.vehicles.length, 'Véhicules', 'Affectation aux routes locales et nationales.']
        ].map(function(c){
            return '<div class="setup-card"><b>'+c[0]+'</b><strong>'+c[1]+'</strong><span>'+c[2]+'</span></div>';
        }).join('');
        return '<div class="overview">'
            +'<div class="overview-hero"><div><div class="hero-kicker">Centre de contrôle national</div><h2>Le moteur est prêt, il attend des colis à dispatcher.</h2><p>Quand HGC ou un autre client crée des colis, cette page classera les commandes par NPA, région, zone, délai et solution recommandée. Les ramasses récurrentes du jour remontent aussi dans cette dispatch.</p></div><div class="hero-actions"><a class="btn btn-red" href="transports-dispatch.html">Voir transports</a><a class="btn btn-orange" href="pickups.html">Ramasses récurrentes</a><a class="btn btn-green" href="national-config.html">Configurer réseau</a><a class="btn btn-ghost" href="../commandes-client.html">Commandes client</a></div></div>'
            +'<div class="overview-section"><h3>Règles de service</h3><div class="overview-grid">'+serviceCards+'</div></div>'
            +'<div class="overview-section"><h3>État du réseau</h3><div class="setup-grid">'+networkCards+'</div></div>'
            +'<div class="overview-section"><h3>Flux prévu</h3><div class="flow-steps"><span>Colis client</span><i class="fas fa-arrow-right"></i><span>NPA</span><i class="fas fa-arrow-right"></i><span>Région / zone</span><i class="fas fa-arrow-right"></i><span>Tournée, ligne ou partenaire</span><i class="fas fa-arrow-right"></i><span>Validation admin</span></div></div>'
            +'</div>';
    }

    function renderOrders(){
        if(!state.orders.length && !state.pickups.length) return renderOpsOverview();
        var pickupRows = state.pickups.map(function(p){
            var end = pickupEndAt(p);
            var risk = end && end.getTime() < Date.now()+45*60000 && ['picked_up','failed','cancelled'].indexOf(String(p.status || '')) < 0;
            return '<tr class="pickup-row"><td><strong>'+esc(pickupRef(p))+'</strong><br><span class="pill p-pickup">RAMASSE RÉCURRENTE</span></td><td><span class="pill p-pickup">'+esc(p.priority || 'pickup')+'</span></td><td>'+esc(p.origin_region_code || '—')+'<br><span class="muted">'+esc(p.pickup_postcode || '')+'</span></td><td>Ramasse<br><span class="muted">'+esc(cleanTime(p.time_window_start))+'-'+esc(cleanTime(p.time_window_end))+'</span></td><td>'+zoneBadge(p.origin_zone_code)+'</td><td class="'+(risk?'risk':'')+'">'+esc(cleanTime(p.time_window_end) || '—')+'</td><td><span class="pill p-pickup">Ramasse du jour</span><br><span class="muted">'+esc(pickupClientName(p.client_id))+' · '+esc(pickupQty(p))+' colis estimés</span></td><td><a class="btn btn-ghost btn-sm" href="pickups.html">Ouvrir</a></td></tr>';
        }).join('');
        return '<table><thead><tr><th>Commande</th><th>Service</th><th>Origine</th><th>Destination</th><th>Zone</th><th>Délai</th><th>Décision suggérée</th><th>Actions</th></tr></thead><tbody>'
            + pickupRows
            + state.orders.map(function(o){
                var d = suggestDispatchDecision(o);
                var cls = service(o)==='express'?'p-express':service(o)==='24h'?'p-24h':'p-48h';
                var risk = new Date(o.latest_delivery_date).getTime() < Date.now()+12*36e5;
                return '<tr><td><strong>'+esc(ref(o))+'</strong><br><span class="muted">'+esc(o.destinataire_nom || o.client_name || '')+'</span></td><td><span class="pill '+cls+'">'+esc(service(o))+'</span></td><td>'+esc(o.origin_region_code)+'<br><span class="muted">'+esc(o.pickup_postcode || '')+'</span></td><td>'+esc(o.destination_region_code)+'<br><span class="muted">'+esc(o.delivery_postcode || '')+'</span></td><td>'+zoneBadge(o.destination_zone_code)+'</td><td class="'+(risk?'risk':'')+'">'+new Date(o.latest_delivery_date).toLocaleString('fr-CH')+'</td><td><span class="pill '+(service(o)==='express'?'p-express':d.type==='local_route'?'p-local':d.type==='partner'?'p-partner':d.type==='linehaul'?'p-national':'p-express')+'">'+esc(d.label)+'</span><br><span class="muted">'+esc(d.reason)+'</span></td><td><button class="btn btn-ghost btn-sm" onclick="window.dispatchNationalManualDecision(&quot;'+esc(o.id)+'&quot;)">Modifier</button></td></tr>';
            }).join('') + '</tbody></table>';
    }

    function renderRecommendations(){
        var grouped = suggestNationalRoutes();
        var parts = [];
        var pickupsByZone = groupBy(state.pickups.filter(function(p){ return p.origin_zone_code && !p.assigned_route_id && ['pending','planned','assigned'].indexOf(String(p.status || 'pending')) >= 0; }), function(p){ return p.origin_zone_code; });
        Object.keys(pickupsByZone).forEach(function(zone){
            parts.push('<div class="rec-card colored-card" style="--zone-color:#f97316"><div class="rec-head"><div><div class="rec-title">Ramasses récurrentes '+zoneBadge(zone)+'</div><div class="rec-meta">'+pickupsByZone[zone].length+' ramasse(s) · fenêtres horaires à respecter</div></div><button class="btn btn-orange btn-sm" onclick="createLocalRouteFromZone(&quot;'+esc(zone)+'&quot;)">Créer tournée</button></div></div>');
        });
        Object.keys(grouped.local).forEach(function(zone){
            parts.push('<div class="rec-card colored-card" style="--zone-color:'+esc(zoneColor(zone))+'"><div class="rec-head"><div><div class="rec-title">Tournée locale '+zoneBadge(zone)+'</div><div class="rec-meta">'+grouped.local[zone].length+' colis · validation admin</div></div><button class="btn btn-green btn-sm" onclick="createLocalRouteFromZone(&quot;'+esc(zone)+'&quot;)">Créer tournée</button></div></div>');
        });
        Object.keys(grouped.linehaul).forEach(function(key){
            var p = key.split('>');
            parts.push('<div class="rec-card"><div class="rec-head"><div><div class="rec-title">Ligne nationale '+esc(key)+'</div><div class="rec-meta">'+grouped.linehaul[key].length+' colis · consolidation nationale</div></div><button class="btn btn-blue btn-sm" onclick="createLinehaulBatch(&quot;'+esc(p[0])+'&quot;,&quot;'+esc(p[1])+'&quot;)">Créer lot</button></div></div>');
        });
        Object.keys(grouped.partner).forEach(function(pid){
            var partner = state.partners.find(function(p){ return p.id === pid; }) || { name:'Partenaire' };
            var ids = grouped.partner[pid].map(function(d){ return d.order.id; }).join(',');
            parts.push('<div class="rec-card"><div class="rec-head"><div><div class="rec-title">'+esc(partner.name)+'</div><div class="rec-meta">'+grouped.partner[pid].length+' colis · partenaire régional</div></div><button class="btn btn-ghost btn-sm" onclick="dispatchNationalAssignPartner(&quot;'+esc(pid)+'&quot;,&quot;'+esc(ids)+'&quot;)">Envoyer</button></div></div>');
        });
        if(grouped.manual.length){
            parts.push('<div class="rec-card"><div class="rec-title">À valider manuellement</div><div class="rec-meta">'+grouped.manual.length+' colis express ou sans solution configurée.</div></div>');
        }
        if(!parts.length){
            parts.push('<div class="rec-card"><div class="rec-title">Aucune recommandation active</div><div class="rec-meta">Les recommandations apparaîtront dès qu’un colis en attente aura un NPA de livraison exploitable.</div></div>');
            parts.push('<div class="rec-card"><div class="rec-title">Tournées locales</div><div class="rec-meta">Les colis dans la même région seront proposés en tournée locale, avec livraison du point le plus éloigné vers le retour.</div></div>');
            parts.push('<div class="rec-card"><div class="rec-title">Lignes nationales</div><div class="rec-meta">Les colis inter-régions seront proposés en batch linehaul dès que les lignes seront configurées.</div></div>');
            parts.push('<div class="rec-card"><div class="rec-title">Partenaires régionaux</div><div class="rec-meta">Les zones non couvertes directement par Colixo seront envoyées vers le partenaire admissible.</div></div>');
        }
        return '<div class="cards">'+parts.join('')+'</div>';
    }

    function renderPickups(){
        if(!state.pickups.length){
            return '<div class="overview"><div class="overview-hero"><div><div class="hero-kicker">Ramasses récurrentes</div><h2>Aucune ramasse générée pour aujourd’hui.</h2><p>Créez des règles client dans le module Ramasses. La dispatch générera ensuite automatiquement les tâches du jour.</p></div><div class="hero-actions"><a class="btn btn-orange" href="pickups.html">Configurer les ramasses</a></div></div></div>';
        }
        return '<table><thead><tr><th>Ramasse</th><th>Client</th><th>Fenêtre</th><th>Adresse</th><th>Zone</th><th>Volume</th><th>Alerte</th><th>Actions</th></tr></thead><tbody>'
            + state.pickups.map(function(p){
                var end = pickupEndAt(p);
                var done = ['picked_up','failed','cancelled'].indexOf(String(p.status || '')) >= 0;
                var late = !done && end && end.getTime() < Date.now();
                var close = !done && end && end.getTime() >= Date.now() && end.getTime() < Date.now()+45*60000;
                var alert = late ? '<span class="pill p-express">Dépassée</span>' : close ? '<span class="pill p-24h">Proche limite</span>' : !p.assigned_driver_id ? '<span class="pill p-pickup">Non affectée</span>' : '<span class="pill p-local">OK</span>';
                return '<tr class="pickup-row"><td><strong>'+esc(pickupRef(p))+'</strong><br><span class="pill p-pickup">RAMASSE RÉCURRENTE</span></td><td>'+esc(pickupClientName(p.client_id))+'<br><span class="muted">'+esc(p.contact_name || '')+' '+esc(p.contact_phone || '')+'</span></td><td>'+esc(cleanTime(p.time_window_start))+' - '+esc(cleanTime(p.time_window_end))+'</td><td>'+esc(p.pickup_address || '')+'</td><td>'+zoneBadge(p.origin_zone_code)+'</td><td>'+esc(pickupQty(p))+' colis<br><span class="muted">'+esc(p.estimated_weight_kg || 0)+' kg</span></td><td>'+alert+'</td><td><a class="btn btn-ghost btn-sm" href="pickups.html">Gérer</a></td></tr>';
            }).join('')+'</tbody></table>';
    }

    function renderRoutes(){
        var rows = state.routes || [];
        if(!rows.length) return '<div class="overview"><div class="overview-hero"><div><div class="hero-kicker">Routes & live</div><h2>Aucune route nationale créée pour le moment.</h2><p>Quand une tournée locale, une ligne nationale ou un lot partenaire sera validé, elle apparaîtra ici avec son statut, son véhicule et ses propositions de réoptimisation.</p></div></div><div class="setup-grid"><div class="setup-card"><b>0</b><strong>Véhicules en cours</strong><span>Les positions chauffeur alimenteront cette vue.</span></div><div class="setup-card"><b>0</b><strong>Retards détectés</strong><span>Le moteur proposera une réoptimisation si le gain dépasse 10 à 15 minutes.</span></div><div class="setup-card"><b>0</b><strong>Colis à risque</strong><span>Les colis 24h et express restent protégés par la date limite.</span></div></div></div>';
        return '<table><thead><tr><th>Route</th><th>Type</th><th>Zone</th><th>Véhicule</th><th>Statut</th><th>Réoptimisation</th><th>Actions</th></tr></thead><tbody>'
            + rows.map(function(r){
                var color = routeColor(r);
                return '<tr><td><span class="route-color-dot" style="background:'+esc(color)+'"></span><strong>'+esc(r.name)+'</strong><br><span class="muted">'+esc(r.route_date || '')+'</span></td><td>'+esc(r.route_type)+'</td><td>'+zoneBadge(r.zone_code || r.destination_region_code)+'</td><td>'+esc(r.vehicle_id || '—')+'</td><td>'+esc(r.dispatch_status)+'</td><td>'+(r.order_locked?'<span class="pill p-express">Verrouillée</span>':'<span class="pill p-local">Flexible</span>')+'</td><td><button class="btn btn-ghost btn-sm" onclick="renderRouteMap(&quot;'+esc(r.id)+'&quot;)">Carte</button> <button class="btn btn-blue btn-sm" onclick="notifyDriverReoptimization(&quot;'+esc(r.id)+'&quot;)">Réoptimiser</button> <button class="btn btn-ghost btn-sm" onclick="lockRouteOrder(&quot;'+esc(r.id)+'&quot;)">Bloquer</button></td></tr>';
            }).join('')+'</tbody></table>';
    }

    function renderActiveTab(){
        document.querySelectorAll('.tab').forEach(function(t){ t.classList.toggle('active', t.dataset.tab === state.activeTab); });
        var html = state.activeTab === 'orders' ? renderOrders() : state.activeTab === 'pickups' ? renderPickups() : state.activeTab === 'reco' ? renderRecommendations() : renderRoutes();
        document.getElementById('mainTable').innerHTML = html;
    }

    function renderRouteMap(routeId){
        if(!window.L) return;
        if(!state.map){
            state.map = L.map('nationalMap', { zoomControl:false, attributionControl:false, scrollWheelZoom:false }).setView([46.9, 8.2], 8);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'&copy; OpenStreetMap' }).addTo(state.map);
            state.mapLayer = L.layerGroup().addTo(state.map);
        }
        state.mapLayer.clearLayers();
        var points = [];
        var selectedRoute = routeId ? state.routes.find(function(r){ return r.id === routeId; }) : null;
        var selectedColor = selectedRoute ? routeColor(selectedRoute) : '#3b82f6';
        var rows = routeId
            ? state.routeStops.filter(function(s){ return s.route_id === routeId; })
            : state.orders.filter(function(o){ return o.delivery_lat && o.delivery_lng; });
        rows.forEach(function(o){
            var lat = parseFloat(o.lat || o.delivery_lat), lng = parseFloat(o.lng || o.delivery_lng);
            if(!isFinite(lat) || !isFinite(lng)) return;
            var isPickupStop = o.stop_type === 'pickup' || o.order_table === 'pickups';
            var markerColor = isPickupStop ? '#f97316' : routeId ? selectedColor : '#22c55e';
            points.push([lat,lng]);
            L.circleMarker([lat,lng], { radius:isPickupStop ? 8 : 6, color:markerColor, fillColor:markerColor, fillOpacity:.85 }).addTo(state.mapLayer)
                .bindPopup(isPickupStop
                    ? '<strong>RAMASSE RÉCURRENTE</strong><br>'+esc(o.recipient_name || '')+'<br>'+esc(o.address || '')+'<br>'+esc(cleanTime(o.time_window_start))+'-'+esc(cleanTime(o.time_window_end))
                    : '<strong>Livraison</strong><br>'+esc(ref(o))+'<br>'+esc(o.address || o.delivery_address || ''));
        });
        if(!routeId){
            state.pickups.forEach(function(p){
                var lat = parseFloat(p.pickup_lat), lng = parseFloat(p.pickup_lng);
                if(!isFinite(lat) || !isFinite(lng)) return;
                points.push([lat,lng]);
                L.circleMarker([lat,lng], { radius:8, color:'#f97316', fillColor:'#f97316', fillOpacity:.9, weight:2 }).addTo(state.mapLayer)
                    .bindPopup('<strong>RAMASSE RÉCURRENTE</strong><br>'+esc(pickupClientName(p.client_id))+'<br>'+esc(cleanTime(p.time_window_start))+'-'+esc(cleanTime(p.time_window_end))+' · '+esc(pickupQty(p))+' colis<br>'+esc(p.driver_notes || ''));
            });
        }
        if(points.length > 1) L.polyline(points, { color:selectedColor, weight:3, opacity:.7 }).addTo(state.mapLayer);
        if(points.length) {
            state.map.fitBounds(points, { padding:[30,30] });
        } else {
            state.regions.forEach(function(r){
                var lat = parseFloat(r.base_lat), lng = parseFloat(r.base_lng);
                if(!isFinite(lat) || !isFinite(lng)) return;
                L.circleMarker([lat,lng], { radius:8, color:'#e8311a', fillColor:'#e8311a', fillOpacity:.75 }).addTo(state.mapLayer).bindPopup('<strong>'+esc(r.name)+'</strong><br>'+esc(r.code));
            });
            state.map.setView([46.95, 8.25], 8);
        }
    }

    window.dispatchNationalManualDecision = function(orderId){
        var order = state.orders.find(function(o){ return o.id === orderId; });
        if(!order) return;
        alert('Décision manuelle pour '+ref(order)+' : utilisez les recommandations ou affectez depuis Supabase. Le moteur garde la validation humaine.');
    };
    window.dispatchNationalAssignPartner = function(partnerId, csv){
        var ids = String(csv || '').split(',').filter(Boolean);
        assignOrdersToPartner(partnerId, ids).catch(function(e){ toast(e.message || e, false); });
    };
    window.setDispatchTab = function(tab){ state.activeTab = tab; renderActiveTab(); };

    async function init(){
        db = window.SUPABASE_CLIENT;
        if(!db) throw new Error('Supabase JS v2 non chargé');
        var auth = await window.colixoRequireRoute({ roles:['admin','super_admin'], legacyRoles:['admin','super_admin'], redirectTo:'../login/index.html' });
        if(!auth) return;
        await refreshAll();
        document.getElementById('btnRefresh').addEventListener('click', refreshAll);
    }

    window.loadPendingOrders = loadPendingOrders;
    window.normalizeSwissPostcode = normalizeSwissPostcode;
    window.findPostalZone = findPostalZone;
    window.assignOriginAndDestinationZones = assignOriginAndDestinationZones;
    window.calculateLatestDeliveryDate = calculateLatestDeliveryDate;
    window.calculatePriorityScore = calculatePriorityScore;
    window.groupOrdersByDestinationRegion = groupOrdersByDestinationRegion;
    window.groupOrdersByDestinationZone = groupOrdersByDestinationZone;
    window.findAvailableLinehaul = findAvailableLinehaul;
    window.findAvailablePartner = findAvailablePartner;
    window.suggestDispatchDecision = suggestDispatchDecision;
    window.suggestNationalRoutes = suggestNationalRoutes;
    window.createLocalRouteFromZone = function(zoneCode){ createLocalRouteFromZone(zoneCode).catch(function(e){ toast(e.message || e, false); }); };
    window.createLinehaulBatch = function(originRegion, destinationRegion){ createLinehaulBatch(originRegion, destinationRegion).catch(function(e){ toast(e.message || e, false); }); };
    window.assignOrdersToPartner = assignOrdersToPartner;
    window.assignVehicleToRoute = assignVehicleToRoute;
    window.generateRouteStops = generateRouteStops;
    window.calculateLoadOrder = calculateLoadOrder;
    window.renderNationalDispatchDashboard = renderNationalDispatchDashboard;
    window.renderRegionOverview = renderRegionOverview;
    window.renderRouteMap = renderRouteMap;
    window.loadPickupData = loadPickupData;
    window.ensureTodayPickups = ensureTodayPickups;
    window.getDriverCurrentPosition = getDriverCurrentPosition;
    window.calculateLiveETA = calculateLiveETA;
    window.detectTrafficDelay = detectTrafficDelay;
    window.suggestRouteReoptimization = suggestRouteReoptimization;
    window.reorderStopsWithinLoadGroup = reorderStopsWithinLoadGroup;
    window.validateReoptimizationImpact = validateReoptimizationImpact;
    window.notifyDriverReoptimization = function(routeId){ notifyDriverReoptimization(routeId).catch(function(e){ toast(e.message || e, false); }); };
    window.acceptReoptimizedRoute = acceptReoptimizedRoute;
    window.rejectReoptimizedRoute = rejectReoptimizedRoute;
    window.lockRouteOrder = function(routeId){ lockRouteOrder(routeId).catch(function(e){ toast(e.message || e, false); }); };

    document.addEventListener('DOMContentLoaded', function(){
        init().catch(function(e){
            console.error(e);
            var el = document.getElementById('mainTable');
            if(el) el.innerHTML = '<div class="error">Erreur dispatch national : '+esc(e.message || e)+'</div>';
        });
    });
})();
