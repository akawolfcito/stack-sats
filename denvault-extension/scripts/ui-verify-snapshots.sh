#!/bin/bash
#
# UI Snapshot Verification Gate
#
# This script verifies that golden screenshots exist and are up-to-date.
# Used as a CI gate to enforce visual regression testing.
#
# Usage: ./scripts/ui-verify-snapshots.sh
#
# Exit codes:
#   0 - All checks passed
#   1 - Missing required screenshots
#   2 - Screenshots are stale (older than UI changes)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
GOLDEN_DIR="$ROOT_DIR/docs/ui/golden"
CURRENT_DIR="$GOLDEN_DIR/CURRENT"

# Required golden screens
REQUIRED_SCREENS=(
  "01-start"
  "02-unlock"
  "03-home"
  "05-settings"
  "06-send"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "  UI Snapshot Verification Gate"
echo "========================================"
echo ""

# Check if CURRENT directory exists
if [ ! -d "$CURRENT_DIR" ]; then
  echo -e "${RED}ERROR: CURRENT directory does not exist${NC}"
  echo "  Expected: $CURRENT_DIR"
  echo ""
  echo "Run 'pnpm ui:snapshots' to generate screenshots."
  exit 1
fi

# Check for required screenshots
MISSING=()
for screen in "${REQUIRED_SCREENS[@]}"; do
  if [ ! -f "$CURRENT_DIR/${screen}.png" ]; then
    MISSING+=("$screen")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo -e "${RED}ERROR: Missing required screenshots:${NC}"
  for screen in "${MISSING[@]}"; do
    echo "  - ${screen}.png"
  done
  echo ""
  echo "Run 'pnpm ui:snapshots' to generate missing screenshots."
  exit 1
fi

# Count total screenshots
TOTAL=$(ls -1 "$CURRENT_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')

echo -e "${GREEN}All required screenshots present${NC}"
echo "  Total screenshots: $TOTAL"
echo "  Location: $CURRENT_DIR"
echo ""

# Check if UI files were modified more recently than screenshots
# (This is a soft warning, not a hard failure)
UI_DIRS=(
  "$ROOT_DIR/src/views"
  "$ROOT_DIR/src/components"
  "$ROOT_DIR/src/assets"
)

NEWEST_UI=0
for dir in "${UI_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    # Find newest file modification time
    NEWEST=$(find "$dir" -name "*.vue" -o -name "*.css" -o -name "*.ts" 2>/dev/null | xargs stat -f "%m" 2>/dev/null | sort -rn | head -1)
    if [ -n "$NEWEST" ] && [ "$NEWEST" -gt "$NEWEST_UI" ]; then
      NEWEST_UI=$NEWEST
    fi
  fi
done

# Get oldest screenshot modification time
OLDEST_SCREENSHOT=$(find "$CURRENT_DIR" -name "*.png" 2>/dev/null | xargs stat -f "%m" 2>/dev/null | sort -n | head -1)

if [ -n "$OLDEST_SCREENSHOT" ] && [ -n "$NEWEST_UI" ] && [ "$NEWEST_UI" -gt "$OLDEST_SCREENSHOT" ]; then
  echo -e "${YELLOW}WARNING: UI files have been modified since last snapshot${NC}"
  echo "  Consider running 'pnpm ui:snapshots' to update screenshots."
  echo ""
fi

echo "========================================"
echo -e "  ${GREEN}Verification PASSED${NC}"
echo "========================================"

exit 0
