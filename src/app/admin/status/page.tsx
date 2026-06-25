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
    <div style={{ minHeight: '100vh', background: '#323232', color: '#E8DDD0', padding: '32px 24px' }}>
      <style>{`body { margin: 0; } @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500&display=swap');`}</style>

      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontFamily: "'Gotham'", fontSize: 11, letterSpacing: '0.12em', color: '#F04B28', textTransform: 'uppercase', marginBottom: 6 }}>
            Admin · Data Refresh Status
          </div>
          <h1 style={{ fontWeight: 900, fontFamily: "'Gotham',sans-serif", fontSize: 44, margin: '0 0 4px', color: '#E8DDD0', letterSpacing: '0.02em' }}>
            Refresh Log
          </h1>
          <div style={{ fontFamily: "'Gotham'", fontSize: 11, color: '#B4A490' }}>
            Outcome of every <code style={{ color: '#A89A88' }}>/api/refresh</code> and <code style={{ color: '#A89A88' }}>/api/refresh-community</code> run — so a failed monthly refresh isn&apos;t silent.
          </div>
        </div>

        {/* Latest-per-job summary cards */}
        {!loading && lastByJob.size > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${lastByJob.size}, 1fr)`, gap: 14, marginBottom: 28 }}>
            {[...lastByJob.values()].map(r => (
              <div key={r.job} style={{ background: '#3C3C3C', border: `1px solid ${r.ok ? '#1e3a2e' : '#3a1e22'}`, borderRadius: 10, padding: '18px 20px' }}>
                <div style={{ fontFamily: "'Gotham'", fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#A89A88', marginBottom: 8 }}>{r.job}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: r.ok ? '#D4883A' : '#C45A46', display: 'inline-block' }} />
                  <span style={{ fontFamily: "'Gotham',sans-serif", fontSize: 26, color: r.ok ? '#D4883A' : '#C45A46', lineHeight: 1 }}>
                    {r.ok ? 'OK' : `${r.error_count} ERROR${r.error_count === 1 ? '' : 'S'}`}
                  </span>
                </div>
                <div style={{ fontFamily: "'Gotham'", fontSize: 10, color: '#B4A490', marginTop: 8 }}>
                  {relativeTime(r.logged_at)} · {summaryText(r.summary)}
                </div>
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <div style={{ fontFamily: "'Gotham'", fontSize: 12, color: '#B4A490' }}>Loading…</div>
        ) : runs.length === 0 ? (
          <div style={{ background: '#3C3C3C', border: '1px solid #4A4A4A', borderRadius: 10, padding: '24px 28px', fontFamily: "'Gotham'", fontSize: 12, color: '#A89A88' }}>
            No refresh runs recorded yet. The next <code>/api/refresh</code> or <code>/api/refresh-community</code> run will appear here.
          </div>
        ) : (
          <div style={{ background: '#3C3C3C', border: '1px solid #4A4A4A', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Gotham'", fontSize: 11 }}>
              <thead>
                <tr style={{ background: '#323232', color: '#B4A490', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>
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
                      style={{ borderTop: '1px solid #424242', cursor: r.error_count > 0 ? 'pointer' : 'default' }}>
                      <td style={{ padding: '11px 16px', color: '#E8DDD0' }} title={new Date(r.logged_at).toLocaleString()}>{relativeTime(r.logged_at)}</td>
                      <td style={{ padding: '11px 16px', color: '#A89A88' }}>{r.job}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <span style={{ color: r.ok ? '#D4883A' : '#C45A46' }}>
                          {r.ok ? '● OK' : `● ${r.error_count} error${r.error_count === 1 ? '' : 's'}`}
                        </span>
                        {r.error_count > 0 && <span style={{ color: '#B4A490', marginLeft: 8 }}>{expanded === r.id ? '▾' : '▸'}</span>}
                      </td>
                      <td style={{ padding: '11px 16px', color: '#A89A88' }}>{summaryText(r.summary)}</td>
                      <td style={{ padding: '11px 16px', textAlign: 'right', color: '#A89A88' }}>{r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                    </tr>
                    {expanded === r.id && r.errors && r.errors.length > 0 && (
                      <tr style={{ background: '#323232' }}>
                        <td colSpan={5} style={{ padding: '12px 16px' }}>
                          <div style={{ fontFamily: "'Gotham'", fontSize: 10, color: '#C45A46', display: 'flex', flexDirection: 'column', gap: 4 }}>
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

        <div style={{ fontFamily: "'Gotham'", fontSize: 9, color: '#A08E7A', marginTop: 16, lineHeight: 1.6 }}>
          Set <code style={{ color: '#B4A490' }}>REFRESH_ALERT_WEBHOOK</code> (e.g. a Slack incoming webhook) in Vercel to also get a push alert on any failed run.
        </div>
      </div>
    </div>
  )
}
