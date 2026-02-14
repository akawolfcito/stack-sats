/**
 * Density Mode Diagnostics Script
 *
 * Run in browser console to verify density mode is working globally.
 *
 * Usage:
 *   1. Open the wallet extension popup or sidepanel
 *   2. Open DevTools (F12)
 *   3. Paste this entire script in the Console
 *   4. Call the functions to test density modes
 */

(function() {
  'use strict';

  const DENSITY_KEY = 'density_mode';

  // Density token definitions (expected values)
  const DENSITY_VALUES = {
    comfortable: {
      '--header-h': '56px',
      '--row-h': '52px',
      '--control-h': '52px',
      '--icon-btn-size': '40px',
      '--section-gap': '24px',
    },
    compact: {
      '--header-h': '44px',
      '--row-h': '44px',
      '--control-h': '44px',
      '--icon-btn-size': '32px',
      '--section-gap': '16px',
    }
  };

  // Get current density mode
  function getCurrentDensity() {
    const stored = localStorage.getItem(DENSITY_KEY);
    const dataAttr = document.documentElement.dataset.density;
    return {
      stored: stored || 'auto',
      applied: dataAttr || 'auto (media-query)',
      isExplicit: !!dataAttr
    };
  }

  // Get computed CSS variable values
  function getComputedTokens() {
    const style = getComputedStyle(document.documentElement);
    return {
      '--header-h': style.getPropertyValue('--header-h').trim(),
      '--row-h': style.getPropertyValue('--row-h').trim(),
      '--control-h': style.getPropertyValue('--control-h').trim(),
      '--icon-btn-size': style.getPropertyValue('--icon-btn-size').trim(),
      '--section-gap': style.getPropertyValue('--section-gap').trim(),
      '--card-pad': style.getPropertyValue('--card-pad').trim(),
      '--card-pad-x': style.getPropertyValue('--card-pad-x').trim(),
      '--card-pad-y': style.getPropertyValue('--card-pad-y').trim(),
    };
  }

  // Set density mode
  function setDensity(mode) {
    if (!['auto', 'compact', 'comfortable'].includes(mode)) {
      console.error('Invalid mode. Use: auto, compact, or comfortable');
      return;
    }

    localStorage.setItem(DENSITY_KEY, mode);

    if (mode === 'auto') {
      delete document.documentElement.dataset.density;
    } else {
      document.documentElement.dataset.density = mode;
    }

    console.log(`✅ Density set to: ${mode}`);
    printStatus();
  }

  // Measure element heights
  function measureElements() {
    const selectors = {
      'AppHeader (.app-header)': '.app-header',
      'ListRow (.list-row)': '.list-row',
      'TokenRow (.token-row)': '.token-row',
      'AssetRow (.asset-row)': '.asset-row',
      'HeaderBtn (.header-btn)': '.header-btn',
      'ActionBtn (.action-btn)': '.action-btn',
      'ContinueBtn (.continue-btn)': '.continue-btn',
      'FormInput (.form-input)': '.form-input',
      'RefreshBtn (.refresh-btn)': '.refresh-btn',
      'TokenIcon (.token-icon)': '.token-icon',
      'FAB (.fab)': '.fab',
    };

    const measurements = {};

    Object.entries(selectors).forEach(([name, selector]) => {
      const el = document.querySelector(selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        measurements[name] = {
          height: Math.round(rect.height) + 'px',
          width: Math.round(rect.width) + 'px',
        };
      } else {
        measurements[name] = 'Not found';
      }
    });

    return measurements;
  }

  // Print full status
  function printStatus() {
    console.log('\n═══════════════════════════════════════');
    console.log('    DENSITY MODE DIAGNOSTICS');
    console.log('═══════════════════════════════════════\n');

    const density = getCurrentDensity();
    console.log('📊 Current Density Mode:');
    console.table(density);

    console.log('\n📐 CSS Token Values:');
    console.table(getComputedTokens());

    console.log('\n📏 Element Measurements:');
    console.table(measureElements());

    console.log('\n═══════════════════════════════════════\n');
  }

  // Compare compact vs comfortable
  function compareMode() {
    console.log('\n🔄 Comparing Compact vs Comfortable...\n');

    // Store original
    const original = getCurrentDensity().stored;

    // Measure compact
    setDensity('compact');
    const compactTokens = getComputedTokens();
    const compactElements = measureElements();

    // Measure comfortable
    setDensity('comfortable');
    const comfortableTokens = getComputedTokens();
    const comfortableElements = measureElements();

    // Restore original
    setDensity(original);

    // Compare tokens
    console.log('📐 Token Comparison:');
    const tokenComparison = {};
    Object.keys(compactTokens).forEach(key => {
      tokenComparison[key] = {
        compact: compactTokens[key],
        comfortable: comfortableTokens[key],
        differs: compactTokens[key] !== comfortableTokens[key] ? '✅' : '❌ SAME'
      };
    });
    console.table(tokenComparison);

    // Compare elements
    console.log('\n📏 Element Comparison:');
    const elementComparison = {};
    Object.keys(compactElements).forEach(key => {
      const compact = compactElements[key];
      const comfy = comfortableElements[key];

      if (typeof compact === 'string' || typeof comfy === 'string') {
        elementComparison[key] = { compact, comfortable: comfy, differs: 'N/A' };
      } else {
        const heightDiff = compact.height !== comfy.height;
        elementComparison[key] = {
          compact: compact.height,
          comfortable: comfy.height,
          differs: heightDiff ? '✅' : '❌ HARDCODED?'
        };
      }
    });
    console.table(elementComparison);

    // Summary
    const hardcodedCount = Object.values(elementComparison)
      .filter(v => v.differs === '❌ HARDCODED?').length;

    if (hardcodedCount > 0) {
      console.warn(`⚠️ ${hardcodedCount} element(s) may have hardcoded dimensions!`);
    } else {
      console.log('✅ All visible elements respond to density changes!');
    }
  }

  // Expose functions globally
  window.densityDiag = {
    status: printStatus,
    set: setDensity,
    compare: compareMode,
    tokens: getComputedTokens,
    measure: measureElements,
    help: function() {
      console.log(`
╔══════════════════════════════════════════════════════════╗
║  DENSITY DIAGNOSTICS - Available Commands                ║
╠══════════════════════════════════════════════════════════╣
║  densityDiag.status()     - Print current density status ║
║  densityDiag.set('mode')  - Set mode (auto/compact/comfy)║
║  densityDiag.compare()    - Compare compact vs comfortable║
║  densityDiag.tokens()     - Get current CSS token values ║
║  densityDiag.measure()    - Measure visible elements     ║
║  densityDiag.help()       - Show this help               ║
╚══════════════════════════════════════════════════════════╝
      `);
    }
  };

  console.log('✅ Density Diagnostics loaded! Run densityDiag.help() for commands.');
  printStatus();
})();
