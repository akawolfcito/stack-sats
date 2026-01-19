import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

// To allow more languages other than `ts` in `.vue` files, uncomment the following lines:
// import { configureVueProject } from '@vue/eslint-config-typescript'
// configureVueProject({ scriptLangs: ['ts', 'tsx'] })
// More info at https://github.com/vuejs/eslint-config-typescript/#advanced-setup

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{ts,mts,tsx,vue}'],
  },

  {
    name: 'app/files-to-ignore',
    ignores: [
      '**/dist/**',
      '**/dist-ssr/**',
      '**/coverage/**',
      'bitcoinjs-lib.js',
      'public/**/*.js',     // Extension runtime scripts
      'e2e/**/*.ts',        // E2E test files
      'scripts/**/*.js',    // Build scripts
      '**/*.test.ts',       // Unit test files
      '**/*.spec.ts',       // Spec test files
    ],
  },

  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  // V1.0.2: Allow single-word component names for UI primitives
  {
    name: 'app/vue-rules',
    rules: {
      'vue/multi-word-component-names': ['error', {
        ignores: ['Badge', 'Button', 'Sheet', 'Toast', 'Confirmation']
      }],
      // Allow unused vars with _ prefix
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_'
      }]
    }
  }
)
