import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Density mode bootstrap
// Accepted values: 'auto' | 'compact' | 'comfy'
const DENSITY_KEY = 'density_mode';
type DensityMode = 'auto' | 'compact' | 'comfy';

function applyDensityMode(mode: DensityMode): void {
  if (mode === 'auto') {
    // Set explicit auto attribute so CSS can target it
    document.documentElement.dataset.density = 'auto';
  } else {
    document.documentElement.dataset.density = mode;
  }
}

// Migrate old 'comfortable' value to 'comfy'
function migrateDensityValue(value: string | null): DensityMode {
  if (value === 'comfortable') return 'comfy';
  if (value && ['auto', 'compact', 'comfy'].includes(value)) {
    return value as DensityMode;
  }
  return 'auto';
}

// Load and apply density mode from localStorage
const savedDensity = localStorage.getItem(DENSITY_KEY);
const densityMode: DensityMode = migrateDensityValue(savedDensity);
applyDensityMode(densityMode);

// Export for use in settings
export { DENSITY_KEY, applyDensityMode };
export type { DensityMode };

const app = createApp(App)

app.use(router)

app.mount('#app')
