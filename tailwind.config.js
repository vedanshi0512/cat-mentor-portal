/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Light, official-CAT-exam-style palette. Same scale name/numbering as before
        // (ink-50 ... ink-900) so every existing class in every component still works -
        // only the actual colors changed, from dark-navy-as-background to light-as-background.
        // ink-900/800 = darkest text & strongest borders. ink-50 = page background.
        ink: {
          50: '#f7f8fa',   // page background
          100: '#eef1f5',  // panel/sidebar background
          200: '#dde3ea',  // borders, dividers
          300: '#c2cad6',  // disabled/faint borders
          400: '#8995a6',  // secondary/placeholder text
          500: '#5b6679',  // body text, secondary labels
          600: '#3f4859',  // headings on light background
          700: '#2a3142',  // strong headings
          800: '#1b2030',  // rarely used - darkest panel (e.g. dark header bar if needed)
          900: '#11141e',  // rarely used - near-black text
        },
        amber: {
          400: '#f5b942',
          500: '#e8a324',
        },
        // Real CAT exam uses blue, not amber, as its primary accent (current section,
        // primary buttons, "Save & Next"). Kept amber for places that still reference
        // it but cat-blue is now the actual primary accent used in the test UI.
        catblue: {
          50: '#eaf2fd',
          100: '#cfe3fb',
          500: '#1f6fd6',
          600: '#1857ab',
          700: '#123f7d',
        },
        palette: {
          notvisited: '#ffffff',
          visited: '#e8534a',
          answered: '#3fb950',
          marked: '#8957e5',
          markedanswered: '#b07cf0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
