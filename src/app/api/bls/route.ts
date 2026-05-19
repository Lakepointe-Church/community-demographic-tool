import { NextRequest, NextResponse } from 'next/server'

const BLS_API_BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data/'
const BLS_KEY = process.env.BLS_API_KEY

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const area = searchParams.get('area') || 'DFW'

  // DFW Metro series IDs
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

    const results: Record<string, { year: string; period: string; value: string }[]> = {}

    for (const series of data.Results.series) {
      const latest = series.data[0] // Most recent period first
      results[series.seriesID] = {
        latest: latest ? { year: latest.year, period: latest.periodName, value: latest.value } : null,
        history: series.data.slice(0, 12), // Last 12 periods
      }
    }

    return NextResponse.json({
      area,
      unemploymentRate: results['LAUMT481910000000003']?.latest,
      unemployedPersons: results['LAUMT481910000000004']?.latest,
      employedPersons: results['LAUMT481910000000006']?.latest,
      laborForce: results['LAUMT481910000000007']?.latest,
      history: results['LAUMT481910000000003']?.history,
    })
  } catch (error) {
    console.error('BLS API error:', error)
    return NextResponse.json({ error: 'Failed to fetch BLS data', details: String(error) }, { status: 500 })
  }
}