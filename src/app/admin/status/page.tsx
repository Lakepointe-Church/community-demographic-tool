'use client'

import { Fragment, useEffect, useState } from 'react'

interface RefreshRun {
  id: number
  job: string
  ok: boolean
  duration_ms: number | null
  summary: Record<string, number> | null
  error_count: number
  errors: string[] | null
  logged_at: string
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return `${days}d ago`
}

function summaryText(s: Record<string, number> | null): string {
  if (!s) return '—'
  return Object.entries(s).map(([k, v]) => `${k}: ${v.toLocaleString()}`).join(' · ')
}

export default function StatusPage() {
  const [runs, setRuns] = useState<RefreshRun[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/refresh-log')
      .then(r => r.json())
      .then(d => { setRuns(d.runs ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const lastByJob = new Map<string, RefreshRun>()
  for (const r of runs) if (!lastByJob.has(r.job)) lastByJob.set(r.job, r)

  return (
    <div style={{ minHeight: '100vh', background: '#0d0f14', color: '#C8D4E4', padding: '32px 24px' }}>
      <style>{`body { margin: 0; } @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap');`}</style>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, letterSpacing: '0.12em', color: '#E8B84B', textTransform: 'uppercase', marginBottom: 6 }}>
            Admin · Data Refresh Status
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 44, margin: '0 0 4px', color: '#C8D4E4', letterSpacing: '0.02em' }}>
            Refresh Log
          </h1>
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: '#5a6478' }}>
            Outcome of every <code style={{ color: '#8A98AE' }}>/api/refresh</code> and <code style={{ color: '#8A98AE' }}>/api/refresh-community</code> run — so a failed monthly refresh isn&apos;t silent.
          </div>
        </div>

        {/* Latest-per-job summary cards */}
        {!loading && lastByJob.size > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${lastByJob.size}, 1fr)`, gap: 14, marginBottom: 28 }}>
            {[...lastByJob.values()].map(r => (
              <div key={r.job} style={{ background: '#13161f', border: `1px solid ${r.ok ? '#1e3a2e' : '#3a1e22'}`, borderRadius: 10, padding: '18px 20px' }}>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8A98AE', marginBottom: 8 }}>{r.job}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: r.ok ? '#2DD4BF' : '#FF6B6B', display: 'inline-block' }} />
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, color: r.ok ? '#2DD4BF' : '#FF6B6B', lineHeight: 1 }}>
                    {r.ok ? 'OK' : `${r.error_count} ERROR${r.error_count === 1 ? '' : 'S'}`}
                  </span>
                </div>
                <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#5a6478', marginTop: 8 }}>
                  {relativeTime(r.logged_at)} · {summaryText(r.summary)}
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: '#5a6478' }}>Loading…</div>
        ) : runs.length === 0 ? (
          <div style={{ background: '#13161f', border: '1px solid #232940', borderRadius: 10, padding: '24px 28px', fontFamily: "'IBM Plex Mono',monospace", fontSize: 12, color: '#8A98AE' }}>
            No refresh runs recorded yet. The next <code>/api/refresh</code> or <code>/api/refresh-community</code> run will appear here.
          </div>
        ) : (
          <div style={{ background: '#13161f', border: '1px solid #232940', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'IBM Plex Mono',monospace", fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#0d0f14', color: '#5a6478', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>When</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Job</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px' }}>Summary</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px' }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <Fragment key={r.id}>
                    <tr onClick={() => r.error_count > 0 && setExpanded(expanded === r.id ? null : r.id)}
                      style={{ borderTop: '1px solid #1e2b3c', cursor: r.error_count > 0 ? 'pointer' : 'default' }}>
                      <td style={{ padding: '11px 16px', color: '#C8D4E4' }} title={new Date(r.logged_at).toLocaleString()}>{relativeTime(r.logged_at)}</td>
                      <td style={{ padding: '11px 16px', color: '#8A98AE' }}>{r.job}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ color: r.ok ? '#2DD4BF' : '#FF6B6B' }}>
                          {r.ok ? '● OK' : `● ${r.error_count} error${r.error_count === 1 ? '' : 's'}`}
                        </span>
                        {r.error_count > 0 && <span style={{ color: '#5a6478', marginLeft: 8 }}>{expanded === r.id ? '▾' : '▸'}</span>}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#8A98AE' }}>{summaryText(r.summary)}</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#8A98AE' }}>{r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                    </tr>
                    {expanded === r.id && r.errors && r.errors.length > 0 && (
                      <tr style={{ background: '#0d0f14' }}>
                        <td colSpan={5} style={{ padding: '12px 16px' }}>
                          <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 10, color: '#FF6B6B', display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {r.errors.map((e, i) => <div key={i}>• {e}</div>)}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 9, color: '#3d4a5c', marginTop: 16, lineHeight: 1.6 }}>
          Set <code style={{ color: '#5a6478' }}>REFRESH_ALERT_WEBHOOK</code> (e.g. a Slack incoming webhook) in Vercel to also get a push alert on any failed run.
        </div>
      </div>
    </div>
  )
}
