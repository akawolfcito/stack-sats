#!/bin/bash
#
# UI Snapshot Diff - Visual Regression Check (V41)
#
# Compares CURRENT screenshots against GOLDEN using ImageMagick.
# V38: Strict count validation - must be 24/24 to pass.
# V41: Added ROI (Region of Interest) comparison with stricter threshold.
#
# Paths:
#   Current:      artifacts/ui/current/
#   Golden:       artifacts/ui/golden/
#   Diff:         artifacts/ui/diff/
#   ROI Current:  artifacts/ui/current/roi/
#   ROI Golden:   artifacts/ui/golden/roi/
#   ROI Diff:     artifacts/ui/diff/roi/
#
# Usage: ./scripts/ui-diff-snapshots.sh [--threshold=N] [--roi-threshold=N]
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

# V41: ROI paths
ROI_CURRENT_DIR="$CURRENT_DIR/roi"
ROI_GOLDEN_DIR="$GOLDEN_DIR/roi"
ROI_DIFF_DIR="$DIFF_DIR/roi"

# Expected count per UI_CONTRACT
EXPECTED_COUNT=24

# Default threshold (percentage difference to fail)
THRESHOLD=5

# V41: ROI threshold (stricter for component-level changes)
ROI_THRESHOLD=0.5

# Parse arguments
for arg in "$@"; do
  case $arg in
    --threshold=*)
      THRESHOLD="${arg#*=}"
      shift
      ;;
    --roi-threshold=*)
      ROI_THRESHOLD="${arg#*=}"
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

  # V43: Compare using ImageMagick - get absolute pixel difference
  DIFF_VALUE=$(compare -metric AE "$golden" "$current" "$diff_out" 2>&1 || true)
  # Clean up non-numeric output
  DIFF_VALUE=$(echo "$DIFF_VALUE" | grep -o '^[0-9]*' || echo "0")

  # Get total pixels
  TOTAL_PIXELS=$(identify -format "%[fx:w*h]" "$golden" 2>/dev/null || echo "0")

  # V43: Calculate percentage with 4 decimal precision
  if [ "$TOTAL_PIXELS" -gt 0 ] && [ -n "$DIFF_VALUE" ] && [ "$DIFF_VALUE" != "0" ]; then
    PERCENT=$(awk "BEGIN {printf \"%.4f\", ($DIFF_VALUE / $TOTAL_PIXELS) * 100}")
  else
    PERCENT="0.0000"
  fi

  # V43: Format for display (show 2 decimals, but use 4 for comparison)
  PERCENT_DISPLAY=$(awk "BEGIN {printf \"%.2f\", $PERCENT}")

  # Check threshold
  EXCEEDS=$(awk "BEGIN {print ($PERCENT > $THRESHOLD) ? 1 : 0}")

  if [ "$EXCEEDS" = "1" ]; then
    FAILURES+=("$filename: ${PERCENT_DISPLAY}%")
    echo -e "  ${RED}✗${NC} $filename - ${PERCENT_DISPLAY}% diff (exceeds ${THRESHOLD}%)"
  else
    PASSES+=("$filename")
    # V43: Always show actual diff, even if 0
    echo -e "  ${GREEN}✓${NC} $filename - ${PERCENT_DISPLAY}% diff"
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

FULLFRAME_FAILED=false
if [ ${#FAILURES[@]} -gt 0 ]; then
  echo -e "\nFull-frame: ${RED}FAILED${NC} - ${#FAILURES[@]} screenshots exceed ${THRESHOLD}% threshold"
  echo ""
  echo "Failures:"
  for f in "${FAILURES[@]}"; do
    echo -e "  ${RED}•${NC} $f"
  done
  echo ""
  echo "Diff images saved to: $DIFF_DIR"
  FULLFRAME_FAILED=true
else
  echo -e "\nFull-frame: ${GREEN}PASSED${NC} - ${#PASSES[@]}/${EXPECTED_COUNT} screenshots within ${THRESHOLD}% threshold"
  # Clean diff dir if all passed
  rmdir "$DIFF_DIR" 2>/dev/null || true
fi

# ═══════════════════════════════════════════════════════════
# V41: ROI (Region of Interest) Comparison
# ═══════════════════════════════════════════════════════════

ROI_FAILED=false
ROI_PASSES=()
ROI_FAILURES=()

# Check if ROI directories exist
if [ -d "$ROI_GOLDEN_DIR" ] && [ -d "$ROI_CURRENT_DIR" ]; then
  ROI_GOLDEN_COUNT=$(ls -1 "$ROI_GOLDEN_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
  ROI_CURRENT_COUNT=$(ls -1 "$ROI_CURRENT_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')

  if [ "$ROI_GOLDEN_COUNT" -gt 0 ] && [ "$ROI_CURRENT_COUNT" -gt 0 ]; then
    echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}   ROI DIFF - Component-Level Regression (V41)${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
    echo -e "ROI Threshold: ${CYAN}${ROI_THRESHOLD}%${NC}"
    echo -e "ROI Golden:    ${CYAN}$ROI_GOLDEN_COUNT${NC} components"
    echo -e "ROI Current:   ${CYAN}$ROI_CURRENT_COUNT${NC} components"
    echo ""

    # Create ROI diff directory
    mkdir -p "$ROI_DIFF_DIR"
    rm -f "$ROI_DIFF_DIR"/*.png 2>/dev/null || true

    # Compare each ROI golden screenshot
    for golden in "$ROI_GOLDEN_DIR"/*.png; do
      [ -f "$golden" ] || continue

      filename=$(basename "$golden")
      current="$ROI_CURRENT_DIR/$filename"
      diff_out="$ROI_DIFF_DIR/$filename"

      if [ ! -f "$current" ]; then
        echo -e "  ${YELLOW}⚠${NC} $filename - missing in current"
        continue
      fi

      # V43: Compare using ImageMagick
      DIFF_VALUE=$(compare -metric AE "$golden" "$current" "$diff_out" 2>&1 || true)
      DIFF_VALUE=$(echo "$DIFF_VALUE" | grep -o '^[0-9]*' || echo "0")

      # Get total pixels
      TOTAL_PIXELS=$(identify -format "%[fx:w*h]" "$golden" 2>/dev/null || echo "0")

      # V43: Calculate percentage with 4 decimal precision
      if [ "$TOTAL_PIXELS" -gt 0 ] && [ -n "$DIFF_VALUE" ] && [ "$DIFF_VALUE" != "0" ]; then
        PERCENT=$(awk "BEGIN {printf \"%.4f\", ($DIFF_VALUE / $TOTAL_PIXELS) * 100}")
      else
        PERCENT="0.0000"
      fi

      PERCENT_DISPLAY=$(awk "BEGIN {printf \"%.2f\", $PERCENT}")

      # Check ROI threshold
      EXCEEDS=$(awk "BEGIN {print ($PERCENT > $ROI_THRESHOLD) ? 1 : 0}")

      if [ "$EXCEEDS" = "1" ]; then
        ROI_FAILURES+=("$filename: ${PERCENT_DISPLAY}%")
        echo -e "  ${RED}✗${NC} $filename - ${PERCENT_DISPLAY}% diff (exceeds ${ROI_THRESHOLD}%)"
      else
        ROI_PASSES+=("$filename")
        echo -e "  ${GREEN}✓${NC} $filename - ${PERCENT_DISPLAY}% diff"
        rm -f "$diff_out"
      fi
    done

    if [ ${#ROI_FAILURES[@]} -gt 0 ]; then
      echo -e "\nROI Result: ${RED}FAILED${NC} - ${#ROI_FAILURES[@]} components exceed ${ROI_THRESHOLD}% threshold"
      ROI_FAILED=true
    else
      echo -e "\nROI Result: ${GREEN}PASSED${NC} - ${#ROI_PASSES[@]}/$ROI_GOLDEN_COUNT components within ${ROI_THRESHOLD}% threshold"
      rmdir "$ROI_DIFF_DIR" 2>/dev/null || true
    fi
  fi
else
  echo -e "\n${YELLOW}ROI: Skipped (no ROI baseline found)${NC}"
fi

# ═══════════════════════════════════════════════════════════
# Final Summary
# ═══════════════════════════════════════════════════════════

echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"

# Update diff result JSON with ROI data
DIFF_RESULT="$ARTIFACTS_DIR/diff-result.json"
echo "{
  \"fullFrame\": {
    \"passed\": ${#PASSES[@]},
    \"failed\": ${#FAILURES[@]},
    \"expected\": $EXPECTED_COUNT,
    \"threshold\": $THRESHOLD
  },
  \"roi\": {
    \"passed\": ${#ROI_PASSES[@]},
    \"failed\": ${#ROI_FAILURES[@]},
    \"threshold\": $ROI_THRESHOLD
  },
  \"success\": $([ "$FULLFRAME_FAILED" = false ] && [ "$ROI_FAILED" = false ] && echo "true" || echo "false")
}" > "$DIFF_RESULT"

if [ "$FULLFRAME_FAILED" = true ] || [ "$ROI_FAILED" = true ]; then
  echo -e "Result: ${RED}FAILED${NC}"
  [ "$FULLFRAME_FAILED" = true ] && echo -e "  Full-frame: ${#FAILURES[@]} failures"
  [ "$ROI_FAILED" = true ] && echo -e "  ROI: ${#ROI_FAILURES[@]} failures"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 1
else
  echo -e "Result: ${GREEN}PASSED${NC}"
  echo -e "  Full-frame: ${#PASSES[@]}/${EXPECTED_COUNT} passed"
  [ ${#ROI_PASSES[@]} -gt 0 ] && echo -e "  ROI: ${#ROI_PASSES[@]} passed"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
fi
