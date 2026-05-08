#!/bin/bash
# Script pour corriger les chemins de config.js dans tous les fichiers HTML

echo "Correction des chemins config.js..."

# Trouver tous les fichiers HTML et remplacer le chemin absolu par un chemin relatif
find . -name "*.html" -type f | while read file; do
    if grep -q 'src="/config.js' "$file"; then
        echo "Correction: $file"
        # Supprimer la ligne avec le chemin absolu
        sed -i '' 's|<script data-cfasync="false">if(!window.SUPABASE_CONFIG){document.write.*config.js[^"]*"></script>||g' "$file"
        # Alternative: remplacer par un chemin relatif basé sur le répertoire
        sed -i '' 's|src="/config.js|src="../config.js|g' "$file"
    fi
done

echo "Terminé!"
