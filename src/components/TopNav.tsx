'use client'
import CoverageNav from './CoverageNav'

export default function TopNav() {
  return (
    <div style={{
      borderBottom: '1px solid #424242',
      padding: '0 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '60px',
      background: 'rgba(50,50,50,0.97)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backdropFilter: 'blur(16px)',
      gap: '16px',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        <div style={{
          fontFamily: "'Gotham', sans-serif",
          fontWeight: 900,
          fontSize: '21px', letterSpacing: '0.1em', color: '#F04B28',
        }}>
          LAKEPOINTE
        </div>
        <div style={{ width: '1px', height: '18px', background: '#4A4A4A' }} />
        <div style={{
          fontFamily: "'Gotham'",
          fontSize: '10px', letterSpacing: '0.16em', color: '#FFFFFF',
          textTransform: 'uppercase' as const,
        }}>
          Community Intelligence
        </div>
      </div>

      {/* Nav links (Suspense-wrapped, coverage-aware) */}
      <CoverageNav />

      {/* Right badge */}
      <div style={{
        fontFamily: "'Gotham'",
        fontSize: '10px', color: '#B4A490', letterSpacing: '0.1em', flexShrink: 0,
      }}>
        DFW · 2026
      </div>
    </div>
  )
}
