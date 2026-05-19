(function(){
    'use strict';

    var db = null;
    var currentTable = 'logistics_regions';
    var currentRows = [];
    var editingRow = null;
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

    var TABLES = {
        logistics_regions: {
            title:'Régions',
            sub:'Grandes régions nationales : Suisse romande, alémanique, Tessin, Grisons, zones industrielles.',
            order:'code',
            columns:['code','name','language_code','base_city','base_postcode','active'],
            fields:[
                ['code','Code','text',true], ['name','Nom','text',true], ['language_code','Langue','text',false],
                ['country_code','Pays','text',false], ['base_city','Ville base','text',false], ['base_postcode','NPA base','text',false],
                ['base_lat','Latitude base','number',false], ['base_lng','Longitude base','number',false], ['active','Actif','checkbox',false]
            ]
        },
        logistics_zones: {
            title:'Zones logistiques',
            sub:'Zones de livraison rattachées aux régions. Les cases changent la recommandation du dispatch : Colixo direct, express possible ou transporteur partenaire.',
            order:'code',
            columns:['region_code','code','name','color_hex','zone_type','service_24h','service_express','direct_colixo','default_partner_required','active'],
            labels:{region_code:'Région',code:'Code',name:'Nom',color_hex:'Couleur',zone_type:'Type',service_24h:'24h disponible',service_express:'Express possible',direct_colixo:'Livré par Colixo',default_partner_required:'Transporteur requis',active:'Actif'},
            fields:[
                ['region_code','Région','text',true], ['code','Code zone','text',true], ['name','Nom','text',true],
                ['color_hex','Couleur zone','color',false],
                ['zone_type','Type','text',false], ['service_48h','48h disponible','checkbox',false], ['service_24h','24h disponible','checkbox',false],
                ['service_express','Express possible','checkbox',false], ['direct_colixo','Livré par Colixo','checkbox',false],
                ['default_partner_required','Transporteur partenaire requis','checkbox',false], ['cutoff_time','Cut-off','time',false],
                ['center_lat','Latitude centre','number',false], ['center_lng','Longitude centre','number',false], ['active','Actif','checkbox',false]
            ]
        },
        postal_zones: {
            title:'Rattachement NPA',
            sub:'Plages de codes postaux suisses reliées à une région et une zone.',
            order:'postcode_from',
            columns:['postcode_from','postcode_to','region_code','zone_code','city','active'],
            fields:[
                ['postcode_from','NPA début','number',true], ['postcode_to','NPA fin','number',true], ['postcode','NPA précis optionnel','text',false],
                ['city','Ville optionnelle','text',false], ['region_code','Région','text',true], ['zone_code','Zone','text',true], ['active','Actif','checkbox',false]
            ]
        },
        linehauls: {
            title:'Lignes nationales',
            sub:'Transferts entre régions : origine, destination, horaires, cut-off et capacités.',
            order:'code',
            columns:['code','name','origin_region_code','destination_region_code','departure_time','arrival_time','service_levels','active'],
            fields:[
                ['code','Code','text',true], ['name','Nom','text',true], ['origin_region_code','Région départ','text',true],
                ['destination_region_code','Région arrivée','text',true], ['departure_time','Départ','time',false], ['arrival_time','Arrivée','time',false],
                ['service_levels','Services séparés par virgule','array',false], ['cutoff_time','Cut-off','time',false],
                ['days_of_week','Jours 1-5 séparés par virgule','intarray',false], ['capacity_parcels','Capacité colis','number',false],
                ['capacity_weight_kg','Capacité kg','number',false], ['partner_id','Partenaire ID optionnel','text',false], ['active','Actif','checkbox',false]
            ]
        },
        delivery_partners: {
            title:'Partenaires régionaux',
            sub:'Transporteurs partenaires utilisés pour les zones non couvertes directement par Colixo.',
            order:'code',
            columns:['code','name','region_code','zone_codes','service_levels','phone','active'],
            fields:[
                ['code','Code','text',true], ['name','Nom','text',true], ['contact_name','Contact','text',false],
                ['email','Email','email',false], ['phone','Téléphone','text',false], ['region_code','Région','text',false],
                ['zone_codes','Zones séparées par virgule','array',false], ['service_levels','Services séparés par virgule','array',false],
                ['cutoff_time','Cut-off','time',false], ['capacity_parcels','Capacité colis','number',false], ['active','Actif','checkbox',false]
            ]
        },
        vehicles: {
            title:'Véhicules',
            sub:'Véhicules Colixo utilisables pour les routes locales et nationales.',
            order:'code',
            columns:['code','immatriculation','label','vehicle_type','home_region_code','capacity_parcels','active'],
            fields:[
                ['code','Code','text',false], ['immatriculation','Immatriculation','text',false], ['label','Libellé','text',false],
                ['vehicle_type','Type','text',false], ['home_region_code','Région base','text',false],
                ['capacity_parcels','Capacité colis','number',false], ['capacity_weight_kg','Capacité kg','number',false],
                ['active','Actif','checkbox',false]
            ]
        },
        routes: {
            title:'Tournées',
            sub:'Couleur et paramètres opérationnels des tournées nationales ou locales.',
            order:'route_date',
            columns:['route_date','name','route_type','zone_code','color_hex','dispatch_status','order_locked'],
            labels:{route_date:'Date',name:'Nom',route_type:'Type',zone_code:'Zone',color_hex:'Couleur',dispatch_status:'Statut',order_locked:'Ordre bloqué'},
            fields:[
                ['name','Nom','text',true], ['route_type','Type','text',false], ['route_date','Date','date',false],
                ['origin_region_code','Région départ','text',false], ['destination_region_code','Région arrivée','text',false],
                ['zone_code','Zone','text',false], ['color_hex','Couleur tournée','color',false],
                ['dispatch_status','Statut dispatch','text',false], ['optimization_mode','Optimisation','text',false],
                ['order_locked','Ordre verrouillé','checkbox',false], ['reoptimization_blocked','Réoptimisation bloquée','checkbox',false],
                ['notes','Notes','text',false]
            ]
        }
    };

    var SEED = {
        logistics_regions:[
            {code:'ROM',name:'Suisse romande',language_code:'fr',country_code:'CH',base_city:'Yvonand',base_postcode:'1462',base_lat:46.8006,base_lng:6.7416,active:true},
            {code:'ALE',name:'Suisse alémanique',language_code:'de',country_code:'CH',base_city:'Zürich',base_postcode:'8000',base_lat:47.3769,base_lng:8.5417,active:true},
            {code:'TIC',name:'Tessin',language_code:'it',country_code:'CH',base_city:'Bellinzona',base_postcode:'6500',base_lat:46.1956,base_lng:9.0238,active:true},
            {code:'GRI',name:'Grisons',language_code:'de',country_code:'CH',base_city:'Chur',base_postcode:'7000',base_lat:46.8508,base_lng:9.5320,active:true},
            {code:'NAT',name:'Zones industrielles nationales',language_code:'fr',country_code:'CH',base_city:'Olten',base_postcode:'4600',base_lat:47.3497,base_lng:7.9033,active:true}
        ],
        logistics_zones:[
            {region_code:'ROM',code:'ROM_VD_GE',name:'Vaud / Genève',color_hex:ZONE_COLORS.ROM_VD_GE,zone_type:'regional',service_48h:true,service_24h:true,service_express:false,direct_colixo:true,default_partner_required:false,active:true},
            {region_code:'ROM',code:'ROM_NE_JU_FR',name:'Neuchâtel / Jura / Fribourg',color_hex:ZONE_COLORS.ROM_NE_JU_FR,zone_type:'regional',service_48h:true,service_24h:true,service_express:false,direct_colixo:true,default_partner_required:false,active:true},
            {region_code:'ROM',code:'ROM_VS',name:'Valais',color_hex:ZONE_COLORS.ROM_VS,zone_type:'mountain',service_48h:true,service_24h:false,service_express:false,direct_colixo:false,default_partner_required:true,active:true},
            {region_code:'ALE',code:'ALE_ZH_AG',name:'Zurich / Argovie',color_hex:ZONE_COLORS.ALE_ZH_AG,zone_type:'national',service_48h:true,service_24h:true,service_express:false,direct_colixo:false,default_partner_required:true,active:true},
            {region_code:'ALE',code:'ALE_BE_BS_BL_SO',name:'Berne / Bâle / Soleure',color_hex:ZONE_COLORS.ALE_BE_BS_BL_SO,zone_type:'national',service_48h:true,service_24h:true,service_express:false,direct_colixo:false,default_partner_required:true,active:true},
            {region_code:'ALE',code:'ALE_OST',name:'Suisse orientale',color_hex:ZONE_COLORS.ALE_OST,zone_type:'national',service_48h:true,service_24h:false,service_express:false,direct_colixo:false,default_partner_required:true,active:true},
            {region_code:'TIC',code:'TIC_MAIN',name:'Tessin',color_hex:ZONE_COLORS.TIC_MAIN,zone_type:'national',service_48h:true,service_24h:false,service_express:false,direct_colixo:false,default_partner_required:true,active:true},
            {region_code:'GRI',code:'GRI_MAIN',name:'Grisons',color_hex:ZONE_COLORS.GRI_MAIN,zone_type:'mountain',service_48h:true,service_24h:false,service_express:false,direct_colixo:false,default_partner_required:true,active:true}
        ],
        postal_zones:[
            {postcode_from:1000,postcode_to:1499,region_code:'ROM',zone_code:'ROM_VD_GE',active:true},
            {postcode_from:1500,postcode_to:2999,region_code:'ROM',zone_code:'ROM_NE_JU_FR',active:true},
            {postcode_from:3000,postcode_to:4999,region_code:'ALE',zone_code:'ALE_BE_BS_BL_SO',active:true},
            {postcode_from:5000,postcode_to:5999,region_code:'ALE',zone_code:'ALE_ZH_AG',active:true},
            {postcode_from:6000,postcode_to:6499,region_code:'ALE',zone_code:'ALE_OST',active:true},
            {postcode_from:6500,postcode_to:6999,region_code:'TIC',zone_code:'TIC_MAIN',active:true},
            {postcode_from:7000,postcode_to:7999,region_code:'GRI',zone_code:'GRI_MAIN',active:true},
            {postcode_from:8000,postcode_to:8999,region_code:'ALE',zone_code:'ALE_ZH_AG',active:true},
            {postcode_from:9000,postcode_to:9999,region_code:'ALE',zone_code:'ALE_OST',active:true}
        ]
    };

    function esc(v){return String(v == null ? '' : v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
    function safeColor(v){
        var c = String(v || '').trim();
        return /^#[0-9a-f]{6}$/i.test(c) ? c : '#ff8a00';
    }
    function displayCell(row, col){
        if(col === 'color_hex'){
            var color = safeColor(row[col]);
            return '<span class="color-cell"><span style="background:'+esc(color)+'"></span>'+esc(row[col] || color)+'</span>';
        }
        return esc(displayValue(row[col]));
    }
    function toast(msg, ok){var el=document.getElementById('toast');el.textContent=msg;el.style.color=ok===false?'#fca5a5':'#fff';el.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(function(){el.classList.remove('show');},3500);}
    function config(){return TABLES[currentTable];}
    function displayValue(v){
        if(Array.isArray(v)) return v.join(', ');
        if(typeof v === 'boolean') return v ? 'Oui' : 'Non';
        return v == null || v === '' ? '—' : String(v);
    }
    function parseValue(type, raw, checked){
        if(type === 'checkbox') return !!checked;
        if(type === 'number') return raw === '' ? null : Number(raw);
        if(type === 'color') return safeColor(raw);
        if(type === 'array') return raw.split(',').map(function(x){return x.trim();}).filter(Boolean);
        if(type === 'intarray') return raw.split(',').map(function(x){return parseInt(x.trim(),10);}).filter(function(n){return isFinite(n);});
        return raw.trim() || null;
    }

    async function loadRows(){
        var c = config();
        document.getElementById('tableTitle').textContent = c.title;
        document.getElementById('tableSub').textContent = c.sub;
        var res = await db.from(currentTable).select('*').order(c.order, { ascending:true });
        if(res.error) throw res.error;
        currentRows = res.data || [];
        renderTable();
    }

    function renderTable(){
        var c = config();
        if(!currentRows.length){
            document.getElementById('configTable').innerHTML = '<div class="empty">Aucune donnée. Utilisez “Préremplir Suisse” ou “Ajouter”.</div>';
            return;
        }
        document.getElementById('configTable').innerHTML = '<table><thead><tr>'+c.columns.map(function(col){return '<th>'+esc((c.labels && c.labels[col]) || col)+'</th>';}).join('')+'<th>Actions</th></tr></thead><tbody>'
            + currentRows.map(function(row){
                return '<tr>'+c.columns.map(function(col){return '<td>'+displayCell(row, col)+'</td>';}).join('')
                    +'<td><button class="btn btn-ghost btn-sm" onclick="nationalConfigEdit(&quot;'+esc(row.id)+'&quot;)"><i class="fas fa-pen"></i></button> <button class="btn btn-ghost btn-sm" onclick="nationalConfigDelete(&quot;'+esc(row.id)+'&quot;)"><i class="fas fa-trash"></i></button></td></tr>';
            }).join('')+'</tbody></table>';
    }

    function openModal(row){
        editingRow = row || null;
        document.getElementById('modalTitle').textContent = (row ? 'Modifier ' : 'Ajouter ') + config().title;
        document.getElementById('configForm').innerHTML = config().fields.map(function(f){
            var val = row ? row[f[0]] : defaultValue(f[0], f[2]);
            var required = f[3] ? ' required' : '';
            if(f[2] === 'checkbox') return '<label class="check-field"><input type="checkbox" name="'+esc(f[0])+'" '+(val !== false ? 'checked' : '')+'> '+esc(f[1])+'</label>';
            var inputType = f[2] === 'array' || f[2] === 'intarray' ? 'text' : f[2];
            var out = Array.isArray(val) ? val.join(', ') : (val == null ? '' : val);
            return '<div class="form-field"><label>'+esc(f[1])+'</label><input type="'+esc(inputType)+'" name="'+esc(f[0])+'" value="'+esc(out)+'"'+required+'></div>';
        }).join('');
        document.getElementById('configModal').classList.add('open');
    }
    function defaultValue(name, type){
        if(type === 'checkbox') return true;
        if(name === 'country_code') return 'CH';
        if(name === 'cutoff_time') return '16:00';
        if(name === 'service_levels') return ['48h'];
        if(name === 'days_of_week') return [1,2,3,4,5];
        if(name === 'vehicle_type') return 'van';
        if(name === 'zone_type') return 'regional';
        if(name === 'route_type') return 'local';
        if(name === 'dispatch_status') return 'draft';
        if(name === 'optimization_mode') return 'regional';
        if(name === 'route_date') return new Date().toISOString().slice(0,10);
        if(name === 'color_hex') return '#ff8a00';
        return '';
    }
    function closeModal(){document.getElementById('configModal').classList.remove('open');}

    async function saveModal(){
        var payload = {};
        config().fields.forEach(function(f){
            var el = document.querySelector('[name="'+f[0]+'"]');
            payload[f[0]] = parseValue(f[2], el.value || '', el.checked);
        });
        var res = editingRow
            ? await db.from(currentTable).update(payload).eq('id', editingRow.id)
            : await db.from(currentTable).insert([payload]);
        if(res.error) throw res.error;
        closeModal();
        toast('Enregistré', true);
        await loadRows();
    }

    async function seedCurrent(){
        var data = SEED[currentTable];
        if(!data || !data.length){ toast('Pas de préremplissage pour cette table', false); return; }
        if(currentTable === 'postal_zones'){
            var missing = data.filter(function(item){
                return !currentRows.some(function(row){
                    return Number(row.postcode_from) === Number(item.postcode_from)
                        && Number(row.postcode_to) === Number(item.postcode_to)
                        && row.zone_code === item.zone_code;
                });
            });
            if(!missing.length){ toast('Rattachement NPA déjà prérempli', true); return; }
            var inserted = await db.from(currentTable).insert(missing);
            if(inserted.error) throw inserted.error;
            toast(missing.length + ' règle(s) NPA ajoutée(s)', true);
            await loadRows();
            return;
        }
        var conflict = currentTable === 'postal_zones' ? undefined : 'code';
        var q = db.from(currentTable).upsert(data, conflict ? { onConflict:conflict } : {});
        var res = await q;
        if(res.error) throw res.error;
        toast('Préremplissage effectué', true);
        await loadRows();
    }

    window.nationalConfigEdit = function(id){ openModal(currentRows.find(function(r){return r.id === id;})); };
    window.nationalConfigDelete = async function(id){
        if(!confirm('Supprimer cet élément ?')) return;
        var res = await db.from(currentTable).delete().eq('id', id);
        if(res.error){ toast(res.error.message, false); return; }
        toast('Supprimé', true);
        await loadRows();
    };

    async function init(){
        db = window.SUPABASE_CLIENT;
        if(!db) throw new Error('Supabase non chargé');
        var auth = await window.colixoRequireRoute({ roles:['admin','super_admin'], legacyRoles:['admin','super_admin'], redirectTo:'../login/index.html' });
        if(!auth) return;
        document.querySelectorAll('.config-tab').forEach(function(btn){
            btn.addEventListener('click', async function(){
                document.querySelectorAll('.config-tab').forEach(function(b){b.classList.remove('active');});
                btn.classList.add('active');
                currentTable = btn.dataset.table;
                await loadRows();
            });
        });
        document.getElementById('btnRefresh').addEventListener('click', loadRows);
        document.getElementById('btnNew').addEventListener('click', function(){openModal(null);});
        document.getElementById('btnSeed').addEventListener('click', function(){seedCurrent().catch(function(e){toast(e.message || e, false);});});
        document.getElementById('btnCloseModal').addEventListener('click', closeModal);
        document.getElementById('btnCancel').addEventListener('click', closeModal);
        document.getElementById('btnSave').addEventListener('click', function(){saveModal().catch(function(e){toast(e.message || e, false);});});
        await loadRows();
    }
    document.addEventListener('DOMContentLoaded', function(){
        init().catch(function(e){
            document.getElementById('configTable').innerHTML = '<div class="error">'+esc(e.message || e)+'</div>';
        });
    });
})();
