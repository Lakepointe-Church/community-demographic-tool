'use client'

import { useState, useEffect } from 'react'
import { DFW_ZIPS } from '@/lib/zips'

interface Decision {
  id: number
  zip: string
  area: string | null
  fit_score: number | null
  scenario_url: string | null
  notes: string | null
  decided_by: string | null
  logged_at: string
}

const LABEL_MAP = Object.fromEntries(DFW_ZIPS.map(z => [z.zip, z.label]))

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [saved, setSaved]         = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const [zip, setZip]             = useState('')
  const [notes, setNotes]         = useState('')
  const [decidedBy, setDecidedBy] = useState('')

  useEffect(() => { loadDecisions() }, [])

  function loadDecisions() {
    setLoading(true)
    fetch('/api/decisions')
      .then(r => r.json())
      .then(d => { setDecisions(d.decisions ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!/^\d{5}$/.test(zip)) { setError('Enter a valid 5-digit ZIP'); return }
    setSubmitting(true)
    setError(null)

    const scenarioUrl = window.location.origin + '/site-scorer'
    const area = LABEL_MAP[zip] ?? null

    const res = await fetch('/api/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ zip, area, scenarioUrl, notes, decidedBy }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error ?? 'Failed to save'); setSubmitting(false); return }

    setZip(''); setNotes(''); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setSubmitting(false)
    loadDecisions()
  }

  const inputStyle: React.CSSProperties = {
    fontFamily: "'Gotham'", fontSize: 12,
    background: '#323232', color: '#E8DDD0',
    border: '1px solid #4A4A4A', borderRadius: 4,
    padding: '8px 12px', outline: 'none', width: '100%', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#323232', color: '#E8DDD0', padding: '32px 24px' }}>
      <style>{`body { margin: 0; } @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap');`}</style>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "'Gotham'", fontSize: 11, letterSpacing: '0.12em', color: '#F04B28', textTransform: 'uppercase', marginBottom: 6 }}>
            Admin · Site Decisions
          </div>
          <h1 style={{ fontWeight: 900, fontFamily: "'Gotham',sans-serif", fontSize: 44, margin: '0 0 4px', color: '#E8DDD0', letterSpacing: '0.02em' }}>
            Decision Log
          </h1>
          <div style={{ fontFamily: "'Gotham'", fontSize: 11, color: '#B4A490' }}>
            Record site decisions for future retrospective — revisit in 2 years.
          </div>
        </div>

        {/* Log new decision */}
        <div style={{ background: '#3C3C3C', border: '1px solid #4A4A4A', borderRadius: 10, padding: '24px 28px', marginBottom: 28 }}>
          <div style={{ fontFamily: "'Gotham'", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A89A88', marginBottom: 16 }}>
            Log a Decision
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontFamily: "'Gotham'", fontSize: 10, color: '#B4A490', display: 'block', marginBottom: 4 }}>ZIP *</label>
                <input
                  value={zip}
                  onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="75087"
                  maxLength={5}
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <label style={{ fontFamily: "'Gotham'", fontSize: 10, color: '#B4A490', display: 'block', marginBottom: 4 }}>Your name</label>
                <input
                  value={decidedBy}
                  onChange={e => setDecidedBy(e.target.value)}
                  placeholder="Paul / Jolie / ..."
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={{ fontFamily: "'Gotham'", fontSize: 10, color: '#B4A490', display: 'block', marginBottom: 4 }}>
                  Area {zip && LABEL_MAP[zip] ? <span style={{ color: '#F04B28' }}>· {LABEL_MAP[zip]}</span> : null}
                </label>
                <input value={LABEL_MAP[zip] ?? ''} readOnly style={{ ...inputStyle, color: '#B4A490' }} />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontFamily: "'Gotham'", fontSize: 10, color: '#B4A490', display: 'block', marginBottom: 4 }}>Notes — why this site? what's the context?</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. High YFI + low saturation; aligns with Collin County expansion strategy; leadership visit 2026-07"
                style={{ ...inputStyle, resize: 'vertical' as const }}
              />
            </div>
            {error && (
              <div style={{ fontFamily: "'Gotham'", fontSize: 11, color: '#C45A46', marginBottom: 10 }}>{error}</div>
            )}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  fontFamily: "'Gotham'", fontSize: 11,
                  background: 'rgba(240,75,40,0.1)', border: '1px solid rgba(240,75,40,0.4)',
                  borderRadius: 4, color: '#F04B28', padding: '8px 20px', cursor: 'pointer',
                  opacity: submitting ? 0.6 : 1,
                }}
              >{submitting ? 'Saving…' : 'Log Decision'}</button>
              {saved && (
                <span style={{ fontFamily: "'Gotham'", fontSize: 11, color: '#D4883A' }}>✓ Saved</span>
              )}
              <span style={{ fontFamily: "'Gotham'", fontSize: 10, color: '#A08E7A', marginLeft: 'auto' }}>
                Scenario URL auto-captured from current Site Scorer state
              </span>
            </div>
          </form>
        </div>

        {/* History table */}
        <div style={{ background: '#3C3C3C', border: '1px solid #4A4A4A', borderRadius: 10, padding: '24px 28px' }}>
          <div style={{ fontFamily: "'Gotham'", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A89A88', marginBottom: 16 }}>
            Decision History · {decisions.length} entries
          </div>
          {loading ? (
            <div style={{ fontFamily: "'Gotham'", fontSize: 12, color: '#B4A490' }}>Loading…</div>
          ) : decisions.length === 0 ? (
            <div style={{ fontFamily: "'Gotham'", fontSize: 12, color: '#A08E7A', padding: '24px 0' }}>
              No decisions logged yet. Use the form above to record the first one.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Gotham'", fontSize: 11 }}>
                <thead>
                  <tr>
                    {['Date', 'ZIP', 'Area', 'Score', 'By', 'Notes', 'Scenario'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 10px 10px', color: '#B4A490', fontWeight: 400, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', borderBottom: '1px solid #424242', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {decisions.map(d => (
                    <tr key={d.id} style={{ borderBottom: '1px solid #1a1f2e' }}>
                      <td style={{ padding: '8px 10px', color: '#B4A490', whiteSpace: 'nowrap' }}>
                        {new Date(d.logged_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#F04B28' }}>{d.zip}</td>
                      <td style={{ padding: '8px 10px', color: '#C8BCA8', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.area ?? '—'}</td>
                      <td style={{ padding: '8px 10px', color: d.fit_score != null ? '#F04B28' : '#A08E7A', textAlign: 'right' }}>{d.fit_score ?? '—'}</td>
                      <td style={{ padding: '8px 10px', color: '#A89A88' }}>{d.decided_by ?? '—'}</td>
                      <td style={{ padding: '8px 10px', color: '#A89A88', maxWidth: 280, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.notes ?? '—'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        {d.scenario_url ? (
                          <a href={d.scenario_url} style={{ fontFamily: "'Gotham'", fontSize: 10, color: '#7AA3AA', textDecoration: 'none' }}>Open →</a>
                        ) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
