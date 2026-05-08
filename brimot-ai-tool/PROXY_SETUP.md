# Proxy IA local (sans cle dans le front)

Ce mode permet d'utiliser DeepSeek/OpenAI sans saisir de cle dans l'interface.
Les cles restent cote serveur.

## 1) Definir les variables d'environnement

```bash
export BRIMOT_DEEPSEEK_API_KEY="sk-..."
export BRIMOT_OPENAI_API_KEY="sk-..."
```

Notes:
- `BRIMOT_DEEPSEEK_API_KEY` sert pour Assistant IA + ajustement de prix via DeepSeek.
- `BRIMOT_OPENAI_API_KEY` sert pour OpenAI et la recherche web concurrence.

## 2) Lancer le serveur HTTPS local

Depuis la racine du projet:

```bash
node server.js
```

Le serveur expose:
- `POST /api/ai-proxy`
- `POST /api/ai-web-research`

## 3) Ouvrir l'outil

- `https://localhost:8443/brimot-ai-tool/ai.html`
- `https://localhost:8443/brimot-ai-tool/config.html`

Laisse le champ cle API vide dans l'UI pour utiliser le proxy serveur.

## Important

Ce proxy local ne fonctionne pas sur GitHub Pages (site statique pur).
Pour la production, utiliser un hebergement avec backend (Vercel Functions, Render, Railway, VPS, etc.).
