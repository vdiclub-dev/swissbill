const OpenAI = require('openai');

const key = process.env.OPENAI_API_KEY;

if (!key) {
  console.warn('[OpenAI] Clé API manquante — les enrichissements IA seront désactivés');
}

const openai = key ? new OpenAI({ apiKey: key }) : null;

module.exports = openai;
