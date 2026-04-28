/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        mist: '#F5F8FB',
        ice: '#EAF2F9',
        ink: '#0B2845',
        ash: '#3B4A5C',
        mute: '#7B8A9A',
        soft: '#D9E3EE',
        brandBlue: '#1E5FA5',
        brandBlueDark: '#154680',
        brandTeal: '#2CA8A8',
        brandGreen: '#5EB33C',
        brandGreenDark: '#4A8F2E',
        warn: '#E0A800',
        danger: '#D14343',
        success: '#5EB33C',
      },
      fontFamily: {
        display: ['"Syne"', 'Georgia', 'serif'],
        sans: ['"Manrope"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #1E5FA5 0%, #2CA8A8 50%, #5EB33C 100%)',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(11,40,69,0.04), 0 4px 12px rgba(11,40,69,0.04)',
      },
    },
  },
  plugins: [],
}
