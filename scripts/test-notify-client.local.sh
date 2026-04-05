#!/usr/bin/env bash
# Test manuel de la fonction notify-new-client (mail « nouveau client »).
#
# 1) Copie ce fichier :
#    cp scripts/test-notify-client.example.sh scripts/test-notify-client.local.sh
# 2) Ouvre test-notify-client.local.sh et remplace les deux valeurs ci-dessous
#    (clé anon = même valeur que window.SUPABASE_CONFIG.key dans config.js).
# 3) Ne commite JAMAIS test-notify-client.local.sh (contient ta clé).
# 4) chmod +x scripts/test-notify-client.local.sh
# 5) ./scripts/test-notify-client.local.sh

SUPABASE_ANON="COLLE_ICI_LA_CLE_ANON_EYJ..."
WEBHOOK_SECRET="colixo-test-2026"

curl -sS -X POST \
  "https://iubbsnntcreneakbdkmv.supabase.co/functions/v1/notify-new-client" \
  -H "Content-Type: application/json" \
  -H "apikey: ${SUPABASE_ANON}" \
  -H "Authorization: Bearer ${SUPABASE_ANON}" \
  -H "x-webhook-secret: ${WEBHOOK_SECRET}" \
  -d '{"type":"INSERT","table":"utilisateurs","record":{"id":"00000000-0000-0000-0000-000000000099","email":"test@example.com","role":"client","prenom":"Test","nom":"Manuel","telephone":"","entreprise_id":null}}'
echo
