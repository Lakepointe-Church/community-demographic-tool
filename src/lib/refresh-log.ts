/**
 * Records the outcome of a data-refresh run so a failed/partial monthly refresh
 * is no longer silent (Spec v2 Phase 5.4). Writes one row per run to refresh_log;
 * the /admin/status page reads them back.
 *
 * Optional push alert: if REFRESH_ALERT_WEBHOOK is set (e.g. a Slack incoming
 * webhook), a failed run also fires a {text} POST. Unset = no-op, so this layer
 * has zero external dependency — the DB log works on its own.
 *
 * Never throws into the caller — a logging failure must not fail the refresh.
 */

import { sql } from './db'

export interface RefreshRun {
  job: string                       // 'refresh' | 'refresh-community'
  ok: boolean
  durationMs: number
  summary: Record<string, number>   // e.g. { zipsRefreshed, employersRefreshed }
  errors: string[]
}

export async function recordRefreshRun(run: RefreshRun): Promise<void> {
  const errs = run.errors.slice(0, 50) // cap stored payload
  try {
    await sql`
      INSERT INTO refresh_log (job, ok, duration_ms, summary, error_count, errors)
      VALUES (
        ${run.job}, ${run.ok}, ${run.durationMs},
        ${JSON.stringify(run.summary)}::jsonb, ${run.errors.length},
        ${JSON.stringify(errs)}::jsonb
      )
    `
  } catch (e) {
    console.error('recordRefreshRun: failed to write refresh_log', e)
  }

  if (!run.ok && process.env.REFRESH_ALERT_WEBHOOK) {
    try {
      await fetch(process.env.REFRESH_ALERT_WEBHOOK, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          text: `⚠️ CIP data refresh "${run.job}" finished with ${run.errors.length} error(s). First: ${errs[0] ?? 'unknown error'}`,
        }),
      })
    } catch (e) {
      console.error('recordRefreshRun: alert webhook failed', e)
    }
  }
}
