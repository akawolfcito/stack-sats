#!/bin/bash
#
# UI Accept - Promote Current Screenshots to Golden (V41)
#
# This script MANUALLY promotes current screenshots to golden baseline.
# Use after reviewing screenshots and confirming they are correct.
#
# Paths:
#   Full-frame Source:  artifacts/ui/current/
#   Full-frame Target:  artifacts/ui/golden/
#   ROI Source:         artifacts/ui/current/roi/
#   ROI Target:         artifacts/ui/golden/roi/
#
# Usage: ./scripts/ui-accept.sh [--force] [--roi-only] [--full-only]
#
# Options:
#   --force      Skip confirmation prompt
#   --roi-only   Only accept ROI screenshots
#   --full-only  Only accept full-frame screenshots
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# V38: Artifacts-based paths
ARTIFACTS_DIR="$ROOT_DIR/artifacts/ui"
CURRENT_DIR="$ARTIFACTS_DIR/current"
GOLDEN_DIR="$ARTIFACTS_DIR/golden"

# V41: ROI paths
ROI_CURRENT_DIR="$CURRENT_DIR/roi"
ROI_GOLDEN_DIR="$GOLDEN_DIR/roi"

# Expected count per UI_CONTRACT
EXPECTED_COUNT=24

# Parse arguments
FORCE=false
ROI_ONLY=false
FULL_ONLY=false
for arg in "$@"; do
  case $arg in
    --force)
      FORCE=true
      shift
      ;;
    --roi-only)
      ROI_ONLY=true
      shift
      ;;
    --full-only)
      FULL_ONLY=true
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
echo -e "${YELLOW}   UI ACCEPT - Promote Current to Golden (V41)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"

# Mode display
if [ "$ROI_ONLY" = true ]; then
  echo -e "Mode: ${CYAN}ROI only${NC}"
elif [ "$FULL_ONLY" = true ]; then
  echo -e "Mode: ${CYAN}Full-frame only${NC}"
else
  echo -e "Mode: ${CYAN}Full-frame + ROI${NC}"
fi
echo ""

# ═══════════════════════════════════════════════════════════
# Full-Frame Screenshots
# ═══════════════════════════════════════════════════════════

FULL_SUCCESS=false
if [ "$ROI_ONLY" = false ]; then
  # Check current directory exists
  if [ ! -d "$CURRENT_DIR" ]; then
    echo -e "${RED}ERROR: No current directory at $CURRENT_DIR${NC}"
    echo "Run 'pnpm ui:shots' to capture screenshots first."
    exit 1
  fi

  # Count current screenshots
  CURRENT_COUNT=$(ls -1 "$CURRENT_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')

  echo -e "Full-frame Source:   ${CYAN}$CURRENT_DIR${NC}"
  echo -e "Full-frame Target:   ${CYAN}$GOLDEN_DIR${NC}"
  echo -e "Current:             ${CYAN}$CURRENT_COUNT${NC} screenshots"
  echo -e "Expected:            ${CYAN}$EXPECTED_COUNT${NC} screenshots"
  echo ""

  # V38: Strict count validation - must have exactly 24 screenshots
  if [ "$CURRENT_COUNT" -ne "$EXPECTED_COUNT" ]; then
    echo -e "${RED}ERROR: Count mismatch - cannot accept incomplete baseline${NC}"
    echo -e "Have $CURRENT_COUNT, need $EXPECTED_COUNT"
    echo ""
    echo "Run 'pnpm ui:shots' to capture all screenshots first."
    echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
    echo -e "Result: ${RED}ABORTED${NC} - Incomplete screenshot set"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
    exit 1
  fi
  FULL_SUCCESS=true
fi

# Check ROI current directory
ROI_COUNT=0
ROI_SUCCESS=false
if [ "$FULL_ONLY" = false ] && [ -d "$ROI_CURRENT_DIR" ]; then
  ROI_COUNT=$(ls -1 "$ROI_CURRENT_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
  if [ "$ROI_COUNT" -gt 0 ]; then
    echo -e "ROI Source:          ${CYAN}$ROI_CURRENT_DIR${NC}"
    echo -e "ROI Target:          ${CYAN}$ROI_GOLDEN_DIR${NC}"
    echo -e "ROI Count:           ${CYAN}$ROI_COUNT${NC} components"
    echo ""
    ROI_SUCCESS=true
  fi
fi

# Check if golden exists and show diff summary
if [ "$ROI_ONLY" = false ] && [ -d "$GOLDEN_DIR" ]; then
  GOLDEN_COUNT=$(ls -1 "$GOLDEN_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
  echo -e "${YELLOW}Existing full-frame golden: $GOLDEN_COUNT screenshots${NC}"
fi

if [ "$FULL_ONLY" = false ] && [ -d "$ROI_GOLDEN_DIR" ]; then
  ROI_GOLDEN_COUNT=$(ls -1 "$ROI_GOLDEN_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
  echo -e "${YELLOW}Existing ROI golden: $ROI_GOLDEN_COUNT components${NC}"
fi

echo -e "${YELLOW}This will REPLACE the existing golden baseline.${NC}"
echo ""

# Confirmation (unless --force)
if [ "$FORCE" = false ]; then
  echo -e "${YELLOW}Are you sure you want to promote current → golden?${NC}"
  echo -e "This action cannot be undone (unless you have git history)."
  echo ""
  read -p "Type 'yes' to confirm: " CONFIRM
  if [ "$CONFIRM" != "yes" ]; then
    echo -e "\n${YELLOW}Aborted by user.${NC}"
    exit 0
  fi
  echo ""
fi

# ═══════════════════════════════════════════════════════════
# Copy Full-Frame Screenshots
# ═══════════════════════════════════════════════════════════

FINAL_COUNT=0
if [ "$ROI_ONLY" = false ] && [ "$FULL_SUCCESS" = true ]; then
  # Create golden directory if it doesn't exist
  mkdir -p "$GOLDEN_DIR"

  # Clear existing golden screenshots
  rm -f "$GOLDEN_DIR"/*.png 2>/dev/null || true

  # Copy current to golden
  cp "$CURRENT_DIR"/*.png "$GOLDEN_DIR/"

  # Verify copy
  FINAL_COUNT=$(ls -1 "$GOLDEN_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')

  echo -e "${GREEN}✓ Copied $FINAL_COUNT full-frame screenshots to golden baseline${NC}"

  # List files
  echo ""
  echo "Full-frame golden files:"
  ls -1 "$GOLDEN_DIR"/*.png 2>/dev/null | while read f; do
    echo "  - $(basename "$f")"
  done
fi

# ═══════════════════════════════════════════════════════════
# Copy ROI Screenshots
# ═══════════════════════════════════════════════════════════

ROI_FINAL_COUNT=0
if [ "$FULL_ONLY" = false ] && [ "$ROI_SUCCESS" = true ]; then
  echo ""

  # Create ROI golden directory if it doesn't exist
  mkdir -p "$ROI_GOLDEN_DIR"

  # Clear existing ROI golden screenshots
  rm -f "$ROI_GOLDEN_DIR"/*.png 2>/dev/null || true

  # Copy ROI current to golden
  cp "$ROI_CURRENT_DIR"/*.png "$ROI_GOLDEN_DIR/"

  # Verify copy
  ROI_FINAL_COUNT=$(ls -1 "$ROI_GOLDEN_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')

  echo -e "${GREEN}✓ Copied $ROI_FINAL_COUNT ROI screenshots to golden baseline${NC}"

  # List files
  echo ""
  echo "ROI golden files:"
  ls -1 "$ROI_GOLDEN_DIR"/*.png 2>/dev/null | while read f; do
    echo "  - $(basename "$f")"
  done
fi

# ═══════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════

echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "Result: ${GREEN}SUCCESS${NC} - Golden baseline updated"
if [ "$ROI_ONLY" = false ] && [ "$FINAL_COUNT" -gt 0 ]; then
  echo -e "  Full-frame: $FINAL_COUNT/$EXPECTED_COUNT"
fi
if [ "$FULL_ONLY" = false ] && [ "$ROI_FINAL_COUNT" -gt 0 ]; then
  echo -e "  ROI: $ROI_FINAL_COUNT components"
fi
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
