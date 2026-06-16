/**
 * GET /api/giving?zip=75205
 *
 * Giving-capacity signal from IRS SOI ZIP-level income data (Phase 4.4):
 *   - avgGiftPerGivingReturn: charitable $ ÷ returns that claimed charity
 *   - charitablePerFiler:     charitable $ ÷ all returns
 *   - charitablePctAgi:       charitable $ ÷ total AGI
 *   - itemizerRate:           itemizing returns ÷ all returns (the TCJA caveat —
 *                             post-2017 only ~10% itemize, so deduction data
 *                             skews to higher-income filers; treat as RELATIVE)
 *   - avgAgiPerReturn:        AGI ÷ returns
 *
 * Amounts in the DB are $1000s (IRS convention); this route returns whole dollars.
 * Graceful: { available: false } when the ZIP has no SOI row (IRS suppression).
 */

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get('zip')
  if (!zip) return NextResponse.json({ error: 'zip is required' }, { status: 400 })

  try {
    const rows = await sql`
      SELECT year, total_returns, agi_total, itemizing_returns, charitable_returns, charitable_amount
      FROM zip_income_soi WHERE zip = ${zip} ORDER BY year DESC LIMIT 1
    `
    const r = rows[0]
    if (!r) return NextResponse.json({ available: false, zip })

    const returns   = r.total_returns as number
    const agi       = Number(r.agi_total)          // $1000s
    const itemizers = r.itemizing_returns as number
    const charN     = r.charitable_returns as number
    const charAmt   = Number(r.charitable_amount)  // $1000s

    return NextResponse.json({
      available: true,
      zip,
      year: r.year as number,
      totalReturns: returns,
      itemizerRate: returns > 0 ? parseFloat(((itemizers / returns) * 100).toFixed(1)) : null,
      charitableReturns: charN,
      givingReturnRate: returns > 0 ? parseFloat(((charN / returns) * 100).toFixed(1)) : null,
      avgGiftPerGivingReturn: charN > 0 ? Math.round((charAmt * 1000) / charN) : null,
      charitablePerFiler: returns > 0 ? Math.round((charAmt * 1000) / returns) : null,
      charitablePctAgi: agi > 0 ? parseFloat(((charAmt / agi) * 100).toFixed(2)) : null,
      avgAgiPerReturn: returns > 0 ? Math.round((agi * 1000) / returns) : null,
      totalCharitable: charAmt * 1000,
    })
  } catch (error) {
    console.error('Giving capacity error:', error)
    return NextResponse.json({ error: 'Failed to load giving capacity', details: String(error) }, { status: 500 })
  }
}
