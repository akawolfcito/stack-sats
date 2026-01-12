#!/bin/bash
#
# UI Commit Guard - Visual Baseline Integrity (V38)
#
# Ensures golden baseline integrity before commits:
#   1. Current screenshots exist and are complete (24/24)
#   2. Golden baseline exists and is complete (24/24)
#   3. No visual regressions (diff check passes)
#
# Paths:
#   Current:  artifacts/ui/current/
#   Golden:   artifacts/ui/golden/
#
# Usage: ./scripts/ui-commit-guard.sh
#
# Exit codes:
#   0 - All checks passed
#   1 - Integrity check failed
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# V38: Artifacts-based paths
ARTIFACTS_DIR="$ROOT_DIR/artifacts/ui"
CURRENT_DIR="$ARTIFACTS_DIR/current"
GOLDEN_DIR="$ARTIFACTS_DIR/golden"
DIFF_DIR="$ARTIFACTS_DIR/diff"
DIFF_RESULT="$ARTIFACTS_DIR/diff-result.json"

# Expected count per UI_CONTRACT
EXPECTED_COUNT=24

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}   UI COMMIT GUARD - Baseline Integrity (V38)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"

ERRORS=()

# Check 1: Golden directory exists
echo -e "${CYAN}[1/4] Checking golden baseline...${NC}"
if [ ! -d "$GOLDEN_DIR" ]; then
  ERRORS+=("No golden baseline directory - run 'pnpm ui:accept' first")
  echo -e "  ${RED}✗ No golden directory${NC}"
else
  GOLDEN_COUNT=$(ls -1 "$GOLDEN_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
  if [ "$GOLDEN_COUNT" -eq "$EXPECTED_COUNT" ]; then
    echo -e "  ${GREEN}✓ Golden: $GOLDEN_COUNT/$EXPECTED_COUNT${NC}"
  else
    ERRORS+=("Golden count mismatch: $GOLDEN_COUNT != $EXPECTED_COUNT")
    echo -e "  ${RED}✗ Golden: $GOLDEN_COUNT/$EXPECTED_COUNT (incomplete)${NC}"
  fi
fi

# Check 2: Current directory exists
echo -e "\n${CYAN}[2/4] Checking current screenshots...${NC}"
if [ ! -d "$CURRENT_DIR" ]; then
  ERRORS+=("No current screenshots - run 'pnpm ui:shots' first")
  echo -e "  ${RED}✗ No current directory${NC}"
else
  CURRENT_COUNT=$(ls -1 "$CURRENT_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
  if [ "$CURRENT_COUNT" -eq "$EXPECTED_COUNT" ]; then
    echo -e "  ${GREEN}✓ Current: $CURRENT_COUNT/$EXPECTED_COUNT${NC}"
  else
    ERRORS+=("Current count mismatch: $CURRENT_COUNT != $EXPECTED_COUNT")
    echo -e "  ${RED}✗ Current: $CURRENT_COUNT/$EXPECTED_COUNT (incomplete)${NC}"
  fi
fi

# Check 3: No diff images (visual regressions)
echo -e "\n${CYAN}[3/4] Checking for visual regressions...${NC}"
if [ -d "$DIFF_DIR" ]; then
  DIFF_COUNT=$(ls -1 "$DIFF_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
  if [ "$DIFF_COUNT" -gt 0 ]; then
    ERRORS+=("$DIFF_COUNT visual regression(s) detected - review diffs in $DIFF_DIR")
    echo -e "  ${RED}✗ Found $DIFF_COUNT diff images (regressions)${NC}"
    ls -1 "$DIFF_DIR"/*.png 2>/dev/null | while read f; do
      echo -e "    ${RED}•${NC} $(basename "$f")"
    done
  else
    echo -e "  ${GREEN}✓ No diff images (no regressions)${NC}"
  fi
else
  echo -e "  ${GREEN}✓ No diff directory (no regressions)${NC}"
fi

# Check 4: Diff result file (from last ui:diff run)
echo -e "\n${CYAN}[4/4] Checking last diff result...${NC}"
if [ -f "$DIFF_RESULT" ]; then
  # Parse JSON result
  SUCCESS=$(cat "$DIFF_RESULT" | grep -o '"success": *[a-z]*' | cut -d: -f2 | tr -d ' ')
  PASSED=$(cat "$DIFF_RESULT" | grep -o '"passed": *[0-9]*' | cut -d: -f2 | tr -d ' ')
  FAILED=$(cat "$DIFF_RESULT" | grep -o '"failed": *[0-9]*' | cut -d: -f2 | tr -d ' ')

  if [ "$SUCCESS" = "true" ]; then
    echo -e "  ${GREEN}✓ Last diff: $PASSED/$EXPECTED_COUNT passed${NC}"
  else
    ERRORS+=("Last diff check failed: $FAILED regressions")
    echo -e "  ${RED}✗ Last diff: $FAILED failed, $PASSED passed${NC}"
  fi
else
  echo -e "  ${YELLOW}! No diff result file - run 'pnpm ui:diff' first${NC}"
  # Not an error if golden and current match, but warn
fi

# Summary
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo -e "Result: ${RED}FAILED${NC} - ${#ERRORS[@]} issue(s) found"
  echo ""
  echo -e "${RED}Errors:${NC}"
  for err in "${ERRORS[@]}"; do
    echo -e "  ${RED}•${NC} $err"
  done
  echo ""
  echo -e "${YELLOW}Required before commit:${NC}"
  echo "  1. Run 'pnpm ui:shots' to capture current screenshots"
  echo "  2. Run 'pnpm ui:diff' to compare against golden"
  echo "  3. If intentional changes, run 'pnpm ui:accept' to update golden"
  echo "  4. Re-run this guard to verify"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 1
else
  echo -e "Result: ${GREEN}PASSED${NC} - Baseline integrity verified"
  echo -e "  Golden:  $EXPECTED_COUNT/$EXPECTED_COUNT"
  echo -e "  Current: $EXPECTED_COUNT/$EXPECTED_COUNT"
  echo -e "  Diffs:   0"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
fi
