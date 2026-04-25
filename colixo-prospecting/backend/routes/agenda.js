const router = require('express').Router();
const supa = require('../services/supabase.service');

// GET /api/agenda  — toutes les tâches avec info prospect
router.get('/', async (req, res) => {
  try {
    const data = await supa.getAllTasks(req.query);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/agenda/:taskId  — changer le statut d'une tâche
router.patch('/:taskId', async (req, res) => {
  const { status } = req.body;
  if (!['pending', 'done', 'cancelled'].includes(status)) {
    return res.status(400).json({ ok: false, error: 'status invalide' });
  }
  try {
    const data = await supa.updateTaskStatus(req.params.taskId, status);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
