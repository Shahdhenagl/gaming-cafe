/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0a0c16',
        surface: '#121626',
        card: '#181e33',
        'card-hover': '#1f2642',
        border: '#2a3254',
        'border-focus': '#7c3aed',
        primary: {
          DEFAULT: '#7c3aed',
          hover: '#6d28d9',
          light: '#8b5cf6',
          glow: 'rgba(124, 58, 237, 0.4)'
        },
        secondary: {
          DEFAULT: '#06b6d4',
          hover: '#0891b2',
        },
        cafe: {
          DEFAULT: '#d97706',
          warm: '#b45309',
          light: '#fde68a',
          latte: '#78350f'
        },
        accent: '#f43f5e',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#ef4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Tajawal', 'sans-serif'],
        mono: ['"Fira Code"', 'monospace'],
        arabic: ['Tajawal', 'Inter', 'sans-serif'],
        gaming: ['"Chakra Petch"', 'Tajawal', 'sans-serif'],
        display: ['"Russo One"', '"Chakra Petch"', 'Tajawal', 'sans-serif'],
      },
      boxShadow: {
        'neon-purple': '0 0 20px rgba(124, 58, 237, 0.35)',
        'neon-cyan': '0 0 20px rgba(6, 182, 212, 0.35)',
        'neon-green': '0 0 20px rgba(16, 185, 129, 0.35)',
        'neon-rose': '0 0 20px rgba(244, 63, 94, 0.35)',
        'neon-amber': '0 0 20px rgba(245, 158, 11, 0.35)',
      },
    },
  },
  plugins: [],
}

