#!/usr/bin/env bash
# Test manuel de la fonction notify-new-client (mail « nouveau client »).
#
# 1) cp scripts/test-notify-client.example.sh scripts/test-notify-client.local.sh
# 2) Colle la clé ENTRE les quotes simples ' ... ' (une seule ligne, sans espace avant/après).
#    Source fiable : Supabase → Settings → API → anon public → copier.
#    Si config.js est vieux et la clé a été régénérée sur le dashboard, utilise le dashboard.
# 3) Ne commite JAMAIS test-notify-client.local.sh
# 4) chmod +x scripts/test-notify-client.local.sh && ./scripts/test-notify-client.local.sh
#
# Si erreur "API key is invalid" : mauvaise clé, clé tronquée, ou retour à la ligne dans la clé.

SUPABASE_ANON='COLLE_ICI_LA_CLE_ANON_COMMENCE_PAR_eyJ'
WEBHOOK_SECRET='colixo-test-2026'

curl -sS -X POST \
  "https://iubbsnntcreneakbdkmv.supabase.co/functions/v1/notify-new-client" \
  -H "Content-Type: application/json" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "Authorization: Bearer ${SUPABASE_ANON}" \
  -H "x-webhook-secret: ${WEBHOOK_SECRET}" \
  -d '{"type":"INSERT","table":"utilisateurs","record":{"id":"00000000-0000-0000-0000-000000000099","email":"test@example.com","role":"client","prenom":"Test","nom":"Manuel","telephone":"","entreprise_id":null}}'
echo
