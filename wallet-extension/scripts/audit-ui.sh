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
  # V40 Modals (uses Sheet primitive)
  "src/components/ImportMnemonicModal.vue"
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

echo -e "\n${CYAN}[3/4] Checking for deprecated neumorphic usage...${NC}"

# Neumorphic is deprecated - only allowed in SendView.vue (legacy)
NEUMORPHIC_ALLOWLIST=(
  "src/views/SendView.vue"
)

NEUMORPHIC_VIOLATIONS=()
while IFS= read -r line; do
  [ -z "$line" ] && continue
  file=$(echo "$line" | cut -d: -f1)
  is_allowed=false
  for allowed in "${NEUMORPHIC_ALLOWLIST[@]}"; do
    if [[ "$file" == *"$allowed"* ]]; then
      is_allowed=true
      break
    fi
  done
  if [ "$is_allowed" = false ]; then
    NEUMORPHIC_VIOLATIONS+=("$line")
  fi
done < <(grep -rn 'variant="neumorphic"' src/ --include="*.vue" 2>/dev/null || true)

if [ ${#NEUMORPHIC_VIOLATIONS[@]} -gt 0 ]; then
  echo -e "  ${RED}Found ${#NEUMORPHIC_VIOLATIONS[@]} new neumorphic usage (deprecated):${NC}"
  for v in "${NEUMORPHIC_VIOLATIONS[@]}"; do
    echo -e "    ${RED}•${NC} $v"
  done
  echo -e "  ${YELLOW}Fix:${NC} Use variant=\"default\" instead"
else
  echo -e "  ${GREEN}✓ No new neumorphic usage${NC}"
fi

echo -e "\n${CYAN}[4/5] Checking for hardcoded rgba() in components (V36 Contract)...${NC}"

# V36: Hardcoded rgba() allowlist - per UI_CONTRACT_V1.md Section 8.2
# Strategy: Allow established files, block new files from introducing hardcodes
HARDCODE_ALLOWLIST=(
  # === Token definitions (always allowed) ===
  "src/assets/base.css"
  "src/styles/tokens.css"
  "src/styles/base.css"

  # === UI Primitives (design system components) ===
  "src/components/ui/"                    # All UI primitives
  "src/components/layout/"                # Layout components

  # === Established components (pre-V36 legacy) ===
  "src/components/list/"                  # ListGroup, ListRow
  "src/components/send/"                  # ConfirmSendModal
  "src/components/tokens/"                # TokenRow
  "src/components/BottomNav.vue"
  "src/components/BackupSuccessModal.vue"
  "src/components/network/"
  "src/components/account/"
  "src/components/activity/"
  "src/components/forms/"
  "src/components/transaction/"
  "src/components/SegmentedTabs.vue"
  "src/components/ReceiveModal.vue"
  "src/components/Confirmation.vue"
  "src/components/BalanceHeader.vue"
  "src/components/AssetRow.vue"
  "src/components/PinInput.vue"
  # V40 modals
  "src/components/ImportMnemonicModal.vue"

  # === Established views (pre-V36 legacy) ===
  "src/views/UserHomeView.vue"
  "src/views/SendView.vue"
  "src/views/SendTokenView.vue"
  "src/views/UnlockView.vue"
  "src/views/UserMenu.vue"
  "src/views/SwapView.vue"
  "src/views/AccountDetailsView.vue"
  "src/views/StartView.vue"
  "src/views/ManageTokensView.vue"
  "src/views/ImportWalletView.vue"
  "src/views/SetupView.vue"
  "src/views/RestoreWalletView.vue"
  "src/views/CreatePasswordView.vue"
  "src/views/ConfirmMnemonicView.vue"
  "src/views/AddTokenView.vue"
  # V48: VerifyPinView reuses UnlockView scaffold
  "src/views/VerifyPinView.vue"
  # V51: ConfirmTxView fullscreen confirm
  "src/views/ConfirmTxView.vue"
  # V52: TxResultView tx result display
  "src/views/TxResultView.vue"
  # V53: Entry flow views with V43 card patterns
  "src/views/AddWalletView.vue"
)

HARDCODE_VIOLATIONS=()
while IFS= read -r line; do
  [ -z "$line" ] && continue
  file=$(echo "$line" | cut -d: -f1)
  is_allowed=false
  for allowed in "${HARDCODE_ALLOWLIST[@]}"; do
    if [[ "$file" == *"$allowed"* ]]; then
      is_allowed=true
      break
    fi
  done
  if [ "$is_allowed" = false ]; then
    HARDCODE_VIOLATIONS+=("$line")
  fi
done < <(grep -rn 'rgba([0-9]' src/components/ src/views/ --include="*.vue" 2>/dev/null | grep -v "^Binary" | grep "<style" -A 1000 2>/dev/null || grep -rn 'rgba([0-9]' src/components/ src/views/ --include="*.vue" 2>/dev/null | grep -v "^Binary" || true)

if [ ${#HARDCODE_VIOLATIONS[@]} -gt 0 ]; then
  echo -e "  ${RED}Found ${#HARDCODE_VIOLATIONS[@]} hardcoded rgba() outside allowlist:${NC}"
  for v in "${HARDCODE_VIOLATIONS[@]}"; do
    echo -e "    ${RED}•${NC} $v"
  done
  echo -e "  ${YELLOW}Fix:${NC} Use tokens from base.css or add to UI_CONTRACT allowlist"
else
  echo -e "  ${GREEN}✓ All rgba() values in allowlist or tokens${NC}"
fi

echo -e "\n${CYAN}[5/5] Counting primitive usage...${NC}"

SHEET_COUNT=$(grep -r '<Sheet' src/ --include="*.vue" 2>/dev/null | wc -l | tr -d ' ')
MODAL_SCAFFOLD_COUNT=$(grep -r '<ModalScaffold' src/ --include="*.vue" 2>/dev/null | wc -l | tr -d ' ')
TOTAL_PRIMITIVES=$((SHEET_COUNT + MODAL_SCAFFOLD_COUNT))

echo -e "  Sheet usage: ${CYAN}$SHEET_COUNT${NC}"
echo -e "  ModalScaffold usage: ${CYAN}$MODAL_SCAFFOLD_COUNT${NC}"
echo -e "  Total primitive modals: ${GREEN}$TOTAL_PRIMITIVES${NC}"

echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"

TOTAL_VIOLATIONS=$((${#TELEPORT_VIOLATIONS[@]} + ${#MODAL_VIOLATIONS[@]} + ${#NEUMORPHIC_VIOLATIONS[@]} + ${#HARDCODE_VIOLATIONS[@]}))

if [ $TOTAL_VIOLATIONS -gt 0 ]; then
  echo -e "Result: ${RED}FAILED${NC} - $TOTAL_VIOLATIONS violations found"
  echo -e "${YELLOW}Fixes:${NC}"
  echo "  - Migrate custom modals to Sheet or ModalScaffold"
  echo "  - Replace hardcoded rgba() with tokens from base.css"
  echo "  - See docs/ui/UI_CONTRACT_V1.md for allowlist process"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 1
else
  echo -e "Result: ${GREEN}PASSED${NC} - UI Contract v1 compliant"
  echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}\n"
  exit 0
fi
