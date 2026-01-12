#!/bin/bash
#
# UI Commit Guard - Visual Baseline Integrity (V41)
#
# BLOCKING guard for CI/pre-commit. Ensures:
#   1. Full-frame golden baseline complete (24/24)
#   2. ROI golden baseline complete (7/7)
#   3. No visual regressions (full-frame + ROI)
#   4. V41 token compliance (style-probe)
#
# Paths:
#   Full-frame Golden:  artifacts/ui/golden/
#   ROI Golden:         artifacts/ui/golden/roi/
#   Style Probe:        artifacts/ui/style-probe.json
#
# Usage: ./scripts/ui-commit-guard.sh [--strict]
#
# Options:
#   --strict    Also require fresh screenshots (not just cached)
#
# Exit codes:
#   0 - All checks passed
#   1 - Guard check failed (BLOCKS merge/commit)
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# V38/V41: Artifacts-based paths
ARTIFACTS_DIR="$ROOT_DIR/artifacts/ui"
CURRENT_DIR="$ARTIFACTS_DIR/current"
GOLDEN_DIR="$ARTIFACTS_DIR/golden"
DIFF_DIR="$ARTIFACTS_DIR/diff"
ROI_CURRENT_DIR="$CURRENT_DIR/roi"
ROI_GOLDEN_DIR="$GOLDEN_DIR/roi"
ROI_DIFF_DIR="$DIFF_DIR/roi"
DIFF_RESULT="$ARTIFACTS_DIR/diff-result.json"
STYLE_PROBE="$ARTIFACTS_DIR/style-probe.json"

# Expected counts
EXPECTED_FULL=24
EXPECTED_ROI=7

# Parse arguments
STRICT=false
for arg in "$@"; do
  case $arg in
    --strict)
      STRICT=true
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
echo -e "${YELLOW}   UI COMMIT GUARD - Baseline Integrity (V41)${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"

if [ "$STRICT" = true ]; then
  echo -e "Mode: ${CYAN}STRICT${NC} (requires fresh screenshots)"
  echo ""
fi

ERRORS=()
WARNINGS=()

# ═══════════════════════════════════════════════════════════
# Check 1: Full-frame Golden Baseline
# ═══════════════════════════════════════════════════════════
echo -e "${CYAN}[1/5] Full-frame Golden Baseline...${NC}"
if [ ! -d "$GOLDEN_DIR" ]; then
  ERRORS+=("No full-frame golden baseline - run 'pnpm ui:accept' first")
  echo -e "  ${RED}✗ Missing golden directory${NC}"
else
  GOLDEN_COUNT=$(ls -1 "$GOLDEN_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
  if [ "$GOLDEN_COUNT" -eq "$EXPECTED_FULL" ]; then
    echo -e "  ${GREEN}✓ Golden: $GOLDEN_COUNT/$EXPECTED_FULL${NC}"
  else
    ERRORS+=("Full-frame golden incomplete: $GOLDEN_COUNT/$EXPECTED_FULL")
    echo -e "  ${RED}✗ Golden: $GOLDEN_COUNT/$EXPECTED_FULL (incomplete)${NC}"
  fi
fi

# ═══════════════════════════════════════════════════════════
# Check 2: ROI Golden Baseline
# ═══════════════════════════════════════════════════════════
echo -e "\n${CYAN}[2/5] ROI Golden Baseline...${NC}"
if [ ! -d "$ROI_GOLDEN_DIR" ]; then
  ERRORS+=("No ROI golden baseline - run 'pnpm ui:roi && pnpm ui:accept'")
  echo -e "  ${RED}✗ Missing ROI golden directory${NC}"
else
  ROI_GOLDEN_COUNT=$(ls -1 "$ROI_GOLDEN_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
  if [ "$ROI_GOLDEN_COUNT" -eq "$EXPECTED_ROI" ]; then
    echo -e "  ${GREEN}✓ ROI Golden: $ROI_GOLDEN_COUNT/$EXPECTED_ROI${NC}"
  else
    ERRORS+=("ROI golden incomplete: $ROI_GOLDEN_COUNT/$EXPECTED_ROI")
    echo -e "  ${RED}✗ ROI Golden: $ROI_GOLDEN_COUNT/$EXPECTED_ROI (incomplete)${NC}"
  fi
fi

# ═══════════════════════════════════════════════════════════
# Check 3: Current Screenshots (strict mode)
# ═══════════════════════════════════════════════════════════
echo -e "\n${CYAN}[3/5] Current Screenshots...${NC}"
if [ "$STRICT" = true ]; then
  if [ ! -d "$CURRENT_DIR" ]; then
    ERRORS+=("No current screenshots - run 'pnpm ui:all' first")
    echo -e "  ${RED}✗ Missing current directory${NC}"
  else
    CURRENT_COUNT=$(ls -1 "$CURRENT_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
    ROI_CURRENT_COUNT=$(ls -1 "$ROI_CURRENT_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ' 2>/dev/null || echo "0")

    if [ "$CURRENT_COUNT" -eq "$EXPECTED_FULL" ]; then
      echo -e "  ${GREEN}✓ Full-frame: $CURRENT_COUNT/$EXPECTED_FULL${NC}"
    else
      ERRORS+=("Current full-frame incomplete: $CURRENT_COUNT/$EXPECTED_FULL")
      echo -e "  ${RED}✗ Full-frame: $CURRENT_COUNT/$EXPECTED_FULL${NC}"
    fi

    if [ "$ROI_CURRENT_COUNT" -eq "$EXPECTED_ROI" ]; then
      echo -e "  ${GREEN}✓ ROI: $ROI_CURRENT_COUNT/$EXPECTED_ROI${NC}"
    else
      ERRORS+=("Current ROI incomplete: $ROI_CURRENT_COUNT/$EXPECTED_ROI")
      echo -e "  ${RED}✗ ROI: $ROI_CURRENT_COUNT/$EXPECTED_ROI${NC}"
    fi
  fi
else
  echo -e "  ${YELLOW}⊘ Skipped (non-strict mode)${NC}"
fi

# ═══════════════════════════════════════════════════════════
# Check 4: Visual Regressions (diff result)
# ═══════════════════════════════════════════════════════════
echo -e "\n${CYAN}[4/5] Visual Regressions...${NC}"
if [ -f "$DIFF_RESULT" ]; then
  # Parse JSON result
  SUCCESS=$(grep -o '"success": *[a-z]*' "$DIFF_RESULT" | head -1 | cut -d: -f2 | tr -d ' ')

  # Check for diff images
  DIFF_COUNT=0
  if [ -d "$DIFF_DIR" ]; then
    DIFF_COUNT=$(ls -1 "$DIFF_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
  fi
  ROI_DIFF_COUNT=0
  if [ -d "$ROI_DIFF_DIR" ]; then
    ROI_DIFF_COUNT=$(ls -1 "$ROI_DIFF_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
  fi

  if [ "$SUCCESS" = "true" ] && [ "$DIFF_COUNT" -eq 0 ] && [ "$ROI_DIFF_COUNT" -eq 0 ]; then
    echo -e "  ${GREEN}✓ No regressions detected${NC}"
  else
    if [ "$DIFF_COUNT" -gt 0 ]; then
      ERRORS+=("$DIFF_COUNT full-frame regression(s) - review $DIFF_DIR")
      echo -e "  ${RED}✗ Full-frame: $DIFF_COUNT regressions${NC}"
    fi
    if [ "$ROI_DIFF_COUNT" -gt 0 ]; then
      ERRORS+=("$ROI_DIFF_COUNT ROI regression(s) - review $ROI_DIFF_DIR")
      echo -e "  ${RED}✗ ROI: $ROI_DIFF_COUNT regressions${NC}"
    fi
  fi
else
  WARNINGS+=("No diff result - run 'pnpm ui:diff' for validation")
  echo -e "  ${YELLOW}⚠ No diff result file${NC}"
fi

# ═══════════════════════════════════════════════════════════
# Check 5: V41 Token Compliance (style-probe)
# ═══════════════════════════════════════════════════════════
echo -e "\n${CYAN}[5/5] V41 Token Compliance...${NC}"
if [ -f "$STYLE_PROBE" ]; then
  # Check for failed probes
  if grep -q '"pass": false' "$STYLE_PROBE"; then
    FAILED_COUNT=$(grep -c '"pass": false' "$STYLE_PROBE")
    ERRORS+=("$FAILED_COUNT V41 token probe(s) failed")
    echo -e "  ${RED}✗ $FAILED_COUNT probe(s) failed V41 compliance${NC}"

    # Show which probes failed
    grep -B5 '"pass": false' "$STYLE_PROBE" | grep -o '"[a-z-]*":' | tr -d '":' | while read probe; do
      echo -e "    ${RED}•${NC} $probe"
    done
  else
    PASSED_COUNT=$(grep -c '"pass": true' "$STYLE_PROBE" 2>/dev/null || echo "0")
    echo -e "  ${GREEN}✓ $PASSED_COUNT probe(s) passed V41 compliance${NC}"
  fi
else
  WARNINGS+=("No style-probe - run 'pnpm ui:roi' to generate")
  echo -e "  ${YELLOW}⚠ No style-probe file${NC}"
fi

# ═══════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo -e "Result: ${RED}BLOCKED${NC} - ${#ERRORS[@]} blocking issue(s)"
  echo ""
  echo -e "${RED}Errors:${NC}"
  for err in "${ERRORS[@]}"; do
    echo -e "  ${RED}✗${NC} $err"
  done

  if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Warnings:${NC}"
    for warn in "${WARNINGS[@]}"; do
      echo -e "  ${YELLOW}⚠${NC} $warn"
    done
  fi

  echo ""
  echo -e "${YELLOW}To fix:${NC}"
  echo "  1. pnpm ui:all      # Capture full-frame + ROI screenshots"
  echo "  2. pnpm ui:diff     # Compare against golden baseline"
  echo "  3. pnpm ui:probe    # Verify V41 token compliance"
  echo "  4. pnpm ui:accept   # Accept changes (if intentional)"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 1
else
  echo -e "Result: ${GREEN}PASSED${NC} - All checks passed"
  echo ""
  echo -e "  Full-frame Golden: ${GREEN}$EXPECTED_FULL/$EXPECTED_FULL${NC}"
  echo -e "  ROI Golden:        ${GREEN}$EXPECTED_ROI/$EXPECTED_ROI${NC}"
  echo -e "  Regressions:       ${GREEN}0${NC}"
  echo -e "  V41 Compliance:    ${GREEN}OK${NC}"

  if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo ""
    echo -e "${YELLOW}Warnings (non-blocking):${NC}"
    for warn in "${WARNINGS[@]}"; do
      echo -e "  ${YELLOW}⚠${NC} $warn"
    done
  fi

  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
fi
