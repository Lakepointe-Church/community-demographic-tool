'use client'
import { useState } from 'react'

export function InfoTooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '5px', cursor: 'default', verticalAlign: 'middle' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, display: 'block' }}>
        <circle cx="6.5" cy="6.5" r="5.5" stroke="#3a4861" strokeWidth="1" fill="none" />
        <text x="6.5" y="9.8" textAnchor="middle" fill="#8A98AE" fontFamily="IBM Plex Mono, monospace" fontSize="8" fontWeight="600">i</text>
      </svg>
      {show && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '230px',
          background: '#0d0f14',
          border: '1px solid #232940',
          padding: '10px 12px',
          zIndex: 999,
          boxShadow: '0 4px 24px rgba(0,0,0,0.75)',
          pointerEvents: 'none',
        }}>
          <p style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: '10px',
            color: '#A8B4C5',
            lineHeight: 1.7,
            letterSpacing: '0.02em',
            margin: 0,
          }}>{text}</p>
        </div>
      )}
    </span>
  )
}
