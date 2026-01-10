import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Density mode bootstrap
const DENSITY_KEY = 'density_mode';
type DensityMode = 'auto' | 'compact' | 'comfortable';

function applyDensityMode(mode: DensityMode): void {
  if (mode === 'auto') {
    // Remove explicit density, let media query handle it
    delete document.documentElement.dataset.density;
  } else {
    document.documentElement.dataset.density = mode;
  }
}

// Load and apply density mode from localStorage
const savedDensity = localStorage.getItem(DENSITY_KEY) as DensityMode | null;
const densityMode: DensityMode = savedDensity && ['auto', 'compact', 'comfortable'].includes(savedDensity)
  ? savedDensity
  : 'auto';
applyDensityMode(densityMode);

// Export for use in settings
export { DENSITY_KEY, applyDensityMode };
export type { DensityMode };

const app = createApp(App)

app.use(router)

app.mount('#app')
