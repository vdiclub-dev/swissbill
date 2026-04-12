# Colixo

Colixo est une application web statique de transport et logistique. Le frontend est servi directement en HTML, CSS et JavaScript, sans build. Le backend est hébergé sur Supabase.

## Quick Start

```bash
python3 -m http.server 8080
```

Ouvrir :

- `http://localhost:8080/`
- `http://localhost:8080/login/`

Ne pas utiliser `file://`.

## Lancer le projet en local

Depuis la racine du dépôt :

```bash
python3 -m http.server 8080
```

Puis ouvrir :

- `http://localhost:8080/`
- `http://localhost:8080/login/`

Ne pas utiliser `file://` : le SDK Supabase exige un contexte HTTP(S).

## Pages principales

| Page | URL |
| --- | --- |
| Accueil | `/` ou `/index.html` |
| Connexion | `/login/index.html` |
| Dashboard admin | `/admin/dashboard.html` |
| Dashboard chauffeur | `/chauffeur/dashboard.html` |
| Dashboard client | `/client/dashboard.html` |
| Dashboard magasinier | `/magasinier/dashboard.html` |
| Commandes client | `/commandes-client.html` |
| Facturation Brimot | `/admin/brimot/facturation.html` |

## Structure utile

- `admin/`, `chauffeur/`, `client/`, `magasinier/`, `login/` : pages applicatives
- `js/`, `css/`, `images/` : assets partagés
- `supabase/functions/` : Edge Functions
- `config.js` : configuration frontend globale, client Supabase, logique de version et de cache
- `version.json`, `version.txt` : marqueurs de version

## Authentification

Toutes les pages privées utilisent une session Supabase.

- Le client Supabase est initialisé dans `config.js`
- Les utilisateurs doivent exister dans la table `utilisateurs`
- La session est partagée entre les pages via une clé de stockage commune
- En cas de restrictions navigateur, `config.js` bascule de `localStorage` vers `sessionStorage`, puis vers un stockage mémoire

## Déploiement

La production est supposée être déployée sur Vercel.

À retenir :

- le dashboard Vercel et les domaines attachés sont la source de vérité
- `_headers`, `netlify.toml` et `CNAME` ne décrivent pas forcément le comportement réel en production
- GitHub Pages reste compatible pour des previews ou un fallback via `COLIXO_BASE_PATH`, mais ne doit pas être considéré comme l’hébergement principal

## Cache et versioning

Les déploiements peuvent sembler “inchangés” à cause du cache navigateur ou CDN. Garder cohérents :

- `window.COLIXO_ASSET_VERSION` dans `config.js`
- `version.txt`
- `version.json`
- `data-colixo-build` dans `admin/dispatch.html`
- les `?v=` sur les scripts HTML

`admin/dispatch.html` compare `version.json` à `data-colixo-build` et tente un rechargement avec `?_cb=` en cas d’écart.

Si la production semble servir une ancienne version :

- attendre la fin du déploiement Vercel
- faire un rechargement forcé : `Cmd+Shift+R` ou `Ctrl+Shift+R`
- purger le CDN si Cloudflare est devant Vercel
- vérifier dans le code source HTML le commentaire `<!-- colixo-build:... -->`
- vérifier dans la console que `[Colixo] build` correspond à la version attendue

## Développement

- Aucun build frontend
- Aucun linter configuré
- Aucun framework de test automatisé

La validation est principalement manuelle dans le navigateur.

Le dépôt contient aussi `server.js` et un `package.json` pour certains besoins locaux spécifiques, mais le mode standard reste le serveur statique Python.
