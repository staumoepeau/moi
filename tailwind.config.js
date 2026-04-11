/** @type {import('tailwindcss').Config} */

const mywhyPreset = require('mywhy-ui/tailwind-preset')

module.exports = {
  content: [
    './moi/public/js/**/*.{js,jsx}',
    './node_modules/mywhy-ui/dist/**/*.{js,cjs}',
  ],
  presets: [mywhyPreset],
  theme: {
    extend: {
      // Add any MOI-specific theme extensions here
    },
  },
  plugins: [],
}
