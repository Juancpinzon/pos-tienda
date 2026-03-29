import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primario: {
          DEFAULT: 'var(--color-primario)',
          hover: 'var(--color-primario-hover)',
        },
        acento: {
          DEFAULT: 'var(--color-acento)',
          hover: 'var(--color-acento-hover)',
        },
        fondo:       'var(--color-fondo)',
        superficie:  'var(--color-superficie)',
        borde:       'var(--color-borde)',
        texto:       'var(--color-texto)',
        suave:       'var(--color-texto-suave)',
        peligro:     'var(--color-peligro)',
        exito:       'var(--color-exito)',
        advertencia: 'var(--color-advertencia)',
        fiado:       'var(--color-fiado)',
      },
      fontFamily: {
        display: ['Nunito', 'sans-serif'],
        body:    ['Inter', 'sans-serif'],
        mono:    ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        precio: ['24px', { lineHeight: '1.2' }],
        total:  ['36px', { lineHeight: '1.1' }],
      },
      minHeight: {
        touch: '56px',
      },
      minWidth: {
        touch: '56px',
      },
    },
  },
  plugins: [],
}

export default config
