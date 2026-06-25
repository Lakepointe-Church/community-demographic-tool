'use client'
import { useState } from 'react'

export function InfoTooltip({ text, placement = 'above-center' }: {
  text: string
  placement?: 'above-center' | 'below-right'
}) {
  const [show, setShow] = useState(false)

  const popoverStyle: React.CSSProperties = placement === 'below-right'
    ? { position: 'absolute', top: 'calc(100% + 6px)', right: 0 }
    : { position: 'absolute', bottom: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)' }

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'default' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, display: 'block' }}>
        <circle cx="7" cy="7" r="6" stroke="#4A4A4A" strokeWidth="1" fill="none" />
        <circle cx="7" cy="4.5" r="1" fill="#A89A88" />
        <rect x="6.2" y="6.5" width="1.6" height="4" rx="0.6" fill="#A89A88" />
      </svg>
      {show && (
        <div style={{
          ...popoverStyle,
          width: '230px',
          background: '#3C3C3C',
          border: '1px solid #484848',
          borderRadius: '6px',
          padding: '10px 12px',
          zIndex: 1000,
          boxShadow: '0 8px 32px rgba(0,0,0,0.85)',
          pointerEvents: 'none',
        }}>
          <p style={{
            fontFamily: "'Gotham'",
            fontSize: '10px',
            color: '#C8BCA8',
            lineHeight: 1.7,
            letterSpacing: '0.02em',
            margin: 0,
            whiteSpace: 'pre-line',
          }}>{text}</p>
        </div>
      )}
    </span>
  )
}
