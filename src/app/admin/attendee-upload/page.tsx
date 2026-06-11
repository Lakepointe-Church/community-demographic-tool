'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" }
const SURFACE: React.CSSProperties = {
  background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
  border: '1px solid #232940',
  padding: '24px',
}

export default function AttendeeUploadPage() {
  const [file, setFile]           = useState<File | null>(null)
  const [sourceDate, setSourceDate] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus]       = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [result, setResult]       = useState<{ upserted?: number; error?: string } | null>(null)
  const inputRef                  = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setStatus('uploading')
    setResult(null)

    const form = new FormData()
    form.append('file', file)
    form.append('source_date', sourceDate)

    try {
      const res  = await fetch('/api/attendee-density', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setResult({ error: data.error ?? 'Upload failed' })
      } else {
        setStatus('success')
        setResult({ upserted: data.upserted })
        setFile(null)
        if (inputRef.current) inputRef.current.value = ''
      }
    } catch {
      setStatus('error')
      setResult({ error: 'Network error — check console' })
    }
  }

  return (
    <div style={{ padding: '40px 32px', maxWidth: '900px', margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ ...MONO, fontSize: '11px', letterSpacing: '0.2em', color: '#E8B84B', textTransform: 'uppercase', marginBottom: '12px' }}>
          Admin · Attendee Data
        </div>
        <h1 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: '42px', letterSpacing: '0.04em', lineHeight: 0.95, color: '#F0F2F7', marginBottom: '8px' }}>
          Upload Attendee Density
        </h1>
        <div style={{ ...MONO, fontSize: '12px', color: '#8A98AE', marginTop: '12px' }}>
          Aggregate Rock RMS household counts by ZIP · Internal use only
        </div>
        <Link href="/" style={{ ...MONO, fontSize: '10px', color: '#4EAEFF', textDecoration: 'none', display: 'inline-block', marginTop: '8px' }}>
          ← Back to Overview
        </Link>
      </div>

      {/* Privacy notice */}
      <div style={{ ...SURFACE, borderColor: 'rgba(255,107,107,0.3)', marginBottom: '24px' }}>
        <div style={{ ...MONO, fontSize: '11px', letterSpacing: '0.1em', color: '#FF6B6B', textTransform: 'uppercase', marginBottom: '10px' }}>
          Privacy Requirements (Mandatory)
        </div>
        <ul style={{ ...MONO, fontSize: '11px', color: '#C8D4E4', lineHeight: 1.8, paddingLeft: '16px', margin: 0 }}>
          <li>Export only <strong>aggregated counts per ZIP</strong> from Rock RMS — no names, addresses, or individual records.</li>
          <li>ZIPs with fewer than 5 households will be automatically suppressed on all maps and displays.</li>
          <li>This file is stored in the database and accessible only within this internal tool.</li>
        </ul>
      </div>

      {/* CSV format reference */}
      <div style={{ ...SURFACE, marginBottom: '24px' }}>
        <div style={{ ...MONO, fontSize: '11px', letterSpacing: '0.1em', color: '#A8B4C5', textTransform: 'uppercase', marginBottom: '16px' }}>
          Expected CSV Format
        </div>
        <p style={{ ...MONO, fontSize: '11px', color: '#8A98AE', marginBottom: '12px' }}>
          Header row required. Two formats are accepted:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ ...MONO, fontSize: '10px', color: '#E8B84B', marginBottom: '6px', letterSpacing: '0.08em' }}>
              WITH PER-CAMPUS BREAKDOWN
            </div>
            <div style={{
              background: '#0d0f14', border: '1px solid #1e2b3c',
              padding: '12px 14px', fontSize: '11px',
              ...MONO, color: '#4EAEFF', lineHeight: 1.8,
              whiteSpace: 'pre',
            }}>
{`zip,campus,households
75087,Rockwall,42
75150,Mesquite,18
75087,Rockwall,12`}
            </div>
            <div style={{ ...MONO, fontSize: '10px', color: '#5a6478', marginTop: '6px' }}>
              Rows for the same ZIP are aggregated. Campus column is optional.
            </div>
          </div>

          <div>
            <div style={{ ...MONO, fontSize: '10px', color: '#E8B84B', marginBottom: '6px', letterSpacing: '0.08em' }}>
              TOTAL ONLY (SIMPLER)
            </div>
            <div style={{
              background: '#0d0f14', border: '1px solid #1e2b3c',
              padding: '12px 14px', fontSize: '11px',
              ...MONO, color: '#4EAEFF', lineHeight: 1.8,
              whiteSpace: 'pre',
            }}>
{`zip,households
75087,54
75150,18
75044,31`}
            </div>
            <div style={{ ...MONO, fontSize: '10px', color: '#5a6478', marginTop: '6px' }}>
              One row per ZIP, total household count only.
            </div>
          </div>
        </div>
      </div>

      {/* Upload form */}
      <div style={{ ...SURFACE, marginBottom: '24px' }}>
        <div style={{ ...MONO, fontSize: '11px', letterSpacing: '0.1em', color: '#A8B4C5', textTransform: 'uppercase', marginBottom: '20px' }}>
          Upload File
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ ...MONO, fontSize: '10px', color: '#8A98AE', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              Source Date (export date from Rock RMS)
            </label>
            <input
              type="date"
              value={sourceDate}
              onChange={e => setSourceDate(e.target.value)}
              style={{
                ...MONO, fontSize: '12px',
                background: '#0d0f14', color: '#C8D4E4',
                border: '1px solid #232940', padding: '8px 12px',
                outline: 'none', width: '180px',
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ ...MONO, fontSize: '10px', color: '#8A98AE', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
              CSV File
            </label>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              style={{ ...MONO, fontSize: '12px', color: '#C8D4E4', cursor: 'pointer' }}
            />
          </div>

          {file && (
            <div style={{ ...MONO, fontSize: '10px', color: '#8A98AE', marginBottom: '16px' }}>
              Selected: <span style={{ color: '#4EAEFF' }}>{file.name}</span> · {(file.size / 1024).toFixed(1)} KB
            </div>
          )}

          <button
            type="submit"
            disabled={!file || status === 'uploading'}
            style={{
              ...MONO, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase',
              background: !file || status === 'uploading' ? 'transparent' : 'rgba(232,184,75,0.12)',
              color: !file || status === 'uploading' ? '#3a4154' : '#E8B84B',
              border: `1px solid ${!file || status === 'uploading' ? '#232940' : 'rgba(232,184,75,0.4)'}`,
              padding: '10px 24px', cursor: !file || status === 'uploading' ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'uploading' ? 'Uploading...' : '↑ Upload CSV'}
          </button>
        </form>
      </div>

      {/* Result */}
      {result && (
        <div style={{
          ...SURFACE,
          borderColor: result.error ? 'rgba(255,107,107,0.4)' : 'rgba(45,212,191,0.4)',
        }}>
          {result.error ? (
            <>
              <div style={{ ...MONO, fontSize: '11px', color: '#FF6B6B', marginBottom: '6px' }}>Upload Failed</div>
              <div style={{ ...MONO, fontSize: '12px', color: '#C8D4E4' }}>{result.error}</div>
            </>
          ) : (
            <>
              <div style={{ ...MONO, fontSize: '11px', color: '#2DD4BF', marginBottom: '6px' }}>Upload Complete</div>
              <div style={{ ...MONO, fontSize: '12px', color: '#C8D4E4' }}>
                {result.upserted} ZIP{result.upserted !== 1 ? 's' : ''} upserted. The Overview map attendee overlay will reflect the new data.
              </div>
            </>
          )}
        </div>
      )}

      {/* Footer note */}
      <div style={{ marginTop: '32px', borderTop: '1px solid #1e2b3c', paddingTop: '16px' }}>
        <div style={{ ...MONO, fontSize: '10px', color: '#5a6478', lineHeight: 1.7 }}>
          Data is stored in the Neon PostgreSQL database under the <code>attendee_density</code> table.
          Uploading a new file overwrites existing rows for matching ZIPs.
          ZIPs not present in the upload are not deleted — re-upload the full export each time.
        </div>
      </div>

    </div>
  )
}
