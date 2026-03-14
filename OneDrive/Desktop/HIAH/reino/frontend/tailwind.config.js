/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Syne', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        r: {
          bg:       '#0d0d1a',
          surface:  '#13131f',
          card:     '#1a1a2e',
          border:   '#2a2a45',
          accent:   '#6c63ff',
          teal:     '#00d4aa',
          pink:     '#ff6b9d',
          amber:    '#f59e0b',
          muted:    '#8888aa',
          text:     '#e8e8f0',
        }
      },
      animation: {
        'fade-up':    'fade-up 0.4s ease-out',
        'fade-in':    'fade-in 0.3s ease-out',
        'slide-in':   'slide-in 0.3s ease-out',
        'pulse-ring': 'pulse-ring 2s ease-in-out infinite',
        'wave':       'wave 1.4s ease-in-out infinite',
        'spin-slow':  'spin 3s linear infinite',
      },
      keyframes: {
        'fade-up':    { from: { opacity: '0', transform: 'translateY(12px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'fade-in':    { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in':   { from: { opacity: '0', transform: 'translateX(-16px)' }, to: { opacity: '1', transform: 'translateX(0)' } },
        'pulse-ring': { '0%,100%': { transform: 'scale(1)', opacity: '0.5' }, '50%': { transform: 'scale(1.15)', opacity: '0.15' } },
        'wave':       { '0%,100%': { transform: 'scaleY(0.4)' }, '50%': { transform: 'scaleY(1.3)' } },
      }
    }
  },
  plugins: []
}
