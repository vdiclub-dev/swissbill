# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a **static frontend-only** web application (no build step, no package manager, no bundler) for two products:

1. **Colixo / Léman-Courses** — A Swiss transport and dispatch logistics platform with multiple role-based portals (admin, driver, client, warehouse worker).
2. **Brimot Nettoyage** — A cleaning company invoicing module under `/admin/brimot/`.

### Architecture

- **No build system**: Pure HTML/CSS/JS loaded via `<script>` tags from CDNs.
- **Backend**: Supabase (hosted cloud at `iubbsnntcreneakbdkmv.supabase.co`) — provides Auth, PostgreSQL DB, RLS, and Realtime.
- **Maps**: Leaflet.js + OpenStreetMap (no API key needed).
- **Config**: `config.js` at the root contains Supabase URL and anon key, loaded by all pages.

### Running the dev server

Serve the repository root with any static HTTP server. For example:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/` in a browser.

### Key pages

| Page | URL path |
|---|---|
| Landing page | `/index.html` |
| Login | `/login/index.html` |
| Admin dashboard | `/admin/dashboard.html` |
| Admin dispatch | `/admin/dispatch.html` |
| Brimot invoicing | `/admin/brimot/facturation.html` |
| Client dashboard | `/client/dashboard.html` |
| Driver dashboard | `/chauffeur/dashboard.html` |

### Auth behavior

Admin and role-specific pages check for a valid Supabase session on load and redirect unauthenticated users to the landing page. A valid Supabase account is required to access any protected page.

### Lint / Test / Build

- There are no linters, test frameworks, or build steps configured in this repository.
- Validation is done by serving the files and manually testing in a browser.

### Caveats

- The Brimot email feature (`admin/brimot/send_mail.php`) requires a PHP runtime; it is optional and not needed for general development.
- All external dependencies (Supabase JS SDK, Leaflet, Font Awesome, Google Fonts) are loaded from CDNs, so internet access is required.
