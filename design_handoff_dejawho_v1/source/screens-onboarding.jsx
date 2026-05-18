// DejaWho — Onboarding Screens (1-5)

// ─────────────────────────────────────────────────────────────
// Screen 1 — Welcome
// ─────────────────────────────────────────────────────────────
function ScreenWelcome() {
  return (
    <ScreenShell topPad={48} bottomPad={48}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 28,
        position: 'relative',
      }}>
        {/* logo block */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 28 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              position: 'absolute', inset: -60, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(65,45,240,0.35) 0%, rgba(65,45,240,0) 65%)',
              animation: 'dw-glow-breathe 4s ease-in-out infinite',
              pointerEvents: 'none',
            }}></div>
            <img src="brand/hero-mark.png" alt="DejaWho" style={{ height: 132, width: 'auto', position: 'relative', display: 'block' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{
              fontFamily: T.font, fontWeight: 700, fontSize: 36,
              color: T.textPrimary, letterSpacing: -0.5, lineHeight: 1,
            }}>DejaWho</div>
            <div style={{
              fontSize: 17, fontWeight: 400, color: T.textSecondary,
              letterSpacing: -0.1, textAlign: 'center',
            }}>
              Remember everyone you've met
            </div>
          </div>
        </div>
      </div>

      {/* CTA stack */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingBottom: 8 }}>
        <CTAButton>
          <span style={{ minWidth: 280, textAlign: 'center' }}>Get Started</span>
        </CTAButton>
        <div style={{ fontSize: 13, color: T.textTertiary, fontWeight: 400 }}>
          No account needed to try
        </div>
      </div>
    </ScreenShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen 2 — How it works
// ─────────────────────────────────────────────────────────────
function ScreenHowItWorks() {
  const steps = [
    { icon: 'mic',      label: 'Meet someone',     desc: 'Speak their name and where you met' },
    { icon: 'search',   label: 'Forget their name', desc: 'Ask DejaWho anything' },
    { icon: 'sparkles', label: 'Get the answer',    desc: 'Instantly, by voice or text' },
  ];
  return (
    <ScreenShell topPad={56}>
      {/* Top nav row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <img src="brand/hero-mark.png" alt="DejaWho" style={{ height: 34, width: 'auto', display: 'block' }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: T.textTertiary }}>Skip</div>
      </div>

      <div style={{ fontSize: 28, fontWeight: 700, color: T.textPrimary, letterSpacing: -0.6, marginBottom: 6 }}>
        How it works
      </div>
      <div style={{ fontSize: 15, color: T.textSecondary, marginBottom: 40 }}>
        Three steps. That's the whole app.
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 36, flex: 1 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16,
              background: T.accentSubtle,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              border: `1px solid ${T.borderSubtle}`,
            }}>
              <Icon name={s.icon} size={24} color={T.accent} strokeWidth={2} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4 }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: T.textTertiary,
                letterSpacing: 1, textTransform: 'uppercase',
              }}>
                Step {i + 1}
              </div>
              <div style={{ fontSize: 19, fontWeight: 600, color: T.textPrimary, letterSpacing: -0.3 }}>
                {s.label}
              </div>
              <div style={{ fontSize: 15, color: T.textSecondary, lineHeight: 1.45 }}>
                {s.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 24, paddingBottom: 16,
      }}>
        <ProgressDots count={3} active={0} />
        <CTAButton size="md" icon="arrow-right" variant="secondary">Next</CTAButton>
      </div>
    </ScreenShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen 3/4 — Try it (Record + Search) share a layout
// ─────────────────────────────────────────────────────────────
function ScreenTryIt({ step, micState = 'default', showResult = false }) {
  const isRecord = step === 'record';
  const stepLabel = isRecord ? 'Step 1 of 2 — Record' : 'Step 2 of 2 — Ask';
  const instruction = isRecord
    ? { icon: 'mic', title: 'Say this out loud', script: 'I met Alex last Friday at a coffee shop and we talked about an app called DejaWho' }
    : { icon: 'sparkles', title: 'Now ask me', script: 'Who did I meet at the coffee shop last week?' };
  const helper = isRecord ? 'Tap and speak — we\'ll do the rest' : 'Tap to ask, listen for the answer';

  // Result card content (shown only on search step done state)
  const resultCard = showResult && (
    <div style={{
      position: 'absolute', bottom: 28, left: 24, right: 24,
      animation: 'dw-fade-up 0.4s cubic-bezier(.2,.7,.3,1)',
    }}>
      <div style={{
        background: T.elevated,
        border: `1px solid ${T.borderDefault}`,
        borderRadius: T.rLg,
        padding: 18,
        display: 'flex', flexDirection: 'column', gap: 10,
        boxShadow: '0 -8px 32px rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: T.success,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="check" size={14} color="#0A1F12" strokeWidth={3} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.success, letterSpacing: 0.2 }}>
              Found it
            </div>
          </div>
          <Icon name="volume" size={16} color={T.textSecondary} />
        </div>
        <div style={{ fontSize: 15, color: T.textPrimary, lineHeight: 1.55 }}>
          You met <b style={{ color: T.textPrimary }}>Alex</b> last Friday at the
          {' '}<span style={{ color: T.textPrimary }}>Coffee Shop</span>. You talked
          about an app called <i>DejaWho</i>.
        </div>
      </div>
    </div>
  );

  // Dim overlay when recording
  const overlay = micState === 'recording' && (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(15,15,18,0.55)',
      pointerEvents: 'none',
    }} />
  );

  // Bottom helper text adapts to state
  const helperText = ({
    default: helper,
    recording: 'Listening… speak naturally',
    processing: 'Working on it…',
    done: isRecord ? 'Saved to your memory' : 'Here\'s what I found',
  })[micState];

  return (
    <ScreenShell topPad={56}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: T.textTertiary,
          letterSpacing: 0.6, textTransform: 'uppercase',
        }}>
          {stepLabel}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.textTertiary }}>Skip</div>
      </div>

      <InstructionCard {...instruction} />

      {/* Mic stage */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 22,
        position: 'relative',
      }}>
        <VoiceButton state={micState} shape="circle" />
        <div style={{
          fontSize: 14, fontWeight: 500,
          color: micState === 'done' ? T.success : T.textSecondary,
          textAlign: 'center', minHeight: 20,
        }}>
          {helperText}
        </div>
      </div>

      {/* Bottom: progress dots */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        paddingBottom: 16,
      }}>
        <ProgressDots count={4} active={isRecord ? 1 : 2} />
      </div>

      {overlay}
      {resultCard}
    </ScreenShell>
  );
}

// ─────────────────────────────────────────────────────────────
// Screen 5 — Complete
// ─────────────────────────────────────────────────────────────
function ScreenComplete() {
  return (
    <ScreenShell topPad={56}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 28,
      }}>
        {/* Animated checkmark with rings */}
        <div style={{ position: 'relative', width: 96, height: 96 }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'rgba(61,214,140,0.12)',
            animation: 'dw-pulse-soft 2.4s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', inset: 12, borderRadius: '50%',
            background: T.success,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 32px rgba(61,214,140,0.35)',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              <path d="M5 12.5l4.5 4.5L19 7"
                stroke="#0A1F12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="60" strokeDashoffset="60"
                style={{ animation: 'dw-draw 0.6s ease-out 0.2s forwards' }}
              />
            </svg>
          </div>
        </div>

        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 30, fontWeight: 700, color: T.textPrimary, letterSpacing: -0.6 }}>
            You're all set
          </div>
          <div style={{ fontSize: 16, color: T.textSecondary, lineHeight: 1.45, maxWidth: 280 }}>
            DejaWho remembers, so you don't have to
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingBottom: 8 }}>
        <CTAButton icon="arrow-right">
          <span style={{ minWidth: 240, textAlign: 'center' }}>Start Remembering</span>
        </CTAButton>
        <div style={{ fontSize: 12, color: T.textTertiary, fontWeight: 400 }}>
          Your trial encounter has been saved
        </div>
      </div>
    </ScreenShell>
  );
}

Object.assign(window, {
  ScreenWelcome, ScreenHowItWorks, ScreenTryIt, ScreenComplete,
});
