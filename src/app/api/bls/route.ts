import { NextRequest, NextResponse } from 'next/server'

const BLS_API_BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data/'
const BLS_KEY = process.env.BLS_API_KEY

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const area = searchParams.get('area') || 'DFW'

  const seriesIds = [
    'LAUMT481910000000003', // DFW unemployment rate
    'LAUMT481910000000004', // DFW unemployed persons
    'LAUMT481910000000006', // DFW employed persons
    'LAUMT481910000000007', // DFW labor force
  ]

  try {
    const response = await fetch(BLS_API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: seriesIds,
        startyear: '2022',
        endyear: '2024',
        registrationkey: BLS_KEY,
      }),
    })

    const data = await response.json()

    if (data.status !== 'REQUEST_SUCCEEDED') {
      return NextResponse.json({ error: 'BLS request failed', details: data.message }, { status: 500 })
    }

    const series: Record<string, { latest: string; period: string; year: string; history: unknown[] }> = {}

    for (const s of data.Results.series) {
      const latest = s.data[0]
      series[s.seriesID] = {
        latest: latest?.value ?? null,
        period: latest?.periodName ?? null,
        year: latest?.year ?? null,
        history: s.data.slice(0, 12),
      }
    }

    return NextResponse.json({
      area,
      unemploymentRate: series['LAUMT481910000000003'],
      unemployedPersons: series['LAUMT481910000000004'],
      employedPersons: series['LAUMT481910000000006'],
      laborForce: series['LAUMT481910000000007'],
    })
  } catch (error) {
    console.error('BLS API error:', error)
    return NextResponse.json({ error: 'Failed to fetch BLS data', details: String(error) }, { status: 500 })
  }
}