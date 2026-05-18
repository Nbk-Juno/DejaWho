// DejaWho — design tokens + icons.
// Loaded as a Babel script. Exposes T (tokens), Icon (lucide-style SVG set),
// and a few small helpers to window.

const T = {
  // Background family — Dark Amethyst
  bg:        '#09043A',
  surface:   '#0E0A4A',
  elevated:  '#15105A',
  overlay:   '#1C166D',

  // Primary accent — Bright Indigo
  accent:        '#412DF0',
  accentDim:     '#2E1FB5',
  accentSubtle:  '#1B1370',
  accentGlow:    'rgba(65,45,240,0.22)',

  // Highlight — Banana Cream (use sparingly)
  highlight:     '#FBEC5D',
  highlightSubtle: 'rgba(251,236,93,0.14)',

  // Text
  textPrimary:   '#F0EFF8',
  textSecondary: '#8B8A99',
  textTertiary:  '#4A4A58',

  // Semantic
  success: '#3DD68C',
  warning: '#F5A623',
  error:   '#F05252',

  // Borders
  borderSubtle:  'rgba(255,255,255,0.06)',
  borderDefault: 'rgba(255,255,255,0.10)',
  borderStrong:  'rgba(255,255,255,0.18)',

  // Type
  font: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',

  // Radii
  rSm: 8, rMd: 12, rLg: 16, rXl: 24,
};

// ─────────────────────────────────────────────────────────────
// Inline-SVG icon set (lucide-style 24px, stroke-based).
// Pass size + color via props.
// ─────────────────────────────────────────────────────────────
function Icon({ name, size = 24, color = 'currentColor', strokeWidth = 2, style }) {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round',
    style,
  };
  switch (name) {
    case 'mic':
      return (
        <svg {...common}>
          <rect x="9" y="2" width="6" height="12" rx="3" />
          <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
          <path d="M12 18v4" />
        </svg>
      );
    case 'mic-off':
      return (
        <svg {...common}>
          <path d="M2 2l20 20" />
          <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2" />
          <path d="M5 10v2a7 7 0 0 0 12 5" />
          <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33" />
          <path d="M9 9v3a3 3 0 0 0 5.12 2.12" />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...common}>
          <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
          <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case 'check-circle':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case 'map-pin':
      return (
        <svg {...common}>
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case 'arrow-right':
      return (
        <svg {...common}>
          <path d="M5 12h14M13 5l7 7-7 7" />
        </svg>
      );
    case 'arrow-up':
      return (
        <svg {...common}>
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      );
    case 'home':
      return (
        <svg {...common}>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M9 22V12h6v10" />
        </svg>
      );
    case 'network':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="2.5" />
          <circle cx="5" cy="5" r="2" />
          <circle cx="19" cy="5" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
          <path d="M10.3 10.3 6.4 6.4M13.7 10.3l3.9-3.9M10.3 13.7l-3.9 3.9M13.7 13.7l3.9 3.9" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      );
    case 'x':
      return (
        <svg {...common}>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'chevron-right':
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case 'chevron-down':
      return (
        <svg {...common}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      );
    case 'volume':
      return (
        <svg {...common}>
          <path d="M11 5 6 9H2v6h4l5 4z" />
          <path d="M15.5 8.5a5 5 0 0 1 0 7" />
          <path d="M19 5a9 9 0 0 1 0 14" />
        </svg>
      );
    default:
      return null;
  }
}

// CSS keyframes used app-wide
if (typeof document !== 'undefined' && !document.getElementById('dw-styles')) {
  const s = document.createElement('style');
  s.id = 'dw-styles';
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    .dw * { box-sizing: border-box; }
    .dw { font-family: ${T.font}; color: ${T.textPrimary}; -webkit-font-smoothing: antialiased; }
    @keyframes dw-pulse-ring {
      0% { transform: scale(0.95); opacity: 0.6; }
      80%, 100% { transform: scale(1.6); opacity: 0; }
    }
    @keyframes dw-pulse-soft {
      0%, 100% { transform: scale(1); opacity: 0.5; }
      50% { transform: scale(1.08); opacity: 0.9; }
    }
    @keyframes dw-wave {
      0%, 100% { transform: scaleY(0.3); }
      50% { transform: scaleY(1); }
    }
    @keyframes dw-spin { to { transform: rotate(360deg); } }
    @keyframes dw-fade-up {
      from { transform: translateY(12px); opacity: 0; }
      to   { transform: translateY(0); opacity: 1; }
    }
    @keyframes dw-draw {
      from { stroke-dashoffset: 60; }
      to   { stroke-dashoffset: 0; }
    }
    @keyframes dw-glow-breathe {
      0%, 100% { opacity: 0.45; transform: scale(1); }
      50% { opacity: 0.7; transform: scale(1.05); }
    }
  `;
  document.head.appendChild(s);
}

Object.assign(window, { T, Icon });
