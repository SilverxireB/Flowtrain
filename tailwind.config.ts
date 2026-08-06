import type { Config } from 'tailwindcss'

// Flow Studio tasarım dili (FlowMeter ile aynı): accent birincil aksiyon,
// brand YALNIZ uyarı/danger, nötrler ink/paper/line/muted.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        accent: '#4f46e5',
        'accent-dark': '#4338ca',
        brand: '#e11d48',
        lacivert: '#001e64',
        ink: '#0f172a',
        muted: '#64748b',
        line: '#e2e8f0',
        paper: '#ffffff',
        wash: '#f8fafc',
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
