const router = require('express').Router();
const { enrichProspect } = require('../services/openai.service');
const supa = require('../services/supabase.service');

// POST /api/enrich-prospect/:id
router.post('/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const prospect = await supa.getProspectById(id);

    // Marquer analyse en cours
    await supa.updateProspect(id, { statut: 'a_qualifier' });
    supa.addEvent(id, 'enrichment_started', 'Analyse IA lancée').catch(() => {});

    // Lancer enrichissement (scraping + OpenAI)
    const enrichment = await enrichProspect(prospect);

    // Sauvegarder tous les champs enrichis + statut
    const updated = await supa.saveEnrichment(id, enrichment);

    supa.addEvent(id, 'enriched',
      `Score: ${enrichment.score_total} (${enrichment.score_classe}) — Qualité analyse: ${enrichment.analysis_quality}`,
      { score: enrichment.score_total, classe: enrichment.score_classe, signals: enrichment.logistic_signals }
    ).catch(() => {});

    // Suggestion de tâche automatique si score élevé
    if (enrichment.score_total >= 70) {
      supa.createTask({
        prospect_id: id,
        title:       `Contacter ${prospect.entreprise} — Score A (${enrichment.score_total}/100)`,
        status:      'pending',
        due_date:    new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      }).catch(() => {});
    }

    res.json({ ok: true, data: updated });

  } catch (err) {
    // Remettre en état si erreur
    supa.updateProspect(id, { statut: 'a_qualifier' }).catch(() => {});
    supa.addEvent(id, 'enrichment_failed', err.message).catch(() => {});

    const isConfig = err.message.includes('non configuré');
    res.status(err.statusCode || (isConfig ? 503 : 502))
       .json({ ok: false, error: err.message });
  }
});

module.exports = router;
