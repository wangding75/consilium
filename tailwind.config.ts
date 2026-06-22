import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        'primary-hover': 'var(--color-primary-hover)',
        'primary-soft': 'var(--color-primary-soft)',
        accent: 'var(--color-primary)',
        surface: 'var(--color-surface)',
        'surface-elevated': 'var(--color-surface-elevated)',
        border: 'var(--color-border)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        green: 'var(--color-green)',
        'green-bg': 'var(--color-green-bg)',
        amber: 'var(--color-amber)',
        red: 'var(--color-red)',
        purple: 'var(--color-purple)',
      },
      spacing: {
        'safe-bottom': 'var(--spacing-safe-bottom)',
        'nav-height': 'var(--nav-height)',
        'header-height': 'var(--header-height)',
      },
    },
  },
  plugins: [],
}

export default config
