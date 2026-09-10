export default {
  content: ['./src/templates/**/*.njk', './src/scripts/**/*.js'],
  safelist: [{ pattern: /^fiestas-type-/ }],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#e9f4f9',
          100: '#d0e8f4',
          200: '#a7d5eb',
          300: '#71bfe1',
          400: '#3cb4e5',
          500: '#0083c1',
          600: '#0074ac',
          700: '#00618f',
          800: '#0b4f72',
          900: '#123f5a'
        },
        ink: '#3c3c3c',
        paper: '#fbfaf8',
        line: '#dfe1e5'
      },
      boxShadow: {
        soft: '0 10px 30px rgba(31, 36, 48, 0.06)'
      },
      fontFamily: {
        display: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
