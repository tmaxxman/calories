#!/usr/bin/env bash
# Cache-busting: stamp a fresh version token onto the asset includes in index.html.
# GitHub Pages caches files for ~10 minutes, so without this a deploy can serve a
# NEW index.html alongside a stale cached app.js/styles.css — a mismatch that can
# freeze the app. Bumping ?v= makes a fresh page always pull matching files.
#
# Run this right before committing a deploy:  ./bump.sh
set -euo pipefail
cd "$(dirname "$0")"
TOKEN=$(date +%Y%m%d%H%M%S)
perl -0pi -e '
  s/(href="styles\.css)(\?v=[^"]*)?"/$1?v='"$TOKEN"'"/;
  s/(src="meals\.js)(\?v=[^"]*)?"/$1?v='"$TOKEN"'"/;
  s/(src="app\.js)(\?v=[^"]*)?"/$1?v='"$TOKEN"'"/;
' index.html
echo "Stamped cache-busting version $TOKEN into index.html"
