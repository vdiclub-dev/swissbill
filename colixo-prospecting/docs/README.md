# Colixo Prospecting System — Niveau 3

Agent de prospection B2B avancé pour Colixo.

---

## Architecture

```
colixo-prospecting/
├── frontend/        → SPA vanilla JS (GitHub Pages / Vercel)
│   ├── index.html
│   ├── style.css
│   └── app.js       ← DEMO_MODE = true/false en haut du fichier
├── backend/         → API Express Node.js (Render / Railway)
│   ├── server.js
│   ├── routes/
│   └── services/
├── config/          → Supabase + OpenAI
├── sql/schema.sql   → À exécuter dans Supabase
└── .env.example
```

---

## Lancement rapide (mode démo — sans backend)

```bash
cd frontend
# Ouvrir index.html dans un navigateur
# OU lancer un serveur local :
npx serve .
```

`DEMO_MODE = true` dans `app.js` → 6 prospects fictifs, toutes les fonctions disponibles, aucune clé API requise.

---

## Lancement en production

### 1. Créer le fichier `.env`

```bash
cp .env.example .env
# Remplir SUPABASE_URL, SUPABASE_SERVICE_KEY, OPENAI_API_KEY, FRONTEND_ORIGIN
```

### 2. Créer les tables Supabase

Dans l'éditeur SQL Supabase → coller le contenu de `sql/schema.sql` → Exécuter.

### 3. Lancer le backend

```bash
cd backend
npm install
npm start           # production
npm run dev         # développement (nodemon)
```

L'API démarre sur `http://localhost:3001`.

### 4. Connecter le frontend au backend

Dans `frontend/app.js`, ligne 1 :

```js
const API_BASE = 'http://localhost:3001/api';  // ou votre URL de déploiement
const DEMO_MODE = false;                        // ← passer à false
```

---

## Fonctionnalités

| Feature | Description |
|---------|-------------|
| Dashboard | KPI temps réel, graphiques secteur/statut, top prospects |
| Liste prospects | Tri, filtres par statut/secteur/recherche |
| Fiche prospect | 5 onglets : enrichissement, messages, réponse IA, tâches, journal |
| Enrichissement IA | OpenAI analyse le prospect → score, messages, angle commercial |
| Messages générés | LinkedIn (manuel), emails, script appel |
| Assistant réponse | Coller la réponse prospect → 6 formulations générées |
| Pipeline CRM | Vue Kanban par statut |
| Tâches | Relances planifiées par prospect |
| Journal | Historique complet des actions |
| Export | CSV (Excel) + JSON |

---

## Variables d'environnement

| Variable | Description |
|----------|-------------|
| `PORT` | Port du serveur backend (défaut : 3001) |
| `SUPABASE_URL` | URL de votre projet Supabase |
| `SUPABASE_SERVICE_KEY` | Clé service (pas la clé anon) |
| `OPENAI_API_KEY` | Clé API OpenAI |
| `FRONTEND_ORIGIN` | URL du frontend pour CORS (ex: `https://votre-app.vercel.app`) |

---

## API Endpoints

```
GET    /health                                → État du serveur
GET    /api/prospects                         → Liste (filtres: statut, secteur, search)
GET    /api/prospects/stats                   → Stats dashboard
GET    /api/prospects/:id                     → Détail prospect
POST   /api/prospects                         → Créer
PUT    /api/prospects/:id                     → Modifier
PATCH  /api/prospects/:id/status              → Changer statut
DELETE /api/prospects/:id                     → Supprimer
POST   /api/enrich-prospect/:id               → Enrichissement IA
GET    /api/prospects/:id/events              → Journal
GET    /api/prospects/:id/tasks               → Tâches
POST   /api/prospects/:id/tasks               → Créer tâche
PATCH  /api/prospects/:id/tasks/:taskId       → Màj statut tâche
POST   /api/prospects/:id/reply-assistant     → Analyser réponse
GET    /api/export/csv                        → Export CSV
GET    /api/export/json                       → Export JSON
```

---

## Contraintes LinkedIn

> ⚠️ Aucune automatisation LinkedIn n'est implémentée ni autorisée.

Les messages LinkedIn sont générés pour **copier-coller manuellement**.
L'interface rappelle cette contrainte à chaque affichage.

---

## Déploiement

**Frontend** → GitHub Pages ou Vercel (fichiers statiques, aucune config)

**Backend** → Render, Railway ou Vercel Serverless :
- Render : `npm start`, variables d'env dans le dashboard
- Railway : `npm start`, variables d'env dans le dashboard
- Vercel : exporte `app` depuis `server.js`, ajouter `vercel.json`

---

## Technologies

- **Frontend** : HTML5, CSS3, JavaScript ES2022 (vanilla, aucune dépendance)
- **Backend** : Node.js 18+, Express 4, CORS, dotenv
- **Base de données** : Supabase (PostgreSQL)
- **IA** : OpenAI Responses API (`gpt-4o-mini`)
- **Déploiement** : Compatible tout hébergeur statique + Node.js
