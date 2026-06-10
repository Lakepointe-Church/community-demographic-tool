'use client'
import CoverageNav from './CoverageNav'

export default function TopNav() {
  return (
    <div style={{
      borderBottom: '1px solid #1e2b3c',
      padding: '0 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '60px',
      background: 'rgba(13,15,20,0.97)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backdropFilter: 'blur(16px)',
      gap: '16px',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '21px', letterSpacing: '0.1em', color: '#E8B84B',
        }}>
          LAKEPOINTE
        </div>
        <div style={{ width: '1px', height: '18px', background: '#232940' }} />
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '10px', letterSpacing: '0.16em', color: '#8A98AE',
          textTransform: 'uppercase' as const,
        }}>
          Community Intelligence
        </div>
      </div>

      {/* Nav links (Suspense-wrapped, coverage-aware) */}
      <CoverageNav />

      {/* Right badge */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '10px', color: '#5a6478', letterSpacing: '0.1em', flexShrink: 0,
      }}>
        DFW · 2026
      </div>
    </div>
  )
}
