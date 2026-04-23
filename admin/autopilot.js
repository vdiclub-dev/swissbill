// ============================================================
// autopilot.js — Colixo Autopilot System
// Requires: window.ColixoDispatch, window.ColixoProfit (optional),
//           window.ColixoAI (optional), window.getAIDriverSuggestion (optional)
// ============================================================
(function(window) {
'use strict';

// ── CONSTANTS ─────────────────────────────────────────────────────────────────

var LOOP_MS          = 30000; // analysis interval
var RATE_LIMIT       = 5;     // max auto-actions per minute
var CLUSTER_RADIUS   = 35;    // km — missions within this radius of a tournée centroid
var STALE_HOURS      = 48;    // hours before unassigned mission is "stale"
var OVERLOAD_LIMIT   = 12;    // active missions before driver is "overloaded"
var MAX_SUGGESTIONS  = 12;
var LOG_MAX          = 50;
var ROLLBACK_MAX     = 20;

var MODE_KEY         = 'colixo_ap_mode';
var LOG_KEY          = 'colixo_ap_log';
var LEARN_KEY        = 'colixo_ap_learn';

// ── STATE ─────────────────────────────────────────────────────────────────────

var state = {
    mode:             localStorage.getItem(MODE_KEY) || 'off', // off | suggest | auto
    suggestions:      [],
    issues:           [],
    log:              _loadLog(),
    actionTimestamps: [],
    rollbackStack:    [],
    loopTimer:        null
};

// ── MATH HELPERS ──────────────────────────────────────────────────────────────

function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat/2)*Math.sin(dLat/2)
          + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function centroid(points) {
    var n = points.length;
    if (!n) return null;
    var lat = 0, lng = 0;
    points.forEach(function(p) { lat += p.lat; lng += p.lng; });
    return { lat: lat/n, lng: lng/n };
}

function tourCentroid(tid) {
    var disp = window.ColixoDispatch;
    if (!disp) return null;
    var pts = disp.rows
        .filter(function(r) { return r.tournee_id === tid && r.delivery_lat && r.delivery_lng; })
        .map(function(r) { return { lat: parseFloat(r.delivery_lat), lng: parseFloat(r.delivery_lng) }; });
    return centroid(pts);
}

// ── RATE LIMIT ────────────────────────────────────────────────────────────────

function _checkRate() {
    var now = Date.now();
    state.actionTimestamps = state.actionTimestamps.filter(function(t) { return now - t < 60000; });
    if (state.actionTimestamps.length >= RATE_LIMIT) return false;
    state.actionTimestamps.push(now);
    return true;
}

// ── LOG ───────────────────────────────────────────────────────────────────────

function _loadLog() {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch(_) { return []; }
}
function _saveLog() {
    localStorage.setItem(LOG_KEY, JSON.stringify(state.log.slice(0, LOG_MAX)));
}
function _addLog(type, msg) {
    state.log.unshift({ ts: Date.now(), type: type, msg: msg });
    state.log = state.log.slice(0, LOG_MAX);
    _saveLog();
    var el = document.getElementById('apLog');
    if (el) el.innerHTML = _renderLog();
}

// ── LEARNING ──────────────────────────────────────────────────────────────────

function _loadLearn() {
    try { return JSON.parse(localStorage.getItem(LEARN_KEY) || '{}'); } catch(_) { return {}; }
}
function _markAccepted(id) {
    var d = _loadLearn();
    d.accepted = d.accepted || {};
    d.accepted[id] = (d.accepted[id] || 0) + 1;
    localStorage.setItem(LEARN_KEY, JSON.stringify(d));
}
function _markRefused(id) {
    var d = _loadLearn();
    d.refused = d.refused || {};
    d.refused[id] = Date.now();
    // Expire refusals older than 24h
    var now = Date.now();
    Object.keys(d.refused).forEach(function(k) { if (now - d.refused[k] > 86400000) delete d.refused[k]; });
    localStorage.setItem(LEARN_KEY, JSON.stringify(d));
}
function _wasRefused(id) {
    var d = _loadLearn();
    return !!(d.refused && d.refused[id]);
}

// ── DETECT ISSUES ─────────────────────────────────────────────────────────────

function detectIssues() {
    var disp = window.ColixoDispatch;
    if (!disp) return [];
    var issues = [];
    var now = Date.now();

    // 1. Unprofitable / low-margin tournées
    if (window.ColixoProfit) {
        disp.tournees.forEach(function(t) {
            var missions = disp.rows.filter(function(r) { return r.tournee_id === t.id; });
            if (!missions.length) return;
            var pr = window.ColixoProfit.calculateTourProfit(missions);
            if (!pr) return;
            if (pr.marginPercent < 0) {
                issues.push({
                    id: 'unprof-' + t.id, type: 'tour_unprofitable', severity: 'high',
                    tid: t.id,
                    title: '⚠ «' + t.nom + '» non rentable',
                    detail: 'Marge ' + pr.marginPercent + '% — Perte CHF ' + Math.abs(pr.profit).toFixed(2),
                    action: null
                });
            } else if (pr.marginPercent < 15) {
                issues.push({
                    id: 'lowmar-' + t.id, type: 'tour_low_margin', severity: 'medium',
                    tid: t.id,
                    title: '⚡ «' + t.nom + '» marge faible',
                    detail: 'Marge ' + pr.marginPercent + '% — ajouter des missions pour diluer les coûts fixes',
                    action: null
                });
            }
        });
    }

    // 2. Overloaded drivers
    var load = {};
    disp.rows.forEach(function(r) {
        if (!r.driver_id || ['delivered','refused','cancelled'].indexOf(r.status) >= 0) return;
        load[r.driver_id] = (load[r.driver_id] || 0) + 1;
    });
    disp.chauffeurs.forEach(function(c) {
        if ((load[c.id] || 0) > OVERLOAD_LIMIT) {
            var nm = ((c.prenom||'') + ' ' + (c.nom||'')).trim();
            issues.push({
                id: 'overload-' + c.id, type: 'driver_overloaded', severity: 'medium',
                title: '🔴 ' + nm + ' surchargé',
                detail: load[c.id] + ' missions actives (limite recommandée : ' + OVERLOAD_LIMIT + ')',
                action: null
            });
        }
    });

    // 3. Stale unassigned missions (>STALE_HOURS)
    var stale = disp.rows.filter(function(r) {
        if (r.tournee_id) return false;
        if (['delivered','refused','cancelled'].indexOf(r.status) >= 0) return false;
        return (now - new Date(r.created_at).getTime()) / 3600000 > STALE_HOURS;
    });
    if (stale.length) {
        issues.push({
            id: 'stale', type: 'stale_unassigned', severity: 'medium',
            title: '🕐 ' + stale.length + ' mission(s) sans tournée depuis +' + STALE_HOURS + 'h',
            detail: 'Ces commandes attendent depuis plus de ' + STALE_HOURS + ' heures sans être assignées',
            action: 'Créer tournées IA'
        });
    }

    // 4. Isolated missions (no tournée within radius)
    var isolated = disp.rows.filter(function(r) {
        if (r.tournee_id || !r.delivery_lat || !r.delivery_lng) return false;
        if (['delivered','refused','cancelled'].indexOf(r.status) >= 0) return false;
        var mLat = parseFloat(r.delivery_lat), mLng = parseFloat(r.delivery_lng);
        return !disp.tournees.some(function(t) {
            var c = tourCentroid(t.id);
            return c && haversine(mLat, mLng, c.lat, c.lng) < CLUSTER_RADIUS;
        });
    });
    if (isolated.length) {
        issues.push({
            id: 'isolated', type: 'isolated_missions', severity: 'low',
            title: '📍 ' + isolated.length + ' mission(s) isolée(s)',
            detail: 'Aucune tournée à moins de ' + CLUSTER_RADIUS + ' km — nouvelle zone à créer ?',
            action: null
        });
    }

    return issues;
}

// ── SUGGEST ACTIONS ───────────────────────────────────────────────────────────

function suggestActions() {
    var disp = window.ColixoDispatch;
    if (!disp) return [];
    var suggestions = [];

    // Unassigned missions with GPS
    var unassigned = disp.rows.filter(function(r) {
        return !r.tournee_id && r.delivery_lat && r.delivery_lng
            && ['pending','planned'].indexOf(r.status) >= 0;
    });

    // For each unassigned: find closest tournée
    unassigned.forEach(function(mission) {
        var mLat = parseFloat(mission.delivery_lat), mLng = parseFloat(mission.delivery_lng);
        var bestTour = null, bestDist = Infinity;
        disp.tournees.forEach(function(t) {
            var tMissions = disp.rows.filter(function(r) { return r.tournee_id === t.id; });
            if (tMissions.length >= 20) return; // full tour
            var c = tourCentroid(t.id);
            if (!c) return;
            var d = haversine(mLat, mLng, c.lat, c.lng);
            if (d < bestDist && d < CLUSTER_RADIUS) { bestDist = d; bestTour = t; }
        });
        if (!bestTour) return;

        var num = mission.order_number || mission.id.slice(0,8);
        var sid = 'assign-' + mission.id;
        if (_wasRefused(sid)) return;

        suggestions.push({
            id: sid, type: 'assign_to_tour',
            priority: bestDist < 10 ? 'high' : 'normal',
            autoSafe: true,
            title: '→ ' + num + ' → «' + bestTour.nom + '»',
            detail: Math.round(bestDist) + ' km du centroïde',
            payload: { orderId: mission.id, tourneeId: bestTour.id }
        });
    });

    // Tournées without driver
    disp.tournees.forEach(function(t) {
        if (t._chauffeur_id) return;
        var tMissions = disp.rows.filter(function(r) { return r.tournee_id === t.id; });
        if (!tMissions.length) return;
        var ai = window.getAIDriverSuggestion ? window.getAIDriverSuggestion(t.id) : null;
        if (!ai) return;
        var sid = 'driver-' + t.id;
        if (_wasRefused(sid)) return;
        suggestions.push({
            id: sid, type: 'suggest_driver',
            priority: 'normal',
            autoSafe: false,
            title: '👤 Assigner ' + ai.name + ' à «' + t.nom + '»',
            detail: ai.load + ' mission(s) en cours — chauffeur le moins chargé',
            payload: { tourneeId: t.id }
        });
    });

    // Cluster suggestion if enough unassigned pile up
    if (unassigned.length >= 5) {
        var sid = 'cluster-all';
        if (!_wasRefused(sid)) {
            suggestions.push({
                id: sid, type: 'create_tour_cluster',
                priority: unassigned.length >= 10 ? 'high' : 'normal',
                autoSafe: false,
                title: '🤖 Créer tournées IA (' + unassigned.length + ' missions)',
                detail: 'Clustering k-means — groupement géographique optimal',
                payload: {}
            });
        }
    }

    // Sort: high priority first
    suggestions.sort(function(a,b) { return a.priority==='high' ? -1 : b.priority==='high' ? 1 : 0; });
    return suggestions.slice(0, MAX_SUGGESTIONS);
}

// ── EXECUTE ACTION ────────────────────────────────────────────────────────────

async function _execute(sug, fromAuto) {
    var disp = window.ColixoDispatch;
    if (!disp) return false;
    var prefix = fromAuto ? '[AUTO] ' : '[Manuel] ';
    try {
        if (sug.type === 'assign_to_tour') {
            var p = sug.payload;
            var r = await disp.db.from('transport_orders_simple')
                .update({ tournee_id: p.tourneeId, status: 'planned' }).eq('id', p.orderId);
            if (r.error) throw r.error;
            var order = disp.rows.find(function(o) { return o.id === p.orderId; });
            if (order) { order.tournee_id = p.tourneeId; order.status = 'planned'; }
            // Store rollback entry
            state.rollbackStack.unshift({ ts: Date.now(), type: 'assign', orderId: p.orderId, prevTourneeId: null });
            state.rollbackStack = state.rollbackStack.slice(0, ROLLBACK_MAX);
            _addLog('success', prefix + sug.title);
            _markAccepted(sug.id);
            _removeSuggestion(sug.id);
            if (disp.applyFilter) disp.applyFilter();
            if (disp.renderTournees) disp.renderTournees();
            return true;

        } else if (sug.type === 'create_tour_cluster') {
            if (window.ColixoAI) {
                _addLog('info', prefix + 'Clustering IA lancé');
                await window.ColixoAI.createSmartTours();
                _markAccepted(sug.id);
                _removeSuggestion(sug.id);
            }
            return true;

        } else if (sug.type === 'suggest_driver') {
            // Open the driver assign modal — never execute automatically
            if (window.assignChauffeurTournee) {
                window.assignChauffeurTournee(sug.payload.tourneeId);
            }
            _addLog('info', prefix + sug.title + ' — modal ouvert');
            _removeSuggestion(sug.id);
            return true;
        }
    } catch(e) {
        _addLog('error', 'Erreur : ' + (e.message || String(e)));
        return false;
    }
    return false;
}

function _removeSuggestion(id) {
    state.suggestions = state.suggestions.filter(function(s) { return s.id !== id; });
    renderPanel();
}

// ── APPLY AUTO ACTIONS ────────────────────────────────────────────────────────

async function applyAutoActions() {
    if (state.mode !== 'auto') return;
    var safe = state.suggestions.filter(function(s) { return s.autoSafe; });
    for (var i = 0; i < safe.length; i++) {
        if (!_checkRate()) {
            _addLog('warn', 'Rate limit atteint (' + RATE_LIMIT + '/min) — pause automatique');
            break;
        }
        await _execute(safe[i], true);
        await new Promise(function(r){ setTimeout(r, 600); });
    }
}

// ── ROLLBACK ──────────────────────────────────────────────────────────────────

async function rollbackLast() {
    var action = state.rollbackStack.shift();
    if (!action) { _addLog('warn', 'Aucune action à annuler'); return; }
    var disp = window.ColixoDispatch;
    if (!disp) return;
    try {
        if (action.type === 'assign') {
            await disp.db.from('transport_orders_simple')
                .update({ tournee_id: action.prevTourneeId }).eq('id', action.orderId);
            var order = disp.rows.find(function(o) { return o.id === action.orderId; });
            if (order) order.tournee_id = action.prevTourneeId;
            _addLog('warn', '↩ Rollback effectué (mission désassignée)');
            if (disp.applyFilter) disp.applyFilter();
            if (disp.renderTournees) disp.renderTournees();
        }
    } catch(e) {
        _addLog('error', 'Rollback échoué : ' + (e.message || String(e)));
    }
    renderPanel();
}

// ── MAIN LOOP ─────────────────────────────────────────────────────────────────

function analyzeSystem() {
    state.issues      = detectIssues();
    state.suggestions = suggestActions();
    renderPanel();
}

function _startLoop() {
    _stopLoop();
    analyzeSystem();
    state.loopTimer = setInterval(function() {
        analyzeSystem();
        if (state.mode === 'auto') applyAutoActions();
    }, LOOP_MS);
}

function _stopLoop() {
    if (state.loopTimer) { clearInterval(state.loopTimer); state.loopTimer = null; }
}

function setMode(mode) {
    state.mode = mode;
    localStorage.setItem(MODE_KEY, mode);
    if (mode === 'off') { _stopLoop(); renderPanel(); }
    else _startLoop();
    _addLog('info', 'Mode changé → ' + { off:'Éteint', suggest:'Suggestions', auto:'Automatique' }[mode]);
}

// ── UI ────────────────────────────────────────────────────────────────────────

var MODE_COLOR = { off:'rgba(255,255,255,0.42)', suggest:'#f59e0b', auto:'#22c55e' };
var MODE_ICON  = { off:'⚫', suggest:'🟡', auto:'🟢' };
var MODE_LBL   = { off:'Éteint', suggest:'Suggestions', auto:'Auto' };
var LOG_ICON   = { success:'✅', warn:'⚡', error:'❌', info:'ℹ' };

function renderPanel() {
    var panel = document.getElementById('apPanel');
    if (!panel) return;

    var highCount = state.issues.filter(function(i){ return i.severity==='high'; }).length;
    var totalAlert = highCount + state.issues.filter(function(i){ return i.severity==='medium'; }).length;

    // Update topbar badge
    var topBtn = document.getElementById('btnAutopilot');
    if (topBtn) {
        topBtn.innerHTML = '🧠 Pilote' + (totalAlert
            ? ' <span style="background:#e8311a;color:#fff;border-radius:100px;font-size:10px;padding:1px 6px;font-weight:700;">' + totalAlert + '</span>'
            : '');
        topBtn.style.borderColor = highCount ? 'rgba(232,49,26,0.5)' : '';
    }

    var html = '';

    // Header
    html += '<div class="ap-header">'
         +    '<span class="ap-title">🧠 Pilote IA</span>'
         +    '<span style="font-size:11px;color:' + MODE_COLOR[state.mode] + ';font-weight:700;">' + MODE_ICON[state.mode] + ' ' + MODE_LBL[state.mode] + '</span>'
         +    '<button class="btn btn-ghost btn-xs" onclick="window.ColixoAutopilot.closePanel()" style="margin-left:auto;">✕</button>'
         + '</div>';

    // Mode tabs
    html += '<div class="ap-modes">';
    ['off','suggest','auto'].forEach(function(m) {
        var active = state.mode === m;
        html += '<button class="ap-mode-btn' + (active?' ap-mode-active':'') + '" '
              + (active ? 'style="border-color:' + MODE_COLOR[m] + ';color:' + MODE_COLOR[m] + ';"' : '')
              + ' onclick="window.ColixoAutopilot.setMode(\'' + m + '\')">'
              + MODE_ICON[m] + ' ' + MODE_LBL[m] + '</button>';
    });
    html += '</div>';

    if (state.mode === 'off') {
        html += '<div class="ap-empty">Mode éteint<br><small>Activez "Suggestions" pour analyser en temps réel</small></div>';
    } else {
        // Issues
        if (state.issues.length) {
            html += '<div class="ap-section">⚠ Alertes <span class="ap-count">' + state.issues.length + '</span></div>';
            state.issues.forEach(function(issue) {
                var bg  = issue.severity==='high' ? 'rgba(232,49,26,0.1)' : issue.severity==='medium' ? 'rgba(245,158,11,0.08)' : 'rgba(59,130,246,0.07)';
                var bdr = issue.severity==='high' ? 'rgba(232,49,26,0.28)' : issue.severity==='medium' ? 'rgba(245,158,11,0.22)' : 'rgba(59,130,246,0.18)';
                html += '<div class="ap-card" style="background:' + bg + ';border-color:' + bdr + ';">'
                      +   '<div class="ap-card-title">' + issue.title + '</div>'
                      +   '<div class="ap-card-detail">' + issue.detail + '</div>'
                      +   (issue.action
                            ? '<div class="ap-card-btns"><button class="btn btn-ghost btn-xs" onclick="window.ColixoAutopilot.handleIssue(\'' + issue.id + '\')">' + issue.action + '</button></div>'
                            : '')
                      + '</div>';
            });
        }

        // Suggestions
        if (state.suggestions.length) {
            html += '<div class="ap-section">💡 Suggestions <span class="ap-count">' + state.suggestions.length + '</span></div>';
            state.suggestions.forEach(function(sug) {
                var high = sug.priority === 'high';
                html += '<div class="ap-card" style="background:' + (high?'rgba(168,85,247,0.08)':'rgba(255,255,255,0.03)') + ';border-color:' + (high?'rgba(168,85,247,0.3)':'var(--border2)') + ';">'
                      +   '<div class="ap-card-title">' + sug.title
                      +     (sug.autoSafe ? '<span class="ap-chip-auto">AUTO</span>' : '') + '</div>'
                      +   '<div class="ap-card-detail">' + sug.detail + '</div>'
                      +   '<div class="ap-card-btns">'
                      +     '<button class="btn btn-green btn-xs" onclick="window.ColixoAutopilot.accept(\'' + sug.id + '\')"><i class="fas fa-check"></i> Accepter</button>'
                      +     '<button class="btn btn-ghost btn-xs" style="color:#f87171;" onclick="window.ColixoAutopilot.refuse(\'' + sug.id + '\')"><i class="fas fa-times"></i> Refuser</button>'
                      +   '</div>'
                      + '</div>';
            });
        }

        if (!state.issues.length && !state.suggestions.length) {
            html += '<div class="ap-empty">✅ Système optimal<br><small>Analyse toutes les 30 secondes</small></div>';
        }
    }

    // Rollback
    if (state.rollbackStack.length) {
        html += '<div class="ap-section">↩ Rollback</div>'
              + '<div style="padding:0 12px 8px;display:flex;align-items:center;gap:8px;">'
              +   '<button class="btn btn-ghost btn-xs" onclick="window.ColixoAutopilot.rollback()">↩ Annuler dernière action</button>'
              +   '<span style="font-size:10px;color:var(--muted);">' + state.rollbackStack.length + ' disponible(s)</span>'
              + '</div>';
    }

    // Log
    html += '<div class="ap-section">📋 Journal <button class="btn btn-ghost btn-xs" style="float:right;margin-top:-2px;" onclick="window.ColixoAutopilot.clearLog()">Effacer</button></div>';
    html += '<div id="apLog">' + _renderLog() + '</div>';

    panel.innerHTML = html;
}

function _renderLog() {
    if (!state.log.length) return '<div style="text-align:center;padding:14px;font-size:11px;color:var(--muted);">Aucune action</div>';
    return state.log.slice(0, 15).map(function(e) {
        var t = new Date(e.ts).toLocaleTimeString('fr-CH', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
        return '<div class="ap-log-row">'
             + '<span>' + (LOG_ICON[e.type]||'·') + '</span>'
             + '<span class="ap-log-msg">' + e.msg + '</span>'
             + '<span class="ap-log-ts">' + t + '</span>'
             + '</div>';
    }).join('');
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

window.ColixoAutopilot = {
    analyzeSystem:    analyzeSystem,
    detectIssues:     detectIssues,
    suggestActions:   suggestActions,
    applyAutoActions: applyAutoActions,
    setMode:          setMode,
    rollback:         rollbackLast,
    renderPanel:      renderPanel,

    accept: function(id) {
        var sug = state.suggestions.find(function(s) { return s.id === id; });
        if (sug) _execute(sug, false);
    },
    refuse: function(id) {
        _markRefused(id);
        _removeSuggestion(id);
        _addLog('info', 'Suggestion ignorée (mémorisé 24h)');
    },
    handleIssue: function(id) {
        var issue = state.issues.find(function(i) { return i.id === id; });
        if (!issue) return;
        if (issue.action === 'Créer tournées IA' && window.ColixoAI) window.ColixoAI.createSmartTours();
    },
    openPanel: function() {
        document.getElementById('apDrawer').classList.add('open');
        if (state.mode !== 'off') analyzeSystem();
        else renderPanel();
    },
    closePanel: function() {
        document.getElementById('apDrawer').classList.remove('open');
    },
    clearLog: function() {
        state.log = [];
        _saveLog();
        renderPanel();
    }
};

// Auto-start loop if previously active
if (state.mode !== 'off') _startLoop();

})(window);
