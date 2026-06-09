import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { ZIP_GROUPS } from '@/lib/zips'

const ZIP_LABEL: Record<string, string> = {}
for (const group of ZIP_GROUPS) {
  for (const z of group.zips) ZIP_LABEL[z.zip] = z.label
}

export async function GET(req: NextRequest) {
  const zip = req.nextUrl.searchParams.get('zip')

  if (zip) {
    // Single ZIP
    const rows = await sql`
      SELECT e.zip, e.total_estab, e.total_emp, e.total_payroll, e.sectors,
             d.population, d.median_household_income
      FROM zip_employers e
      LEFT JOIN zip_demographics d ON d.zip = e.zip
      WHERE e.zip = ${zip}
      LIMIT 1
    `
    if (!rows.length) return NextResponse.json({ error: 'No data' }, { status: 404 })
    const r = rows[0]
    return NextResponse.json({
      zip: r.zip,
      name: ZIP_LABEL[r.zip] ?? r.zip,
      totalEstab: r.total_estab,
      totalEmp: r.total_emp,
      totalPayroll: r.total_payroll,
      sectors: r.sectors ?? [],
      population: r.population,
      medianHouseholdIncome: r.median_household_income,
    })
  }

  // DFW overview — aggregate across all ZIPs
  const rows = await sql`
    SELECT zip, total_estab, total_emp, total_payroll, sectors
    FROM zip_employers
    WHERE total_estab > 0
    ORDER BY total_estab DESC
  `

  let totalEstab = 0, totalEmp = 0, totalPayroll = 0
  const sectorMap: Record<string, number> = {}
  const topZips = rows.slice(0, 20).map(r => ({
    zip: r.zip,
    name: ZIP_LABEL[r.zip] ?? r.zip,
    totalEstab: r.total_estab,
    totalEmp: r.total_emp,
  }))

  for (const r of rows) {
    totalEstab   += r.total_estab ?? 0
    totalEmp     += r.total_emp   ?? 0
    totalPayroll += Number(r.total_payroll ?? 0)
    for (const s of (r.sectors ?? [])) {
      sectorMap[s.label] = (sectorMap[s.label] ?? 0) + s.estab
    }
  }

  const sectors = Object.entries(sectorMap)
    .map(([label, estab]) => ({ label, estab }))
    .sort((a, b) => b.estab - a.estab)

  return NextResponse.json({
    totalEstab,
    totalEmp,
    totalPayroll,
    zipCount: rows.length,
    sectors,
    topZips,
  })
}
