(function(){
    'use strict';

    var db = null;
    var map = null;
    var mapLayer = null;
    var state = {
        clients: [],
        schedules: [],
        pickups: [],
        orders: [],
        vehicles: [],
        postalZones: [],
        editingId: null
    };

    var POSTAL_FALLBACK = [
        [1000,1499,'ROM','ROM_VD_GE'], [1500,2999,'ROM','ROM_NE_JU_FR'],
        [3000,4999,'ALE','ALE_BE_BS_BL_SO'], [5000,5999,'ALE','ALE_ZH_AG'],
        [6000,6499,'ALE','ALE_OST'], [6500,6999,'TIC','TIC_MAIN'],
        [7000,7999,'GRI','GRI_MAIN'], [8000,8999,'ALE','ALE_ZH_AG'], [9000,9999,'ALE','ALE_OST']
    ].map(function(r){ return { postcode_from:r[0], postcode_to:r[1], region_code:r[2], zone_code:r[3] }; });
    var DAY_LABELS = { 1:'Lun', 2:'Mar', 3:'Mer', 4:'Jeu', 5:'Ven', 6:'Sam', 7:'Dim' };

    function $(id){ return document.getElementById(id); }
    function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    function n(v){ var x = Number(v); return isFinite(x) ? x : 0; }
    function todayIso(){ return new Date().toISOString().slice(0,10); }
    function dayIndex(date){ var d = date.getDay(); return d === 0 ? 7 : d; }
    function cleanTime(v){ return String(v || '').slice(0,5); }
    function postcodeFrom(value){ var m = String(value || '').match(/\b([1-9]\d{3})\b/); return m ? m[1] : ''; }
    function cityFromAddress(value){
        var pc = postcodeFrom(value);
        if(!pc) return '';
        var parts = String(value || '').split(pc);
        return (parts[1] || '').replace(/^[,\s]+/,'').trim().split(',')[0] || '';
    }
    function toast(msg, ok){
        var el = $('toast');
        if(!el) return;
        el.textContent = msg;
        el.style.color = ok === false ? '#fca5a5' : '#fff';
        el.classList.add('show');
        clearTimeout(toast._t);
        toast._t = setTimeout(function(){ el.classList.remove('show'); }, 4200);
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

    async function firstAvailable(sources){
        for(var i=0;i<sources.length;i++){
            var src = sources[i];
            var res = await queryTable(src.table, src.query);
            if(!res.error && (res.data.length || i === sources.length - 1)){
                return (res.data || []).map(src.normalize || function(x){ return x; });
            }
        }
        return [];
    }

    function clientName(id){
        var row = state.clients.find(function(c){ return String(c.id) === String(id); });
        if(!row) return id ? 'Client '+String(id).slice(0,8) : 'Client non renseigne';
        return row.company_name || row.nom || row.name || row.email || 'Client';
    }

    function vehicleCapacity(id){
        var row = state.vehicles.find(function(v){ return String(v.id) === String(id); });
        return row ? n(row.capacity_parcels || row.capacity || row.capacite) : 0;
    }

    function normalizeClient(row){
        var r = Object.assign({}, row || {});
        r.company_name = r.company_name || r.nom || r.name || r.raison_sociale || r.email || 'Client';
        return r;
    }

    function normalizeVehicle(row){
        var r = Object.assign({}, row || {});
        r.capacity_parcels = r.capacity_parcels || r.capacity || r.capacite || 0;
        return r;
    }

    function normalizeOrder(row){
        var r = Object.assign({}, row || {});
        r.delivery_lat = r.delivery_lat || r.destination_lat;
        r.delivery_lng = r.delivery_lng || r.destination_lng;
        return r;
    }

    function findPostalZone(postcode){
        var pc = parseInt(postcodeFrom(postcode), 10);
        if(!pc) return null;
        var list = state.postalZones.length ? state.postalZones : POSTAL_FALLBACK;
        return list.find(function(z){
            return pc >= parseInt(z.postcode_from,10) && pc <= parseInt(z.postcode_to,10);
        }) || null;
    }

    function scheduleDays(schedule){
        return Array.isArray(schedule.days_of_week) ? schedule.days_of_week.map(Number).filter(Boolean) : [];
    }

    function scheduleMatchesDate(schedule, date){
        if(schedule.is_active === false) return false;
        if(schedule.frequency_type === 'daily') return true;
        var days = scheduleDays(schedule);
        return days.indexOf(dayIndex(date)) >= 0;
    }

    function pickupPayloadFromSchedule(schedule, dateIso){
        var pc = postcodeFrom(schedule.pickup_address);
        var zone = findPostalZone(pc) || {};
        return {
            schedule_id:schedule.id,
            client_id:schedule.client_id || null,
            pickup_date:dateIso,
            pickup_address:schedule.pickup_address,
            pickup_postcode:pc || null,
            pickup_city:cityFromAddress(schedule.pickup_address) || null,
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

    async function generateTodayPickups(){
        var date = todayIso();
        var targetDate = new Date(date+'T12:00:00');
        var schedules = state.schedules.filter(function(s){ return scheduleMatchesDate(s, targetDate); });
        if(!schedules.length) return 0;
        var existing = await firstAvailable([
            { table:'pickups', query:function(q){ return q.eq('pickup_date', date).limit(2000); } }
        ]);
        var existingKeys = {};
        existing.forEach(function(p){ if(p.schedule_id) existingKeys[p.schedule_id] = true; });
        var payloads = schedules.filter(function(s){ return !existingKeys[s.id]; }).map(function(s){ return pickupPayloadFromSchedule(s, date); });
        if(!payloads.length) return 0;
        var res = await db.from('pickups').insert(payloads).select('id');
        if(res.error) throw res.error;
        return payloads.length;
    }

    async function loadData(generate){
        var date = todayIso();
        state.clients = await firstAvailable([
            { table:'clients', query:function(q){ return q.limit(3000); }, normalize:normalizeClient },
            { table:'entreprises', query:function(q){ return q.limit(3000); }, normalize:normalizeClient }
        ]);
        state.clients.sort(function(a,b){ return clientName(a.id).localeCompare(clientName(b.id), 'fr'); });
        state.postalZones = await firstAvailable([{ table:'postal_zones', query:function(q){ return q.limit(3000); } }]);
        state.vehicles = await firstAvailable([
            { table:'vehicles', query:function(q){ return q.limit(1200); }, normalize:normalizeVehicle },
            { table:'vehicules', query:function(q){ return q.limit(1200); }, normalize:normalizeVehicle }
        ]);
        state.schedules = await firstAvailable([
            { table:'pickup_schedules', query:function(q){ return q.order('created_at', { ascending:false }).limit(3000); } }
        ]);
        if(generate) await generateTodayPickups();
        state.pickups = await firstAvailable([
            { table:'pickups', query:function(q){ return q.eq('pickup_date', date).order('time_window_start', { ascending:true }).limit(2000); } }
        ]);
        state.orders = await firstAvailable([
            { table:'transport_orders_simple', query:function(q){ return q.order('created_at', { ascending:false }).limit(500); }, normalize:normalizeOrder },
            { table:'orders', query:function(q){ return q.order('created_at', { ascending:false }).limit(500); }, normalize:normalizeOrder }
        ]);
        renderAll();
    }

    function renderClientOptions(){
        var opts = '<option value="">Client non renseigne</option>' + state.clients.map(function(c){
            return '<option value="'+esc(c.id)+'">'+esc(c.company_name || c.nom || c.name || c.email || c.id)+'</option>';
        }).join('');
        $('pickupClient').innerHTML = opts;
    }

    function frequencyLabel(s){
        if(s.frequency_type === 'daily') return 'Tous les jours';
        var labels = scheduleDays(s).map(function(d){ return DAY_LABELS[d] || d; }).join(', ');
        return (s.frequency_type === 'weekly' ? 'Hebdomadaire' : 'Personnalise') + (labels ? ' · '+labels : '');
    }

    function priorityClass(p){
        return p === 'express' ? 'priority-express' : (p === 'high' || p === 'urgent') ? 'priority-high' : '';
    }

    function renderStats(){
        var active = state.schedules.filter(function(s){ return s.is_active !== false; }).length;
        var pending = state.pickups.filter(function(p){ return ['pending','planned','assigned'].indexOf(String(p.status || '')) >= 0; }).length;
        var alerts = buildAlerts().length;
        var parcels = state.pickups.reduce(function(sum,p){ return sum + n(p.estimated_parcels); }, 0);
        var stats = [
            [state.pickups.length, 'Ramasses aujourd hui'],
            [active, 'Regles actives'],
            [pending, 'A traiter'],
            [alerts, 'Alertes'],
            [parcels, 'Colis estimes']
        ];
        $('pickupStats').innerHTML = stats.map(function(s){ return '<div class="pickup-stat"><b>'+esc(s[0])+'</b><span>'+esc(s[1])+'</span></div>'; }).join('');
        $('todayLabel').textContent = new Date().toLocaleDateString('fr-CH', { weekday:'long', day:'2-digit', month:'2-digit' });
        $('lastSync').textContent = 'Derniere synchro '+new Date().toLocaleTimeString('fr-CH', { hour:'2-digit', minute:'2-digit' });
    }

    function renderSchedules(){
        $('schedulesTable').innerHTML = state.schedules.length ? state.schedules.map(function(s){
            return '<tr><td><strong>'+esc(clientName(s.client_id))+'</strong><br><span class="muted">'+esc(s.contact_name || '')+'</span></td>'
                +'<td>'+esc(frequencyLabel(s))+'</td>'
                +'<td>'+esc(cleanTime(s.time_window_start))+' - '+esc(cleanTime(s.time_window_end))+'</td>'
                +'<td>'+esc(s.estimated_parcels || 0)+' colis<br><span class="muted">'+esc(s.estimated_weight_kg || 0)+' kg</span></td>'
                +'<td><span class="pill '+(s.is_active === false ? 'status-inactive' : 'status-active')+'">'+(s.is_active === false ? 'Inactif' : 'Actif')+'</span></td>'
                +'<td><button class="btn btn-ghost btn-sm" onclick="editPickupSchedule(&quot;'+esc(s.id)+'&quot;)">Modifier</button> '
                +'<button class="btn btn-ghost btn-sm" onclick="togglePickupSchedule(&quot;'+esc(s.id)+'&quot;)">'+(s.is_active === false ? 'Activer' : 'Pause')+'</button></td></tr>';
        }).join('') : '<tr><td colspan="6">Aucune ramasse recurrente configuree.</td></tr>';
    }

    function renderTodayPickups(){
        $('todayPickupsTable').innerHTML = state.pickups.length ? state.pickups.map(function(p){
            return '<tr class="pickup-row"><td><strong>'+esc(clientName(p.client_id))+'</strong><br><span class="pickup-badge">RAMASSE RECURRENTE</span></td>'
                +'<td>'+esc(cleanTime(p.time_window_start))+' - '+esc(cleanTime(p.time_window_end))+'</td>'
                +'<td>'+esc(p.pickup_address || '')+'<br><span class="muted">'+esc(p.contact_name || '')+' '+esc(p.contact_phone || '')+'</span></td>'
                +'<td>'+esc(p.estimated_parcels || 0)+' colis<br><span class="muted">'+esc(p.estimated_weight_kg || 0)+' kg</span></td>'
                +'<td class="'+priorityClass(p.priority)+'">'+esc(p.priority || 'normal')+'</td>'
                +'<td><span class="pill '+(p.status === 'picked_up' ? 'p-local' : 'p-24h')+'">'+esc(p.status || 'pending')+'</span></td></tr>';
        }).join('') : '<tr><td colspan="6">Aucune ramasse generee pour aujourd hui.</td></tr>';
    }

    function endDateTime(p){
        if(!p.pickup_date || !p.time_window_end) return null;
        return new Date(p.pickup_date+'T'+cleanTime(p.time_window_end)+':00');
    }

    function buildAlerts(){
        var now = new Date();
        var alerts = [];
        state.pickups.forEach(function(p){
            var done = ['picked_up','failed','cancelled'].indexOf(String(p.status || '')) >= 0;
            var end = endDateTime(p);
            if(!done && !p.assigned_driver_id){
                alerts.push({ level:'orange', title:'Ramasse non affectee', body:clientName(p.client_id)+' · '+cleanTime(p.time_window_start)+'-'+cleanTime(p.time_window_end) });
            }
            if(!done && end){
                var minutes = Math.round((end.getTime() - now.getTime()) / 60000);
                if(minutes < 0) alerts.push({ level:'red', title:'Ramasse depassee', body:clientName(p.client_id)+' · limite '+cleanTime(p.time_window_end) });
                else if(minutes <= 45) alerts.push({ level:'orange', title:'Ramasse proche limite', body:clientName(p.client_id)+' · '+minutes+' min restantes' });
            }
            var cap = vehicleCapacity(p.assigned_vehicle_id);
            if(cap && n(p.estimated_parcels) > cap){
                alerts.push({ level:'red', title:'Capacite vehicule depassee', body:clientName(p.client_id)+' · '+p.estimated_parcels+' colis pour capacite '+cap });
            }
        });
        return alerts;
    }

    function renderAlerts(){
        var colors = { green:'#22c55e', orange:'#f97316', red:'#e8311a' };
        var alerts = buildAlerts();
        if(!alerts.length) alerts = [{ level:'green', title:'Ramasses sous controle', body:'Aucune alerte critique pour les ramasses du jour.' }];
        $('pickupAlerts').innerHTML = alerts.slice(0,12).map(function(a){
            return '<div class="pickup-alert" style="--accent:'+colors[a.level || 'orange']+'"><strong>'+esc(a.title)+'</strong><span>'+esc(a.body)+'</span></div>';
        }).join('');
    }

    function renderMap(){
        if(!window.L) return;
        if(!map){
            map = L.map('pickupsMap', { scrollWheelZoom:false }).setView([46.85, 8.2], 8);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution:'&copy; OpenStreetMap' }).addTo(map);
            mapLayer = L.layerGroup().addTo(map);
        }
        mapLayer.clearLayers();
        var points = [];
        state.orders.forEach(function(o){
            var lat = parseFloat(o.delivery_lat), lng = parseFloat(o.delivery_lng);
            if(!isFinite(lat) || !isFinite(lng)) return;
            points.push([lat,lng]);
            L.circleMarker([lat,lng], { radius:5, color:'#22c55e', fillColor:'#22c55e', fillOpacity:.75, weight:1 }).addTo(mapLayer)
                .bindPopup('<strong>Livraison</strong><br>'+esc(o.delivery_address || o.address || ''));
        });
        state.pickups.forEach(function(p){
            var lat = parseFloat(p.pickup_lat), lng = parseFloat(p.pickup_lng);
            if(!isFinite(lat) || !isFinite(lng)) return;
            points.push([lat,lng]);
            L.circleMarker([lat,lng], { radius:7, color:'#f97316', fillColor:'#f97316', fillOpacity:.9, weight:2 }).addTo(mapLayer)
                .bindPopup('<strong>RAMASSE RECURRENTE</strong><br>'+esc(clientName(p.client_id))+'<br>'+esc(cleanTime(p.time_window_start))+'-'+esc(cleanTime(p.time_window_end))+' · '+esc(p.estimated_parcels || 0)+' colis<br>'+esc(p.driver_notes || ''));
        });
        if(points.length) map.fitBounds(points, { padding:[28,28] });
        else map.setView([46.85, 8.2], 8);
        setTimeout(function(){ map.invalidateSize(); }, 120);
    }

    function renderAll(){
        renderClientOptions();
        renderStats();
        renderSchedules();
        renderTodayPickups();
        renderAlerts();
        renderMap();
    }

    function selectedDays(){
        return Array.prototype.slice.call(document.querySelectorAll('#daysGrid input:checked')).map(function(el){ return parseInt(el.value,10); }).sort(function(a,b){ return a-b; });
    }

    function setSelectedDays(days){
        days = (days || []).map(Number);
        document.querySelectorAll('#daysGrid input').forEach(function(el){ el.checked = days.indexOf(parseInt(el.value,10)) >= 0; });
    }

    function syncFrequencyUi(){
        var daily = $('frequencyType').value === 'daily';
        $('daysGrid').classList.toggle('disabled', daily);
    }

    function resetForm(){
        state.editingId = null;
        $('formTitle').textContent = 'Nouvelle ramasse';
        $('scheduleId').value = '';
        $('pickupForm').reset();
        $('isActive').checked = true;
        $('estimatedParcels').value = '1';
        $('estimatedWeight').value = '0';
        setSelectedDays([]);
        syncFrequencyUi();
    }

    function fillForm(schedule){
        state.editingId = schedule.id;
        $('formTitle').textContent = 'Modifier ramasse';
        $('scheduleId').value = schedule.id;
        $('pickupClient').value = schedule.client_id || '';
        $('pickupAddress').value = schedule.pickup_address || '';
        $('contactName').value = schedule.contact_name || '';
        $('contactPhone').value = schedule.contact_phone || '';
        $('frequencyType').value = schedule.frequency_type || 'daily';
        $('isActive').checked = schedule.is_active !== false;
        setSelectedDays(scheduleDays(schedule));
        $('timeStart').value = cleanTime(schedule.time_window_start);
        $('timeEnd').value = cleanTime(schedule.time_window_end);
        $('estimatedParcels').value = schedule.estimated_parcels || 1;
        $('estimatedWeight').value = schedule.estimated_weight_kg || 0;
        $('packageType').value = schedule.package_type || 'colis';
        $('priority').value = schedule.priority || 'normal';
        $('pickupLat').value = schedule.pickup_lat || '';
        $('pickupLng').value = schedule.pickup_lng || '';
        $('driverNotes').value = schedule.driver_notes || '';
        syncFrequencyUi();
        window.scrollTo({ top:0, behavior:'smooth' });
    }

    function formPayload(){
        var freq = $('frequencyType').value;
        var days = freq === 'daily' ? [] : selectedDays();
        if(freq === 'weekly' && days.length !== 1) throw new Error('Choisis un seul jour pour une ramasse hebdomadaire.');
        if(freq === 'custom' && !days.length) throw new Error('Choisis au moins un jour personnalise.');
        var start = $('timeStart').value;
        var end = $('timeEnd').value;
        if(!start || !end) throw new Error('La fenetre horaire est obligatoire.');
        if(end <= start) throw new Error('L heure de fin doit etre apres l heure de debut.');
        var lat = $('pickupLat').value.trim();
        var lng = $('pickupLng').value.trim();
        return {
            client_id:$('pickupClient').value || null,
            pickup_address:$('pickupAddress').value.trim(),
            pickup_lat:lat ? parseFloat(lat) : null,
            pickup_lng:lng ? parseFloat(lng) : null,
            contact_name:$('contactName').value.trim() || null,
            contact_phone:$('contactPhone').value.trim() || null,
            frequency_type:freq,
            days_of_week:days,
            time_window_start:start,
            time_window_end:end,
            estimated_parcels:parseInt($('estimatedParcels').value, 10) || 0,
            estimated_weight_kg:parseFloat($('estimatedWeight').value) || 0,
            package_type:$('packageType').value || 'colis',
            priority:$('priority').value || 'normal',
            driver_notes:$('driverNotes').value.trim() || null,
            is_active:$('isActive').checked
        };
    }

    async function saveSchedule(ev){
        ev.preventDefault();
        try{
            var payload = formPayload();
            if(!payload.pickup_address) throw new Error('Adresse de ramasse obligatoire.');
            var id = $('scheduleId').value || state.editingId;
            var res = id
                ? await db.from('pickup_schedules').update(payload).eq('id', id).select('id').maybeSingle()
                : await db.from('pickup_schedules').insert([payload]).select('id').single();
            if(res.error) throw res.error;
            toast('Ramasse recurrente enregistree', true);
            resetForm();
            await loadData(true);
        }catch(e){
            toast(e.message || e, false);
        }
    }

    window.editPickupSchedule = function(id){
        var row = state.schedules.find(function(s){ return s.id === id; });
        if(row) fillForm(row);
    };

    window.togglePickupSchedule = async function(id){
        var row = state.schedules.find(function(s){ return s.id === id; });
        if(!row) return;
        var res = await db.from('pickup_schedules').update({ is_active:row.is_active === false }).eq('id', id);
        if(res.error) return toast(res.error.message, false);
        toast(row.is_active === false ? 'Ramasse activee' : 'Ramasse mise en pause', true);
        await loadData(true);
    };

    async function init(){
        db = window.SUPABASE_CLIENT;
        if(!db) throw new Error('Supabase JS v2 non charge');
        var auth = await window.colixoRequireRoute({ roles:['admin','super_admin'], legacyRoles:['admin','super_admin'], redirectTo:'../login/index.html' });
        if(!auth) return;
        $('pickupForm').addEventListener('submit', saveSchedule);
        $('btnResetForm').addEventListener('click', resetForm);
        $('frequencyType').addEventListener('change', syncFrequencyUi);
        $('btnRefresh').addEventListener('click', function(){ loadData(false).catch(function(e){ toast(e.message || e, false); }); });
        $('btnGenerateToday').addEventListener('click', function(){
            loadData(true).then(function(){ toast('Ramasses du jour synchronisees', true); }).catch(function(e){ toast(e.message || e, false); });
        });
        resetForm();
        await loadData(true);
    }

    document.addEventListener('DOMContentLoaded', function(){
        init().catch(function(e){
            console.error(e);
            toast(e.message || e, false);
            $('schedulesTable').innerHTML = '<tr><td colspan="6">Erreur : '+esc(e.message || e)+'</td></tr>';
        });
    });
})();
