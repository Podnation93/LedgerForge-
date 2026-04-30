import type { Config } from 'tailwindcss'

export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0B0F17',
        panel: '#161E2E',
        card: '#1C2638',
        border: '#263348',
        primary: '#3B82F6',
        cyan: '#38BDF8',
        indigo: '#4F46E5',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(59,130,246,.35), 0 12px 34px rgba(37,99,235,.18)',
      },
    },
  },
  plugins: [],
} satisfies Config
