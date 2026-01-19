import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { DensityService } from './services/density'

// V79: DEV-only layout debug (exposes window.__debugLayout)
if (import.meta.env.DEV) {
  import('./utils/dev/layoutDebug')
}

// Initialize density service (rehydrates + registers cross-document listeners)
// Note: init() is async but we don't await - density applies immediately from storage
DensityService.init()

const app = createApp(App)

app.use(router)

app.mount('#app')

// Re-export for backwards compatibility with existing imports
export { DensityService }
export type { DensityMode } from './services/density'
