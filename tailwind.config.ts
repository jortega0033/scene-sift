import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/renderer/**/*.{ts,tsx}'],
  darkMode: ['class'],
  theme: {
    extend: {
      fontSize: {
        label: ['var(--font-size-xs)', { lineHeight: '1.2' }],
        'mono-path': ['var(--font-size-mono-path)', { lineHeight: '1.4' }],
        dot: ['var(--font-size-dot)', { lineHeight: '1' }],
      },
      letterSpacing: {
        label: 'var(--tracking-label)',
        heading: 'var(--tracking-heading)',
        brand: 'var(--tracking-brand)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        border: 'hsl(var(--border))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        danger: 'hsl(var(--danger))',
        'video-bg': ({ opacityValue }: { opacityValue?: string }) =>
          opacityValue !== undefined
            ? `hsl(var(--video-bg) / ${opacityValue})`
            : 'hsl(var(--video-bg))',
        'video-fg': ({ opacityValue }: { opacityValue?: string }) =>
          opacityValue !== undefined
            ? `hsl(var(--video-fg) / ${opacityValue})`
            : 'hsl(var(--video-fg))',
      },
    },
  },
  plugins: [],
} satisfies Config;
