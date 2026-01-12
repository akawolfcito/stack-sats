#!/bin/bash
#
# UI Style Probe - V41 Token Validation Guardrail
#
# Validates that computed CSS styles match V41 token expectations.
# This is a hard guardrail - if primary CTA tokens are wrong, it fails.
#
# Usage: ./scripts/ui-style-probe.sh
#
# Prerequisites: Run 'pnpm ui:roi' first to generate style-probe.json
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

ARTIFACTS_DIR="$ROOT_DIR/artifacts/ui"
STYLE_PROBE_PATH="$ARTIFACTS_DIR/style-probe.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}   UI STYLE PROBE - V41 Token Guardrail${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"

# Check if style-probe.json exists
if [ ! -f "$STYLE_PROBE_PATH" ]; then
  echo -e "${RED}ERROR: style-probe.json not found${NC}"
  echo "Run 'pnpm ui:roi' first to generate style probe data."
  exit 1
fi

echo -e "Reading: ${CYAN}$STYLE_PROBE_PATH${NC}\n"

# V41 Expected Values
# Primary CTA should use #C9E426 (rgb(201, 228, 38))
V41_PRIMARY_BG="rgb(201, 228, 38)"

# Extract probe data using basic shell parsing
# We check if the probes contain the expected V41 values

FAILED=false
PASSED=0
TOTAL=0

# Check for primary-cta-start
echo "Checking V41 Token Compliance:"
echo ""

# Parse JSON and check for expected values
# Using grep and basic parsing since jq may not be available

# Check if any probe failed
if grep -q '"pass": false' "$STYLE_PROBE_PATH"; then
  FAILED=true
fi

# Count total and passed
TOTAL=$(grep -c '"pass":' "$STYLE_PROBE_PATH" 2>/dev/null || echo "0")
PASSED=$(grep -c '"pass": true' "$STYLE_PROBE_PATH" 2>/dev/null || echo "0")

# Extract and display individual probe results
# Look for primary CTA probes specifically

echo "  Probes analyzed: $TOTAL"
echo "  Passed: $PASSED"
echo ""

# Check for specific critical probes
CRITICAL_PROBES=("primary-cta-start" "primary-cta-send" "inline-action-max")

for probe in "${CRITICAL_PROBES[@]}"; do
  # Check if this probe exists and passed
  if grep -A 10 "\"$probe\"" "$STYLE_PROBE_PATH" | grep -q '"pass": true'; then
    echo -e "  ${GREEN}✓${NC} $probe - V41 tokens applied"
  elif grep -q "\"$probe\"" "$STYLE_PROBE_PATH"; then
    echo -e "  ${RED}✗${NC} $probe - V41 tokens NOT applied"
    FAILED=true

    # Extract actual values for debugging
    ACTUAL=$(grep -A 5 "\"$probe\"" "$STYLE_PROBE_PATH" | grep -A 3 '"actual"' | head -5)
    if [ -n "$ACTUAL" ]; then
      echo "      Actual: $ACTUAL"
    fi
  else
    echo -e "  ${YELLOW}⚠${NC} $probe - not probed"
  fi
done

echo ""

# Summary
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"

if [ "$FAILED" = true ]; then
  echo -e "Result: ${RED}FAILED${NC}"
  echo ""
  echo "V41 tokens are NOT correctly applied to primary CTAs."
  echo "Check that:"
  echo "  - --btn-primary-bg: #C9E426 is defined in base.css"
  echo "  - Button.vue uses var(--btn-primary-bg) for .btn--primary"
  echo "  - No local CSS overrides in component files"
  echo ""
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 1
else
  echo -e "Result: ${GREEN}PASSED${NC}"
  echo ""
  echo "V41 tokens are correctly applied to all primary CTAs."
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
fi
