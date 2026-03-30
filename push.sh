#!/bin/bash
# ─────────────────────────────────────────
#  push.sh — Upload automatique vers GitHub
#  Usage : ./push.sh "message du commit"
#  Sans argument : message automatique avec date
# ─────────────────────────────────────────

set -e

# Message de commit : argument ou automatique
MESSAGE="${1:-"update: $(date '+%Y-%m-%d %H:%M')"}"

echo "📦 Préparation du push..."

# Aller dans le dossier du projet
cd "$(dirname "$0")"

# Vérifier s'il y a des changements
if git diff --quiet && git diff --cached --quiet; then
    echo "✅ Aucun changement détecté — rien à pousser."
    exit 0
fi

# Ajouter tous les fichiers modifiés
git add -A

# Commit
git commit -m "$MESSAGE"
echo "✅ Commit : $MESSAGE"

# Synchroniser avec GitHub avant de pousser
echo "🔄 Synchronisation avec GitHub..."
git fetch origin main
git rebase origin/main

# Pousser
echo "🚀 Push vers GitHub..."
git push origin main

echo ""
echo "✅ Terminé ! Code en ligne sur GitHub."
echo "🔗 https://github.com/vdiclub-dev/swissbill"
