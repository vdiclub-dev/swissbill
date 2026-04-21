const router = require('express').Router();
const supa = require('../services/supabase.service');
const { validateProspect } = require('../utils/validator');

// GET /api/prospects
router.get('/', async (req, res) => {
  try {
    const { statut, secteur, search } = req.query;
    const data = await supa.getAllProspects({ statut, secteur, search });
    res.json({ ok: true, data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

// GET /api/prospects/stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await supa.getDashboardStats();
    res.json({ ok: true, data: stats });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

// GET /api/prospects/:id
router.get('/:id', async (req, res) => {
  try {
    const data = await supa.getProspectById(req.params.id);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

// POST /api/prospects
router.post('/', async (req, res) => {
  const { ok, errors } = validateProspect(req.body);
  if (!ok) return res.status(400).json({ ok: false, errors });

  try {
    const data = await supa.createProspect(req.body);
    supa.addEvent(data.id, 'created', `Prospect ${data.entreprise} créé`).catch(e => console.warn('[addEvent]', e.message));
    res.status(201).json({ ok: true, data });
  } catch (err) {
    console.error('[POST /prospects]', err.message);
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

// PUT /api/prospects/:id
router.put('/:id', async (req, res) => {
  const { ok, errors } = validateProspect(req.body);
  if (!ok) return res.status(400).json({ ok: false, errors });

  try {
    const data = await supa.updateProspect(req.params.id, req.body);
    supa.addEvent(req.params.id, 'updated', 'Fiche mise à jour').catch(e => console.warn('[addEvent]', e.message));
    res.json({ ok: true, data });
  } catch (err) {
    console.error('[PUT /prospects]', err.message);
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/prospects/:id/status
router.patch('/:id/status', async (req, res) => {
  const { statut } = req.body;
  const { ok, errors } = validateProspect({ entreprise: 'tmp', statut });
  if (!ok) return res.status(400).json({ ok: false, errors });

  try {
    const data = await supa.updateProspect(req.params.id, { statut });
    await supa.addEvent(req.params.id, 'status_changed', `Statut → ${statut}`);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

// DELETE /api/prospects/:id
router.delete('/:id', async (req, res) => {
  try {
    await supa.deleteProspect(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
