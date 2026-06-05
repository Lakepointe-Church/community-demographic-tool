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

      {/* Nav links */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {NAV_ITEMS.map(({ label, href }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={active ? '' : 'nav-link-item'}
              style={active ? {
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '11px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                textDecoration: 'none',
                whiteSpace: 'nowrap' as const,
                color: '#E8B84B',
                background: 'rgba(232,184,75,0.12)',
                padding: '5px 10px',
                borderRadius: '4px',
                border: '1px solid rgba(232,184,75,0.2)',
                transition: 'all 0.15s ease',
              } : {
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: '11px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                textDecoration: 'none',
                whiteSpace: 'nowrap' as const,
                color: '#8A98AE',
                padding: '5px 10px',
                transition: 'all 0.15s ease',
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
        fontSize: '10px', color: '#5a6478', letterSpacing: '0.1em', flexShrink: 0,
      }}>
        DFW · 2026
      </div>
    </div>
  )
}
