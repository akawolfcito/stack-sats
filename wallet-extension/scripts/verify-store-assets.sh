#!/bin/bash
# verify-store-assets.sh - Verify CWS store assets meet requirements

set -e

STORE_DIR="$(dirname "$0")/../assets/store"
ERRORS=0

echo "=== CWS Store Assets Verification ==="
echo ""

# Check icon_128.png (REQUIRED: exactly 128x128)
ICON="$STORE_DIR/icon_128.png"
if [ -f "$ICON" ]; then
  SIZE=$(sips -g pixelWidth -g pixelHeight "$ICON" 2>/dev/null | grep pixel | awk '{print $2}' | tr '\n' 'x' | sed 's/x$//')
  if [ "$SIZE" = "128x128" ]; then
    echo "✅ icon_128.png: $SIZE (PASS)"
  else
    echo "❌ icon_128.png: $SIZE (REQUIRED: 128x128)"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "❌ icon_128.png: MISSING"
  ERRORS=$((ERRORS + 1))
fi

# Check screenshot_1.png (REQUIRED: min 1280x800)
SCREENSHOT="$STORE_DIR/screenshot_1.png"
if [ -f "$SCREENSHOT" ]; then
  W=$(sips -g pixelWidth "$SCREENSHOT" 2>/dev/null | grep pixelWidth | awk '{print $2}')
  H=$(sips -g pixelHeight "$SCREENSHOT" 2>/dev/null | grep pixelHeight | awk '{print $2}')
  if [ "$W" -ge 1280 ] && [ "$H" -ge 800 ]; then
    echo "✅ screenshot_1.png: ${W}x${H} (PASS)"
  else
    echo "❌ screenshot_1.png: ${W}x${H} (REQUIRED: min 1280x800)"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "⚠️  screenshot_1.png: MISSING (will use placeholder)"
fi

# Check promo_440x280.png (RECOMMENDED: exactly 440x280)
PROMO="$STORE_DIR/promo_440x280.png"
if [ -f "$PROMO" ]; then
  SIZE=$(sips -g pixelWidth -g pixelHeight "$PROMO" 2>/dev/null | grep pixel | awk '{print $2}' | tr '\n' 'x' | sed 's/x$//')
  if [ "$SIZE" = "440x280" ]; then
    echo "✅ promo_440x280.png: $SIZE (PASS)"
  else
    echo "⚠️  promo_440x280.png: $SIZE (RECOMMENDED: 440x280)"
  fi
else
  echo "⚠️  promo_440x280.png: MISSING (optional)"
fi

echo ""
if [ $ERRORS -eq 0 ]; then
  echo "=== RESULT: PASS ==="
  exit 0
else
  echo "=== RESULT: FAIL ($ERRORS errors) ==="
  exit 1
fi
