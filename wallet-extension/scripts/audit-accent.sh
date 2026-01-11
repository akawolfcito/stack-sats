#!/bin/bash
# audit-accent.sh - Guardrails for lime accent usage
# Rule: "Acento lime = signature exclusivo del Primary CTA"

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Lime accent pattern (the "gamer glow")
LIME_PATTERN="rgba\(232,\s*248,\s*89"

# Allowlist: files where lime is intentional (Primary CTAs, active indicators)
ALLOWLIST=(
  "src/components/BottomNav.vue"      # QR button - Primary CTA
  "src/components/ui/Button.vue"       # Primary button variant
  "src/components/SegmentedTabs.vue"   # Active tab indicator
  "src/styles/tokens.css"              # Token definitions
)

echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}   ACCENT AUDIT - Lime Guardrails${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"

# Find all files with lime pattern
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

VIOLATIONS=()
ALLOWED=()

while IFS= read -r line; do
  [ -z "$line" ] && continue
  file=$(echo "$line" | cut -d: -f1)

  # Check if file is in allowlist
  is_allowed=false
  for allowed in "${ALLOWLIST[@]}"; do
    if [[ "$file" == *"$allowed"* ]]; then
      is_allowed=true
      ALLOWED+=("$line")
      break
    fi
  done

  if [ "$is_allowed" = false ]; then
    VIOLATIONS+=("$line")
  fi
done < <(grep -rn --extended-regexp "$LIME_PATTERN" src/ --include="*.vue" --include="*.css" --include="*.ts" 2>/dev/null || true)

# Report allowed usages
if [ ${#ALLOWED[@]} -gt 0 ]; then
  echo -e "${GREEN}✅ ALLOWED (${#ALLOWED[@]} in allowlist)${NC}"
  echo "──────────────────────────────────────────"
  for item in "${ALLOWED[@]}"; do
    echo "  • $item" | head -c 100
    echo ""
  done
  echo ""
fi

# Report violations
if [ ${#VIOLATIONS[@]} -gt 0 ]; then
  echo -e "${RED}🔴 VIOLATIONS (${#VIOLATIONS[@]} found)${NC}"
  echo "──────────────────────────────────────────"
  for item in "${VIOLATIONS[@]}"; do
    echo -e "  ${RED}•${NC} $item"
  done
  echo ""
  echo -e "${YELLOW}Rule: Lime accent is reserved for Primary CTAs only.${NC}"
  echo -e "${YELLOW}Options:${NC}"
  echo "  1. Replace with neutral: rgba(255, 255, 255, ...)"
  echo "  2. Use token: var(--shadow-elev-*), var(--color-text-*)"
  echo "  3. Add to allowlist if this is a Primary CTA"
  echo ""
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
  echo -e "Result: ${RED}FAILED${NC} - Fix violations before commit"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 1
else
  echo -e "${GREEN}✅ NO VIOLATIONS${NC}"
  echo "──────────────────────────────────────────"
  echo "  All lime usage is in allowlisted Primary CTA files."
  echo ""
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
  echo -e "Result: ${GREEN}PASSED${NC}"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
fi
