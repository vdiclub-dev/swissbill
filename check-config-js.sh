#!/bin/bash
# Vérifie la présence de config.js sur plusieurs environnements Vercel
# Usage : ./check-config-js.sh

# Liste des environnements à tester (ajoute ou modifie selon tes besoins)
URLS=(
  "https://swissbill.vercel.app/config.js?v=20260462"
  "https://swissbill-pru1v888e-vdiclub-devs-projects.vercel.app/config.js?v=20260462"
  "https://www.colixo.ch/config.js?v=20260462"
)

for url in "${URLS[@]}"; do
  echo "\nTest de $url :"
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$http_code" = "200" ]; then
    echo "  ✅ config.js accessible ($http_code)"
  else
    echo "  ❌ config.js INACCESSIBLE ($http_code)"
  fi
  # Affiche les 5 premières lignes du contenu si accessible
  if [ "$http_code" = "200" ]; then
    curl -s "$url" | head -n 5
  fi
  echo "-----------------------------"
done
