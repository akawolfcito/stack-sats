#!/bin/bash
set -e

echo "=== DenVault Production Build Verification ==="
echo ""

# Step 1: Build
echo "[1/5] Building production bundle..."
pnpm build-only

# Step 2: Check for snapshot mode backdoor
echo "[2/5] Checking for snapshot mode strings in dist/..."
if grep -r "__UI_SNAPSHOT_MODE__" dist/; then
  echo "FAIL: Snapshot mode string found in production build"
  exit 1
fi
echo "  OK: No snapshot mode strings found"

# Step 3: Check for devLog calls
echo "[3/5] Checking for devLog calls in dist/..."
if grep -r "devLog" dist/; then
  echo "WARN: devLog found in production build (non-blocking)"
fi
echo "  OK: devLog check complete"

# Step 4: Check for console.log
# Split by ownership: our own extension scripts are copied verbatim from
# public/ and must be clean, while bundled dependencies (@noble/hashes
# logs a digest fallback) are outside our control and only reported.
echo "[4/5] Checking for console.log in dist/..."
OWNED_CONSOLE=0
for f in dist/background.js dist/content.js dist/injection.js; do
  [ -f "$f" ] || continue
  COUNT=$(grep -c "console\.log" "$f" || true)
  if [ "$COUNT" -gt 0 ]; then
    echo "  FAIL: $COUNT console.log in $f"
    OWNED_CONSOLE=$((OWNED_CONSOLE + COUNT))
  fi
done
if [ "$OWNED_CONSOLE" -gt 0 ]; then
  echo "FAIL: console.log found in extension-owned scripts"
  exit 1
fi
VENDOR_CONSOLE=$(grep -r "console\.log" dist/ | wc -l | tr -d ' ')
if [ "$VENDOR_CONSOLE" -gt 0 ]; then
  echo "  OK: extension scripts clean ($VENDOR_CONSOLE occurrence(s) in bundled deps)"
else
  echo "  OK: No console.log found"
fi

# Step 5: Check the Hiro platform API key never reaches the bundle.
# The key is only used on the devnet branch (src/utils/balance/index.ts);
# mainnet and testnet hit public endpoints. Building with a .env that
# carries the key would embed it in plaintext, so fail hard on the URL
# shape that only exists when the key is compiled in.
echo "[5/5] Checking for embedded Hiro API key in dist/..."
if grep -rq "api\.platform\.hiro\.so/v1/ext/" dist/; then
  echo "FAIL: Hiro platform API key embedded in production build"
  echo "      Rebuild without VITE_PLATFORM_HIRO_API_KEY set."
  exit 1
fi
echo "  OK: No embedded Hiro API key"

echo ""
echo "=== Verification Complete ==="
