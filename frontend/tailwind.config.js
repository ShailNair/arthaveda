/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0a0e1a',
        surface: '#111827',
        card: '#1a2235',
        border: '#1e2d42',
        accent: '#f59e0b',
        green: { 400: '#4ade80', 500: '#22c55e', 600: '#16a34a' },
        red: { 400: '#f87171', 500: '#ef4444' },
        blue: { 400: '#60a5fa', 500: '#3b82f6' },
        gold: '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slideIn 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        slideIn: { from: { opacity: 0, transform: 'translateY(-10px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        glow: { from: { boxShadow: '0 0 5px #f59e0b33' }, to: { boxShadow: '0 0 20px #f59e0b66' } },
      }
    },
  },
  plugins: [],
}
