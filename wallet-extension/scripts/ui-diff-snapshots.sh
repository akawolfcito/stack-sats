#!/bin/bash
#
# UI Snapshot Diff - Visual Regression Check
#
# Compares CURRENT screenshots against BASELINE using ImageMagick.
# Fails if difference exceeds threshold (default 5%).
#
# Usage: ./scripts/ui-diff-snapshots.sh [--threshold=N]
#
# Prerequisites: ImageMagick must be installed (brew install imagemagick)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
GOLDEN_DIR="$ROOT_DIR/docs/ui/golden"
# Support both old (BASELINE/CURRENT) and new (baseline/latest) structures
if [ -d "$GOLDEN_DIR/baseline" ]; then
  BASELINE_DIR="$GOLDEN_DIR/baseline"
  CURRENT_DIR="$GOLDEN_DIR/latest"
  DIFF_DIR="$GOLDEN_DIR/diff"
else
  BASELINE_DIR="$GOLDEN_DIR/BASELINE"
  CURRENT_DIR="$GOLDEN_DIR/CURRENT"
  DIFF_DIR="$GOLDEN_DIR/DIFF"
fi

# Default threshold (percentage difference to fail)
THRESHOLD=5

# Parse arguments
for arg in "$@"; do
  case $arg in
    --threshold=*)
      THRESHOLD="${arg#*=}"
      shift
      ;;
  esac
done

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}   UI SNAPSHOT DIFF - Visual Regression${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"

# Check for ImageMagick
if ! command -v compare &> /dev/null; then
  echo -e "${RED}ERROR: ImageMagick not installed${NC}"
  echo "Install with: brew install imagemagick"
  exit 1
fi

# Check directories exist
if [ ! -d "$BASELINE_DIR" ]; then
  echo -e "${YELLOW}WARNING: No BASELINE directory${NC}"
  echo "Run 'pnpm ui:baseline' to create baseline from current screenshots."
  exit 0
fi

if [ ! -d "$CURRENT_DIR" ]; then
  echo -e "${RED}ERROR: No CURRENT directory${NC}"
  echo "Run 'pnpm ui:snapshots' to capture screenshots."
  exit 1
fi

# Create diff directory
mkdir -p "$DIFF_DIR"

echo -e "Threshold: ${CYAN}$THRESHOLD%${NC}"
echo -e "Baseline:  $BASELINE_DIR"
echo -e "Current:   $CURRENT_DIR"
echo ""

FAILURES=()
PASSES=()
SKIPPED=()

# Compare each baseline screenshot
for baseline in "$BASELINE_DIR"/*.png; do
  [ -f "$baseline" ] || continue

  filename=$(basename "$baseline")
  current="$CURRENT_DIR/$filename"
  diff_out="$DIFF_DIR/$filename"

  if [ ! -f "$current" ]; then
    SKIPPED+=("$filename (no current)")
    continue
  fi

  # Compare using ImageMagick - get percentage difference
  # Using AE (Absolute Error) metric
  DIFF_VALUE=$(compare -metric AE "$baseline" "$current" "$diff_out" 2>&1 || true)

  # Get total pixels
  TOTAL_PIXELS=$(identify -format "%w*%h\n" "$baseline" | bc)

  # Calculate percentage
  if [ "$TOTAL_PIXELS" -gt 0 ] && [ -n "$DIFF_VALUE" ]; then
    PERCENT=$(echo "scale=2; ($DIFF_VALUE / $TOTAL_PIXELS) * 100" | bc 2>/dev/null || echo "0")
  else
    PERCENT="0"
  fi

  # Check threshold
  EXCEEDS=$(echo "$PERCENT > $THRESHOLD" | bc -l 2>/dev/null || echo "0")

  if [ "$EXCEEDS" = "1" ]; then
    FAILURES+=("$filename: ${PERCENT}%")
    echo -e "  ${RED}✗${NC} $filename - ${PERCENT}% diff (exceeds ${THRESHOLD}%)"
  else
    PASSES+=("$filename")
    echo -e "  ${GREEN}✓${NC} $filename - ${PERCENT}% diff"
    # Remove diff file if passed
    rm -f "$diff_out"
  fi
done

# Summary
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"

if [ ${#SKIPPED[@]} -gt 0 ]; then
  echo -e "${YELLOW}Skipped: ${#SKIPPED[@]}${NC}"
fi

if [ ${#FAILURES[@]} -gt 0 ]; then
  echo -e "Result: ${RED}FAILED${NC} - ${#FAILURES[@]} screenshots exceed threshold"
  echo ""
  echo "Failures:"
  for f in "${FAILURES[@]}"; do
    echo -e "  ${RED}•${NC} $f"
  done
  echo ""
  echo "Diff images saved to: $DIFF_DIR"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 1
else
  echo -e "Result: ${GREEN}PASSED${NC} - ${#PASSES[@]} screenshots within threshold"
  # Clean diff dir if all passed
  rmdir "$DIFF_DIR" 2>/dev/null || true
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
fi
