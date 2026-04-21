const router = require('express').Router({ mergeParams: true });
const supa = require('../services/supabase.service');
const { validateTask } = require('../utils/validator');

// GET /api/prospects/:id/tasks
router.get('/', async (req, res) => {
  try {
    const data = await supa.getTasks(req.params.id);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

// POST /api/prospects/:id/tasks
router.post('/', async (req, res) => {
  const { ok, errors } = validateTask(req.body);
  if (!ok) return res.status(400).json({ ok: false, errors });

  try {
    const data = await supa.createTask({ ...req.body, prospect_id: req.params.id });
    await supa.addEvent(req.params.id, 'task_created', req.body.title);
    res.status(201).json({ ok: true, data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

// PATCH /api/prospects/:id/tasks/:taskId
router.patch('/:taskId', async (req, res) => {
  const { status } = req.body;
  if (!['pending','done','cancelled'].includes(status)) {
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
