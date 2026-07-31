import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        xiom: {
          black:   '#000000',
          white:   '#ffffff',
          dim:     'rgba(255,255,255,0.5)',
          muted:   'rgba(255,255,255,0.35)',
          accent:  'rgba(255,255,255,0.08)',
          hover:   'rgba(255,255,255,0.12)',
          border:  'rgba(255,255,255,0.08)',
          'border-hover': 'rgba(255,255,255,0.18)',
          success: '#4ade80',
          warning: '#fbbf24',
        },
        background: '#000000',
        foreground: '#ffffff',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Courier New', 'monospace'],
      },
      borderRadius: {
        none: '0px',
        sm:   '2px',
        DEFAULT: '0px',
        md:   '4px',
        lg:   '4px',
        xl:   '4px',
      },
      letterSpacing: {
        widest: '0.14em',
        label:  '0.1em',
      },
      animation: {
        'fade-in':    'fadeIn 0.5s ease forwards',
        'fade-in-up': 'fadeInUp 0.7s cubic-bezier(0.22,1,0.36,1) forwards',
        'pulse-border': 'borderPulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        borderPulse: {
          '0%, 100%': { borderColor: 'rgba(255,255,255,0.08)' },
          '50%':      { borderColor: 'rgba(255,255,255,0.25)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
