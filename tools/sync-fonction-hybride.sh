#!/usr/bin/env bash
# Copie les modules purs du module hybride dans la fonction serveur (Supabase ne lit que son propre dossier).
set -euo pipefail
cd "$(dirname "$0")/.."
for f in hybride.js hybride-quetes.js hybride-serveur.js; do cp "js/$f" "supabase/functions/hybride-xp/$f"; done
echo "Copies à jour dans supabase/functions/hybride-xp/"
