(function(){
    'use strict';

    var db = null;
    var auth = null;
    var state = {
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1,
        search: '',
        selectedEmployeeId: null,
        data: {
            categories: [],
            employees: [],
            monthly_balances: [],
            category_totals: [],
            annual_balances: [],
            deductions: [],
            validations: [],
            rh_alerts: [],
            audit_logs: []
        },
        voidingId: null
    };

    function $(id){ return document.getElementById(id); }
    function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
    function n(v){ var x = Number(v); return isFinite(x) ? x : 0; }
    function nowIsoDate(){ return new Date().toISOString().slice(0,10); }
    function monthName(m){ return ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'][Number(m)-1] || '—'; }
    function dateFmt(v){ return v ? new Date(String(v).length === 10 ? v+'T12:00:00' : v).toLocaleDateString('fr-CH') : '—'; }
    function timeFmt(v){ return v ? new Date(v).toLocaleString('fr-CH', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' }) : '—'; }
    function normalize(v){ return String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
    function employeeName(e){ return [e && e.prenom, e && e.nom].filter(Boolean).join(' ').trim() || (e && e.email) || 'Employé'; }
    function roleLabel(role){ return { chauffeur:'Chauffeur', magasinier:'Magasinier', auxiliaire:'Auxiliaire' }[role] || role || '—'; }
    function adminId(){ return auth && auth.profile && auth.profile.id; }
    function readStoredAdminCode(){
        var stores = [];
        try { stores.push(localStorage); } catch(e) {}
        try { stores.push(sessionStorage); } catch(e) {}
        for(var i=0;i<stores.length;i++){
            try {
                var rawUser = stores[i].getItem('colixo_user');
                if(rawUser){
                    var user = JSON.parse(rawUser);
                    var userCode = user && (user.code || user.code_usr || user.code_acces || user.code_connexion);
                    if(userCode) return String(userCode).trim().toUpperCase();
                }
                var rawCode = stores[i].getItem('colixo_access_code');
                if(rawCode) return String(rawCode).trim().toUpperCase();
            } catch(e) {}
        }
        try {
            var match = document.cookie.match(/(?:^|;\s*)colixo_code=([^;]+)/);
            if(match) return decodeURIComponent(match[1]).trim().toUpperCase();
        } catch(e) {}
        return null;
    }
    function adminCode(){
        var p = auth && auth.profile || {};
        return p.code_usr || p.code || p.code_acces || p.code_connexion || readStoredAdminCode();
    }
    function toast(type, msg){
        var el = $('toast');
        $('toastIcon').textContent = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
        $('toastText').textContent = msg;
        el.className = 'toast '+type+' show';
        clearTimeout(toast._t);
        toast._t = setTimeout(function(){ el.classList.remove('show'); }, 4200);
    }
    function loading(on){ $('loader').classList.toggle('on', !!on); }
    function payload(data){ return typeof data === 'string' ? JSON.parse(data) : (data || {}); }

    async function callRpc(name, params){
        var res = await db.rpc(name, params || {});
        if(res.error) throw res.error;
        return res.data;
    }

    function selectedEmployee(){
        return state.data.employees.find(function(e){ return e.id === state.selectedEmployeeId; }) || null;
    }
    function annualFor(employeeId){
        return state.data.annual_balances.find(function(r){ return r.employee_id === employeeId && Number(r.period_year) === Number(state.year); }) || null;
    }
    function monthlyFor(employeeId, month){
        return state.data.monthly_balances.find(function(r){ return r.employee_id === employeeId && Number(r.period_year) === Number(state.year) && Number(r.period_month) === Number(month); }) || null;
    }
    function validationFor(employeeId){
        return state.data.validations.find(function(r){ return r.employee_id === employeeId && Number(r.period_year) === Number(state.year); }) || null;
    }
    function deductionsFor(employeeId){
        return state.data.deductions.filter(function(d){ return d.employee_id === employeeId && Number(d.period_year) === Number(state.year); });
    }
    function activeDeductionsFor(employeeId){
        return deductionsFor(employeeId).filter(function(d){ return !d.voided_at; });
    }
    function categoryRowsFor(employeeId){
        return state.data.category_totals.filter(function(r){
            return r.employee_id === employeeId && Number(r.period_year) === Number(state.year) && Number(r.period_month) === Number(state.month);
        });
    }
    function badgeForPercent(p){
        p = n(p);
        if(p >= 100) return 'b-green';
        if(p >= 75) return 'b-blue';
        if(p >= 50) return 'b-orange';
        return 'b-red';
    }
    function severityLabel(v){
        return { light:'Légère', medium:'Moyenne', serious:'Sérieuse' }[v] || v || '—';
    }
    function validationLabel(v){
        return { draft:'Brouillon', pending_direction:'À valider', validated:'Validée', rejected:'Refusée', paid:'Payée' }[v] || 'Non validée';
    }
    function alertLevelLabel(v){
        return { red:'Rouge', orange:'Orange', follow_up:'Suivi RH' }[v] || v || '—';
    }
    function alertStatusLabel(v){
        return {
            open:'Ouverte',
            reviewed:'Revue',
            interview_scheduled:'Entretien prévu',
            warning_draft:'Brouillon lettre',
            warning_sent:'Lettre remise',
            closed_no_action:'Clôturée sans suite'
        }[v] || v || '—';
    }
    function alertsForMonth(){
        return (state.data.rh_alerts || []).filter(function(a){
            return Number(a.period_year) === Number(state.year) && Number(a.period_month) === Number(state.month);
        });
    }

    function filteredEmployees(){
        var needle = normalize(state.search);
        var list = state.data.employees.slice();
        if(needle){
            list = list.filter(function(e){
                return normalize(employeeName(e)+' '+(e.email || '')+' '+(e.role || '')).indexOf(needle) >= 0;
            });
        }
        return list.sort(function(a,b){ return employeeName(a).localeCompare(employeeName(b), 'fr'); });
    }

    function fillSelectors(){
        var ySel = $('yearSelect');
        if(!ySel.options.length){
            var current = new Date().getFullYear();
            for(var y = current - 3; y <= current + 3; y++){
                ySel.insertAdjacentHTML('beforeend', '<option value="'+y+'">'+y+'</option>');
            }
        }
        ySel.value = String(state.year);
        var mSel = $('monthSelect');
        if(!mSel.options.length){
            for(var m=1;m<=12;m++) mSel.insertAdjacentHTML('beforeend', '<option value="'+m+'">'+monthName(m)+'</option>');
        }
        mSel.value = String(state.month);

        var cSel = $('categorySelect');
        if(!state.data.categories.length){
            cSel.innerHTML = '<option value="">Aucun critère chargé</option>';
            $('pointsInput').max = '100';
            $('pointsInput').value = '';
            return;
        }
        cSel.innerHTML = state.data.categories.map(function(c){
            return '<option value="'+esc(c.code)+'" data-max="'+esc(c.monthly_max_points)+'">'+esc(c.label)+' · max '+esc(c.monthly_max_points)+'</option>';
        }).join('');
        updatePointsMax();
    }

    function renderKPIs(){
        var employees = state.data.employees.length;
        var annual = state.data.annual_balances.filter(function(r){ return Number(r.period_year) === Number(state.year); });
        var avg = annual.length ? Math.round(annual.reduce(function(s,r){ return s+n(r.annual_points); },0) / annual.length) : 0;
        var full = annual.filter(function(r){ return n(r.estimated_prime_percent) === 100; }).length;
        var activeDeductions = state.data.deductions.filter(function(d){ return Number(d.period_year) === Number(state.year) && !d.voided_at; }).length;
        var voided = state.data.deductions.filter(function(d){ return Number(d.period_year) === Number(state.year) && d.voided_at; }).length;
        var cards = [
            ['Employés actifs', employees, 'Depuis utilisateurs', '#22c55e'],
            ['Moyenne annuelle', avg, '/ 1200 points', '#ff8a00'],
            ['Prime 100 %', full, 'Employés au barème max', '#3b82f6'],
            ['Retraits actifs', activeDeductions, 'Année sélectionnée', '#e8311a'],
            ['Retraits annulés', voided, 'Conservés en historique', '#a855f7']
        ];
        $('kpiGrid').innerHTML = cards.map(function(c){
            return '<article class="kpi" style="--accent:'+c[3]+'"><div class="kpi-label">'+esc(c[0])+'</div><div class="kpi-val">'+esc(c[1])+'</div><div class="kpi-sub">'+esc(c[2])+'</div></article>';
        }).join('');
    }

    function renderEmployees(){
        var rows = filteredEmployees();
        $('employeeCount').textContent = rows.length+' employé'+(rows.length>1?'s':'');
        if(!rows.length){
            $('employeeRows').innerHTML = '<tr><td colspan="5" class="empty">Aucun employé actif.</td></tr>';
            return;
        }
        if(!state.selectedEmployeeId || !rows.some(function(e){ return e.id === state.selectedEmployeeId; })){
            state.selectedEmployeeId = rows[0].id;
        }
        $('employeeRows').innerHTML = rows.map(function(e){
            var monthly = monthlyFor(e.id, state.month) || {};
            var annual = annualFor(e.id) || {};
            var val = validationFor(e.id);
            return '<tr class="employee-row '+(e.id === state.selectedEmployeeId ? 'active' : '')+'" data-employee-id="'+esc(e.id)+'">'
                +'<td><div class="cell-main">'+esc(employeeName(e))+'</div><div class="cell-sub">'+esc(roleLabel(e.role))+' · '+esc(e.email || '')+'</div></td>'
                +'<td><span class="score">'+esc(monthly.monthly_balance == null ? 100 : monthly.monthly_balance)+'</span><div class="cell-sub">/ 100 · '+esc(monthName(state.month))+'</div></td>'
                +'<td><span class="score">'+esc(annual.annual_points == null ? 1200 : annual.annual_points)+'</span><div class="cell-sub">Retirés '+esc(annual.annual_points_deducted || 0)+'</div></td>'
                +'<td><span class="badge '+badgeForPercent(annual.estimated_prime_percent)+'">'+esc(annual.estimated_prime_percent == null ? 100 : annual.estimated_prime_percent)+' %</span></td>'
                +'<td><span class="badge '+(val && val.status === 'validated' ? 'b-green' : val && val.status === 'rejected' ? 'b-red' : 'b-orange')+'">'+esc(validationLabel(val && val.status))+'</span></td>'
                +'</tr>';
        }).join('');
        document.querySelectorAll('.employee-row').forEach(function(row){
            row.addEventListener('click', function(){
                state.selectedEmployeeId = row.getAttribute('data-employee-id');
                renderAll();
            });
        });
    }

    function renderDetail(){
        var e = selectedEmployee();
        if(!e){
            $('detailName').textContent = 'Sélectionnez un employé';
            return;
        }
        var annual = annualFor(e.id) || {};
        var monthly = monthlyFor(e.id, state.month) || {};
        var active = activeDeductionsFor(e.id);
        var val = validationFor(e.id);
        $('detailName').textContent = employeeName(e);
        $('detailRole').textContent = roleLabel(e.role)+' · '+(e.email || '');
        $('annualScore').textContent = annual.annual_points == null ? '1200' : annual.annual_points;
        $('monthlyBalance').textContent = monthly.monthly_balance == null ? '100' : monthly.monthly_balance;
        $('annualPercent').textContent = (annual.estimated_prime_percent == null ? 100 : annual.estimated_prime_percent)+' %';
        $('deductionCount').textContent = active.length;
        $('finalPercent').value = String((val && val.final_prime_percent != null) ? val.final_prime_percent : (annual.estimated_prime_percent == null ? 100 : annual.estimated_prime_percent));
        $('validationStatus').value = val && val.status ? val.status : 'pending_direction';
        $('directionNote').value = val && val.direction_note ? val.direction_note : '';
    }

    function renderCategories(){
        var e = selectedEmployee();
        if(!e){
            $('categoryGrid').innerHTML = '<div class="empty">Sélectionnez un employé.</div>';
            return;
        }
        var rows = categoryRowsFor(e.id);
        if(!rows.length){
            $('categoryGrid').innerHTML = '<div class="empty">Aucune catégorie calculée. Exécutez la migration SQL 043.</div>';
            return;
        }
        $('categoryGrid').innerHTML = rows.map(function(r){
            var max = Math.max(1, n(r.monthly_max_points));
            var used = n(r.points_deducted);
            var pct = Math.min(100, Math.round(used / max * 100));
            return '<div class="cat-card"><strong>'+esc(r.category_label)+'</strong>'
                +'<div class="cat-line"><span style="width:'+pct+'%"></span></div>'
                +'<div class="cat-meta"><span>Retirés '+esc(used)+'</span><span>Solde '+esc(r.category_balance)+' / '+esc(max)+'</span></div></div>';
        }).join('');
    }

    function renderHistory(){
        var rows = state.data.deductions.filter(function(d){
            return Number(d.period_year) === Number(state.year)
                && (!state.selectedEmployeeId || d.employee_id === state.selectedEmployeeId);
        }).sort(function(a,b){ return String(b.created_at || '').localeCompare(String(a.created_at || '')); });
        if(!rows.length){
            $('historyRows').innerHTML = '<tr><td colspan="8" class="empty">Aucun retrait pour cette sélection.</td></tr>';
            return;
        }
        $('historyRows').innerHTML = rows.map(function(d){
            var voided = !!d.voided_at;
            return '<tr class="'+(voided?'history-voided':'')+'">'
                +'<td><div class="cell-main">'+esc(dateFmt(d.incident_date))+'</div><div class="cell-sub">'+esc(monthName(d.period_month))+' '+esc(d.period_year)+'</div></td>'
                +'<td>'+esc(d.employee_name || '—')+'</td>'
                +'<td>'+esc(d.category_label || d.category_code || '—')+'</td>'
                +'<td><span class="score">-'+esc(d.points_deducted)+'</span></td>'
                +'<td><span class="badge '+(d.severity === 'serious' ? 'b-red' : d.severity === 'medium' ? 'b-orange' : 'b-blue')+'">'+esc(severityLabel(d.severity))+'</span></td>'
                +'<td>'+esc(d.comment || '')+'</td>'
                +'<td><div class="cell-sub">Créé par '+esc(d.created_by_name || '—')+' · '+esc(timeFmt(d.created_at))+'</div>'+(voided?'<div class="cell-sub">Annulé par '+esc(d.voided_by_name || '—')+' · '+esc(timeFmt(d.voided_at))+'<br>'+esc(d.void_reason || '')+'</div>':'')+'</td>'
                +'<td><div class="actions">'+(voided?'<span class="badge b-blue">Annulé</span>':'<button class="btn btn-ghost btn-xs" data-void-id="'+esc(d.id)+'"><i class="fas fa-ban"></i> Annuler</button>')+'</div></td>'
                +'</tr>';
        }).join('');
        document.querySelectorAll('[data-void-id]').forEach(function(btn){
            btn.addEventListener('click', function(){
                state.voidingId = btn.getAttribute('data-void-id');
                $('voidReason').value = '';
                openVoidModal();
            });
        });
    }

    function renderAudit(){
        var rows = (state.data.audit_logs || []).filter(function(l){
            return !state.selectedEmployeeId || l.employee_id === state.selectedEmployeeId;
        }).slice(0,80);
        if(!rows.length){
            $('auditRows').innerHTML = '<div class="empty">Aucun audit pour cette sélection.</div>';
            return;
        }
        $('auditRows').innerHTML = rows.map(function(l){
            return '<div class="audit-item"><strong>'+esc(l.action)+' · '+esc(l.table_name)+'</strong><span>'+esc(l.employee_name || '—')+' · '+esc(l.actor_name || '—')+' · '+esc(timeFmt(l.event_at))+(l.note ? ' · '+esc(l.note) : '')+'</span></div>';
        }).join('');
    }

    function renderAlerts(){
        var rows = alertsForMonth();
        if(!rows.length){
            $('rhAlertRows').innerHTML = '<tr><td colspan="8" class="empty">Aucune alerte RH pour ce mois. Lancez l’analyse après les retraits de points.</td></tr>';
            return;
        }
        rows.sort(function(a,b){
            var weight = { red:1, orange:2, follow_up:3 };
            return (weight[a.severity_level] || 9) - (weight[b.severity_level] || 9)
                || String(b.created_at || '').localeCompare(String(a.created_at || ''));
        });
        $('rhAlertRows').innerHTML = rows.map(function(a){
            var canPrepare = a.severity_level === 'red' || a.alert_type === 'serious_count_3' || a.alert_type === 'manual_red';
            return '<tr>'
                +'<td><div class="cell-main">'+esc(a.employee_name || '—')+'</div><div class="cell-sub">'+esc(a.employee_email || '')+'</div></td>'
                +'<td>'+esc(monthName(a.period_month))+' '+esc(a.period_year)+'</td>'
                +'<td><span class="alert-level '+esc(a.severity_level || '')+'">'+esc(alertLevelLabel(a.severity_level))+'</span></td>'
                +'<td><div class="cell-main">'+esc(a.trigger_reason || '—')+'</div>'+(a.decision_note?'<div class="cell-sub">'+esc(a.decision_note)+'</div>':'')+'</td>'
                +'<td><span class="score">'+esc(a.serious_deductions_count || 0)+'</span><div class="cell-sub">Points serious '+esc(a.serious_points_total || 0)+'</div></td>'
                +'<td><span class="score">'+esc(a.total_points_deducted || 0)+'</span></td>'
                +'<td><span class="badge '+(a.status === 'closed_no_action' ? 'b-blue' : a.status === 'warning_draft' ? 'b-red' : a.status === 'interview_scheduled' ? 'b-orange' : 'b-green')+'">'+esc(alertStatusLabel(a.status))+'</span></td>'
                +'<td><div class="actions alert-actions">'
                +'<button class="btn btn-ghost btn-xs" data-alert-status="'+esc(a.id)+'" data-status="interview_scheduled"><i class="fas fa-calendar-check"></i> Entretien prévu</button>'
                +(canPrepare ? '<button class="btn btn-red btn-xs" data-warning-id="'+esc(a.id)+'"><i class="fas fa-file-signature"></i> Préparer une lettre</button>' : '')
                +'<button class="btn btn-ghost btn-xs" data-alert-status="'+esc(a.id)+'" data-status="closed_no_action"><i class="fas fa-check"></i> Clôturer sans suite</button>'
                +(a.warning_letter_text ? '<button class="btn btn-ghost btn-xs" data-show-warning="'+esc(a.id)+'"><i class="fas fa-eye"></i> Voir brouillon</button>' : '')
                +'</div></td>'
                +'</tr>';
        }).join('');

        document.querySelectorAll('[data-warning-id]').forEach(function(btn){
            btn.addEventListener('click', function(){ prepareWarningLetter(btn.getAttribute('data-warning-id')); });
        });
        document.querySelectorAll('[data-alert-status]').forEach(function(btn){
            btn.addEventListener('click', function(){ updateAlertStatus(btn.getAttribute('data-alert-status'), btn.getAttribute('data-status')); });
        });
        document.querySelectorAll('[data-show-warning]').forEach(function(btn){
            btn.addEventListener('click', function(){
                var alert = (state.data.rh_alerts || []).find(function(a){ return a.id === btn.getAttribute('data-show-warning'); });
                showWarningLetter(alert && alert.warning_letter_text || '');
            });
        });
    }

    function renderAll(){
        fillSelectors();
        renderKPIs();
        renderEmployees();
        renderDetail();
        renderCategories();
        renderAlerts();
        renderHistory();
        renderAudit();
    }

    async function loadDashboard(){
        loading(true);
        try{
            var data = await callRpc('admin_prime_dashboard', {
                p_admin_id: adminId(),
                p_code: adminCode(),
                p_year: Number(state.year)
            });
            state.data = Object.assign({
                categories: [],
                employees: [],
                monthly_balances: [],
                category_totals: [],
                annual_balances: [],
                deductions: [],
                validations: [],
                rh_alerts: [],
                audit_logs: []
            }, payload(data));
            renderAll();
            if(!state.data.categories.length) toast('error', 'Aucun critère prime chargé. Vérifiez la migration SQL 043.');
            if(!state.data.employees.length) toast('info', 'Aucun employé actif trouvé dans utilisateurs pour les rôles chauffeur, magasinier ou auxiliaire.');
        }finally{
            loading(false);
        }
    }

    function updatePointsMax(){
        var opt = $('categorySelect').selectedOptions[0];
        var max = opt ? Number(opt.getAttribute('data-max')) || 1 : 1;
        $('pointsInput').max = String(max);
        if(!$('pointsInput').value) $('pointsInput').value = String(Math.min(5, max));
    }

    async function saveDeduction(e){
        e.preventDefault();
        var employee = selectedEmployee();
        if(!employee){ toast('error', 'Sélectionnez un employé.'); return; }
        if(!$('categorySelect').value){ toast('error', 'Aucun critère disponible.'); return; }
        var comment = $('commentInput').value.trim();
        if(comment.length < 3){ toast('error', 'Commentaire obligatoire.'); return; }
        loading(true);
        try{
            await callRpc('admin_prime_add_deduction', {
                p_admin_id: adminId(),
                p_code: adminCode(),
                p_employee_id: employee.id,
                p_category_code: $('categorySelect').value,
                p_period_year: Number(state.year),
                p_period_month: Number(state.month),
                p_incident_date: $('incidentDate').value || nowIsoDate(),
                p_points_deducted: Number($('pointsInput').value || 0),
                p_severity: $('severitySelect').value,
                p_comment: comment,
                p_immediate_red_alert: $('immediateRedAlert').checked
            });
            $('commentInput').value = '';
            $('immediateRedAlert').checked = false;
            await generateAlerts(true);
            toast('success', 'Retrait enregistré.');
            await loadDashboard();
        }catch(err){
            toast('error', err.message || String(err));
        }finally{
            loading(false);
        }
    }

    async function generateAlerts(silent){
        loading(true);
        try{
            await callRpc('admin_prime_generate_alerts', {
                p_admin_id: adminId(),
                p_code: adminCode(),
                p_year: Number(state.year),
                p_month: Number(state.month)
            });
            if(!silent) toast('success', 'Alertes RH analysées pour le mois.');
            if(!silent) await loadDashboard();
        }catch(err){
            toast('error', err.message || String(err));
        }finally{
            loading(false);
        }
    }

    function showWarningLetter(text){
        $('warningLetterText').value = text || '';
        $('warningModal').classList.add('open');
    }
    function closeWarningModal(){ $('warningModal').classList.remove('open'); }

    async function prepareWarningLetter(alertId){
        loading(true);
        try{
            var row = await callRpc('admin_prime_prepare_warning_letter', {
                p_admin_id: adminId(),
                p_code: adminCode(),
                p_alert_id: alertId
            });
            var data = payload(row);
            showWarningLetter(data.warning_letter_text || '');
            toast('success', 'Brouillon préparé. Validation direction requise avant remise.');
            await loadDashboard();
        }catch(err){
            toast('error', err.message || String(err));
        }finally{
            loading(false);
        }
    }

    async function updateAlertStatus(alertId, status){
        var defaults = {
            interview_scheduled:'Entretien RH prévu.',
            closed_no_action:'Clôturé sans suite par décision RH.',
            reviewed:'Alerte revue.'
        };
        var note = window.prompt('Note de décision RH', defaults[status] || '');
        if(note === null) return;
        loading(true);
        try{
            await callRpc('admin_prime_update_alert_status', {
                p_admin_id: adminId(),
                p_code: adminCode(),
                p_alert_id: alertId,
                p_status: status,
                p_decision_note: note
            });
            toast('success', 'Statut RH mis à jour.');
            await loadDashboard();
        }catch(err){
            toast('error', err.message || String(err));
        }finally{
            loading(false);
        }
    }

    function openVoidModal(){ $('voidModal').classList.add('open'); }
    function closeVoidModal(){ $('voidModal').classList.remove('open'); state.voidingId = null; }

    async function confirmVoid(){
        var reason = $('voidReason').value.trim();
        if(!state.voidingId) return;
        if(reason.length < 3){ toast('error', 'Motif obligatoire.'); return; }
        loading(true);
        try{
            await callRpc('admin_prime_void_deduction', {
                p_admin_id: adminId(),
                p_code: adminCode(),
                p_deduction_id: state.voidingId,
                p_void_reason: reason
            });
            closeVoidModal();
            toast('success', 'Retrait annulé.');
            await loadDashboard();
        }catch(err){
            toast('error', err.message || String(err));
        }finally{
            loading(false);
        }
    }

    async function saveValidation(e){
        e.preventDefault();
        var employee = selectedEmployee();
        if(!employee){ toast('error', 'Sélectionnez un employé.'); return; }
        loading(true);
        try{
            await callRpc('admin_prime_validate_annual', {
                p_admin_id: adminId(),
                p_code: adminCode(),
                p_employee_id: employee.id,
                p_year: Number(state.year),
                p_final_prime_percent: Number($('finalPercent').value),
                p_status: $('validationStatus').value,
                p_direction_note: $('directionNote').value.trim() || null
            });
            toast('success', 'Validation enregistrée.');
            await loadDashboard();
        }catch(err){
            toast('error', err.message || String(err));
        }finally{
            loading(false);
        }
    }

    async function init(){
        db = window.SUPABASE_CLIENT;
        if(!db) throw new Error('Supabase non chargé.');
        auth = await window.colixoRequireRoute({
            roles:['admin','super_admin'],
            legacyRoles:['admin','super_admin'],
            redirectTo:'../login/index.html'
        });
        if(!auth || !auth.profile) return;
        if(!adminCode()) throw new Error('Code admin absent. Reconnectez-vous avec le code Colixo.');
        var p = auth.profile;
        $('sideAvatar').textContent = ((p.prenom || '').charAt(0)+(p.nom || '').charAt(0)).toUpperCase() || 'SA';
        $('sideName').textContent = [p.prenom, p.nom].filter(Boolean).join(' ') || 'Admin';
        $('incidentDate').value = nowIsoDate();
        $('yearSelect').addEventListener('change', function(e){ state.year = Number(e.target.value); loadDashboard().catch(function(err){ toast('error', err.message || String(err)); }); });
        $('monthSelect').addEventListener('change', function(e){ state.month = Number(e.target.value); renderAll(); });
        $('searchInput').addEventListener('input', function(e){ state.search = e.target.value || ''; renderAll(); });
        $('categorySelect').addEventListener('change', updatePointsMax);
        $('btnRefresh').addEventListener('click', function(){ loadDashboard().then(function(){ toast('success', 'Primes actualisées.'); }).catch(function(err){ toast('error', err.message || String(err)); }); });
        $('btnGenerateAlerts').addEventListener('click', function(){ generateAlerts(false); });
        $('deductionForm').addEventListener('submit', saveDeduction);
        $('validationForm').addEventListener('submit', saveValidation);
        $('btnCloseVoid').addEventListener('click', closeVoidModal);
        $('btnCancelVoid').addEventListener('click', closeVoidModal);
        $('btnConfirmVoid').addEventListener('click', confirmVoid);
        $('voidModal').addEventListener('click', function(e){ if(e.target === $('voidModal')) closeVoidModal(); });
        $('btnCloseWarning').addEventListener('click', closeWarningModal);
        $('btnCloseWarningFooter').addEventListener('click', closeWarningModal);
        $('warningModal').addEventListener('click', function(e){ if(e.target === $('warningModal')) closeWarningModal(); });
        $('btnCopyWarning').addEventListener('click', async function(){
            try {
                await navigator.clipboard.writeText($('warningLetterText').value || '');
                toast('success', 'Brouillon copié.');
            } catch(e) {
                toast('error', 'Copie impossible. Sélectionnez le texte manuellement.');
            }
        });
        $('btnLogout').addEventListener('click', function(){ window.colixoLogout(); });
        await loadDashboard();
    }

    document.addEventListener('DOMContentLoaded', function(){
        init().catch(function(err){
            loading(false);
            $('kpiGrid').innerHTML = '<div class="empty">'+esc(err.message || err)+'</div>';
            toast('error', err.message || String(err));
        });
    });
})();
