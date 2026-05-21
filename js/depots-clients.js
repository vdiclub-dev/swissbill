(function(){
    'use strict';

    var db = null;
    var charts = {};
    var state = {
        orders: [],
        clients: [],
        warnings: [],
        orderSource: 'orders',
        clientSource: 'clients',
        period: '30',
        search: ''
    };

    function $(id){ return document.getElementById(id); }
    function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    function n(v){ var x = Number(v); return isFinite(x) ? x : 0; }
    function first(o, keys){
        for(var i=0;i<keys.length;i++){
            var v = o && o[keys[i]];
            if(v !== undefined && v !== null && v !== '') return v;
        }
        return null;
    }
    function money(v){ return new Intl.NumberFormat('fr-CH', { style:'currency', currency:'CHF', maximumFractionDigits:2 }).format(n(v)); }
    function int(v){ return new Intl.NumberFormat('fr-CH', { maximumFractionDigits:0 }).format(n(v)); }
    function pad(v){ return String(v).padStart(2,'0'); }
    function dayKey(v){
        if(!v) return '';
        var d = new Date(String(v).length === 10 ? v+'T12:00:00' : v);
        return isFinite(d.getTime()) ? d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()) : '';
    }
    function dayLabel(key){
        if(!key) return 'Sans date';
        return new Date(key+'T12:00:00').toLocaleDateString('fr-CH', { weekday:'short', day:'2-digit', month:'2-digit' });
    }
    function addDays(date, amount){ var d = new Date(date); d.setDate(d.getDate()+amount); return d; }
    function startOfDay(date){ return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
    function startOfMonth(date){ return new Date(date.getFullYear(), date.getMonth(), 1); }
    function startOfYear(date){ return new Date(date.getFullYear(), 0, 1); }
    function normalizeText(v){ return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

    function toast(msg, ok){
        var el = $('toast');
        if(!el) return;
        el.textContent = msg;
        el.style.color = ok === false ? '#fca5a5' : '#fff';
        el.classList.add('show');
        clearTimeout(toast._t);
        toast._t = setTimeout(function(){ el.classList.remove('show'); }, 4200);
    }

    function orderDate(o){
        return first(o, ['pickup_date','date_depot','depot_date','created_at','delivery_date','delivered_at']);
    }
    function clientId(o){
        return first(o, ['client_id','entreprise_id','customer_id','order_client_id']);
    }
    function clientLabelFromOrder(o){
        return first(o, ['client_name','nom_client','company_name','entreprise_nom','customer_name','pickup_nom']) || 'Client non renseigne';
    }
    function clientKey(o){
        return clientId(o) || 'name:'+clientLabelFromOrder(o);
    }
    function price(o){
        return n(first(o, ['price','price_chf','prix_chf','total_price_chf','total_estimated_price_chf','amount_chf','montant','total_amount']));
    }
    function parcels(o){
        var value = parseInt(first(o, ['parcel_count','quantity','colis','nombre_colis','packages','qty']) || 1, 10);
        return isFinite(value) && value > 0 ? value : 1;
    }
    function normalizeOrder(row){
        var r = Object.assign({}, row || {});
        r._date = orderDate(r);
        r._day = dayKey(r._date);
        r._client_key = clientKey(r);
        r._price = price(r);
        r._parcels = parcels(r);
        return r;
    }
    function normalizeClient(row){
        var r = Object.assign({}, row || {});
        r.company_name = first(r, ['company_name','nom','name','raison_sociale','email']) || 'Client';
        return r;
    }
    function clientLookup(){
        return state.clients.reduce(function(acc,c){
            if(c && c.id) acc[String(c.id)] = c;
            return acc;
        }, {});
    }
    function clientName(key, lookup){
        if(!key) return 'Client non renseigne';
        if(String(key).indexOf('name:') === 0) return String(key).slice(5) || 'Client non renseigne';
        var row = lookup[String(key)];
        return row ? row.company_name : 'Client '+String(key).slice(0,8);
    }
    function inRange(o){
        if(state.period === 'all') return true;
        if(!o._day) return false;
        var now = new Date();
        var start = state.period === '7' ? addDays(startOfDay(now), -6)
            : state.period === '30' ? addDays(startOfDay(now), -29)
            : state.period === 'month' ? startOfMonth(now)
            : state.period === 'year' ? startOfYear(now)
            : addDays(startOfDay(now), -29);
        var d = new Date(o._day+'T12:00:00');
        return d >= start && d < addDays(startOfDay(now), 1);
    }
    function groupBy(list, fn){
        return (list || []).reduce(function(acc,row){
            var key = fn(row) || 'INCONNU';
            if(!acc[key]) acc[key] = [];
            acc[key].push(row);
            return acc;
        }, {});
    }
    function filteredOrders(){
        var lookup = clientLookup();
        var needle = normalizeText(state.search);
        return state.orders.filter(function(o){
            if(!inRange(o)) return false;
            if(!needle) return true;
            return normalizeText(clientName(o._client_key, lookup)).indexOf(needle) >= 0;
        });
    }

    async function queryTable(table, queryFn){
        try{
            var q = db.from(table).select('*');
            if(queryFn) q = queryFn(q);
            var res = await q;
            if(res.error) throw res.error;
            return { data:res.data || [], error:null };
        }catch(e){
            return { data:[], error:e };
        }
    }
    async function readFirstAvailable(kind, sources){
        var failures = [];
        for(var i=0;i<sources.length;i++){
            var src = sources[i];
            var res = await queryTable(src.table, src.query);
            if(res.error){
                failures.push(src.table+' : '+(res.error.message || res.error));
                continue;
            }
            if(res.data.length || i === sources.length - 1){
                if(src.onUse) src.onUse();
                if(i > 0 && res.data.length){
                    state.warnings.push({ title:'Source '+kind+' adaptee', body:'Donnees lues depuis '+src.table+'.' });
                }
                return (res.data || []).map(src.normalize || function(x){ return x; });
            }
        }
        failures.forEach(function(msg){ state.warnings.push({ title:'Source '+kind+' indisponible', body:msg }); });
        return [];
    }

    function dailyRows(orders){
        var lookup = clientLookup();
        var grouped = groupBy(orders, function(o){ return o._day || 'Sans date'; });
        return Object.keys(grouped).map(function(day){
            var rows = grouped[day];
            var byClient = groupBy(rows, function(o){ return o._client_key; });
            var topKey = Object.keys(byClient).sort(function(a,b){
                var ap = byClient[a].reduce(function(s,o){ return s + o._parcels; },0);
                var bp = byClient[b].reduce(function(s,o){ return s + o._parcels; },0);
                return bp - ap;
            })[0];
            return {
                day: day,
                orders: rows.length,
                parcels: rows.reduce(function(s,o){ return s + o._parcels; },0),
                revenue: rows.reduce(function(s,o){ return s + o._price; },0),
                clients: Object.keys(byClient).length,
                topClient: clientName(topKey, lookup)
            };
        }).sort(function(a,b){ return String(b.day).localeCompare(String(a.day)); });
    }

    function clientRows(orders){
        var lookup = clientLookup();
        var grouped = groupBy(orders, function(o){ return o._client_key; });
        return Object.keys(grouped).map(function(key){
            var rows = grouped[key];
            var revenue = rows.reduce(function(s,o){ return s + o._price; },0);
            var parcelsCount = rows.reduce(function(s,o){ return s + o._parcels; },0);
            var latest = rows.map(function(o){ return o._day; }).filter(Boolean).sort().pop() || '';
            return {
                key: key,
                name: clientName(key, lookup),
                orders: rows.length,
                parcels: parcelsCount,
                revenue: revenue,
                avg: rows.length ? revenue / rows.length : 0,
                latest: latest
            };
        }).sort(function(a,b){ return b.revenue - a.revenue || b.parcels - a.parcels; });
    }

    function renderKPIs(orders, clients, days){
        var totalParcels = orders.reduce(function(s,o){ return s + o._parcels; },0);
        var revenue = orders.reduce(function(s,o){ return s + o._price; },0);
        var daysCount = days.length;
        var activeClients = clients.length;
        var avgParcels = daysCount ? totalParcels / daysCount : 0;
        var avgClientRevenue = activeClients ? revenue / activeClients : 0;
        var cards = [
            ['Colis deposes', int(totalParcels), 'Periode filtree', 'fa-boxes-stacked', '#ff8a00'],
            ['Commandes', int(orders.length), 'Lignes transport', 'fa-clipboard-list', '#3b82f6'],
            ['CA total', money(revenue), 'Prix factures', 'fa-franc-sign', '#22c55e'],
            ['Clients actifs', int(activeClients), 'Avec depot', 'fa-building', '#a855f7'],
            ['Jours actifs', int(daysCount), 'Avec colis', 'fa-calendar-day', '#facc15'],
            ['Moyenne jour', int(avgParcels), 'Colis par jour actif', 'fa-chart-simple', '#e8311a'],
            ['CA moyen client', money(avgClientRevenue), 'Sur clients actifs', 'fa-scale-balanced', '#14b8a6']
        ];
        $('summaryCards').innerHTML = cards.map(function(c){
            return '<article class="kpi-card" style="--accent:'+c[4]+'"><div class="kpi-top"><span class="kpi-label">'+esc(c[0])+'</span><span class="kpi-icon"><i class="fas '+c[3]+'"></i></span></div><div class="kpi-value">'+esc(c[1])+'</div><div class="kpi-sub">'+esc(c[2])+'</div></article>';
        }).join('');
    }

    function renderDailyTable(rows){
        $('dailyCount').textContent = rows.length+' jour'+(rows.length>1?'s':'');
        if(!rows.length){
            $('dailyTable').innerHTML = '<tr><td colspan="6" class="empty">Aucun depot sur cette periode.</td></tr>';
            return;
        }
        $('dailyTable').innerHTML = rows.map(function(r){
            return '<tr><td><div class="cell-main">'+esc(dayLabel(r.day))+'</div><div class="cell-sub">'+esc(r.day)+'</div></td><td><span class="num">'+int(r.parcels)+'</span></td><td>'+int(r.orders)+'</td><td>'+int(r.clients)+'</td><td><span class="money">'+money(r.revenue)+'</span></td><td><span class="pill pill-orange">'+esc(r.topClient)+'</span></td></tr>';
        }).join('');
    }

    function renderClientTable(rows){
        $('clientCount').textContent = rows.length+' client'+(rows.length>1?'s':'');
        if(!rows.length){
            $('clientTable').innerHTML = '<tr><td colspan="6" class="empty">Aucun client trouve sur cette periode.</td></tr>';
            return;
        }
        $('clientTable').innerHTML = rows.map(function(r){
            return '<tr><td><div class="cell-main">'+esc(r.name)+'</div><div class="cell-sub">'+esc(String(r.key).replace(/^name:/,''))+'</div></td><td><span class="num">'+int(r.parcels)+'</span></td><td>'+int(r.orders)+'</td><td><span class="money">'+money(r.revenue)+'</span></td><td>'+money(r.avg)+'</td><td><span class="pill pill-green">'+esc(r.latest ? dayLabel(r.latest) : '—')+'</span></td></tr>';
        }).join('');
    }

    function destroyCharts(){
        Object.keys(charts).forEach(function(id){ if(charts[id]) charts[id].destroy(); });
        charts = {};
    }
    function configureCharts(){
        if(!window.Chart) return;
        Chart.defaults.color = 'rgba(255,255,255,.68)';
        Chart.defaults.borderColor = 'rgba(255,255,255,.09)';
        Chart.defaults.font.family = 'Outfit, Arial, sans-serif';
    }
    function renderCharts(days, clients){
        if(!window.Chart) return;
        destroyCharts();
        var orderedDays = days.slice().sort(function(a,b){ return String(a.day).localeCompare(String(b.day)); });
        var visibleDays = orderedDays.length > 45 ? orderedDays.slice(-45) : orderedDays;
        $('dailyChartSub').textContent = visibleDays.length+' jour'+(visibleDays.length>1?'s':'')+' affiche'+(visibleDays.length>1?'s':'');
        charts.daily = new Chart($('chartDailyDeposits'), {
            type:'line',
            data:{ labels:visibleDays.map(function(r){ return r.day.slice(5); }), datasets:[{ label:'Colis', data:visibleDays.map(function(r){ return r.parcels; }), borderColor:'#ff8a00', backgroundColor:'rgba(255,138,0,.16)', fill:true, tension:.35, pointRadius:3 }] },
            options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, scales:{ x:{ grid:{ display:false } }, y:{ beginAtZero:true, ticks:{ precision:0 } } } }
        });
        var topClients = clients.slice(0,10).reverse();
        charts.clients = new Chart($('chartClientRevenue'), {
            type:'bar',
            data:{ labels:topClients.map(function(r){ return r.name.length > 18 ? r.name.slice(0,18)+'...' : r.name; }), datasets:[{ label:'CA', data:topClients.map(function(r){ return r.revenue; }), backgroundColor:'#e8311a', borderRadius:7 }] },
            options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false }, tooltip:{ callbacks:{ label:function(ctx){ return money(ctx.raw); } } } }, scales:{ x:{ beginAtZero:true, ticks:{ callback:function(v){ return money(v); } } }, y:{ grid:{ display:false } } } }
        });
    }

    function renderWarnings(){
        if(!state.warnings.length){
            $('warnings').innerHTML = '';
            return;
        }
        $('warnings').innerHTML = state.warnings.map(function(w){
            return '<div class="warning"><strong>'+esc(w.title)+'</strong>'+esc(w.body)+'</div>';
        }).join('');
    }

    function renderAll(){
        var orders = filteredOrders();
        var days = dailyRows(orders);
        var clients = clientRows(orders);
        renderKPIs(orders, clients, days);
        renderDailyTable(days);
        renderClientTable(clients);
        renderCharts(days, clients);
        renderWarnings();
        $('lastSync').textContent = 'Derniere synchro '+new Date().toLocaleTimeString('fr-CH', { hour:'2-digit', minute:'2-digit' });
        $('dataScope').textContent = orders.length+' commande'+(orders.length>1?'s':'')+' · '+state.orderSource;
    }

    function exportCsv(){
        var rows = clientRows(filteredOrders());
        var lines = [['Client','Colis','Commandes','CA CHF','Panier moyen CHF','Dernier depot']];
        rows.forEach(function(r){
            lines.push([r.name, r.parcels, r.orders, r.revenue.toFixed(2), r.avg.toFixed(2), r.latest]);
        });
        var csv = lines.map(function(row){
            return row.map(function(cell){ return '"'+String(cell == null ? '' : cell).replace(/"/g,'""')+'"'; }).join(';');
        }).join('\n');
        var blob = new Blob([csv], { type:'text/csv;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'colixo-ca-clients-'+new Date().toISOString().slice(0,10)+'.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    async function loadData(){
        state.warnings = [];
        state.orderSource = 'orders';
        state.clientSource = 'clients';
        state.orders = await readFirstAvailable('commandes', [
            { table:'orders', query:function(q){ return q.order('created_at', { ascending:false }).limit(20000); }, normalize:normalizeOrder, onUse:function(){ state.orderSource = 'orders'; } },
            { table:'transport_orders_simple', query:function(q){ return q.order('created_at', { ascending:false }).limit(20000); }, normalize:normalizeOrder, onUse:function(){ state.orderSource = 'transport_orders_simple'; } }
        ]);
        state.clients = await readFirstAvailable('clients', [
            { table:'clients', query:function(q){ return q.limit(5000); }, normalize:normalizeClient, onUse:function(){ state.clientSource = 'clients'; } },
            { table:'entreprises', query:function(q){ return q.limit(5000); }, normalize:normalizeClient, onUse:function(){ state.clientSource = 'entreprises'; } }
        ]);
        if(state.orders.length && state.orders.every(function(o){ return !o._price; })){
            state.warnings.push({
                title:'Chiffre d’affaires non detecte',
                body:'Aucune valeur trouvee dans price, price_chf, prix_chf ou total_price_chf. La page affiche les colis, mais le CA restera a 0 tant que le prix n’est pas renseigne.'
            });
        }
        renderAll();
    }

    async function init(){
        db = window.SUPABASE_CLIENT;
        if(!db) throw new Error('Supabase non charge');
        if(window.colixoRequireRoute){
            var auth = await window.colixoRequireRoute({ roles:['admin','super_admin'], legacyRoles:['admin','super_admin'], redirectTo:'../login/index.html' });
            if(!auth) return;
        }
        configureCharts();
        $('periodSelect').addEventListener('change', function(e){ state.period = e.target.value; renderAll(); });
        $('clientSearch').addEventListener('input', function(e){ state.search = e.target.value || ''; renderAll(); });
        $('btnRefresh').addEventListener('click', function(){ loadData().then(function(){ toast('Depots clients actualises', true); }).catch(function(e){ toast(e.message || e, false); }); });
        $('btnExport').addEventListener('click', exportCsv);
        await loadData();
    }

    window.loadClientDepositStats = loadData;

    document.addEventListener('DOMContentLoaded', function(){
        init().catch(function(e){
            $('summaryCards').innerHTML = '<div class="loading">'+esc(e.message || e)+'</div>';
            toast(e.message || e, false);
        });
    });
})();
