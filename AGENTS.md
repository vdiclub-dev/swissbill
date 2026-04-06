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

### Production hosting (GitHub Pages)

- The live site is served from **this GitHub repository** via **GitHub Pages** (static files from the default branch).
- The custom domain is configured with the **`CNAME`** file at the repo root (e.g. `www.colixo.ch`). DNS must point to GitHub’s Pages IPs or CNAME target as in [GitHub’s docs](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site).
- **`_headers`** and **`netlify.toml`** in the repo are **not used by GitHub Pages** (they apply on Netlify or similar hosts only). Cache behaviour for HTML is therefore mostly **browser + any CDN in front** (e.g. Cloudflare).
- **`config.js`** must be present in the repo and deployed branch so production can load Supabase; scripts use `<script src="config.js?v=…">` and `data-cfasync="false"` where relevant for Cloudflare compatibility.

### Gotchas

- **Localhost vs domaine** : en `http://localhost:8080` le cache est souvent faible ; sur **`www.colixo.ch`** le navigateur ou un CDN peut garder une ancienne **page HTML** alors que le code dans le dépôt est à jour. Après un `git push`, attendre la fin du déploiement GitHub Pages, puis **rechargement forcé** (Cmd+Shift+R) ou le lien **« Ouvrir sans cache »** sur Dispatch si un bandeau rouge apparaît.
- **Cache après déploiement** : si « rien ne change » après plusieurs F5, le navigateur ou un CDN (souvent **Cloudflare** devant le domaine) sert encore d’anciens fichiers. Faire un **rechargement forcé** (Cmd+Shift+R / Ctrl+Shift+R), ou **vider le cache** pour le site. Avec Cloudflare : **Caching → Purge Everything** (ou règle « Bypass » pour le HTML). Vérifier dans **Afficher le code source** la présence du commentaire `<!-- colixo-build:… -->` : s’il est absent ou ancien, ce n’est pas la dernière version déployée. Dans la console, `[Colixo] build` doit afficher la même version que dans `config.js`.
- **Dispatch** (`admin/dispatch.html`) : le fichier racine **`version.json`** (champ `build`) est comparé à l’attribut **`data-colixo-build`** sur `<html>` ; en cas d’écart, une redirection avec `?_cb=` tente de récupérer le nouveau HTML. À chaque déploiement important, incrémenter ensemble **`version.json`**, **`data-colixo-build`** sur dispatch, **`COLIXO_ASSET_VERSION`** dans `config.js` et le `?v=` des scripts dans les HTML. Si Cloudflare **ignore les query strings** pour le cache, purger le CDN reste nécessaire.
- **GitHub Pages** (URL du type `user.github.io/nom-du-depot/`) : les liens absolus `/login/…` sans préfixe du dépôt cassent. `config.js` définit `COLIXO_BASE_PATH` sur `*.github.io`, corrige les `<a href="/…">` au chargement et expose `colixoHref()` pour les redirections JS. Sur le domaine personnalisé (`www.colixo.ch`), le préfixe reste vide.
- The app loads external CDN resources (Supabase JS SDK, Leaflet, Chart.js, Google Fonts, Font Awesome). Internet access is required.
- Push notifications require HTTPS (except on `localhost`).
- The `send_mail.php` file under `admin/brimot/` requires a PHP runtime — it is only used for the Brimot invoicing email feature and is not needed for core transport functionality.
