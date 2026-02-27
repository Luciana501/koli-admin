/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        koli: {
          bg: '#020409',
          surface: '#060d1a',
          border: '#0f2040',
          accent: '#00c6ff',
          accent2: '#7b2fff',
          accent3: '#00ff88',
          danger: '#ff3b6b',
          warning: '#ffb800',
          text: '#e2f0ff',
          muted: '#4a6a8a',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'monospace'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'border-pulse': 'border-pulse 2s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'scan': 'scan 3s linear infinite',
        'fadeIn': 'fadeIn 0.3s ease-in-out',
        'slideIn': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        'border-pulse': {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.4 },
        },
        'glow': {
          from: { boxShadow: '0 0 10px #00c6ff33, 0 0 20px #00c6ff11' },
          to: { boxShadow: '0 0 20px #00c6ff66, 0 0 40px #00c6ff22' },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'fadeIn': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        'slideIn': {
          from: { opacity: 0, transform: 'translateY(-8px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(rgba(0,198,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,198,255,0.03) 1px, transparent 1px)",
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
    },
  },
  plugins: [],
};
