import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0F1A',
        foreground: '#E2E8F0',
        primary: {
          DEFAULT: '#3B82F6',
          light: '#60A5FA',
          lighter: '#93C5FD',
          dark: '#2563EB',
          50: '#1E3A5F',
          100: '#1E3A5F',
          200: '#1E4D8C',
        },
        ink: {
          DEFAULT: '#F1F5F9',
          light: '#CBD5E1',
          lighter: '#94A3B8',
        },
        surface: {
          DEFAULT: '#111827',
          soft: '#151C2C',
          blue: '#0D1424',
          warm: '#0F1623',
        },
        muted: '#94A3B8',
        line: '#1E293B',
        success: '#10B981',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0) rotate(1deg)' },
          '50%': { transform: 'translateY(-14px) rotate(-1deg)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blob: {
          '0%, 100%': { borderRadius: '60% 40% 30% 70% / 60% 30% 70% 40%' },
          '50%': { borderRadius: '30% 60% 70% 40% / 50% 60% 30% 60%' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        rise: 'rise 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 8s ease-in-out infinite',
        'fade-in': 'fade-in 0.6s ease-out both',
        'slide-up': 'slide-up 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
        blob: 'blob 8s ease-in-out infinite',
        'spin-slow': 'spin-slow 25s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
