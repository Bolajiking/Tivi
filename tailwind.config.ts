import type { Config } from 'tailwindcss';
const config: Config = {
  darkMode: ['class'],
  content: ['./src/components/**/*.{js,ts,jsx,tsx,mdx}', './src/app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Design system tokens — "The Stream Is the Stage"
        canvas: '#080808',    // main app background
        surface: '#0f0f0f',   // sidebar, panels, dropdowns
        raised: '#1a1a1a',    // list items, inputs, cards
        // Legacy (kept for compatibility)
        'main-blue': '#3351FF',
        'orange-drop': '#FE5C2B',
        'green-drop': '#00E36E',
        'background-gray': '#EEEFF1',
        'border-gray': '#DFE0E1',
        'pubnub-dark': '#161C2D',
        'pubnub-red': '#EF3A43',
        'pubnub-faded-red': '#FDECED',
        'pubnub-dark-grey': '#475569',
        'pubnub-light-grey': '#94A3B7',
        'pubnub-yellow': '#FBBF24',
        'pubnub-white': '#F8FAFC',
        background: '#000000',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      keyframes: {
        overlayShow: {
          from: {
            opacity: '0',
          },
          to: {
            opacity: '1',
          },
        },
        contentShow: {
          from: {
            opacity: '0',
            transform: 'translate(-50%, -48%) scale(0.96)',
          },
          to: {
            opacity: '1',
            transform: 'translate(-50%, -50%) scale(1)',
          },
        },
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        overlayShow: 'overlayShow 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        contentShow: 'contentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      fontFamily: {
        inter: ['Inter', 'sans-serif'],
        'funnel-display': ['Funnel Display', 'sans-serif'],
        'host-grotesk': ['Host Grotesk', 'Inter', 'sans-serif'],
      },
    },
  },
};
export default config;
