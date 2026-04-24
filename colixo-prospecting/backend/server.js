// Charge .env si présent (local), ignoré sur Render (variables injectées directement)
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors    = require('cors');

const app = express();

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_ORIGIN,
  'https://www.colixo.ch',
  'https://colixo.ch',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:3000',
  'http://localhost:8080'
].filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    // Autoriser les requêtes sans origin (Postman, curl, apps mobiles)
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origine non autorisée (${origin})`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// ── Body parsing ──────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// Erreur de parsing JSON — renvoie une réponse lisible
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'Corps JSON invalide' });
  }
  next(err);
});

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    ok: true,
    supabase: !!require('./config/supabase'),
    openai:   !!require('./config/openai'),
    uptime:   Math.round(process.uptime())
  });
});

// ── Routes ────────────────────────────────────────────────────
const prospectsRouter      = require('./routes/prospects');
const enrichRouter         = require('./routes/enrich');
const tasksRouter          = require('./routes/tasks');
const eventsRouter         = require('./routes/events');
const repliesRouter        = require('./routes/replies');
const linkedinPrefillRouter = require('./routes/linkedin-prefill');

app.use('/api/prospects',                prospectsRouter);
app.use('/api/enrich-prospect',          enrichRouter);
app.use('/api/linkedin-prefill',         linkedinPrefillRouter);
app.use('/api/prospects/:id/tasks',      tasksRouter);
app.use('/api/prospects/:id/events',     eventsRouter);
app.use('/api/prospects/:id/reply-assistant', repliesRouter);

// Export CSV / JSON
app.get('/api/export/:format', async (req, res) => {
  const format = req.params.format;
  if (!['json','csv'].includes(format)) {
    return res.status(400).json({ ok: false, error: 'Format non supporté. Utilisez "json" ou "csv"' });
  }
  try {
    const supa = require('./services/supabase.service');
    const data = await supa.getAllProspects(req.query);

    if (format === 'json') {
      res.setHeader('Content-Disposition', 'attachment; filename="prospects.json"');
      res.setHeader('Content-Type', 'application/json');
      return res.json(data);
    }

    // CSV
    const cols = ['id','entreprise','ville','secteur','email','telephone','score','score_classe','statut','created_at'];
    const header = cols.join(';');
    const rows = data.map(p =>
      cols.map(c => {
        const v = String(p[c] ?? '').replace(/"/g, '""');
        return v.includes(';') ? `"${v}"` : v;
      }).join(';')
    );
    res.setHeader('Content-Disposition', 'attachment; filename="prospects.csv"');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send('\uFEFF' + [header, ...rows].join('\n')); // BOM UTF-8 pour Excel
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ ok: false, error: `Route ${req.method} ${req.path} introuvable` });
});

// ── Gestionnaire d'erreurs global ─────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Server Error]', err.message);
  const status = err.statusCode || 500;
  res.status(status).json({ ok: false, error: err.message || 'Erreur interne' });
});

// ── Démarrage ─────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = '0.0.0.0'; // requis sur Render
app.listen(PORT, HOST, () => {
  console.log(`\n🚀 Colixo Prospecting API — http://${HOST}:${PORT}`);
  console.log(`   Supabase : ${process.env.SUPABASE_URL ? '✅ configuré' : '⚠️  non configuré'}`);
  console.log(`   OpenAI   : ${process.env.OPENAI_API_KEY ? '✅ configuré' : '⚠️  non configuré'}`);
  console.log('');
});

module.exports = app;
