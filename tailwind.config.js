/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html"],
    darkMode: 'class',
    safelist:[
    //'bg-blue-500',
    'text-xxs'
  ],

  theme: {
    screens: {
      sm: '480px',
      md: '768px',
      lg: '1020px',
      xl: '1440px',
    },
    extend: {
      colors: {
        // webOrange: '#FFB790',
      },
      fontFamily: {
        tourney: ['Tourney'],
        spartan: ['League Spartan'],
      },
      fontSize:{
        xxs: '0.625rem',
        md: '0.938rem'
      }
    },    
  },

    variants: {
    extend: {
      backgroundImage: ['dark']
    }
  },
  plugins: [],
}

