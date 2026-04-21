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
    const analysis = await analyzeReply(prospect, req.body.raw_message);

    const saved = await supa.saveReply({
      prospect_id: req.params.id,
      source: req.body.source || 'other',
      raw_message: req.body.raw_message,
      ...analysis
    });

    await supa.addEvent(req.params.id, 'reply_analyzed', `Type: ${analysis.objection_type}`);

    // Mise à jour automatique du statut si réponse positive
    if (analysis.objection_type === 'interet') {
      await supa.updateProspect(req.params.id, { statut: 'repondu' });
      await supa.addEvent(req.params.id, 'status_changed', 'Statut → repondu (réponse positive détectée)');
    }

    res.json({ ok: true, data: { ...saved, ...analysis } });
  } catch (err) {
    const isConfig = err.message.includes('non configuré');
    res.status(err.statusCode || (isConfig ? 503 : 502)).json({ ok: false, error: err.message });
  }
});

module.exports = router;
