'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { label: 'Overview',    href: '/' },
  { label: 'Demographics', href: '/demographics' },
  { label: 'SES Classes', href: '/ses-classes' },
  { label: 'Compare',     href: '/compare' },
  { label: 'Religious',   href: '/religious' },
  { label: 'Employers',   href: '/employers' },
  { label: 'Site Scorer', href: '/site-scorer' },
]

export default function TopNav() {
  const pathname = usePathname()

  return (
    <div style={{
      borderBottom: '1px solid #1a1f2e',
      padding: '0 32px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '54px',
      background: 'rgba(13,15,20,0.96)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      backdropFilter: 'blur(12px)',
      gap: '16px',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: '20px', letterSpacing: '0.1em', color: '#E8B84B',
        }}>
          LAKEPOINTE
        </div>
        <div style={{ width: '1px', height: '18px', background: '#1e2433' }} />
        <div style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: '9px', letterSpacing: '0.18em', color: '#6B7689',
          textTransform: 'uppercase' as const,
        }}>
          Community Intelligence
        </div>
      </div>

      {/* Nav links */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {NAV_ITEMS.map(({ label, href }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              style={{
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '10px', letterSpacing: '0.12em',
                textTransform: 'uppercase' as const,
                color: active ? '#E8B84B' : '#6B7689',
                padding: '6px 2px',
                borderBottom: active ? '2px solid #E8B84B' : '2px solid transparent',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap' as const,
                textDecoration: 'none',
              }}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Right badge */}
      <div style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: '9px', color: '#6B7689', letterSpacing: '0.1em', flexShrink: 0,
      }}>
        DFW · 2026
      </div>
    </div>
  )
}
