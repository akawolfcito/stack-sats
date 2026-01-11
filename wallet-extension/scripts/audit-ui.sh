#!/bin/bash
# audit-ui.sh - UI Guardrails for modal/view consistency
# Rule: All modals/overlays must use primitives (Sheet, ModalScaffold)

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

cd "$(dirname "$0")/.."

echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}   UI GUARDRAILS AUDIT${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"

# Primitives and special UI patterns allowlist
ALLOWLIST=(
  # UI Primitives
  "src/components/ui/Sheet.vue"
  "src/components/ui/ModalScaffold.vue"
  "src/components/ui/Button.vue"
  "src/styles/tokens.css"
  "src/styles/base.css"
  # Layout components
  "src/components/layout/"
  "src/components/BottomNav.vue"
  "src/components/BackupSuccessModal.vue"
  # Dropdowns (not full modals)
  "src/components/account/AccountSwitcher.vue"
  "src/components/network/NetworkChip.vue"
  # Sticky footers
  "src/views/SendView.vue"
  "src/views/SendTokenView.vue"
)

echo -e "${CYAN}[1/3] Checking for custom Teleport modals...${NC}"

TELEPORT_VIOLATIONS=()
while IFS= read -r line; do
  [ -z "$line" ] && continue
  file=$(echo "$line" | cut -d: -f1)
  is_allowed=false
  for allowed in "${ALLOWLIST[@]}"; do
    if [[ "$file" == *"$allowed"* ]]; then
      is_allowed=true
      break
    fi
  done
  if [ "$is_allowed" = false ]; then
    TELEPORT_VIOLATIONS+=("$line")
  fi
done < <(grep -rn 'Teleport to="body"' src/ --include="*.vue" 2>/dev/null || true)

if [ ${#TELEPORT_VIOLATIONS[@]} -gt 0 ]; then
  echo -e "  ${RED}Found ${#TELEPORT_VIOLATIONS[@]} custom Teleport modals:${NC}"
  for v in "${TELEPORT_VIOLATIONS[@]}"; do
    echo -e "    ${RED}•${NC} $v"
  done
else
  echo -e "  ${GREEN}✓ All modals use primitives${NC}"
fi

echo -e "\n${CYAN}[2/3] Checking for hardcoded modal patterns...${NC}"

MODAL_VIOLATIONS=()
while IFS= read -r line; do
  [ -z "$line" ] && continue
  file=$(echo "$line" | cut -d: -f1)
  is_allowed=false
  for allowed in "${ALLOWLIST[@]}"; do
    if [[ "$file" == *"$allowed"* ]]; then
      is_allowed=true
      break
    fi
  done
  if [ "$is_allowed" = false ]; then
    MODAL_VIOLATIONS+=("$line")
  fi
done < <(grep -rn --extended-regexp 'position:\s*fixed.*inset:\s*0|\.modal-overlay|\.dialog-overlay' src/views/ src/components/ --include="*.vue" 2>/dev/null | grep -v "^Binary" || true)

if [ ${#MODAL_VIOLATIONS[@]} -gt 0 ]; then
  echo -e "  ${RED}Found ${#MODAL_VIOLATIONS[@]} custom modal patterns:${NC}"
  for v in "${MODAL_VIOLATIONS[@]}"; do
    echo -e "    ${RED}•${NC} $v"
  done
else
  echo -e "  ${GREEN}✓ No custom modal overlays${NC}"
fi

echo -e "\n${CYAN}[3/3] Counting primitive usage...${NC}"

SHEET_COUNT=$(grep -r '<Sheet' src/ --include="*.vue" 2>/dev/null | wc -l | tr -d ' ')
MODAL_SCAFFOLD_COUNT=$(grep -r '<ModalScaffold' src/ --include="*.vue" 2>/dev/null | wc -l | tr -d ' ')
TOTAL_PRIMITIVES=$((SHEET_COUNT + MODAL_SCAFFOLD_COUNT))

echo -e "  Sheet usage: ${CYAN}$SHEET_COUNT${NC}"
echo -e "  ModalScaffold usage: ${CYAN}$MODAL_SCAFFOLD_COUNT${NC}"
echo -e "  Total primitive modals: ${GREEN}$TOTAL_PRIMITIVES${NC}"

echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"

TOTAL_VIOLATIONS=$((${#TELEPORT_VIOLATIONS[@]} + ${#MODAL_VIOLATIONS[@]}))

if [ $TOTAL_VIOLATIONS -gt 0 ]; then
  echo -e "Result: ${RED}FAILED${NC} - $TOTAL_VIOLATIONS violations found"
  echo -e "${YELLOW}Fix:${NC} Migrate custom modals to Sheet or ModalScaffold"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 1
else
  echo -e "Result: ${GREEN}PASSED${NC}"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
fi
