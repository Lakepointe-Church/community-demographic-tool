'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { label: 'Overview',    href: '/' },
  { label: 'Demographics', href: '/demographics' },
  { label: 'SES Classes', href: '/ses-classes' },
  { label: 'Compare',     href: '/compare' },
  { label: 'Religious',   href: '/religious' },
  { label: 'Employers',   href: '/employers' },
  { label: 'Comm. Needs', href: '/community-needs' },
  { label: 'Site Scorer', href: '/site-scorer' },
  { label: 'Methodology', href: '/methodology' },
]

function CoverageNavInner() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const isAll = searchParams.get('coverage') === 'all'

  // Preserve ?coverage=all when navigating between pages
  const withCoverage = (href: string) =>
    isAll ? `${href}?coverage=all` : href

  return (
    <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {NAV_ITEMS.map(({ label, href }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={withCoverage(href)}
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
  )
}

export default function CoverageNav() {
  // Fallback renders static nav without coverage awareness (SSR / before hydration)
  return (
    <Suspense fallback={
      <nav style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        {NAV_ITEMS.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className="nav-link-item"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              textDecoration: 'none',
              whiteSpace: 'nowrap' as const,
              color: '#8A98AE',
              padding: '5px 10px',
            }}
          >
            {label}
          </Link>
        ))}
      </nav>
    }>
      <CoverageNavInner />
    </Suspense>
  )
}
