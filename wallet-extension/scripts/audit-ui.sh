#!/bin/bash

# UI Audit Script - Finds violations of UI_CONTRACT.md
# Run from wallet-extension directory: bash scripts/audit-ui.sh

echo "═══════════════════════════════════════════════════════════════════════"
echo "   UI AUDIT - Checking for hardcoded values and component violations"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

SRC_DIR="src"
ISSUES_FOUND=0

# ============================================================================
# 1. Hardcoded Pixel Heights (should use --control-h, --row-h, etc.)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Hardcoded Pixel Heights"
echo "   Recommended: Use --control-h, --row-h, --header-h, --icon-btn-size"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Look for height: NNpx patterns (excluding comments, var(), calc())
HEIGHT_ISSUES=$(grep -rn "height:\s*[0-9]\+px" "$SRC_DIR" --include="*.vue" --include="*.css" | grep -v "var(" | grep -v "calc(" | grep -v "/\*" || true)

if [ -n "$HEIGHT_ISSUES" ]; then
    echo "$HEIGHT_ISSUES" | head -20
    COUNT=$(echo "$HEIGHT_ISSUES" | wc -l | tr -d ' ')
    echo ""
    echo "⚠️  Found $COUNT hardcoded height values"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT))
else
    echo "✅ No hardcoded height values found"
fi
echo ""

# ============================================================================
# 2. Hardcoded Width Values (may be acceptable for icons)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2. Hardcoded Width Values (review needed - some may be acceptable)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

WIDTH_ISSUES=$(grep -rn "width:\s*[0-9]\+px" "$SRC_DIR" --include="*.vue" --include="*.css" | grep -v "var(" | grep -v "calc(" | grep -v "/\*" | grep -v "max-width" | grep -v "min-width" || true)

if [ -n "$WIDTH_ISSUES" ]; then
    echo "$WIDTH_ISSUES" | head -15
    COUNT=$(echo "$WIDTH_ISSUES" | wc -l | tr -d ' ')
    echo ""
    echo "ℹ️  Found $COUNT hardcoded width values (review needed)"
else
    echo "✅ No suspicious width values found"
fi
echo ""

# ============================================================================
# 3. Hardcoded Accent Colors (should use --color-accent-primary)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3. Hardcoded Accent Colors"
echo "   Recommended: Use --color-accent-primary, --color-accent-primary-muted"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Primary accent: #D7F82E
ACCENT_ISSUES=$(grep -rn "#[Dd]7[Ff]82[Ee]" "$SRC_DIR" --include="*.vue" --include="*.css" | grep -v "base.css" | grep -v "/\*" || true)

if [ -n "$ACCENT_ISSUES" ]; then
    echo "$ACCENT_ISSUES" | head -20
    COUNT=$(echo "$ACCENT_ISSUES" | wc -l | tr -d ' ')
    echo ""
    echo "⚠️  Found $COUNT hardcoded accent colors"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT))
else
    echo "✅ No hardcoded accent colors found outside base.css"
fi
echo ""

# ============================================================================
# 4. Hardcoded Background Colors (should use --color-bg-*)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4. Hardcoded Dark Background Colors"
echo "   Recommended: Use --color-bg-primary, --color-bg-card"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Look for common dark backgrounds: #0a0a0a, #1d1d1c, #141413, #01070e
BG_ISSUES=$(grep -rn "#0[Aa]0[Aa]0[Aa]\|#1[Dd]1[Dd]1[Cc]\|#141413\|#01070[Ee]" "$SRC_DIR" --include="*.vue" --include="*.css" | grep -v "base.css" | grep -v "/\*" || true)

if [ -n "$BG_ISSUES" ]; then
    echo "$BG_ISSUES" | head -15
    COUNT=$(echo "$BG_ISSUES" | wc -l | tr -d ' ')
    echo ""
    echo "ℹ️  Found $COUNT hardcoded background colors (some may be intentional)"
else
    echo "✅ No hardcoded background colors found outside base.css"
fi
echo ""

# ============================================================================
# 5. Raw Button Elements with Custom Classes
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5. Raw Button Elements (should use <Button> component)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Look for <button class=" patterns
RAW_BTN=$(grep -rn '<button class="' "$SRC_DIR" --include="*.vue" || true)

if [ -n "$RAW_BTN" ]; then
    echo "$RAW_BTN" | head -20
    COUNT=$(echo "$RAW_BTN" | wc -l | tr -d ' ')
    echo ""
    echo "⚠️  Found $COUNT raw button elements with custom classes"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT))
else
    echo "✅ No raw buttons with custom classes found"
fi
echo ""

# ============================================================================
# 6. Raw Input Elements with Custom Classes
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6. Raw Input Elements (should use <TextField> component)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Look for <input type="text" class=" patterns
RAW_INPUT=$(grep -rn '<input.*class="' "$SRC_DIR" --include="*.vue" | grep -v "type=\"checkbox\"" | grep -v "type=\"radio\"" || true)

if [ -n "$RAW_INPUT" ]; then
    echo "$RAW_INPUT" | head -15
    COUNT=$(echo "$RAW_INPUT" | wc -l | tr -d ' ')
    echo ""
    echo "⚠️  Found $COUNT raw input elements (review needed)"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT))
else
    echo "✅ No raw text inputs found"
fi
echo ""

# ============================================================================
# 7. Hardcoded Padding Values
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7. Hardcoded Padding Values (review for density awareness)"
echo "   Recommended: Use --space-*, --control-pad-x, --card-pad"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Look for padding: NNpx patterns
PAD_ISSUES=$(grep -rn "padding:\s*[0-9]\+px" "$SRC_DIR" --include="*.vue" --include="*.css" | grep -v "var(" | grep -v "/\*" | head -10 || true)

if [ -n "$PAD_ISSUES" ]; then
    echo "$PAD_ISSUES"
    echo ""
    echo "ℹ️  Some hardcoded padding found (may be acceptable)"
else
    echo "✅ No suspicious padding values found"
fi
echo ""

# ============================================================================
# 8. font-size Hardcoded Values
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8. Hardcoded Font Sizes"
echo "   Recommended: Use --font-size-* tokens"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FONT_ISSUES=$(grep -rn "font-size:\s*[0-9]\+px" "$SRC_DIR" --include="*.vue" --include="*.css" | grep -v "var(" | grep -v "/\*" | head -15 || true)

if [ -n "$FONT_ISSUES" ]; then
    echo "$FONT_ISSUES"
    echo ""
    echo "ℹ️  Some hardcoded font sizes found (review needed)"
else
    echo "✅ No hardcoded font sizes found"
fi
echo ""

# ============================================================================
# 9. Forbidden Pill Radius (only allowed in SegmentedTabs, chips, badges)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "9. Forbidden Pill Radius (9999px outside whitelisted components)"
echo "   Allowed: SegmentedTabs, chips, badges. Forbidden: CTAs, cards, inputs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Look for 9999px or --radius-pill usage outside allowed components
PILL_ISSUES=$(grep -rn "9999px\|--radius-pill" "$SRC_DIR" --include="*.vue" --include="*.css" | grep -v "base.css" | grep -v "SegmentedTabs" | grep -v "Chip" | grep -v "Badge" | grep -v "\.btn--pill" || true)

if [ -n "$PILL_ISSUES" ]; then
    echo "$PILL_ISSUES" | head -15
    COUNT=$(echo "$PILL_ISSUES" | wc -l | tr -d ' ')
    echo ""
    echo "⚠️  Found $COUNT uses of pill radius (review if appropriate)"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT))
else
    echo "✅ No forbidden pill radius usage found"
fi
echo ""

# ============================================================================
# 10. Hardcoded Box Shadows (should use --shadow-elev-* tokens)
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "10. Hardcoded Box Shadows (should use --shadow-elev-* tokens)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Look for box-shadow: followed by values (not var())
SHADOW_ISSUES=$(grep -rn "box-shadow:" "$SRC_DIR/views" --include="*.vue" | grep -v "var(--shadow" | grep -v "none" | grep -v "/\*" || true)

if [ -n "$SHADOW_ISSUES" ]; then
    echo "$SHADOW_ISSUES" | head -15
    COUNT=$(echo "$SHADOW_ISSUES" | wc -l | tr -d ' ')
    echo ""
    echo "⚠️  Found $COUNT hardcoded shadows in views"
    ISSUES_FOUND=$((ISSUES_FOUND + COUNT))
else
    echo "✅ No hardcoded shadows in views"
fi
echo ""

# ============================================================================
# Summary
# ============================================================================
echo "═══════════════════════════════════════════════════════════════════════"
if [ $ISSUES_FOUND -eq 0 ]; then
    echo "   ✅ AUDIT PASSED - No critical issues found"
else
    echo "   ⚠️  AUDIT COMPLETE - Found $ISSUES_FOUND potential issues"
    echo "   Review UI_CONTRACT.md for migration guidelines"
fi
echo "═══════════════════════════════════════════════════════════════════════"
