'use client'

import { useEffect, useRef } from 'react'
import type { CampusInfo } from '@/lib/campuses'
import { ordinalRamps, ordinalTextColors, growthTier, GROWTH_THRESHOLDS } from '@/lib/theme'
// Static side-effect import so the bundler extracts + injects this stylesheet
// before the map ever renders. The previous `import(...)` inside an async
// callback (with no `await`) didn't reliably land in time — Mapbox GL warned
// "missing CSS declarations" at runtime, which skews canvas sizing/DPR and,
// in turn, how thin strokes (borders, text halos) actually render.
import 'mapbox-gl/dist/mapbox-gl.css'

// ── Point-in-polygon (ray casting) ──────────────────────────────────────────
function pointInRing(pt: [number, number], ring: number[][]): boolean {
  const [x, y] = pt
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function inIsochrone(pt: [number, number], fc: GeoJSON.FeatureCollection): boolean {
  for (const f of fc.features) {
    const g = f.geometry
    if (!g) continue
    if (g.type === 'Polygon') {
      if (pointInRing(pt, (g as GeoJSON.Polygon).coordinates[0] as number[][])) return true
    } else if (g.type === 'MultiPolygon') {
      for (const poly of (g as GeoJSON.MultiPolygon).coordinates) {
        if (pointInRing(pt, poly[0] as number[][])) return true
      }
    }
  }
  return false
}

interface ZipRow {
  zip: string
  label: string
  population: number
  populationGrowth: number | null
  medianHouseholdIncome: number
  hhWithChildrenPct: number | null
}

export interface AttendeeZip {
  zip:                      string
  households:               number   // -1 = suppressed (<5 households)
  censusHH?:                number | null
  penetrationPct?:          number | null
  county?:                  string | null
  attendeesPer1kUnclaimed?: number | null
  campusBreakdown?:         Record<string, number> | null
  primaryCampus?:           string | null
}

interface Props {
  zipData:           ZipRow[]
  loading:           boolean
  campuses?:         CampusInfo[]
  attendeeData?:     AttendeeZip[]
  showAttendees?:    boolean
  campusColorMap?:   Record<string, string>   // campus name → hex color
  activeCampuses?:   Set<string> | null       // null = show all; Set = filter to these
  isochroneGeoJson?:    GeoJSON.FeatureCollection | null
  candidateIsochrone?:  GeoJSON.FeatureCollection | null  // candidate-pin isochrone only, for cannibalization
  isochroneMinutes?:    number
  candidatePin?:        { lng: number; lat: number } | null
  onMapClick?:          (coords: { lng: number; lat: number }) => void
  onCannibalizationResult?: (r: { totalHH: number; zipCount: number } | null) => void
}

// Popup text color — uses the AA-legible tier counterparts, not the fill ramp.
function growthColor(g: number | null): string {
  const tier = growthTier(g)
  return tier ? ordinalTextColors.growth[tier] : '#A89A88'
}

// ── Compute simple centroid from a GeoJSON Polygon/MultiPolygon ───────────────
function computeCentroid(geometry: GeoJSON.Geometry): [number, number] | null {
  let coords: number[][] = []
  if (geometry.type === 'Polygon') {
    coords = geometry.coordinates[0]
  } else if (geometry.type === 'MultiPolygon') {
    coords = geometry.coordinates[0][0]
  }
  if (!coords.length) return null
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length
  return [lng, lat]
}

export default function MapboxChoropleth({
  zipData,
  loading,
  campuses                  = [],
  attendeeData              = [],
  showAttendees             = false,
  campusColorMap            = {},
  activeCampuses            = null,
  isochroneGeoJson          = null,
  candidateIsochrone        = null,
  isochroneMinutes,
  candidatePin              = null,
  onMapClick,
  onCannibalizationResult,
}: Props) {
  const containerRef      = useRef<HTMLDivElement>(null)
  const mapRef            = useRef<unknown>(null)
  const markersRef        = useRef<mapboxgl.Marker[]>([])
  const pinMarkerRef      = useRef<mapboxgl.Marker | null>(null)
  const zctaCentroidsRef  = useRef<Record<string, [number, number]>>({})
  const zctaLabelsRef     = useRef<Record<string, string>>({})

  // ── Main map initialization (runs once after data loads) ────────────────────
  useEffect(() => {
    if (!containerRef.current || loading || !zipData.length) return
    if (mapRef.current) return

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return

    let map: mapboxgl.Map

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      mapboxgl.accessToken = token

      map = new mapboxgl.Map({
        container: containerRef.current!,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-96.82, 32.90],
        zoom: 8.8,
        attributionControl: false,
      })

      map.addControl(new mapboxgl.AttributionControl({ compact: true }))
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

      mapRef.current = map

      map.on('load', async () => {
        // ── ZCTA choropleth ───────────────────────────────────────────────────
        const res     = await fetch('/api/boundaries')
        const geojson = await res.json()

        const zipMap = Object.fromEntries(zipData.map(z => [z.zip, z]))

        const enriched: GeoJSON.FeatureCollection = {
          ...geojson,
          features: (geojson.features ?? []).map((f: GeoJSON.Feature) => {
            const zcta = f.properties?.ZCTA5 as string
            const d    = zipMap[zcta]
            return {
              ...f,
              properties: {
                ...f.properties,
                label:      d?.label ?? zcta,
                growth:     d?.populationGrowth ?? null,
                population: d?.population ?? 0,
                hhi:        d?.medianHouseholdIncome ?? 0,
                hhChildren: d?.hhWithChildrenPct ?? null,
              },
            }
          }),
        }

        map.addSource('zctas', { type: 'geojson', data: enriched })

        // Compute and cache centroids + labels for cannibalization checks
        for (const f of enriched.features) {
          const zcta = f.properties?.ZCTA5 as string
          if (!zcta || !f.geometry) continue
          const c = computeCentroid(f.geometry as GeoJSON.Geometry)
          if (c) zctaCentroidsRef.current[zcta] = c
          if (f.properties?.label) zctaLabelsRef.current[zcta] = f.properties.label as string
        }

        // Google Maps-style light basemap: tint the land background + water bodies
        // (stakeholder hexes). Water is what shows through the gaps where ZCTA
        // polygons don't cover open water (lakes/reservoirs).
        if (map.getLayer('background')) {
          map.setPaintProperty('background', 'background-color', '#F4F2F2')
        }
        if (map.getLayer('water')) {
          map.setPaintProperty('water', 'fill-color', '#6E8794')
        }

        // Insert the choropleth beneath the basemap's symbol layers so city/place
        // names render on top of the (fully opaque) ZIP fills.
        const firstSymbolId = map.getStyle()?.layers?.find(l => l.type === 'symbol')?.id

        map.addLayer({
          id:     'zcta-fill',
          type:   'fill',
          source: 'zctas',
          paint:  {
            'fill-color': [
              'case',
              ['==', ['get', 'growth'], null], ordinalRamps.growth.noData,
              ['>=', ['get', 'growth'], GROWTH_THRESHOLDS.rapidGrowth], ordinalRamps.growth.rapidGrowth,
              ['>=', ['get', 'growth'], GROWTH_THRESHOLDS.growing],     ordinalRamps.growth.growing,
              ['>=', ['get', 'growth'], GROWTH_THRESHOLDS.stable],      ordinalRamps.growth.stable,
              ordinalRamps.growth.declining,
            ],
            'fill-opacity': 1,
          },
        }, firstSymbolId)

        map.addLayer({
          id:     'zcta-fill-hover',
          type:   'fill',
          source: 'zctas',
          paint:  {
            // Light basemap — hover tint darkens instead of the old white-on-dark wash.
            'fill-color':   '#000000',
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.08, 0],
          },
        }, firstSymbolId)

        map.addLayer({
          id:     'zcta-border',
          type:   'line',
          source: 'zctas',
          paint:  { 'line-color': '#5C6B75', 'line-width': 1 },
        }, firstSymbolId)

        // Near-black basemap labels, NO white halo. The paint override was always
        // landing (devtools verified #2B2B2B) — what read as "white text" was the
        // near-opaque white halo we were forcing: at map label sizes the outline
        // swallows the thin dark glyph core and the label reads white. Per Jolie:
        // dark font, no white stroke. Each property set is wrapped independently
        // so one rejected layer/property can't abort the rest of the loop.
        for (const layer of map.getStyle()?.layers ?? []) {
          if (layer.type !== 'symbol') continue
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (!(layer as any).layout?.['text-field']) continue
          if (layer.id === 'zcta-label') continue // already themed explicitly below
          try { map.setPaintProperty(layer.id, 'text-color', '#1A1A1A') } catch { /* unsupported on this layer */ }
          try { map.setPaintProperty(layer.id, 'text-halo-width', 0) } catch { /* unsupported on this layer */ }
        }

        map.addLayer({
          id:     'zcta-label',
          type:   'symbol',
          source: 'zctas',
          layout: {
            'text-field':       ['concat', ['get', 'ZCTA5'], '\n', ['get', 'label']],
            'text-size':        9,
            'text-font':        ['DIN Pro Medium', 'Arial Unicode MS Regular'],
            'text-line-height': 1.3,
            'text-anchor':      'center',
          },
          paint: {
            // Near-black, no white stroke — matches the basemap label treatment.
            'text-color':      '#1A1A1A',
            'text-halo-width': 0,
          },
          minzoom: 9,
        })

        // ── Isochrone placeholder layer (populated via separate effect) ───────
        map.addSource('isochrone', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id:     'isochrone-fill',
          type:   'fill',
          source: 'isochrone',
          paint:  {
            'fill-color':   ['get', 'color'],
            'fill-opacity': 0.18,
          },
        })
        map.addLayer({
          id:     'isochrone-border',
          type:   'line',
          source: 'isochrone',
          paint:  {
            'line-color':   ['get', 'color'],
            'line-width':   2,
            'line-opacity': 0.7,
          },
        })

        // ── Attendee circles placeholder layer ────────────────────────────────
        map.addSource('attendees', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        })
        map.addLayer({
          id:     'attendee-circles',
          type:   'circle',
          source: 'attendees',
          paint:  {
            // campusColor is pre-computed per feature from the campusColorMap prop
            'circle-color':        ['coalesce', ['get', 'campusColor'], '#F04B28'],
            'circle-opacity':      0.82,
            'circle-stroke-color': ['coalesce', ['get', 'campusColor'], '#F04B28'],
            'circle-stroke-width': 1.5,
            'circle-stroke-opacity': 1,
            'circle-radius': [
              'interpolate', ['linear'], ['get', 'households'],
              5, 6, 50, 14, 200, 28, 500, 44,
            ],
          },
          layout: { visibility: 'none' },
        })

        // ── Hover popup ───────────────────────────────────────────────────────
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'cip-popup',
        })

        let hoveredId: string | number | null = null

        map.on('mousemove', 'zcta-fill', (e) => {
          if (!e.features?.length) return
          map.getCanvas().style.cursor = onMapClick ? 'crosshair' : 'pointer'

          const f  = e.features[0]
          const id = f.id

          if (hoveredId !== null && hoveredId !== id) {
            map.setFeatureState({ source: 'zctas', id: hoveredId }, { hover: false })
          }
          hoveredId = id ?? null
          if (hoveredId !== null) {
            map.setFeatureState({ source: 'zctas', id: hoveredId }, { hover: true })
          }

          const g        = f.properties?.growth
          const color    = growthColor(g)
          const growthStr = g != null ? `${g > 0 ? '↑' : '↓'} ${Math.abs(g)}% since 2020` : '—'

          popup.setLngLat(e.lngLat).setHTML(`
            <div style="font-family:'Gotham';min-width:180px">
              <div style="font-size:13px;color:#FFFFFF;font-weight:600;margin-bottom:6px">
                ${f.properties?.ZCTA5} · ${f.properties?.label}
              </div>
              <div style="font-size:10px;color:${color};margin-bottom:4px">${growthStr}</div>
              <div style="font-size:10px;color:#9BA5B7">Pop: ${Number(f.properties?.population).toLocaleString()}</div>
              <div style="font-size:10px;color:#9BA5B7">Median HHI: $${Number(f.properties?.hhi).toLocaleString()}</div>
              ${f.properties?.hhChildren != null
                ? `<div style="font-size:10px;color:#9BA5B7">HH w/ Children: ${f.properties.hhChildren}%</div>`
                : ''}
            </div>
          `).addTo(map)
        })

        map.on('mouseleave', 'zcta-fill', () => {
          map.getCanvas().style.cursor = ''
          popup.remove()
          if (hoveredId !== null) {
            map.setFeatureState({ source: 'zctas', id: hoveredId }, { hover: false })
            hoveredId = null
          }
        })

        // ── Attendee circle popup ─────────────────────────────────────────────
        const attendeePopup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'cip-popup',
        })

        // Hover: quick summary (campus name + count)
        map.on('mousemove', 'attendee-circles', (e) => {
          if (!e.features?.length) return
          map.getCanvas().style.cursor = 'pointer'
          const p      = e.features[0].properties as Record<string, unknown>
          const campus = p.primaryCampus ? String(p.primaryCampus) : null
          const color  = p.campusColor   ? String(p.campusColor)   : '#F04B28'
          attendeePopup.setLngLat(e.lngLat).setHTML(`
            <div style="font-family:'Gotham';min-width:160px">
              <div style="font-size:12px;color:#FFFFFF;font-weight:600;margin-bottom:4px">${p.label ?? p.zip}</div>
              <div style="font-size:10px;color:#A89A88;margin-bottom:6px">${p.zip}</div>
              <div style="font-size:10px;color:#E8DDD0;margin-bottom:3px">${Number(p.households).toLocaleString()} attendee households</div>
              ${campus ? `<div style="font-size:10px;color:${color};margin-top:4px">Primary: ${campus}</div>` : ''}
              <div style="font-size:10px;color:#B4A490;margin-top:6px">Click for campus breakdown</div>
            </div>
          `).addTo(map)
        })

        map.on('mouseleave', 'attendee-circles', () => {
          map.getCanvas().style.cursor = ''
          attendeePopup.remove()
        })

        // Click: full campus breakdown popup (persistent, has close button)
        const clickPopup = new mapboxgl.Popup({
          closeButton:  true,
          closeOnClick: false,
          className:    'cip-popup',
          maxWidth:     '260px',
        })

        let circleClicked = false

        map.on('click', 'attendee-circles', (e) => {
          if (!e.features?.length) return
          circleClicked = true
          attendeePopup.remove()

          const p = e.features[0].properties as Record<string, unknown>
          const pct   = p.penetration != null ? `${Number(p.penetration).toFixed(2)}%` : null
          const color = p.campusColor ? String(p.campusColor) : '#F04B28'

          // Parse campus breakdown (was JSON-stringified for GeoJSON storage)
          let breakdownRows = ''
          try {
            const bd = JSON.parse(String(p.campusBreakdown ?? '{}')) as Record<string, number>
            const sorted = Object.entries(bd).sort(([, a], [, b]) => b - a)
            breakdownRows = sorted.map(([campus, hh]) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,0.06)">
                <span style="font-size:10px;color:#E8DDD0">${campus}</span>
                <span style="font-size:10px;color:${color};font-weight:600">${hh.toLocaleString()} HH</span>
              </div>
            `).join('')
          } catch { /* no breakdown */ }

          clickPopup.setLngLat(e.lngLat).setHTML(`
            <div style="font-family:'Gotham';min-width:220px">
              <div style="font-size:13px;color:#FFFFFF;font-weight:600;margin-bottom:2px">${p.label ?? p.zip}</div>
              <div style="font-size:10px;color:#A89A88;margin-bottom:12px">${p.zip}${pct ? ` · ${pct} of census HH` : ''}</div>
              <div style="font-size:10px;letter-spacing:0.1em;color:#B4A490;text-transform:uppercase;margin-bottom:6px">Campus Attendance</div>
              ${breakdownRows || `<div style="font-size:10px;color:#B4A490">No breakdown available</div>`}
              <div style="margin-top:8px;font-size:11px;color:#F04B28;font-weight:600">${Number(p.households).toLocaleString()} total households</div>
            </div>
          `).addTo(map)
        })

        // ── Click-to-drop pin (skip if circle was just clicked) ───────────────
        map.on('click', (e) => {
          if (circleClicked) { circleClicked = false; return }
          onMapClick?.({ lng: e.lngLat.lng, lat: e.lngLat.lat })
        })

        // ── Campus markers (added here so they render after load) ─────────────
        addCampusMarkers(map, mapboxgl)
      })
    })

    return () => {
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []
      pinMarkerRef.current?.remove()
      pinMarkerRef.current = null
      if (mapRef.current) {
        (mapRef.current as mapboxgl.Map).remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // ── Campus markers helper ───────────────────────────────────────────────────
  function addCampusMarkers(map: mapboxgl.Map, mapboxgl: typeof import('mapbox-gl').default) {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    campuses.forEach(campus => {
      const isExisting = campus.status === 'existing'
      const el = document.createElement('div')
      el.style.cssText = `
        width: ${isExisting ? 14 : 12}px;
        height: ${isExisting ? 14 : 12}px;
        border-radius: 50%;
        background: ${isExisting ? '#F04B28' : '#A89A88'};
        border: none;
        cursor: pointer;
        box-shadow: 0 0 ${isExisting ? '8px' : '4px'} ${isExisting ? 'rgba(240,75,40,0.6)' : 'rgba(0,0,0,0.5)'};
      `

      const popup = new mapboxgl.Popup({ closeButton: false, offset: 14 }).setHTML(`
        <div style="font-family:'Gotham'">
          <div style="font-size:11px;color:${isExisting ? '#F04B28' : '#A89A88'};font-weight:600;margin-bottom:4px">
            ${isExisting ? '● EXISTING CAMPUS' : '◌ COMING SOON'}
          </div>
          <div style="font-size:13px;color:#FFFFFF">Lakepointe · ${campus.label}</div>
          <div style="font-size:10px;color:#9BA5B7;margin-top:2px">ZIP ${campus.zip}</div>
        </div>
      `)

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([campus.lng, campus.lat])
        .setPopup(popup)
        .addTo(map)

      markersRef.current.push(marker)
    })
  }

  // ── Isochrone layer update ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current as mapboxgl.Map | null
    if (!map || !map.isStyleLoaded?.()) return
    const src = map.getSource('isochrone') as mapboxgl.GeoJSONSource | undefined
    if (!src) return

    if (!isochroneGeoJson) {
      src.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    // Assign colors based on drive-time order (outermost = lightest).
    // Brand orange is chrome/campus-marker-only (spec v2) — not used for rings.
    const colors = ['#7AA3AA', '#D4883A', '#E8DDD0']
    const features = isochroneGeoJson.features.map((f, i) => ({
      ...f,
      properties: { ...f.properties, color: colors[i % colors.length] },
    }))

    src.setData({ ...isochroneGeoJson, features })
  }, [isochroneGeoJson])

  // ── Attendee circles update ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current as mapboxgl.Map | null
    if (!map || !map.isStyleLoaded?.()) return
    const src = map.getSource('attendees') as mapboxgl.GeoJSONSource | undefined
    if (!src) return

    map.setLayoutProperty('attendee-circles', 'visibility', showAttendees ? 'visible' : 'none')

    if (!showAttendees || !attendeeData.length) return

    // Use centroids cached during map init; recompute as fallback if not yet populated
    if (!Object.keys(zctaCentroidsRef.current).length) {
      const boundariesSrc = map.getSource('zctas') as mapboxgl.GeoJSONSource | undefined
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const boundaryData = (boundariesSrc as any)?._data as GeoJSON.FeatureCollection | null
      if (boundaryData?.features?.length) {
        for (const f of boundaryData.features) {
          const zcta = f.properties?.ZCTA5 as string
          if (!zcta || !f.geometry) continue
          const c = computeCentroid(f.geometry as GeoJSON.Geometry)
          if (c) zctaCentroidsRef.current[zcta] = c
          if (f.properties?.label) zctaLabelsRef.current[zcta] = f.properties.label as string
        }
      }
    }
    if (!Object.keys(zctaCentroidsRef.current).length) return

    const features: GeoJSON.Feature[] = attendeeData
      .filter(a => a.households !== -1)
      .filter(a => {
        if (!activeCampuses) return true
        return a.primaryCampus ? activeCampuses.has(a.primaryCampus) : false
      })
      .map(a => {
        const coords = zctaCentroidsRef.current[a.zip]
        if (!coords) return null
        const campusColor = a.primaryCampus
          ? (campusColorMap[a.primaryCampus] ?? '#F04B28')
          : '#F04B28'
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: coords },
          properties: {
            zip:                     a.zip,
            label:                   zctaLabelsRef.current[a.zip] ?? a.zip,
            households:              a.households,
            penetration:             a.penetrationPct ?? null,
            attendeesPer1kUnclaimed: a.attendeesPer1kUnclaimed ?? null,
            primaryCampus:           a.primaryCampus ?? null,
            campusColor,
            campusBreakdown:         a.campusBreakdown
              ? JSON.stringify(a.campusBreakdown)
              : null,
          },
        } as GeoJSON.Feature
      })
      .filter(Boolean) as GeoJSON.Feature[]

    src.setData({ type: 'FeatureCollection', features })
  }, [attendeeData, showAttendees, campusColorMap, activeCampuses])

  // ── Cannibalization check ────────────────────────────────────────────────────
  // When a candidate pin isochrone is active, compute how many existing attendee
  // households fall within that drive-time polygon.
  useEffect(() => {
    if (!candidateIsochrone || !attendeeData.length) {
      onCannibalizationResult?.(null)
      return
    }
    const centroids = zctaCentroidsRef.current
    if (!Object.keys(centroids).length) {
      onCannibalizationResult?.(null)
      return
    }
    let totalHH = 0, zipCount = 0
    for (const a of attendeeData) {
      if (a.households === -1) continue
      const c = centroids[a.zip]
      if (!c) continue
      if (inIsochrone(c, candidateIsochrone)) {
        totalHH += a.households
        zipCount++
      }
    }
    onCannibalizationResult?.(totalHH > 0 ? { totalHH, zipCount } : null)
  }, [candidateIsochrone, attendeeData, onCannibalizationResult])

  // ── Candidate pin update ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current as mapboxgl.Map | null
    if (!map) return

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      pinMarkerRef.current?.remove()
      pinMarkerRef.current = null

      if (!candidatePin) return

      const el = document.createElement('div')
      el.style.cssText = `
        width: 16px; height: 16px; border-radius: 50%;
        background: #7A9E8A; border: none;
        box-shadow: 0 0 10px rgba(122,158,138,0.7);
        cursor: pointer;
      `

      const popup = new mapboxgl.Popup({ closeButton: false, offset: 14 }).setHTML(`
        <div style="font-family:'Gotham'">
          <div style="font-size:11px;color:#7A9E8A;font-weight:600;margin-bottom:4px">◎ CANDIDATE SITE</div>
          <div style="font-size:10px;color:#9BA5B7">${candidatePin.lat.toFixed(4)}°N, ${Math.abs(candidatePin.lng).toFixed(4)}°W</div>
        </div>
      `)

      pinMarkerRef.current = new mapboxgl.Marker({ element: el })
        .setLngLat([candidatePin.lng, candidatePin.lat])
        .setPopup(popup)
        .addTo(map)
    })
  }, [candidatePin])

  return (
    <>
      <style>{`
        .mapboxgl-popup-content {
          background: #1e2433 !important;
          border: 1px solid #2a3044 !important;
          border-radius: 0 !important;
          padding: 12px 16px !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
        }
        .mapboxgl-popup-tip { display: none !important; }
        .mapboxgl-ctrl-group { background: #3C3C3C !important; border: 1px solid #1e2433 !important; }
        .mapboxgl-ctrl-group button { background: #3C3C3C !important; }
        .mapboxgl-ctrl-group button:hover { background: #1e2433 !important; }
        .mapboxgl-ctrl-icon { filter: invert(1) opacity(0.6); }
        .mapboxgl-ctrl-attrib { background: transparent !important; }
        .mapboxgl-ctrl-attrib a { color: #3a4154 !important; font-size: 8px !important; }
      `}</style>
      <div style={{ position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: '#3C3C3C',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: "'Gotham'", fontSize: '10px', color: '#6B7689', letterSpacing: '0.12em' }}>
              LOADING MAP DATA...
            </span>
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '500px' }} />

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 24, left: 16,
          background: 'rgba(50,50,50,0.88)',
          border: '1px solid #1e2433',
          padding: '10px 14px',
          display: 'flex', gap: '16px', alignItems: 'center',
          backdropFilter: 'blur(8px)',
          flexWrap: 'wrap',
        }}>
          {[
            { label: 'Declining',    color: ordinalRamps.growth.declining },
            { label: 'Stable',       color: ordinalRamps.growth.stable },
            { label: 'Growing',      color: ordinalRamps.growth.growing },
            { label: 'Rapid Growth', color: ordinalRamps.growth.rapidGrowth },
            { label: 'No Data',      color: ordinalRamps.growth.noData },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 10, height: 10, background: color, border: '1px solid rgba(255,255,255,0.25)' }} />
              <span style={{ fontFamily: "'Gotham'", fontSize: '10px', color: '#9BA5B7', letterSpacing: '0.06em' }}>{label}</span>
            </div>
          ))}
          {campuses.some(c => c.status === 'existing') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F04B28' }} />
              <span style={{ fontFamily: "'Gotham'", fontSize: '10px', color: '#9BA5B7', letterSpacing: '0.06em' }}>Campus</span>
            </div>
          )}
          {showAttendees && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(240,75,40,0.75)', border: '1px solid #F04B28' }} />
              <span style={{ fontFamily: "'Gotham'", fontSize: '10px', color: '#9BA5B7', letterSpacing: '0.06em' }}>Attendees</span>
            </div>
          )}
          {isochroneGeoJson && isochroneMinutes && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 16, height: 3, background: '#7AA3AA' }} />
              <span style={{ fontFamily: "'Gotham'", fontSize: '10px', color: '#9BA5B7', letterSpacing: '0.06em' }}>{isochroneMinutes}-min drive</span>
            </div>
          )}
          <span style={{ fontFamily: "'Gotham'", fontSize: '8px', color: '#3a4154', marginLeft: '8px' }}>
            Zoom in to see ZIP labels
          </span>
        </div>

        {/* Click-to-pin hint */}
        {onMapClick && (
          <div style={{
            position: 'absolute', top: 12, left: 12,
            background: 'rgba(50,50,50,0.88)', border: '1px solid rgba(122,158,138,0.4)',
            padding: '6px 12px',
            fontFamily: "'Gotham'", fontSize: '10px',
            color: '#7A9E8A', letterSpacing: '0.08em',
            backdropFilter: 'blur(8px)',
          }}>
            CLICK MAP TO PLACE CANDIDATE SITE
          </div>
        )}
      </div>
    </>
  )
}
