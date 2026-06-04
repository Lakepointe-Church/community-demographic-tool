import { NextResponse } from 'next/server'
import { DFW_ZIPS } from '@/lib/zips'

// Cache boundary data for 24 hours — polygon shapes don't change
export const revalidate = 86400

export async function GET() {
  const zipList = DFW_ZIPS.map(z => `'${z.zip}'`).join(',')
  const where   = encodeURIComponent(`ZCTA5 IN (${zipList})`)

  const url =
    `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/2/query` +
    `?where=${where}&outFields=ZCTA5&f=geojson&outSR=4326`

  try {
    const res  = await fetch(url, { next: { revalidate: 86400 } })
    const data = await res.json()
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600' },
    })
  } catch (error) {
    console.error('Boundaries fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch boundary data' }, { status: 500 })
  }
}
