const router = require('express').Router({ mergeParams: true });
const supa = require('../services/supabase.service');
const { analyzeReply } = require('../services/openai.service');
const { validateReply } = require('../utils/validator');

// POST /api/prospects/:id/reply-assistant
router.post('/', async (req, res) => {
  const { ok, errors } = validateReply(req.body);
  if (!ok) return res.status(400).json({ ok: false, errors });

  try {
    const prospect = await supa.getProspectById(req.params.id);
    const analysis = await analyzeReply(prospect, req.body.source || 'other', req.body.raw_message);

    const saved = await supa.saveReply({
      prospect_id:            req.params.id,
      source:                 req.body.source || 'other',
      raw_message:            req.body.raw_message,
      suggested_reply_short:  analysis.suggested_reply_short,
      suggested_reply_sales:  analysis.suggested_reply_sales,
      suggested_reply_meeting:analysis.suggested_reply_meeting,
      objection_type:         analysis.objection_type,
      next_best_action:       analysis.next_best_action,
      sentiment:              analysis.sentiment,
      buying_signal_level:    analysis.buying_signal_level,
      urgency_level:          analysis.urgency_level,
      recommended_channel:    analysis.recommended_channel,
    });

    supa.addEvent(req.params.id, 'reply_analyzed',
      `Réponse analysée — Type: ${analysis.objection_type}, Signal: ${analysis.buying_signal_level}/5`,
      { objection_type: analysis.objection_type, sentiment: analysis.sentiment }
    ).catch(() => {});

    // Mise à jour statut selon analyse
    const newStatut = analysis.objection_type === 'interet' || analysis.objection_type === 'demande_appel'
      ? 'repondu'
      : analysis.objection_type === 'demande_infos'
      ? 'repondu'
      : null;

    if (newStatut) {
      supa.updateProspect(req.params.id, { statut: newStatut }).catch(() => {});
      supa.addEvent(req.params.id, 'status_changed', `Statut → ${newStatut} (réponse analysée)`).catch(() => {});
    }

    // Suggestion de tâche selon next_best_action
    if (analysis.next_best_action && analysis.buying_signal_level >= 3) {
      supa.createTask({
        prospect_id: req.params.id,
        title:       analysis.next_best_action,
        status:      'pending',
        due_date:    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      }).catch(() => {});
    }

    res.json({ ok: true, data: { ...saved, ...analysis } });
  } catch (err) {
    const isConfig = err.message.includes('non configuré');
    res.status(err.statusCode || (isConfig ? 503 : 502)).json({ ok: false, error: err.message });
  }
});

module.exports = router;
