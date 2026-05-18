// DejaWho — Logomark + Wordmark (v2 — no containing circle).
// Direction: a bold standalone '?' whose proportions subtly imply a human
// figure — wide curved head up top, narrower stem body, dot at the base.
// Three explorations (A primary, B/C alternates) and a wordmark whose "j"
// echoes the stem anatomy.

// ─────────────────────────────────────────────────────────────
// A — Two-weight ? (PRIMARY)
//   Head curve drawn at thicker stroke; stem at narrower stroke;
//   distinct dot. The weight change creates a visible "shoulder"
//   where head meets body — that's the silhouette read.
// ─────────────────────────────────────────────────────────────
function DWLogoA({ size = 80, color = '#7B6EF6', glow = false }) {
  return (
    <LogoWrap size={size} color={color} glow={glow}>
      <svg viewBox="0 0 64 80" width={size * 64/80} height={size}>
        {/* head curl */}
        <path
          d="M 12 22
             C 12 11, 20 5, 32 5
             C 44 5, 52 11, 52 22
             C 52 32, 44 37, 36 40"
          stroke={color} strokeWidth="11" fill="none"
          strokeLinecap="round" strokeLinejoin="round"
        />
        {/* narrower stem (body) */}
        <path
          d="M 32 47 L 32 60"
          stroke={color} strokeWidth="7" fill="none"
          strokeLinecap="round"
        />
        {/* dot */}
        <circle cx="32" cy="73" r="5" fill={color} />
      </svg>
    </LogoWrap>
  );
}

// ─────────────────────────────────────────────────────────────
// B — Filled chunky ?
//   One solid filled shape, narrowing from head to body, with a
//   separate dot. Reads as a heavier, more iconic glyph.
// ─────────────────────────────────────────────────────────────
function DWLogoB({ size = 80, color = '#7B6EF6', glow = false }) {
  return (
    <LogoWrap size={size} color={color} glow={glow}>
      <svg viewBox="0 0 64 80" width={size * 64/80} height={size}>
        <path
          fill={color}
          d="M 32 4
             C 18 4, 8 13, 8 24
             C 8 27, 9 30, 11 32
             L 19 28
             C 18 27, 18 25, 18 24
             C 18 18, 24 14, 32 14
             C 40 14, 46 18, 46 24
             C 46 30, 41 32, 36 35
             C 31 38, 27 42, 27 49
             L 27 55
             L 37 55
             L 37 50
             C 37 47, 40 45, 44 43
             C 51 39, 56 33, 56 24
             C 56 13, 46 4, 32 4 Z"
        />
        <circle cx="32" cy="71" r="6" fill={color} />
      </svg>
    </LogoWrap>
  );
}

// ─────────────────────────────────────────────────────────────
// C — Geometric anatomy
//   Head and body drawn as separate primitives: a circular "head"
//   (thick ring with an opening on the bottom-right that suggests
//   a curl-to-stem motion), straight tapered neck, and dot. Most
//   abstract — reads from a distance.
// ─────────────────────────────────────────────────────────────
function DWLogoC({ size = 80, color = '#7B6EF6', glow = false }) {
  return (
    <LogoWrap size={size} color={color} glow={glow}>
      <svg viewBox="0 0 64 80" width={size * 64/80} height={size}>
        {/* head — open ring */}
        <path
          d="M 49 32
             A 18 18 0 1 0 32 50"
          stroke={color} strokeWidth="10" fill="none"
          strokeLinecap="round"
        />
        {/* stem - narrower */}
        <path
          d="M 32 50 L 32 60"
          stroke={color} strokeWidth="6" fill="none"
          strokeLinecap="round"
        />
        {/* dot */}
        <circle cx="32" cy="73" r="5" fill={color} />
      </svg>
    </LogoWrap>
  );
}

// Primary export is variant A. Existing screens continue to call DWLogo.
function DWLogo(props) { return <DWLogoA {...props} />; }

// Shared wrapper (glow + sizing)
function LogoWrap({ size, color, glow, children }) {
  return (
    <div style={{
      position: 'relative',
      width: size, height: size,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {glow && (
        <div style={{
          position: 'absolute', inset: -size * 0.6, borderRadius: '50%',
          background: `radial-gradient(circle, ${color}33 0%, ${color}00 60%)`,
          animation: 'dw-glow-breathe 4s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
      )}
      <div style={{ position: 'relative', display: 'flex' }}>
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Wordmark — Inter-style, with a custom "j" whose stem/dot
// match the logomark anatomy (narrow stem + clear dot).
// ─────────────────────────────────────────────────────────────
function DWWordmark({ size = 28, color = (typeof T !== 'undefined' ? T.textPrimary : '#F0EFF8'), weight = 600, letterSpacing = -0.5 }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline',
      fontFamily: (typeof T !== 'undefined' ? T.font : 'Inter, sans-serif'),
      fontWeight: weight, fontSize: size,
      color, letterSpacing, lineHeight: 1,
    }}>
      <span>De</span>
      <span style={{ position: 'relative', display: 'inline-block', width: size * 0.32, height: size }}>
        <svg viewBox="0 0 16 48" width={size * 0.32} height={size * 1.05}
             style={{ position: 'absolute', top: -size * 0.16, left: 0 }}>
          {/* dot */}
          <circle cx="9" cy="8" r="2.4" fill={color} />
          {/* stem with hook descender — echoes mark's narrow stem */}
          <path
            d="M 9 16 L 9 36 C 9 41, 6 43, 2 41"
            stroke={color} strokeWidth="3" fill="none"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span>aWho</span>
    </span>
  );
}

// Lockup helper (mark stacked above wordmark)
function DWLockup({
  markSize = 80, wordSize = 22,
  color = (typeof T !== 'undefined' ? T.textPrimary : '#F0EFF8'),
  accent = (typeof T !== 'undefined' ? T.accent : '#7B6EF6'),
  glow = false, gap = 20,
  variant = 'A',
}) {
  const Mark = variant === 'B' ? DWLogoB : variant === 'C' ? DWLogoC : DWLogoA;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap }}>
      <Mark size={markSize} color={accent} glow={glow} />
      <DWWordmark size={wordSize} color={color} />
    </div>
  );
}

Object.assign(window, { DWLogo, DWLogoA, DWLogoB, DWLogoC, DWWordmark, DWLockup });
