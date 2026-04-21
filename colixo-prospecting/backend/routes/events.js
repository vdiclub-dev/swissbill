const router = require('express').Router({ mergeParams: true });
const supa = require('../services/supabase.service');

// GET /api/prospects/:id/events
router.get('/', async (req, res) => {
  try {
    const data = await supa.getEvents(req.params.id);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(err.statusCode || 500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
