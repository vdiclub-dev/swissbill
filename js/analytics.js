(function(){
    'use strict';

    var db = null;
    var charts = {};
    var pendingCharts = {};
    var chartObserver = null;
    var map = null;
    var mapLayer = null;
    var heatLayer = null;
    var state = { orders:[], clients:[], drivers:[], vehicles:[], warnings:[], period:'year' };

    var CH_ZONES = [
        { code:'GE', name:'Genève', lat:46.204, lng:6.143, ranges:[[1200,1299]] },
        { code:'VD', name:'Vaud', lat:46.62, lng:6.55, ranges:[[1000,1199],[1300,1499],[1800,1899]] },
        { code:'FR', name:'Fribourg', lat:46.81, lng:7.16, ranges:[[1600,1799]] },
        { code:'NE/JU', name:'Neuchâtel / Jura', lat:47.02, lng:6.88, ranges:[[2000,2999]] },
        { code:'BE/SO/BS/BL', name:'Berne / Soleure / Bâle', lat:47.05, lng:7.55, ranges:[[3000,4999]] },
        { code:'AG/LU/NW/OW/UR/SZ/ZG', name:'Centre Suisse', lat:47.08, lng:8.16, ranges:[[5000,6499]] },
        { code:'TI', name:'Tessin', lat:46.19, lng:8.95, ranges:[[6500,6999]] },
        { code:'GR', name:'Grisons', lat:46.85, lng:9.53, ranges:[[7000,7999]] },
        { code:'ZH/SH/TG', name:'Zurich / Nord-Est', lat:47.42, lng:8.65, ranges:[[8000,8999]] },
        { code:'SG/AI/AR/GL', name:'Suisse orientale', lat:47.37, lng:9.27, ranges:[[9000,9999]] }
    ];

    function $(id){ return document.getElementById(id); }
    function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    function n(v){ var x = Number(v); return isFinite(x) ? x : 0; }
    function money(v){ return new Intl.NumberFormat('fr-CH', { style:'currency', currency:'CHF', maximumFractionDigits:0 }).format(n(v)); }
    function km(v){ return new Intl.NumberFormat('fr-CH', { maximumFractionDigits:0 }).format(n(v)) + ' km'; }
    function pct(v){ return isFinite(v) ? Math.round(v) + '%': '—'; }
    function dayKey(v){ return new Date(v).toISOString().slice(0,10); }
    function monthKey(v){ var d = new Date(v); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
    function addDays(v,d){ var x = new Date(v); x.setDate(x.getDate()+d); return x; }
    function startOfWeek(v){ var d = new Date(v); var day = d.getDay() || 7; d.setHours(0,0,0,0); d.setDate(d.getDate()-day+1); return d; }
    function startOfMonth(v){ return new Date(v.getFullYear(), v.getMonth(), 1); }
    function startOfYear(v){ return new Date(v.getFullYear(), 0, 1); }
    function created(o){ return o.created_at || o.pickup_date || o.delivery_date || o.delivered_at; }
    function actualDelivery(o){ return o.delivered_at || (isDelivered(o) ? o.delivery_date : null); }
    function service(o){ return String(o.service_type || 'eco').toLowerCase().replace('standard','eco').replace('prio','priority'); }
    function price(o){ return n(o.price || o.price_chf || o.total_price); }
    function distance(o){ return n(o.distance_km || o.km); }
    function cost(o){ return n(o.estimated_cost) || (distance(o) * 0.85 + 6.5); }
    function isDelivered(o){ return ['delivered','completed','livre','livré'].indexOf(String(o.status || '').toLowerCase()) >= 0; }
    function isOpen(o){ return ['delivered','completed','cancelled','canceled','failed','returned','livre','livré'].indexOf(String(o.status || '').toLowerCase()) < 0; }
    function parcel(o){ var q = parseInt(o.parcel_count || o.quantity || 1, 10); return isFinite(q) && q > 0 ? q : 1; }

    function toast(msg, ok){
        var el = $('toast');
        if(!el) return;
        el.textContent = msg;
        el.style.color = ok === false ? '#fca5a5' : '#fff';
        el.classList.add('show');
        clearTimeout(toast._t);
        toast._t = setTimeout(function(){ el.classList.remove('show'); }, 4200);
    }

    function inRange(v,start,end){
        if(!v) return false;
        var d = new Date(v);
        return d >= start && d < end;
    }

    function periodOrders(){
        var today = new Date();
        var start = state.period === '30' ? addDays(today, -29)
            : state.period === 'month' ? startOfMonth(today)
            : state.period === 'year' ? startOfYear(today)
            : new Date(0);
        return state.orders.filter(function(o){ return inRange(created(o), start, addDays(today, 1)); });
    }

    function deadline(o){
        if(o.delivered_at && o.delivery_date) return new Date(o.delivery_date);
        var base = o.pickup_date || o.created_at;
        if(!base) return null;
        var d = new Date(base);
        var s = service(o);
        d.setHours(18,0,0,0);
        if(s === 'express' || s === 'priority') return addDays(d, 1);
        return addDays(d, 2);
    }

    function delayMinutes(o){
        var actual = actualDelivery(o);
        var due = deadline(o);
        if(!actual || !due) return null;
        var diff = new Date(actual).getTime() - due.getTime();
        return isFinite(diff) ? Math.max(0, Math.round(diff / 60000)) : null;
    }

    function deliveryDurationHours(o){
        var a = o.pickup_date || o.created_at;
        var b = actualDelivery(o);
        if(!a || !b) return null;
        var diff = new Date(b).getTime() - new Date(a).getTime();
        return isFinite(diff) ? Math.max(0, diff / 36e5) : null;
    }

    function groupBy(list, fn){
        return (list || []).reduce(function(acc,row){
            var key = fn(row) || 'INCONNU';
            if(!acc[key]) acc[key] = [];
            acc[key].push(row);
            return acc;
        }, {});
    }

    function byId(list){
        return (list || []).reduce(function(acc,row){ if(row && row.id) acc[row.id] = row; return acc; }, {});
    }

    function rowName(row, fallback){
        if(!row) return fallback || '—';
        return row.company_name || row.name || row.full_name || row.nom || row.label || row.model || row.email || fallback || '—';
    }

    function lookup(){
        return { clients:byId(state.clients), drivers:byId(state.drivers), vehicles:byId(state.vehicles) };
    }

    function clientName(id, lkp){ return rowName(lkp.clients[id], id ? 'Client '+String(id).slice(0,8) : 'Client non renseigné'); }
    function driverName(id, lkp){ return rowName(lkp.drivers[id], id ? 'Chauffeur '+String(id).slice(0,8) : 'Non affecté'); }

    function extractPostcode(o){
        var raw = o.delivery_postcode || o.postcode || o.zip || o.delivery_address || '';
        var m = String(raw).match(/\b([1-9]\d{3})\b/);
        return m ? parseInt(m[1],10) : null;
    }

    function canton(o){
        var pc = extractPostcode(o);
        if(pc){
            for(var i=0;i<CH_ZONES.length;i++){
                if(CH_ZONES[i].ranges.some(function(r){ return pc >= r[0] && pc <= r[1]; })) return CH_ZONES[i];
            }
        }
        var p = deliveryPoint(o);
        if(p){
            return CH_ZONES.slice().sort(function(a,b){
                return Math.hypot(a.lat-p.lat, a.lng-p.lng) - Math.hypot(b.lat-p.lat, b.lng-p.lng);
            })[0];
        }
        return null;
    }

    function point(lat,lng){
        lat = n(lat); lng = n(lng);
        return lat && lng ? { lat:lat, lng:lng } : null;
    }
    function pickupPoint(o){ return point(o.pickup_lat, o.pickup_lng); }
    function deliveryPoint(o){ return point(o.delivery_lat, o.delivery_lng); }

    async function readTable(table, queryFn){
        try{
            var q = db.from(table).select('*');
            if(queryFn) q = queryFn(q);
            var res = await q;
            if(res.error) throw res.error;
            return res.data || [];
        }catch(e){
            state.warnings.push({ level:'red', title:'Source Supabase indisponible', body:table+' : '+(e.message || e) });
            return [];
        }
    }

    function checkSchema(){
        var required = ['created_at','pickup_date','delivery_date','status','service_type','price','distance_km','estimated_cost','driver_id','client_id','vehicle_id','delivered_at','pickup_lat','pickup_lng','delivery_lat','delivery_lng'];
        var sample = state.orders[0];
        if(!sample) return;
        var missing = required.filter(function(k){ return !(k in sample); });
        if(missing.length){
            state.warnings.push({ level:'orange', title:'Colonnes orders à aligner', body:'Manquant détecté : '+missing.join(', ')+'. Voir supabase/sql/033_analytics_schema_columns.sql.' });
        }
    }

    function configureCharts(){
        if(!window.Chart) return;
        Chart.defaults.color = 'rgba(255,255,255,.65)';
        Chart.defaults.borderColor = 'rgba(255,255,255,.08)';
        Chart.defaults.font.family = 'Outfit, Arial, sans-serif';
        if(typeof IntersectionObserver === 'undefined') return;
        if(chartObserver) return;
        chartObserver = new IntersectionObserver(function(entries){
            entries.forEach(function(entry){
                if(entry.isIntersecting){
                    drawPendingChart(entry.target.id);
                    chartObserver.unobserve(entry.target);
                }
            });
        }, { rootMargin:'180px' });
    }

    function isVisible(el){
        var r = el.getBoundingClientRect();
        return r.top < window.innerHeight + 180 && r.bottom > -120;
    }

    function destroyChart(id){
        if(charts[id]){ charts[id].destroy(); delete charts[id]; }
    }

    function scheduleChart(id, renderFn){
        var canvas = $(id);
        if(!canvas || !window.Chart) return;
        destroyChart(id);
        pendingCharts[id] = renderFn;
        if(isVisible(canvas) || !chartObserver) drawPendingChart(id);
        else if(chartObserver) chartObserver.observe(canvas);
    }

    function drawPendingChart(id){
        if(!pendingCharts[id]) return;
        pendingCharts[id]();
        delete pendingCharts[id];
    }

    function renderKPIs(){
        var all = state.orders;
        var period = periodOrders();
        var today = new Date();
        var todayOrders = all.filter(function(o){ return inRange(created(o), new Date(today.getFullYear(),today.getMonth(),today.getDate()), addDays(today,1)); });
        var weekOrders = all.filter(function(o){ return inRange(created(o), startOfWeek(today), addDays(today,1)); });
        var monthOrders = all.filter(function(o){ return inRange(created(o), startOfMonth(today), addDays(today,1)); });
        var yearOrders = all.filter(function(o){ return inRange(created(o), startOfYear(today), addDays(today,1)); });
        var deliveredWithDelay = period.filter(function(o){ return isDelivered(o) && delayMinutes(o) !== null; });
        var late = deliveredWithDelay.filter(function(o){ return delayMinutes(o) > 0; });
        var onTime = deliveredWithDelay.length ? (deliveredWithDelay.length - late.length) / deliveredWithDelay.length * 100 : NaN;
        var revenuePeriod = period.reduce(function(s,o){ return s + price(o); }, 0);
        var costPeriod = period.reduce(function(s,o){ return s + cost(o); }, 0);
        var cards = [
            ['Colis aujourd’hui', todayOrders.length, 'Commandes créées', 'fa-box', '#ff8a00'],
            ['Colis cette semaine', weekOrders.length, 'Semaine opérationnelle', 'fa-calendar-week', '#3b82f6'],
            ['Colis ce mois', monthOrders.length, 'Mois en cours', 'fa-calendar-days', '#22c55e'],
            ['Colis cette année', yearOrders.length, String(today.getFullYear()), 'fa-chart-line', '#a855f7'],
            ['CA aujourd’hui', money(todayOrders.reduce(function(s,o){ return s + price(o); },0)), 'Prix facturé', 'fa-franc-sign', '#facc15'],
            ['CA mensuel', money(monthOrders.reduce(function(s,o){ return s + price(o); },0)), 'Mois en cours', 'fa-money-bill-trend-up', '#ff8a00'],
            ['Km parcourus', km(period.reduce(function(s,o){ return s + distance(o); },0)), 'Période sélectionnée', 'fa-road', '#3b82f6'],
            ['Coût opérationnel', money(costPeriod), 'estimated_cost ou calcul', 'fa-gas-pump', '#e8311a'],
            ['Marge brute', money(revenuePeriod - costPeriod), 'Période sélectionnée', 'fa-scale-balanced', '#22c55e'],
            ['Livraison à temps', pct(onTime), 'Selon SLA service', 'fa-stopwatch', '#22c55e'],
            ['Nombre de retards', late.length, 'Livraisons hors délai', 'fa-triangle-exclamation', '#e8311a'],
            ['Express en cours', all.filter(function(o){ return service(o)==='express' && isOpen(o); }).length, 'Non livrés', 'fa-bolt', '#facc15']
        ];
        $('kpiGrid').innerHTML = cards.map(function(c){
            return '<div class="kpi-card" style="--accent:'+c[4]+'"><div class="kpi-top"><div class="kpi-label">'+esc(c[0])+'</div><div class="kpi-icon"><i class="fas '+c[3]+'"></i></div></div><div class="kpi-value">'+esc(c[1])+'</div><div class="kpi-sub">'+esc(c[2])+'</div></div>';
        }).join('');
        $('dataScope').textContent = period.length+' commande'+(period.length>1?'s':'');
    }

    function renderCharts(){
        var orders = periodOrders();
        var lkp = lookup();
        scheduleChart('chartDaily', function(){
            var days = [];
            for(var i=29;i>=0;i--) days.push(dayKey(addDays(new Date(), -i)));
            var grouped = groupBy(state.orders, function(o){ return created(o) ? dayKey(created(o)) : ''; });
            charts.chartDaily = new Chart($('chartDaily'), { type:'line', data:{ labels:days.map(function(d){ return d.slice(5); }), datasets:[{ label:'Colis', data:days.map(function(d){ return (grouped[d] || []).length; }), borderColor:'#ff8a00', backgroundColor:'rgba(255,138,0,.16)', fill:true, tension:.35, pointRadius:2 }] }, options:chartOptions(false) });
        });
        scheduleChart('chartRevenue', function(){
            var keys = [];
            var now = new Date();
            for(var i=11;i>=0;i--) keys.push(monthKey(new Date(now.getFullYear(), now.getMonth()-i, 1)));
            var grouped = groupBy(state.orders, function(o){ return created(o) ? monthKey(created(o)) : ''; });
            charts.chartRevenue = new Chart($('chartRevenue'), { type:'bar', data:{ labels:keys.map(function(k){ return k.slice(5)+'/'+k.slice(2,4); }), datasets:[{ label:'CA', data:keys.map(function(k){ return (grouped[k] || []).reduce(function(s,o){ return s + price(o); },0); }), backgroundColor:'#ff8a00', borderRadius:6 }] }, options:chartOptions(true, function(v){ return money(v); }) });
        });
        scheduleChart('chartServices', function(){
            var counts = { eco:0, priority:0, express:0 };
            orders.forEach(function(o){ var s = service(o); counts[counts[s] === undefined ? 'eco' : s]++; });
            charts.chartServices = new Chart($('chartServices'), { type:'doughnut', data:{ labels:['Eco','Priority','Express'], datasets:[{ data:[counts.eco, counts.priority, counts.express], backgroundColor:['#22c55e','#ff8a00','#e8311a'], borderColor:'#101014', borderWidth:3 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } }, cutout:'62%' } });
        });
        scheduleChart('chartClients', function(){
            var rows = Object.keys(groupBy(orders, function(o){ return o.client_id || 'none'; })).map(function(id){
                var list = orders.filter(function(o){ return (o.client_id || 'none') === id; });
                return { name:clientName(id, lkp), count:list.length };
            }).sort(function(a,b){ return b.count-a.count; }).slice(0,8).reverse();
            charts.chartClients = new Chart($('chartClients'), { type:'bar', data:{ labels:rows.map(shortName), datasets:[{ label:'Colis', data:rows.map(function(r){ return r.count; }), backgroundColor:'#facc15', borderRadius:6 }] }, options:barYOptions() });
        });
        scheduleChart('chartCantons', function(){
            var grouped = groupBy(orders, function(o){ var c = canton(o); return c && c.code; });
            var rows = Object.keys(grouped).map(function(code){ var zone = CH_ZONES.find(function(z){ return z.code === code; }); return { name:zone ? zone.name : code, count:grouped[code].length }; }).sort(function(a,b){ return b.count-a.count; }).slice(0,8).reverse();
            charts.chartCantons = new Chart($('chartCantons'), { type:'bar', data:{ labels:rows.map(shortName), datasets:[{ label:'Livraisons', data:rows.map(function(r){ return r.count; }), backgroundColor:'#3b82f6', borderRadius:6 }] }, options:barYOptions() });
        });
        scheduleChart('chartDrivers', function(){
            var rows = driverRows(orders, lkp).slice(0,8).reverse();
            charts.chartDrivers = new Chart($('chartDrivers'), { type:'bar', data:{ labels:rows.map(shortName), datasets:[{ label:'Livrés', data:rows.map(function(r){ return r.delivered; }), backgroundColor:'#22c55e', borderRadius:6 },{ label:'Retards', data:rows.map(function(r){ return r.late; }), backgroundColor:'#e8311a', borderRadius:6 }] }, options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom' } }, scales:{ x:{ stacked:true, grid:{ display:false } }, y:{ stacked:true, beginAtZero:true, ticks:{ precision:0 } } } } });
        });
    }

    function shortName(row){
        var value = row.name || String(row);
        return value.length > 20 ? value.slice(0,20)+'…' : value;
    }

    function chartOptions(formatMoney, labelFormatter){
        return { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:function(ctx){ return labelFormatter ? labelFormatter(ctx.raw) : ctx.raw; } } } }, scales:{ x:{ grid:{ display:false } }, y:{ beginAtZero:true, ticks:{ precision:0, callback:formatMoney ? function(v){ return money(v); } : undefined } } } };
    }
    function barYOptions(){
        return { indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ x:{ beginAtZero:true, ticks:{ precision:0 } }, y:{ grid:{ display:false } } } };
    }

    function renderMap(){
        if(!window.L) return;
        var orders = periodOrders();
        if(!map){
            map = L.map('analyticsMap', { scrollWheelZoom:false }).setView([46.85, 8.2], 8);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'&copy; OpenStreetMap' }).addTo(map);
            mapLayer = L.layerGroup().addTo(map);
        }
        mapLayer.clearLayers();
        if(heatLayer){ map.removeLayer(heatLayer); heatLayer = null; }
        var heat = [];
        orders.forEach(function(o){
            var p1 = pickupPoint(o);
            var p2 = deliveryPoint(o);
            if(p1) L.circleMarker([p1.lat,p1.lng], { radius:4, color:'#3b82f6', fillColor:'#3b82f6', fillOpacity:.75, weight:1 }).addTo(mapLayer);
            if(p2){
                heat.push([p2.lat,p2.lng,.6]);
                L.circleMarker([p2.lat,p2.lng], { radius:4, color:'#ff8a00', fillColor:'#ff8a00', fillOpacity:.8, weight:1 }).addTo(mapLayer);
            }
        });
        if(heat.length && L.heatLayer) heatLayer = L.heatLayer(heat, { radius:28, blur:22, gradient:{ .25:'#3b82f6', .55:'#ff8a00', 1:'#e8311a' } }).addTo(map);
        renderZoneCircles(orders);
        renderFrequentRoutes(orders);
        setTimeout(function(){ map.invalidateSize(); }, 120);
    }

    function renderZoneCircles(orders){
        var grouped = groupBy(orders, function(o){ var c = canton(o); return c && c.code; });
        CH_ZONES.forEach(function(z){
            var count = (grouped[z.code] || []).length;
            L.circle([z.lat,z.lng], { radius:8000 + Math.min(50000, count * 1400), color:'#ff8a00', weight:1, fillColor:'#ff8a00', fillOpacity:count ? .13 : .04 }).addTo(mapLayer)
                .bindPopup('<strong>'+esc(z.name)+'</strong><br>'+count+' colis');
        });
    }

    function renderFrequentRoutes(orders){
        var routeGroups = {};
        orders.forEach(function(o){
            var p1 = pickupPoint(o), p2 = deliveryPoint(o);
            if(!p1 || !p2) return;
            var key = p1.lat.toFixed(1)+','+p1.lng.toFixed(1)+'>'+p2.lat.toFixed(1)+','+p2.lng.toFixed(1);
            if(!routeGroups[key]) routeGroups[key] = { count:0, from:p1, to:p2 };
            routeGroups[key].count++;
        });
        Object.keys(routeGroups).map(function(k){ return routeGroups[k]; }).sort(function(a,b){ return b.count-a.count; }).slice(0,7).forEach(function(r){
            L.polyline([[r.from.lat,r.from.lng],[r.to.lat,r.to.lng]], { color:'#facc15', weight:Math.min(7,2+r.count), opacity:.45 }).addTo(mapLayer)
                .bindTooltip('Route fréquente · '+r.count+' colis');
        });
    }

    function avg(list){ return list.length ? list.reduce(function(s,v){ return s+n(v); },0) / list.length : 0; }

    function profitRows(orders, lkp){
        var grouped = groupBy(orders.filter(function(o){ return o.client_id; }), function(o){ return o.client_id; });
        return Object.keys(grouped).map(function(id){
            var list = grouped[id];
            var revenue = list.reduce(function(s,o){ return s + price(o); },0);
            var totalCost = list.reduce(function(s,o){ return s + cost(o); },0);
            var delays = list.map(delayMinutes).filter(function(v){ return v !== null; });
            var margin = revenue - totalCost;
            var rate = revenue ? margin / revenue * 100 : 0;
            return { id:id, name:clientName(id,lkp), count:list.length, revenue:revenue, cost:totalCost, margin:margin, marginRate:rate, delay:avg(delays) };
        }).sort(function(a,b){ return b.revenue-a.revenue; });
    }

    function driverRows(orders, lkp){
        var grouped = groupBy(orders.filter(function(o){ return o.driver_id; }), function(o){ return o.driver_id; });
        return Object.keys(grouped).map(function(id){
            var list = grouped[id];
            var delivered = list.filter(isDelivered);
            var late = delivered.filter(function(o){ return delayMinutes(o) > 0; });
            var durations = delivered.map(deliveryDurationHours).filter(function(v){ return v !== null; });
            return { id:id, name:driverName(id,lkp), assigned:list.length, delivered:delivered.length, km:list.reduce(function(s,o){ return s+distance(o); },0), late:late.length, success:list.length ? delivered.length / list.length * 100 : 0, avgHours:avg(durations) };
        }).sort(function(a,b){ return b.delivered-a.delivered; });
    }

    function renderTables(){
        var orders = periodOrders();
        var lkp = lookup();
        var profit = profitRows(orders, lkp).slice(0,14);
        $('profitTable').innerHTML = profit.length ? profit.map(function(r){
            var color = r.marginRate >= 30 ? 'green' : r.marginRate >= 15 ? 'orange' : 'red';
            var status = color === 'green' ? 'Rentable' : color === 'orange' ? 'Moyen' : 'Non rentable';
            return '<tr><td><strong>'+esc(r.name)+'</strong></td><td>'+r.count+'</td><td>'+money(r.revenue)+'</td><td>'+money(r.cost)+'</td><td>'+money(r.margin)+'<br><span class="muted">'+pct(r.marginRate)+'</span></td><td>'+Math.round(r.delay)+' min</td><td><span class="badge '+color+'">'+status+'</span></td></tr>';
        }).join('') : '<tr><td colspan="7">Aucune donnée client sur cette période.</td></tr>';
        var drivers = driverRows(orders, lkp).slice(0,14);
        $('driverTable').innerHTML = drivers.length ? drivers.map(function(r){
            var color = r.success >= 95 ? 'green' : r.success >= 85 ? 'orange' : 'red';
            return '<tr><td><strong>'+esc(r.name)+'</strong></td><td>'+r.delivered+'</td><td>'+km(r.km)+'</td><td>'+r.late+'</td><td><span class="badge '+color+'">'+pct(r.success)+'</span></td><td>'+Math.round(r.avgHours)+' h</td></tr>';
        }).join('') : '<tr><td colspan="6">Aucune donnée chauffeur sur cette période.</td></tr>';
    }

    function renderIntelligence(){
        var orders = periodOrders();
        var lkp = lookup();
        var alerts = state.warnings.slice();
        var revenue = orders.reduce(function(s,o){ return s+price(o); },0);
        var totalCost = orders.reduce(function(s,o){ return s+cost(o); },0);
        var totalKm = orders.reduce(function(s,o){ return s+distance(o); },0);
        var marginRate = revenue ? (revenue-totalCost)/revenue*100 : 0;
        if(totalKm > 0 && marginRate < 18) alerts.push({ level:'red', title:'Km élevés avec faible marge', body:km(totalKm)+' sur la période, marge estimée '+pct(marginRate)+'. Revoir tarifs ou consolidation.' });
        profitRows(orders, lkp).filter(function(r){ return r.count > 0 && r.count < 3; }).slice(0,3).forEach(function(r){
            alerts.push({ level:'orange', title:'Recommandation commerciale', body:r.name+' génère peu de volume. Proposer abonnement ou engagement mensuel.' });
        });
        var byCanton = groupBy(orders, function(o){ var c = canton(o); return c && c.code; });
        Object.keys(byCanton).forEach(function(code){
            var list = byCanton[code];
            if(list.length >= Math.max(12, orders.length * .22)){
                var z = CH_ZONES.find(function(c){ return c.code === code; });
                alerts.push({ level:'green', title:'Opportunité mini hub', body:(z ? z.name : code)+' concentre '+list.length+' colis. Evaluer dépôt local ou partenaire.' });
            }
        });
        var expressOpen = state.orders.filter(function(o){ return service(o)==='express' && isOpen(o); }).length;
        if(expressOpen >= 8 || (orders.length && expressOpen/orders.length > .18)){
            alerts.push({ level:'orange', title:'Pression express', body:expressOpen+' colis express en cours. Prévoir véhicule dédié ou cut-off séparé.' });
        }
        if(!alerts.length) alerts.push({ level:'green', title:'Réseau stable', body:'Aucune anomalie critique détectée sur la période sélectionnée.' });
        var colors = { green:'#22c55e', orange:'#ff8a00', red:'#e8311a' };
        $('alertsList').innerHTML = alerts.slice(0,12).map(function(a){
            return '<div class="alert" style="--accent:'+colors[a.level || 'orange']+'"><strong>'+esc(a.title)+'</strong><span>'+esc(a.body)+'</span></div>';
        }).join('');
    }

    function renderForecast(){
        var forecast = buildForecast();
        $('forecastGrid').innerHTML = [
            ['Colis mois prochain', forecast.orders],
            ['CA mois prochain', money(forecast.revenue)],
            ['Besoin chauffeurs', forecast.drivers],
            ['Véhicules nécessaires', forecast.vehicles]
        ].map(function(c){ return '<div class="forecast-card"><b>'+esc(c[1])+'</b><span>'+esc(c[0])+'</span></div>'; }).join('');
    }

    function buildForecast(){
        var now = new Date();
        var months = [];
        for(var i=3;i>=1;i--) months.push(monthKey(new Date(now.getFullYear(), now.getMonth()-i, 1)));
        var grouped = groupBy(state.orders, function(o){ return created(o) ? monthKey(created(o)) : ''; });
        var monthCounts = months.map(function(m){ return (grouped[m] || []).length; });
        var monthRevenue = months.map(function(m){ return (grouped[m] || []).reduce(function(s,o){ return s + price(o); },0); });
        var currentMonthOrders = state.orders.filter(function(o){ return inRange(created(o), startOfMonth(now), addDays(now,1)); });
        var daysElapsed = Math.max(1, now.getDate());
        var daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
        var runRateOrders = currentMonthOrders.length / daysElapsed * daysInMonth;
        var avgOrders = avg(monthCounts.filter(Boolean));
        var avgRevenue = avg(monthRevenue.filter(Boolean));
        var expectedOrders = Math.round(avgOrders ? (avgOrders*.65 + runRateOrders*.35) : runRateOrders);
        var avgTicket = state.orders.length ? state.orders.reduce(function(s,o){ return s+price(o); },0) / state.orders.length : 0;
        var expectedRevenue = avgRevenue ? avgRevenue*.65 + expectedOrders*avgTicket*.35 : expectedOrders*avgTicket;
        return {
            orders: expectedOrders,
            revenue: expectedRevenue,
            drivers: Math.max(1, Math.ceil(expectedOrders / 420)),
            vehicles: Math.max(1, Math.ceil(expectedOrders / 560))
        };
    }

    function renderAll(){
        renderKPIs();
        renderCharts();
        renderMap();
        renderTables();
        renderIntelligence();
        renderForecast();
        $('lastSync').textContent = 'Dernière synchro '+new Date().toLocaleTimeString('fr-CH', { hour:'2-digit', minute:'2-digit' });
    }

    async function loadData(){
        state.warnings = [];
        state.orders = await readTable('orders', function(q){ return q.order('created_at', { ascending:false }).limit(10000); });
        var refs = await Promise.all([
            readTable('clients', function(q){ return q.order('company_name', { ascending:true }).limit(3000); }),
            readTable('drivers', function(q){ return q.limit(1500); }),
            readTable('vehicles', function(q){ return q.limit(1500); })
        ]);
        state.clients = refs[0];
        state.drivers = refs[1];
        state.vehicles = refs[2];
        checkSchema();
        renderAll();
    }

    async function init(){
        db = window.SUPABASE_CLIENT;
        if(!db) throw new Error('Supabase non chargé');
        if(window.colixoRequireRoute){
            var auth = await window.colixoRequireRoute({ roles:['admin','super_admin'], legacyRoles:['admin','super_admin'], redirectTo:'../login/index.html' });
            if(!auth) return;
        }
        configureCharts();
        $('periodSelect').addEventListener('change', function(e){ state.period = e.target.value; renderAll(); });
        $('btnRefresh').addEventListener('click', function(){ loadData().then(function(){ toast('Analytics actualisés', true); }).catch(function(e){ toast(e.message || e, false); }); });
        await loadData();
    }

    document.addEventListener('DOMContentLoaded', function(){
        init().catch(function(e){
            $('kpiGrid').innerHTML = '<div class="loading">'+esc(e.message || e)+'</div>';
            toast(e.message || e, false);
        });
    });
})();
