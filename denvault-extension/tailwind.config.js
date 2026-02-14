/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Colors - Design guide palette
      colors: {
        // Primary accent (neon lime from design guide)
        primary: {
          DEFAULT: '#e8f859',
          hover: '#f0ff6a',
          muted: 'rgba(232, 248, 89, 0.15)',
        },
        // Background colors
        'bg-primary': '#0a0a0a',
        'bg-card': '#1a1a1a',
        'bg-card-hover': '#252524',
        'bg-elevated': '#141413',
        // Text colors
        'text-primary': '#FFFFFF',
        'text-secondary': 'rgba(255, 255, 255, 0.64)',
        'text-muted': 'rgba(255, 255, 255, 0.40)',
        // Status colors
        success: {
          DEFAULT: '#99E18E',
          muted: 'rgba(153, 225, 142, 0.15)',
        },
        error: {
          DEFAULT: '#FF6B6B',
          muted: 'rgba(255, 107, 107, 0.15)',
        },
        warning: {
          DEFAULT: '#FBBF24',
          muted: 'rgba(251, 191, 36, 0.15)',
        },
        // Border colors
        'border-default': 'rgba(255, 255, 255, 0.12)',
        'border-hover': 'rgba(255, 255, 255, 0.24)',
        // Asset accent colors
        'accent-stx': '#7c3aed',
        'accent-btc': '#f7931a',
        'accent-runes': '#ec4899',
        'accent-ordinals': '#eab308',
      },
      // Font family
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['SF Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      // Border radius
      borderRadius: {
        'sm': '0.5rem',
        'md': '0.75rem',
        'lg': '1rem',
        'xl': '1.5rem',
        '2xl': '2rem',
        'pill': '9999px',
      },
      // Box shadows
      boxShadow: {
        'glow-primary': '0 0 20px rgba(232, 248, 89, 0.3)',
        'glow-primary-lg': '0 4px 20px rgba(232, 248, 89, 0.35)',
        'neumorphic': '8px 8px 16px rgba(0, 0, 0, 0.4), -8px -8px 16px rgba(255, 255, 255, 0.05)',
        'neumorphic-inset': 'inset 2px 2px 5px rgba(0, 0, 0, 0.5), inset -1px -1px 2px rgba(255, 255, 255, 0.05)',
      },
      // Animation
      animation: {
        'shake': 'shake 0.3s ease-in-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 12px rgba(232, 248, 89, 0.6)' },
          '50%': { boxShadow: '0 0 20px rgba(232, 248, 89, 0.8)' },
        },
      },
    },
  },
  plugins: [],
}
