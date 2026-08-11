#!/bin/bash
set -e

# Package dist/ for the Chrome Web Store.
#
# The version comes from public/manifest.json — the file CWS actually
# reads — so the artifact name can never drift from what is inside it.
# The previous script hardcoded 1.1.0, which is how a stale ZIP survived
# three months of changes.

cd "$(dirname "$0")/.."

if [ ! -f dist/manifest.json ]; then
  echo "FAIL: dist/ not built. Run 'pnpm verify:production' first."
  exit 1
fi

VERSION=$(node -p "require('./public/manifest.json').version")
DIST_VERSION=$(node -p "require('./dist/manifest.json').version")

if [ "$VERSION" != "$DIST_VERSION" ]; then
  echo "FAIL: dist/ was built from version $DIST_VERSION, manifest says $VERSION"
  echo "      Rebuild before packaging."
  exit 1
fi

ZIP="../denvault-v${VERSION}.zip"

rm -f "$ZIP"
(cd dist && zip -rq "../$ZIP" . -x '*.DS_Store')

echo "Created denvault-v${VERSION}.zip ($(du -h "$ZIP" | cut -f1))"
