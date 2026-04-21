const router = require('express').Router();
const { enrichProspect } = require('../services/openai.service');
const supa = require('../services/supabase.service');

// POST /api/enrich-prospect
// Body: données du prospect (pas forcément sauvegardé)
router.post('/', async (req, res) => {
  const { entreprise } = req.body;
  if (!entreprise?.trim()) {
    return res.status(400).json({ ok: false, error: 'Le champ "entreprise" est requis pour l\'enrichissement' });
  }

  try {
    const enrichment = await enrichProspect(req.body);
    res.json({ ok: true, data: enrichment });
  } catch (err) {
    const isConfig = err.message.includes('non configuré');
    res.status(isConfig ? 503 : 502).json({ ok: false, error: err.message });
  }
});

// POST /api/enrich-prospect/:id
// Enrichit un prospect existant et sauvegarde le résultat
router.post('/:id', async (req, res) => {
  try {
    const prospect = await supa.getProspectById(req.params.id);

    await supa.updateProspect(req.params.id, { statut: 'analyse_en_cours' });
    await supa.addEvent(req.params.id, 'enrichment_started', 'Analyse IA lancée');

    const enrichment = await enrichProspect(prospect);

    const updated = await supa.updateProspect(req.params.id, {
      ...enrichment,
      statut: 'pret_a_contacter'
    });

    await supa.addEvent(req.params.id, 'enriched', `Score: ${enrichment.score} — Classe: ${enrichment.score_classe}`);
    res.json({ ok: true, data: updated });
  } catch (err) {
    const isConfig = err.message.includes('non configuré');
    res.status(err.statusCode || (isConfig ? 503 : 502)).json({ ok: false, error: err.message });
  }
});

module.exports = router;
