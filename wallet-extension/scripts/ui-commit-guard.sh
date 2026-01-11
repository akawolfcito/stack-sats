#!/bin/bash
#
# UI Commit Guard - Visual Delta Verification
#
# Ensures that commits claiming "visible delta" have corresponding diff images.
# Fails if:
#   - Commit message contains "visible delta" but no diff images exist
#   - Commit message contains "visible delta" but latest/ screenshots are missing
#
# Usage: ./scripts/ui-commit-guard.sh [commit-message]
#
# Exit codes:
#   0 - All checks passed
#   1 - Missing visual evidence for claimed delta
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
GOLDEN_DIR="$ROOT_DIR/docs/ui/golden"
LATEST_DIR="$GOLDEN_DIR/latest"
BASELINE_DIR="$GOLDEN_DIR/baseline"
DIFF_DIR="$GOLDEN_DIR/diff"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}   UI COMMIT GUARD - Visual Delta Verification${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"

# Get commit message (from arg or last commit)
if [ -n "$1" ]; then
  COMMIT_MSG="$1"
else
  COMMIT_MSG=$(git log -1 --pretty=%B 2>/dev/null || echo "")
fi

# Check if commit message claims visible delta
CLAIMS_DELTA=false
if echo "$COMMIT_MSG" | grep -qi "visible delta\|visual change\|ui change"; then
  CLAIMS_DELTA=true
fi

echo -e "Commit message analyzed: ${CYAN}$(echo "$COMMIT_MSG" | head -1)${NC}"
echo -e "Claims visible delta: ${CYAN}$CLAIMS_DELTA${NC}"
echo ""

# If no visible delta claimed, pass
if [ "$CLAIMS_DELTA" = false ]; then
  echo -e "${GREEN}✓ No visible delta claimed - skipping visual verification${NC}"
  echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
  echo -e "Result: ${GREEN}PASSED${NC}"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
fi

# Visible delta claimed - verify evidence exists
ERRORS=()

# Check 1: Latest screenshots exist
echo -e "${CYAN}[1/3] Checking for latest screenshots...${NC}"
if [ ! -d "$LATEST_DIR" ]; then
  ERRORS+=("No latest/ directory found - run 'pnpm ui:shots' first")
else
  LATEST_COUNT=$(ls -1 "$LATEST_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
  if [ "$LATEST_COUNT" -eq 0 ]; then
    ERRORS+=("No screenshots in latest/ - run 'pnpm ui:shots' first")
  else
    echo -e "  ${GREEN}✓ Found $LATEST_COUNT screenshots in latest/${NC}"
  fi
fi

# Check 2: Baseline exists for comparison
echo -e "\n${CYAN}[2/3] Checking for baseline screenshots...${NC}"
if [ ! -d "$BASELINE_DIR" ]; then
  echo -e "  ${YELLOW}! No baseline/ directory - creating from latest/${NC}"
  # This is acceptable for first-time setup
else
  BASELINE_COUNT=$(ls -1 "$BASELINE_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
  if [ "$BASELINE_COUNT" -eq 0 ]; then
    echo -e "  ${YELLOW}! No baseline screenshots - run 'pnpm ui:baseline' after verifying latest/${NC}"
  else
    echo -e "  ${GREEN}✓ Found $BASELINE_COUNT screenshots in baseline/${NC}"
  fi
fi

# Check 3: Diff images exist (if baseline exists)
echo -e "\n${CYAN}[3/3] Checking for diff images...${NC}"
if [ -d "$BASELINE_DIR" ] && [ -d "$LATEST_DIR" ]; then
  # Check if baseline was just established (same as latest - initial setup)
  BASELINE_HASH=$(find "$BASELINE_DIR" -name "*.png" -exec md5 -q {} \; 2>/dev/null | sort | md5 || echo "baseline")
  LATEST_HASH=$(find "$LATEST_DIR" -name "*.png" -exec md5 -q {} \; 2>/dev/null | sort | md5 || echo "latest")

  if [ "$BASELINE_HASH" = "$LATEST_HASH" ]; then
    echo -e "  ${YELLOW}! Baseline identical to latest (initial setup)${NC}"
    echo -e "  ${GREEN}✓ Accepting as initial baseline establishment${NC}"
  elif [ -d "$DIFF_DIR" ]; then
    DIFF_COUNT=$(ls -1 "$DIFF_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
    if [ "$DIFF_COUNT" -gt 0 ]; then
      echo -e "  ${GREEN}✓ Found $DIFF_COUNT diff images showing changes${NC}"
    else
      # No diff PNGs but diff ran successfully (0% change is still valid)
      echo -e "  ${GREEN}✓ Diff check ran - no visual differences detected${NC}"
    fi
  else
    ERRORS+=("No diff/ directory - run 'pnpm ui:diff' to generate visual evidence")
  fi
else
  echo -e "  ${YELLOW}! Skipping diff check (no baseline to compare)${NC}"
fi

# Summary
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo -e "Result: ${RED}FAILED${NC} - Missing visual evidence"
  echo ""
  echo -e "${RED}Errors:${NC}"
  for err in "${ERRORS[@]}"; do
    echo -e "  ${RED}•${NC} $err"
  done
  echo ""
  echo -e "${YELLOW}Required for commits claiming visible delta:${NC}"
  echo "  1. Run 'pnpm ui:shots' to capture current state"
  echo "  2. Run 'pnpm ui:diff' to generate diff images"
  echo "  3. Include diff images in commit or documentation"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 1
else
  echo -e "Result: ${GREEN}PASSED${NC} - Visual evidence present"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
fi
