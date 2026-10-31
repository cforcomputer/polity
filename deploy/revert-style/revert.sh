#!/bin/sh
# Restore Polity's original look: the long homepage at "/" inside the app shell,
# the navy pin logo and the blue palette. Seed data and the map fix are kept.
# Afterwards both polity.geckur.com and app.polity.geckur.com serve the whole app.
#   deploy/revert-style/revert.sh && deploy/deploy.sh
set -e
cd "$(dirname "$0")/../.."
KIT=deploy/revert-style

cp "$KIT/page.tsx" "src/app/(app)/page.tsx"
cp "$KIT/logo.tsx" src/components/logo.tsx
rm -rf "src/app/(site)" "src/app/(app)/home" src/proxy.ts

# Swap the color tokens between the "--color-ink" line and "--color-brand-soft" line for the originals.
awk -v kit="$KIT/theme.css" '
  /--color-ink:/ { while ((getline l < kit) > 0) print l; skip = 1 }
  skip && /--color-brand-soft:/ { skip = 0; next }
  !skip
' src/app/globals.css > src/app/globals.css.tmp && mv src/app/globals.css.tmp src/app/globals.css

# Header: original active-tab and bar styles.
sed -i '' \
  -e 's#"bg-ink/\[0.06\] text-ink" : "text-muted hover:text-ink"#"bg-brand-soft text-brand" : "text-muted hover:bg-slate-100 hover:text-ink"#' \
  -e 's#bg-white/80 backdrop-blur-xl#bg-white/90 backdrop-blur#' \
  src/components/header.tsx
sed -i '' -e 's/#5b4cf0/#1d4ed8/g' src/components/map.tsx

echo "Reverted to the original style. Run: npx next build (or deploy/deploy.sh)"
