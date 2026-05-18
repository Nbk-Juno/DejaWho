// DejaWho — App Screens (Home + Network Graph)

// ─────────────────────────────────────────────────────────────
// Screen 6 — Home, voice-first
// ─────────────────────────────────────────────────────────────
function ScreenHome({ greeting = 'Good morning, Juno', micState = 'default' }) {
  const recents = [
    { name: 'Alex Chen',     loc: 'Blue Bottle Coffee', color: T.accent },
    { name: 'Maya Patel',    loc: 'NeurIPS, New Orleans', color: '#6FB3F6' },
    { name: 'Tomas Werner',  loc: 'Soho House SF',      color: '#F6A66E' },
    { name: 'Priya Joshi',   loc: 'Allbirds HQ',        color: '#A36EF6' },
  ];

  return (
    <ScreenShell topPad={56} bottomPad={0}>
      {/* Top: small logo + greeting */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingTop: 4 }}>
        <img src="brand/hero-mark.png" alt="DejaWho" style={{ height: 36, width: 'auto', display: 'block' }} />
        <div style={{ fontSize: 13, color: T.textSecondary, letterSpacing: -0.1 }}>
          {greeting}
        </div>
      </div>

      {/* Hero: big mic pill */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 16, paddingBottom: 24,
      }}>
        <VoiceButton state={micState} shape="pill" />
        <div style={{
          fontSize: 12, color: T.textTertiary, textAlign: 'center',
          fontWeight: 500, letterSpacing: 0.2,
        }}>
          Try: <span style={{ color: T.textSecondary, fontStyle: 'italic' }}>
            "Who did I meet at the conference?"
          </span>
        </div>
      </div>

      {/* Bottom: recent */}
      <div style={{ marginBottom: 96 }}>
        <div style={{
          height: 1, background: T.borderSubtle, marginBottom: 16,
          marginLeft: -24, marginRight: -24,
        }} />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: T.textTertiary,
            letterSpacing: 0.8, textTransform: 'uppercase',
          }}>
            Recent
          </div>
          <div style={{ fontSize: 12, color: T.textSecondary, fontWeight: 500 }}>
            See all
          </div>
        </div>
        <div style={{
          display: 'flex', gap: 10, overflowX: 'auto',
          marginLeft: -24, paddingLeft: 24,
          paddingRight: 24, paddingBottom: 4,
        }}>
          {recents.map((r, i) => (
            <RecentChip key={i} name={r.name} location={r.loc} color={r.color} />
          ))}
        </div>
      </div>

      <BottomNav active="home" />
    </ScreenShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen 9 — Network Graph (populated)
// ─────────────────────────────────────────────────────────────
// Hand-placed positions to get a nice-looking force-directed layout
// without running a real simulation. Coordinates in 0–1 space of the
// graph area; rendered into the actual SVG viewport at draw time.

const GRAPH_DATA = {
  clusters: [
    { id: 'sf',     label: 'San Francisco', x: 0.32, y: 0.30, r: 0.18 },
    { id: 'nola',   label: 'New Orleans',   x: 0.74, y: 0.30, r: 0.13 },
    { id: 'nyc',    label: 'New York',      x: 0.70, y: 0.72, r: 0.14 },
    { id: 'london', label: 'London',        x: 0.22, y: 0.78, r: 0.10 },
  ],
  people: [
    // cluster, x, y, name, size (encounters), recency
    { c: 'sf', x: 0.22, y: 0.20, name: 'Alex',    size: 18, recency: 1.0 },
    { c: 'sf', x: 0.38, y: 0.21, name: 'Maya',    size: 14, recency: 0.9 },
    { c: 'sf', x: 0.30, y: 0.33, name: 'Tomas',   size: 12, recency: 0.7 },
    { c: 'sf', x: 0.20, y: 0.38, name: 'Sara',    size: 9,  recency: 0.5 },
    { c: 'sf', x: 0.43, y: 0.36, name: 'Priya',   size: 11, recency: 0.6 },

    { c: 'nola', x: 0.72, y: 0.25, name: 'Lena',    size: 16, recency: 0.95 },
    { c: 'nola', x: 0.82, y: 0.30, name: 'Devon',   size: 10, recency: 0.4 },
    { c: 'nola', x: 0.69, y: 0.36, name: 'Marcus',  size: 8,  recency: 0.35 },

    { c: 'nyc', x: 0.65, y: 0.68, name: 'Ana',     size: 13, recency: 0.8 },
    { c: 'nyc', x: 0.78, y: 0.66, name: 'Kenji',   size: 9,  recency: 0.55 },
    { c: 'nyc', x: 0.68, y: 0.80, name: 'Rae',     size: 10, recency: 0.6 },
    { c: 'nyc', x: 0.80, y: 0.78, name: 'Jonas',   size: 7,  recency: 0.25 },

    { c: 'london', x: 0.20, y: 0.74, name: 'Iris',  size: 11, recency: 0.7 },
    { c: 'london', x: 0.28, y: 0.81, name: 'Owen',  size: 8,  recency: 0.3 },
  ],
};

function NetworkGraph({ width = 354, height = 470, selected = 'Maya' }) {
  // graph background area
  const px = (v) => v * width;
  const py = (v) => v * height;

  // build "edge" lines from you-node (center) to each person, plus
  // a few cluster-internal connecting edges for visual density
  const youX = px(0.5), youY = py(0.5);

  const edges = GRAPH_DATA.people.map((p, i) => ({
    x1: youX, y1: youY,
    x2: px(p.x), y2: py(p.y),
    op: 0.04 + p.recency * 0.05,
  }));

  // cross edges within a cluster
  const cross = [];
  for (const cluster of GRAPH_DATA.clusters) {
    const members = GRAPH_DATA.people.filter(p => p.c === cluster.id);
    for (let i = 0; i < members.length - 1; i++) {
      cross.push({
        x1: px(members[i].x),   y1: py(members[i].y),
        x2: px(members[i+1].x), y2: py(members[i+1].y),
        op: 0.06,
      });
    }
  }

  // node color: more recent = closer to accent, older = desaturated
  const nodeFill = (p) => {
    if (p.recency > 0.75) return T.accent;
    if (p.recency > 0.45) return 'rgba(123,110,246,0.55)';
    return T.overlay;
  };
  const nodeStroke = (p) => {
    if (p.recency > 0.75) return 'rgba(255,255,255,0.18)';
    return T.borderDefault;
  };
  // size mapping: 7→8px, 18→20px
  const nodeR = (sz) => 4 + sz * 0.7;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* edges to you */}
      {edges.map((e, i) => (
        <line key={`e${i}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
          stroke="#fff" strokeOpacity={e.op} strokeWidth="1" />
      ))}
      {/* cluster cross edges */}
      {cross.map((e, i) => (
        <line key={`c${i}`} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
          stroke="#fff" strokeOpacity={e.op} strokeWidth="1" />
      ))}

      {/* cluster halos */}
      {GRAPH_DATA.clusters.map((c) => (
        <g key={c.id}>
          <circle
            cx={px(c.x)} cy={py(c.y)} r={px(c.r)}
            fill="rgba(123,110,246,0.04)"
            stroke="rgba(123,110,246,0.10)" strokeDasharray="3 4"
          />
          <text
            x={px(c.x)} y={py(c.y - c.r) - 6}
            fontSize="10" fill={T.textSecondary} textAnchor="middle"
            fontFamily={T.font} fontWeight="500" letterSpacing="0.8"
            style={{ textTransform: 'uppercase' }}
          >
            {c.label}
          </text>
        </g>
      ))}

      {/* people */}
      {GRAPH_DATA.people.map((p, i) => {
        const r = nodeR(p.size);
        const isSelected = p.name === selected;
        return (
          <g key={i}>
            {isSelected && (
              <circle cx={px(p.x)} cy={py(p.y)} r={r + 7}
                fill="none" stroke={T.accent} strokeOpacity="0.5" strokeWidth="1" />
            )}
            <circle
              cx={px(p.x)} cy={py(p.y)} r={r}
              fill={isSelected ? T.accent : nodeFill(p)}
              stroke={nodeStroke(p)} strokeWidth="1"
            />
            {(isSelected || p.size >= 14) && (
              <text
                x={px(p.x)} y={py(p.y) + r + 14}
                fontSize="11" fill={isSelected ? T.textPrimary : T.textSecondary}
                fontFamily={T.font} fontWeight={isSelected ? 600 : 500}
                textAnchor="middle"
              >
                {p.name}
              </text>
            )}
          </g>
        );
      })}

      {/* YOU node — center */}
      <g>
        <circle cx={youX} cy={youY} r="22"
          fill="none" stroke={T.accent} strokeOpacity="0.25" strokeWidth="1" />
        <circle cx={youX} cy={youY} r="14"
          fill={T.accent} stroke="#fff" strokeOpacity="0.18" strokeWidth="1.5" />
        <text x={youX} y={youY + 30} fontSize="11" fill={T.textPrimary}
          fontFamily={T.font} fontWeight="600" textAnchor="middle">
          You
        </text>
      </g>
    </svg>
  );
}

function ScreenNetwork({ empty = false, selectedName = 'Maya' }) {
  return (
    <ScreenShell topPad={56} bottomPad={0} padding="0">
      {/* Top bar */}
      <div style={{
        padding: '0 20px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 8,
      }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary, letterSpacing: -0.4 }}>
            Network
          </div>
          <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 2 }}>
            {empty ? 'Just you so far' : '14 people · 4 places'}
          </div>
        </div>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: T.surface, border: `1px solid ${T.borderSubtle}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="search" size={16} color={T.textSecondary} strokeWidth={2} />
        </div>
      </div>

      {/* Graph stage */}
      <div style={{
        flex: 1, margin: '0 12px', borderRadius: 20,
        background: 'radial-gradient(circle at 50% 50%, rgba(123,110,246,0.06) 0%, rgba(15,15,18,0) 70%)',
        border: `1px solid ${T.borderSubtle}`,
        position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {empty ? <EmptyGraph /> : (
          <>
            <NetworkGraph selected={selectedName} />
            <SelectedPersonSheet name={selectedName} />
          </>
        )}

        {/* zoom controls */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          display: 'flex', flexDirection: 'column',
          background: T.surface,
          border: `1px solid ${T.borderSubtle}`,
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{ padding: 8, borderBottom: `1px solid ${T.borderSubtle}` }}>
            <Icon name="plus" size={14} color={T.textSecondary} />
          </div>
          <div style={{ padding: 8 }}>
            <div style={{ width: 14, height: 2, background: T.textSecondary, borderRadius: 2 }} />
          </div>
        </div>

        {/* zoom level pill */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          padding: '6px 10px', borderRadius: 99,
          background: T.surface, border: `1px solid ${T.borderSubtle}`,
          fontSize: 11, color: T.textSecondary, fontWeight: 500,
          letterSpacing: 0.4,
        }}>
          City level
        </div>
      </div>

      <div style={{ height: 90 }} />
      <BottomNav active="network" />
    </ScreenShell>
  );
}

function EmptyGraph() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28,
      padding: '0 32px', textAlign: 'center',
    }}>
      <div style={{ position: 'relative', width: 100, height: 100 }}>
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `1px solid ${T.accent}`,
          opacity: 0.3,
          animation: 'dw-pulse-ring 3s ease-out infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: `1px solid ${T.accent}`,
          opacity: 0.3,
          animation: 'dw-pulse-ring 3s ease-out 1.5s infinite',
        }} />
        <div style={{
          position: 'absolute', inset: 30, borderRadius: '50%',
          background: T.accent,
          boxShadow: '0 0 24px rgba(123,110,246,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: 0.4 }}>You</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: T.textPrimary, letterSpacing: -0.3 }}>
          Your network grows as you record
        </div>
        <div style={{ fontSize: 14, color: T.textSecondary, lineHeight: 1.45 }}>
          Every encounter becomes a node. Connections form as places and people overlap.
        </div>
      </div>

      <CTAButton size="md" icon="mic">Record your first encounter</CTAButton>
    </div>
  );
}

function SelectedPersonSheet({ name = 'Maya' }) {
  return (
    <div style={{
      position: 'absolute', bottom: 12, left: 12, right: 12,
      background: T.elevated,
      border: `1px solid ${T.borderDefault}`,
      borderRadius: 18,
      padding: 16,
      boxShadow: '0 -12px 32px rgba(0,0,0,0.4)',
    }}>
      {/* handle */}
      <div style={{
        width: 36, height: 4, borderRadius: 99,
        background: T.borderStrong,
        margin: '-6px auto 12px',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: T.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 600, color: '#fff',
          }}>
            {name.charAt(0)}
          </div>
          <div>
            <div style={{ fontSize: 17, fontWeight: 600, color: T.textPrimary, letterSpacing: -0.2 }}>
              {name} Patel
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
              <Icon name="map-pin" size={12} color={T.textSecondary} strokeWidth={1.8} />
              <span>NeurIPS · New Orleans · 4 months ago</span>
            </div>
          </div>
        </div>
        <Icon name="chevron-right" size={18} color={T.textSecondary} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Voice button states showcase (component grid)
// ─────────────────────────────────────────────────────────────
function VoiceStatesShowcase() {
  return (
    <ScreenShell topPad={56}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: T.textPrimary, letterSpacing: -0.4 }}>
          Voice button states
        </div>
        <div style={{ fontSize: 13, color: T.textSecondary, marginTop: 4 }}>
          One component, four states. Used across home, record, search & onboarding.
        </div>
      </div>

      {/* Pill states */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Labeled label="DEFAULT — Home, Search">
          <VoiceButton state="default" shape="pill" />
        </Labeled>
        <Labeled label="RECORDING">
          <VoiceButton state="recording" shape="pill" label="Listening…" />
        </Labeled>
        <Labeled label="PROCESSING">
          <VoiceButton state="processing" shape="pill" label="Saving…" />
        </Labeled>
        <Labeled label="DONE">
          <VoiceButton state="done" shape="pill" label="Got it!" />
        </Labeled>
      </div>

      {/* Circle row */}
      <div style={{ marginTop: 24 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: T.textTertiary,
          letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 16,
        }}>
          Circle variant (Onboarding)
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 4px' }}>
          <VoiceButton state="default"    shape="circle" />
          <VoiceButton state="recording"  shape="circle" />
          <VoiceButton state="processing" shape="circle" />
          <VoiceButton state="done"       shape="circle" />
        </div>
      </div>
    </ScreenShell>
  );
}

function Labeled({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 600, color: T.textTertiary,
        letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

Object.assign(window, {
  ScreenHome, ScreenNetwork, EmptyGraph, SelectedPersonSheet, VoiceStatesShowcase,
});
