#!/bin/bash
#
# UI Snapshot Diff - Visual Regression Check (V38)
#
# Compares CURRENT screenshots against GOLDEN using ImageMagick.
# V38: Strict count validation - must be 24/24 to pass.
#
# Paths:
#   Current:  artifacts/ui/current/
#   Golden:   artifacts/ui/golden/
#   Diff:     artifacts/ui/diff/
#
# Usage: ./scripts/ui-diff-snapshots.sh [--threshold=N]
#
# Prerequisites: ImageMagick must be installed (brew install imagemagick)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# V38: New paths - artifacts-based
ARTIFACTS_DIR="$ROOT_DIR/artifacts/ui"
CURRENT_DIR="$ARTIFACTS_DIR/current"
GOLDEN_DIR="$ARTIFACTS_DIR/golden"
DIFF_DIR="$ARTIFACTS_DIR/diff"

# Expected count per UI_CONTRACT
EXPECTED_COUNT=24

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
echo -e "${YELLOW}   UI SNAPSHOT DIFF - Visual Regression (V38)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"

# Check for ImageMagick
if ! command -v compare &> /dev/null; then
  echo -e "${RED}ERROR: ImageMagick not installed${NC}"
  echo "Install with: brew install imagemagick"
  exit 1
fi

# Check golden directory exists
if [ ! -d "$GOLDEN_DIR" ]; then
  echo -e "${RED}ERROR: No golden directory at $GOLDEN_DIR${NC}"
  echo "Run 'pnpm ui:accept' after capturing and reviewing screenshots."
  exit 1
fi

# Check current directory exists
if [ ! -d "$CURRENT_DIR" ]; then
  echo -e "${RED}ERROR: No current directory at $CURRENT_DIR${NC}"
  echo "Run 'pnpm ui:shots' to capture screenshots first."
  exit 1
fi

# Count files
GOLDEN_COUNT=$(ls -1 "$GOLDEN_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
CURRENT_COUNT=$(ls -1 "$CURRENT_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')

echo -e "Threshold:  ${CYAN}$THRESHOLD%${NC}"
echo -e "Expected:   ${CYAN}$EXPECTED_COUNT${NC} screenshots"
echo -e "Golden:     ${CYAN}$GOLDEN_COUNT${NC} ($GOLDEN_DIR)"
echo -e "Current:    ${CYAN}$CURRENT_COUNT${NC} ($CURRENT_DIR)"
echo ""

# V38: Strict count validation
COUNT_OK=true
if [ "$GOLDEN_COUNT" -ne "$EXPECTED_COUNT" ]; then
  echo -e "${RED}ERROR: Golden count mismatch ($GOLDEN_COUNT != $EXPECTED_COUNT)${NC}"
  COUNT_OK=false
fi

if [ "$CURRENT_COUNT" -ne "$EXPECTED_COUNT" ]; then
  echo -e "${RED}ERROR: Current count mismatch ($CURRENT_COUNT != $EXPECTED_COUNT)${NC}"
  COUNT_OK=false
fi

if [ "$COUNT_OK" = false ]; then
  echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
  echo -e "Result: ${RED}FAILED${NC} - Count mismatch (expected $EXPECTED_COUNT)"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 1
fi

# Create diff directory
mkdir -p "$DIFF_DIR"
# Clear previous diffs
rm -f "$DIFF_DIR"/*.png 2>/dev/null || true

FAILURES=()
PASSES=()
MISSING_GOLDEN=()
MISSING_CURRENT=()

# Compare each golden screenshot
for golden in "$GOLDEN_DIR"/*.png; do
  [ -f "$golden" ] || continue

  filename=$(basename "$golden")
  current="$CURRENT_DIR/$filename"
  diff_out="$DIFF_DIR/$filename"

  if [ ! -f "$current" ]; then
    MISSING_CURRENT+=("$filename")
    continue
  fi

  # Compare using ImageMagick - get percentage difference
  DIFF_VALUE=$(compare -metric AE "$golden" "$current" "$diff_out" 2>&1 || true)

  # Get total pixels
  TOTAL_PIXELS=$(identify -format "%w*%h\n" "$golden" | bc)

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

# Check for current screenshots missing from golden
for current in "$CURRENT_DIR"/*.png; do
  [ -f "$current" ] || continue
  filename=$(basename "$current")
  if [ ! -f "$GOLDEN_DIR/$filename" ]; then
    MISSING_GOLDEN+=("$filename")
  fi
done

# Summary
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"

echo -e "Compared: ${CYAN}${#PASSES[@]}/${EXPECTED_COUNT}${NC} passed"

if [ ${#MISSING_CURRENT[@]} -gt 0 ]; then
  echo -e "${RED}Missing in current: ${#MISSING_CURRENT[@]}${NC}"
  for f in "${MISSING_CURRENT[@]}"; do
    echo -e "  ${RED}•${NC} $f"
  done
fi

if [ ${#MISSING_GOLDEN[@]} -gt 0 ]; then
  echo -e "${YELLOW}New in current (not in golden): ${#MISSING_GOLDEN[@]}${NC}"
  for f in "${MISSING_GOLDEN[@]}"; do
    echo -e "  ${YELLOW}•${NC} $f"
  done
fi

# Write diff results for ui:guard
DIFF_RESULT="$ARTIFACTS_DIR/diff-result.json"
echo "{
  \"passed\": ${#PASSES[@]},
  \"failed\": ${#FAILURES[@]},
  \"missingCurrent\": ${#MISSING_CURRENT[@]},
  \"missingGolden\": ${#MISSING_GOLDEN[@]},
  \"expected\": $EXPECTED_COUNT,
  \"threshold\": $THRESHOLD,
  \"success\": $([ ${#FAILURES[@]} -eq 0 ] && [ ${#MISSING_CURRENT[@]} -eq 0 ] && echo "true" || echo "false")
}" > "$DIFF_RESULT"

if [ ${#FAILURES[@]} -gt 0 ]; then
  echo -e "\nResult: ${RED}FAILED${NC} - ${#FAILURES[@]} screenshots exceed ${THRESHOLD}% threshold"
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
  echo -e "\nResult: ${GREEN}PASSED${NC} - ${#PASSES[@]}/${EXPECTED_COUNT} screenshots within ${THRESHOLD}% threshold"
  # Clean diff dir if all passed
  rmdir "$DIFF_DIR" 2>/dev/null || true
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
fi
