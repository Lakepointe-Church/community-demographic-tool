import { NextRequest, NextResponse } from 'next/server'

const CACHE_TTL_MS = 1000 * 60 * 60 * 6 // 6 hours — isochrones don't change often

// Simple in-memory cache (resets on cold start; fine for infrequent use)
const cache = new Map<string, { data: unknown; expiresAt: number }>()

// GET /api/isochrone?lng=...&lat=...&minutes=20,25,30&profile=driving-traffic
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const lng     = searchParams.get('lng')
  const lat     = searchParams.get('lat')
  const minutes = searchParams.get('minutes') ?? '15,20,30'
  const profile = searchParams.get('profile') ?? 'driving-traffic'

  if (!lng || !lat) {
    return NextResponse.json({ error: 'lng and lat are required' }, { status: 400 })
  }

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'Mapbox token not configured' }, { status: 500 })
  }

  const cacheKey = `${lng},${lat},${minutes},${profile}`
  const cached   = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data)
  }

  // Mapbox Isochrone API v1
  // Docs: https://docs.mapbox.com/api/navigation/isochrone/
  const url = `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}`
    + `?contours_minutes=${minutes}`
    + `&polygons=true`
    + `&denoise=1`
    + `&generalize=50`
    + `&access_token=${token}`

  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json(
      { error: `Mapbox Isochrone API error ${res.status}`, detail: text },
      { status: 502 }
    )
  }

  const data = await res.json()
  cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS })

  return NextResponse.json(data)
}
