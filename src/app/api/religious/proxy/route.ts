import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { DFW_ZIPS, CORE_MSA_ZIP_SET } from '@/lib/zips'

const LABEL_MAP: Record<string, string> = Object.fromEntries(
  DFW_ZIPS.map(({ zip, label }) => [zip, label])
)

export async function GET(request: NextRequest) {
  const coverage = new URL(request.url).searchParams.get('coverage') ?? 'core'

  try {
    const rows = await sql`
      SELECT zip, population, proxy_born, proxy_language
      FROM zip_demographics
      WHERE proxy_born IS NOT NULL
        AND (proxy_born > 0 OR proxy_language > 0)
        AND population > 0
      ORDER BY proxy_born DESC NULLS LAST
    `

    const filtered = coverage === 'all'
      ? rows
      : rows.filter(r => CORE_MSA_ZIP_SET.has(r.zip as string))

    const data = filtered.map(r => ({
      zip:           r.zip,
      label:         LABEL_MAP[r.zip as string] ?? r.zip,
      population:    r.population as number,
      proxyBorn:     (r.proxy_born as number) ?? 0,
      proxyLanguage: (r.proxy_language as number) ?? 0,
      per1k:         r.population > 0
        ? parseFloat(((r.proxy_born as number ?? 0) / (r.population as number) * 1000).toFixed(1))
        : 0,
    }))

    return NextResponse.json({ rows: data, coverage })
  } catch (err) {
    return NextResponse.json(
      { error: 'proxy_born column not yet populated — run POST /api/refresh', detail: String(err) },
      { status: 503 }
    )
  }
}
