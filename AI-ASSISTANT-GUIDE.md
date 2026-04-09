# 🤖 AI Assistant pour Colixo

Interface de chat IA pour administrer et améliorer votre site web.

## 🚀 Installation

### Étape 1 : Uploader sur Cloudflare

1. Ajoutez le fichier `admin/ai-chat.html` à votre projet GitHub
2. Push vers GitHub
3. Cloudflare Pages déploiera automatiquement

```bash
git add admin/ai-chat.html
git commit -m "Add AI Assistant"
git push
```

### Étape 2 : Configurer l'accès

，推荐在 Cloudflare Pages 添加自定义域名：
- `ai.colixo.ch`
- Ou accédez via : `colixo.ch/admin/ai-chat.html`

### Étape 3 : Obtenir une clé API OpenAI

1. Allez sur [platform.openai.com](https://platform.openai.com)
2. Créez un compte ou connectez-vous
3. Allez dans **"API Keys"** → **"Create new secret key"**
4. Copiez la clé

### Étape 4 : Configurer l'assistant

1. Ouvrez `ai.colixo.ch` (ou `/admin/ai-chat.html`)
2. Cliquez sur **⚙️** (en haut à droite)
3. Entrez votre clé API OpenAI
4. Choisissez le modèle (recommandé : GPT-3.5 Turbo)
5. Cliquez **Enregistrer**

## 💰 Coûts

| Modèle | Prix / 1K tokens | Recommandé |
|--------|------------------|------------|
| GPT-3.5 Turbo | ~$0.002 | ✅ Oui |
| GPT-4 | ~$0.03 | Pour plus de puissance |

Les $5 gratuits suffisent pour démarrer !

## 🎯 Fonctionnalités

- 💬 Chat en français
- ⚡ Réponses rapides
- 💻 Aide avec le code
- 📊 Génération de rapports
- 🔧 Support technique

## 🔧 Configuration Cloudflare Pages

1. Connectez-vous à [dash.cloudflare.com](https://dash.cloudflare.com)
2. Allez dans **Workers & Pages**
3. Créez une nouvelle page ou sélectionnez existante
4. Connectez votre dépôt GitHub
5. Déployez !

## 📱 URL d'accès

Après déploiement :
- `colixo.ch/admin/ai-chat.html`
- Ou configurez un subdomain comme `ai.colixo.ch`

---

Développé pour Colixo.ch 🚀
