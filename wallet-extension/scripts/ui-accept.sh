#!/bin/bash
#
# UI Accept - Promote Current Screenshots to Golden (V38)
#
# This script MANUALLY promotes current screenshots to golden baseline.
# Use after reviewing screenshots and confirming they are correct.
#
# Paths:
#   Source:  artifacts/ui/current/
#   Target:  artifacts/ui/golden/
#
# Usage: ./scripts/ui-accept.sh [--force]
#
# Options:
#   --force    Skip confirmation prompt
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# V38: Artifacts-based paths
ARTIFACTS_DIR="$ROOT_DIR/artifacts/ui"
CURRENT_DIR="$ARTIFACTS_DIR/current"
GOLDEN_DIR="$ARTIFACTS_DIR/golden"

# Expected count per UI_CONTRACT
EXPECTED_COUNT=24

# Parse arguments
FORCE=false
for arg in "$@"; do
  case $arg in
    --force)
      FORCE=true
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
echo -e "${YELLOW}   UI ACCEPT - Promote Current to Golden (V38)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"

# Check current directory exists
if [ ! -d "$CURRENT_DIR" ]; then
  echo -e "${RED}ERROR: No current directory at $CURRENT_DIR${NC}"
  echo "Run 'pnpm ui:shots' to capture screenshots first."
  exit 1
fi

# Count current screenshots
CURRENT_COUNT=$(ls -1 "$CURRENT_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')

echo -e "Source:   ${CYAN}$CURRENT_DIR${NC}"
echo -e "Target:   ${CYAN}$GOLDEN_DIR${NC}"
echo -e "Current:  ${CYAN}$CURRENT_COUNT${NC} screenshots"
echo -e "Expected: ${CYAN}$EXPECTED_COUNT${NC} screenshots"
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

# Check if golden exists and show diff summary
if [ -d "$GOLDEN_DIR" ]; then
  GOLDEN_COUNT=$(ls -1 "$GOLDEN_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
  echo -e "${YELLOW}Existing golden: $GOLDEN_COUNT screenshots${NC}"
  echo -e "${YELLOW}This will REPLACE the existing golden baseline.${NC}"
  echo ""
fi

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

# Create golden directory if it doesn't exist
mkdir -p "$GOLDEN_DIR"

# Clear existing golden screenshots
rm -f "$GOLDEN_DIR"/*.png 2>/dev/null || true

# Copy current to golden
cp "$CURRENT_DIR"/*.png "$GOLDEN_DIR/"

# Verify copy
FINAL_COUNT=$(ls -1 "$GOLDEN_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')

echo -e "${GREEN}✓ Copied $FINAL_COUNT screenshots to golden baseline${NC}"

# List files
echo ""
echo "Golden baseline files:"
ls -1 "$GOLDEN_DIR"/*.png 2>/dev/null | while read f; do
  echo "  - $(basename "$f")"
done

echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "Result: ${GREEN}SUCCESS${NC} - Golden baseline updated ($FINAL_COUNT/$EXPECTED_COUNT)"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
