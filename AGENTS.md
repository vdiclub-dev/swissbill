# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Colixo is a static web application (HTML/CSS/JS) for a transport & logistics dispatch platform. There is **no build step, no package manager, and no bundler**. The backend is entirely Supabase (cloud-hosted BaaS).

### Running the dev server

Serve the repo root with any static HTTP server:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` for the landing page, or `http://localhost:8080/login/` for the login page.

**Do not open files via `file://`** — the Supabase JS SDK requires HTTP(S) due to CORS.

### Key pages

| Page | URL path |
|------|----------|
| Landing page | `/` or `/index.html` |
| Login | `/login/index.html` |
| Admin dashboard | `/admin/dashboard.html` |
| Driver dashboard | `/chauffeur/dashboard.html` |
| Client dashboard | `/client/dashboard.html` |
| Warehouse dashboard | `/magasinier/dashboard.html` |
| Client orders | `/commandes-client.html` |
| Brimot invoicing | `/admin/brimot/facturation.html` |

### Authentication

All authenticated pages require a Supabase session. The Supabase anon key is in `config.js`. To access dashboards beyond the login page, you need valid credentials in the Supabase `utilisateurs` table.

### Lint / Test / Build

- **Lint**: No linter is configured in this repo. You can optionally run an HTML validator or use browser DevTools console to check for JS errors.
- **Tests**: No automated test framework is present.
- **Build**: No build step — files are served directly as static assets.

### Production hosting (Vercel)

- The production site is assumed to be deployed on **Vercel** from this Git repository.
- The repo contains Vercel-related files and dependencies (`package.json` includes `vercel`, and `brimot-ai-tool/vercel.json` exists), so do not assume GitHub Pages is the active production host.
- Root-level **`_headers`**, **`netlify.toml`**, and **`CNAME`** are not a reliable source of truth for Vercel production behaviour. Treat the Vercel dashboard project settings, attached domains, redirects, and cache headers as authoritative.
- **`config.js`** must be present in the deployed output so production can load Supabase; scripts use `<script src="config.js?v=…">` and `data-cfasync="false"` where relevant for cache busting and Cloudflare compatibility.

### Gotchas

- **Localhost vs domaine** : en `http://localhost:8080` le cache est souvent faible ; sur **`www.colixo.ch`** le navigateur, Vercel, ou un CDN devant le domaine peut garder une ancienne **page HTML** alors que le code dans le dépôt est à jour. Après un `git push`, attendre la fin du déploiement Vercel, puis **rechargement forcé** (Cmd+Shift+R) ou le lien **« Ouvrir sans cache »** sur Dispatch si un bandeau rouge apparaît.
- **Cache après déploiement** : si « rien ne change » après plusieurs F5, le navigateur ou un CDN (souvent **Cloudflare** devant le domaine) sert encore d’anciens fichiers. Faire un **rechargement forcé** (Cmd+Shift+R / Ctrl+Shift+R), ou **vider le cache** pour le site. Si Cloudflare est utilisé devant Vercel : **Caching → Purge Everything** (ou règle « Bypass » pour le HTML). Vérifier dans **Afficher le code source** la présence du commentaire `<!-- colixo-build:… -->` : s’il est absent ou ancien, ce n’est pas la dernière version déployée. Dans la console, `[Colixo] build` doit afficher la même version que dans `config.js`.
- **Dispatch** (`admin/dispatch.html`) : le fichier racine **`version.json`** (champ `build`) est comparé à l’attribut **`data-colixo-build`** sur `<html>` ; en cas d’écart, une redirection avec `?_cb=` tente de récupérer le nouveau HTML. À chaque déploiement important, incrémenter ensemble **`version.json`**, **`data-colixo-build`** sur dispatch, **`COLIXO_ASSET_VERSION`** dans `config.js` et le `?v=` des scripts dans les HTML. Si Cloudflare **ignore les query strings** pour le cache, purger le CDN reste nécessaire.
- **Compatibilité `github.io` toujours présente dans le code** : certaines pages et `config.js` gèrent encore le cas **GitHub Pages** (URL du type `user.github.io/nom-du-depot/`) via `COLIXO_BASE_PATH`, la correction des liens `<a href="/…">`, et `colixoHref()`. Cette logique reste utile pour des previews ou un fallback, mais ne doit pas être interprétée comme la preuve que la production tourne encore sur GitHub Pages.
- The app loads external CDN resources (Supabase JS SDK, Leaflet, Chart.js, Google Fonts, Font Awesome). Internet access is required.
- Push notifications require HTTPS (except on `localhost`).
- The `send_mail.php` file under `admin/brimot/` requires a PHP runtime — it is only used for the Brimot invoicing email feature and is not needed for core transport functionality.
