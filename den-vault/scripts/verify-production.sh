#!/bin/bash
set -e

echo "=== DenVault Production Build Verification ==="
echo ""

# Step 1: Build
echo "[1/4] Building production bundle..."
pnpm build-only

# Step 2: Check for snapshot mode backdoor
echo "[2/4] Checking for snapshot mode strings in dist/..."
if grep -r "__UI_SNAPSHOT_MODE__" dist/; then
  echo "FAIL: Snapshot mode string found in production build"
  exit 1
fi
echo "  OK: No snapshot mode strings found"

# Step 3: Check for devLog calls
echo "[3/4] Checking for devLog calls in dist/..."
if grep -r "devLog" dist/; then
  echo "WARN: devLog found in production build (non-blocking)"
fi
echo "  OK: devLog check complete"

# Step 4: Check for console.log (optional warning)
echo "[4/4] Checking for console.log in dist/..."
CONSOLE_COUNT=$(grep -r "console\.log" dist/ | wc -l | tr -d ' ')
if [ "$CONSOLE_COUNT" -gt 0 ]; then
  echo "  WARN: $CONSOLE_COUNT console.log occurrences found in dist/"
else
  echo "  OK: No console.log found"
fi

echo ""
echo "=== Verification Complete ==="
