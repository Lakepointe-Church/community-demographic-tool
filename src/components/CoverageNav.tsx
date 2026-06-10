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
]

function CoverageNavInner() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const isAll = searchParams.get('coverage') === 'all'

  // Build href that preserves (or removes) the coverage param
  const withCoverage = (href: string) =>
    isAll ? `${href}?coverage=all` : href

  // Toggle destination — same path, opposite coverage
  const toggleHref = isAll ? pathname : `${pathname}?coverage=all`

  return (
    <>
      {/* Nav links */}
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

      {/* Coverage toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <div style={{ width: '1px', height: '16px', background: '#232940' }} />
        <Link
          href={toggleHref}
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '9px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase' as const,
            textDecoration: 'none',
            padding: '4px 8px',
            borderRadius: '3px',
            whiteSpace: 'nowrap' as const,
            transition: 'all 0.15s ease',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid #232940',
            color: '#8A98AE',
          }}
          title={isAll
            ? 'Switch to Core MSA only (11 counties)'
            : 'Switch to all 370 ZIPs including extended coverage area'}
        >
          {isAll ? 'All ZIPs ▾' : 'Core MSA ▾'}
        </Link>
      </div>
    </>
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
