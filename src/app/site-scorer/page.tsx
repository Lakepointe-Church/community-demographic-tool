'use client'

export default function SiteScorerPage() {
  return (
    <div style={{ padding: '40px 32px', maxWidth: '1440px', margin: '0 auto' }}>

      <div style={{ marginBottom: '36px' }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '11px', letterSpacing: '0.2em', color: '#E8B84B', textTransform: 'uppercase', marginBottom: '12px' }}>
          Dashboard · Site Scorer
        </div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(36px,4vw,52px)', letterSpacing: '0.05em', lineHeight: 0.92, color: '#F0F2F7' }}>
          Site<br />Scorer
        </h1>
        <div style={{ width: '48px', height: '2px', background: 'linear-gradient(90deg,#E8B84B,rgba(232,184,75,0))', marginTop: '16px' }} />
      </div>

      <div style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid #232940',
        borderRadius: '4px',
        padding: '48px 40px',
        textAlign: 'center',
        maxWidth: '600px',
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '18px',
          letterSpacing: '0.12em',
          color: '#E8B84B',
          marginBottom: '16px',
        }}>
          COMING IN PHASE 2
        </div>
        <div style={{
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: '14px',
          color: '#8A98AE',
          lineHeight: 1.6,
          marginBottom: '24px',
        }}>
          The Site Scorer will combine YFI, WFI, SES alignment, church saturation, and population growth
          into a single weighted score for each ZIP — with user-adjustable weights and a quadrant view
          of high-growth / low-saturation opportunity areas.
        </div>
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '10px',
          letterSpacing: '0.12em',
          color: '#5a6478',
          textTransform: 'uppercase',
        }}>
          Prerequisite: church saturation index (Phase 2.1)
        </div>
      </div>

    </div>
  )
}
