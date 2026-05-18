// DejaWho — shared UI components.
// Voice button, encounter card, bottom nav, instruction card, etc.

// ─────────────────────────────────────────────────────────────
// VoiceButton — THE component. Pill or circle, four states.
// ─────────────────────────────────────────────────────────────
function VoiceButton({
  state = 'default',      // default | recording | processing | done
  shape = 'pill',         // pill | circle
  label,                  // override default label
  sublabel,
  width,                  // optional override (pill only)
}) {
  const isCircle = shape === 'circle';
  const size = isCircle ? 96 : 'auto';

  // State styling
  const styling = {
    default:    { bg: T.accent,    fg: '#fff',  shadow: '0 8px 24px rgba(65,45,240,0.38), 0 0 0 1px rgba(255,255,255,0.06) inset' },
    recording:  { bg: T.highlight, fg: T.bg,    shadow: '0 8px 24px rgba(251,236,93,0.30)' },
    processing: { bg: T.accent,    fg: '#fff',  shadow: '0 8px 24px rgba(65,45,240,0.38)' },
    done:       { bg: T.success,   fg: '#fff',  shadow: '0 8px 24px rgba(61,214,140,0.3)' },
  }[state];

  // Label fallbacks
  const lbl = label ?? ({
    default: isCircle ? null : 'Tap to speak',
    recording: 'Listening…',
    processing: 'Saving…',
    done: 'Got it!',
  }[state]);

  const sub = sublabel ?? (
    !isCircle && state === 'default' ? 'Record an encounter or find someone' : null
  );

  // Glyph inside
  const glyph = (() => {
    if (state === 'processing') {
      return (
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          border: '2.5px solid rgba(255,255,255,0.25)',
          borderTopColor: '#fff',
          animation: 'dw-spin 0.7s linear infinite',
        }} />
      );
    }
    if (state === 'recording') {
      // Waveform bars — dark amethyst on yellow ground
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28 }}>
          {[0, 0.15, 0.3, 0.1, 0.25, 0.05, 0.2].map((d, i) => (
            <div key={i} style={{
              width: 3, height: '100%', borderRadius: 2,
              background: T.bg,
              animation: `dw-wave 0.9s ease-in-out ${d}s infinite`,
              transformOrigin: 'center',
            }} />
          ))}
        </div>
      );
    }
    if (state === 'done') return <Icon name="check" size={isCircle ? 36 : 24} color={styling.fg} strokeWidth={2.5} />;
    return <Icon name="mic" size={isCircle ? 32 : 22} color={styling.fg} strokeWidth={2} />;
  })();

  if (isCircle) {
    return (
      <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* pulse ring (default only) */}
        {state === 'default' && (
          <>
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: `1.5px solid ${T.accent}`,
              animation: 'dw-pulse-ring 2.4s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: `1.5px solid ${T.accent}`,
              animation: 'dw-pulse-ring 2.4s ease-out 1.2s infinite',
            }} />
          </>
        )}
        <div style={{
          width: size, height: size, borderRadius: '50%',
          background: styling.bg, boxShadow: styling.shadow,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', userSelect: 'none', position: 'relative', zIndex: 1,
        }}>
          {glyph}
        </div>
      </div>
    );
  }

  // pill
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, width: width ?? '100%' }}>
      <div style={{
        height: 72, borderRadius: 36, background: styling.bg, boxShadow: styling.shadow,
        display: 'flex', alignItems: 'center', padding: '0 28px', gap: 14,
        cursor: 'pointer', userSelect: 'none',
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: state === 'recording' ? 'rgba(9,4,58,0.12)' : 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {glyph}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: styling.fg, letterSpacing: -0.2 }}>
            {lbl}
          </div>
          {sub && (
            <div style={{ fontSize: 12, fontWeight: 400, color: state === 'recording' ? 'rgba(9,4,58,0.7)' : 'rgba(255,255,255,0.7)', marginTop: 2 }}>
              {sub}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// EncounterCard — name / location / context preview
// ─────────────────────────────────────────────────────────────
function EncounterCard({ name, location, date, context, confidence, compact = false }) {
  const borderColor = confidence === 'high' ? T.success : confidence === 'med' ? T.warning : null;

  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.borderSubtle}`,
      borderLeft: borderColor ? `3px solid ${borderColor}` : `1px solid ${T.borderSubtle}`,
      borderRadius: T.rLg,
      padding: compact ? 14 : 18,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: T.textPrimary, letterSpacing: -0.2 }}>
        {name}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: T.textSecondary, fontSize: 13 }}>
        {location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <Icon name="map-pin" size={13} color={T.textSecondary} strokeWidth={1.8} />
            <span>{location}</span>
          </div>
        )}
        {date && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: T.textTertiary, fontSize: 12 }}>
            <Icon name="calendar" size={12} color={T.textTertiary} strokeWidth={1.8} />
            <span>{date}</span>
          </div>
        )}
      </div>
      {context && !compact && (
        <div style={{
          fontSize: 14, color: T.textSecondary, lineHeight: 1.5, marginTop: 4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {context}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RecentChip — horizontal-scroll chip for home recent list
// ─────────────────────────────────────────────────────────────
function RecentChip({ name, location, color = T.accent }) {
  return (
    <div style={{
      flexShrink: 0,
      background: T.surface,
      border: `1px solid ${T.borderSubtle}`,
      borderRadius: 14,
      padding: '12px 14px',
      minWidth: 144,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: color, opacity: 0.85,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 600, color: '#fff',
        }}>
          {name.charAt(0)}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{name}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.textSecondary, fontSize: 11 }}>
        <Icon name="map-pin" size={10} color={T.textSecondary} strokeWidth={1.8} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{location}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// InstructionCard — onboarding scripted-text card
// ─────────────────────────────────────────────────────────────
function InstructionCard({ icon, title, script }) {
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.borderSubtle}`,
      borderRadius: T.rLg,
      padding: 18,
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: T.accentSubtle,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={16} color={T.accent} strokeWidth={2} />
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, letterSpacing: -0.1 }}>
          {title}
        </div>
      </div>
      <div style={{
        borderLeft: `2px solid ${T.accent}`,
        paddingLeft: 12, marginLeft: 4,
        fontSize: 15, fontStyle: 'italic', lineHeight: 1.5,
        color: T.textPrimary, opacity: 0.92,
      }}>
        “{script}”
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BottomNav — 4-tab nav for the redesigned home
// ─────────────────────────────────────────────────────────────
function BottomNav({ active = 'home' }) {
  const tabs = [
    { id: 'home',    icon: 'home',    label: 'Home' },
    { id: 'network', icon: 'network', label: 'Network' },
    { id: 'search',  icon: 'search',  label: 'Search' },
    { id: 'profile', icon: 'user',    label: 'Profile' },
  ];
  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      background: T.bg,
      borderTop: `1px solid ${T.borderSubtle}`,
      padding: '12px 16px 32px',
      display: 'flex', justifyContent: 'space-around',
    }}>
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <div key={t.id} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            color: on ? T.accent : T.textSecondary,
            opacity: on ? 1 : 0.7,
          }}>
            <Icon name={t.icon} size={22} color="currentColor" strokeWidth={on ? 2.2 : 1.8} />
            <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: 0.1 }}>{t.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ScreenShell — provides dark canvas + safe-area padding inside iOS frame
// ─────────────────────────────────────────────────────────────
function ScreenShell({ children, padding = '0 24px', topPad = 64, bottomPad = 34, bg = T.bg }) {
  return (
    <div className="dw" style={{
      width: '100%', height: '100%', background: bg,
      paddingTop: topPad, paddingBottom: bottomPad,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ padding, height: '100%', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

// Small primary CTA button — single primary action per screen
function CTAButton({ children, variant = 'primary', size = 'lg', icon, onClick }) {
  const styles = {
    primary:   { bg: T.accent,   fg: '#fff',          border: 'none' },
    secondary: { bg: 'transparent', fg: T.textPrimary, border: `1px solid ${T.borderStrong}` },
    ghost:     { bg: 'transparent', fg: T.textSecondary, border: 'none' },
  }[variant];
  const sz = size === 'lg' ? { h: 56, fs: 17, px: 24, r: 16 } : { h: 44, fs: 15, px: 18, r: 12 };
  return (
    <button onClick={onClick} style={{
      height: sz.h, padding: `0 ${sz.px}px`, borderRadius: sz.r,
      background: styles.bg, color: styles.fg, border: styles.border,
      fontFamily: T.font, fontSize: sz.fs, fontWeight: 600, letterSpacing: -0.2,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      cursor: 'pointer',
      boxShadow: variant === 'primary' ? '0 6px 20px rgba(123,110,246,0.3)' : 'none',
    }}>
      {children}
      {icon && <Icon name={icon} size={18} color={styles.fg} />}
    </button>
  );
}

// Progress dots (onboarding)
function ProgressDots({ count, active }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          width: i === active ? 22 : 7, height: 7, borderRadius: 99,
          background: i === active ? T.accent : T.overlay,
          transition: 'all 0.25s',
        }} />
      ))}
    </div>
  );
}

Object.assign(window, {
  VoiceButton, EncounterCard, RecentChip, InstructionCard,
  BottomNav, ScreenShell, CTAButton, ProgressDots,
});
