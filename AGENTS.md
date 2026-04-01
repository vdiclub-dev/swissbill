# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Colixo / Léman-Courses is a static web application (HTML/CSS/JS) for a transport & logistics dispatch platform. There is **no build step, no package manager, and no bundler**. The backend is entirely Supabase (cloud-hosted BaaS).

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

### Gotchas

- The app loads external CDN resources (Supabase JS SDK, Leaflet, Chart.js, Google Fonts, Font Awesome). Internet access is required.
- Push notifications require HTTPS (except on `localhost`).
- The `send_mail.php` file under `admin/brimot/` requires a PHP runtime — it is only used for the Brimot invoicing email feature and is not needed for core transport functionality.
