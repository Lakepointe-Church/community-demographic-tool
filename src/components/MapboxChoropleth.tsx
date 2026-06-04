'use client'

import { useEffect, useRef } from 'react'

interface ZipRow {
  zip: string
  label: string
  population: number
  populationGrowth: number | null
  medianHouseholdIncome: number
  hhWithChildrenPct: number | null
}

interface Props {
  zipData: ZipRow[]
  loading: boolean
}

function growthColor(g: number | null): string {
  if (g == null) return '#2a3044'
  if (g >= 20)   return '#2DD4BF'
  if (g >= 8)    return '#4EAEFF'
  if (g >= 0)    return '#3a4561'
  return '#FF6B6B'
}

export default function MapboxChoropleth({ zipData, loading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<unknown>(null)

  useEffect(() => {
    if (!containerRef.current || loading || !zipData.length) return
    if (mapRef.current) return // already initialized

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) return

    let map: mapboxgl.Map

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      import('mapbox-gl/dist/mapbox-gl.css' as never)
      mapboxgl.accessToken = token

      map = new mapboxgl.Map({
        container: containerRef.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-96.82, 32.90],
        zoom: 8.8,
        attributionControl: false,
      })

      map.addControl(new mapboxgl.AttributionControl({ compact: true }))
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')

      mapRef.current = map

      map.on('load', async () => {
        // Fetch ZCTA boundary polygons
        const res     = await fetch('/api/boundaries')
        const geojson = await res.json()

        // Join growth + demographic data to GeoJSON features
        const zipMap = Object.fromEntries(zipData.map(z => [z.zip, z]))

        const enriched = {
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

        // Fill — color by growth rate
        map.addLayer({
          id: 'zcta-fill',
          type: 'fill',
          source: 'zctas',
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'growth'], null], '#2a3044',
              ['>=', ['get', 'growth'], 20],   '#2DD4BF',
              ['>=', ['get', 'growth'], 8],    '#4EAEFF',
              ['>=', ['get', 'growth'], 0],    '#3a4561',
              '#FF6B6B',
            ],
            'fill-opacity': 0.72,
          },
        })

        // Hover highlight
        map.addLayer({
          id: 'zcta-fill-hover',
          type: 'fill',
          source: 'zctas',
          paint: {
            'fill-color': '#ffffff',
            'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.15, 0],
          },
        })

        // Borders
        map.addLayer({
          id: 'zcta-border',
          type: 'line',
          source: 'zctas',
          paint: { 'line-color': '#0d0f14', 'line-width': 1.5 },
        })

        // ZIP label layer
        map.addLayer({
          id: 'zcta-label',
          type: 'symbol',
          source: 'zctas',
          layout: {
            'text-field': ['concat', ['get', 'ZCTA5'], '\n', ['get', 'label']],
            'text-size': 9,
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
            'text-line-height': 1.3,
            'text-anchor': 'center',
          },
          paint: {
            'text-color': 'rgba(255,255,255,0.65)',
            'text-halo-color': 'rgba(0,0,0,0.3)',
            'text-halo-width': 1,
          },
          minzoom: 9,
        })

        // Popup on hover
        const popup = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          className: 'cip-popup',
        })

        let hoveredId: string | number | null = null

        map.on('mousemove', 'zcta-fill', (e) => {
          if (!e.features?.length) return
          map.getCanvas().style.cursor = 'pointer'

          const f  = e.features[0]
          const id = f.id

          if (hoveredId !== null && hoveredId !== id) {
            map.setFeatureState({ source: 'zctas', id: hoveredId }, { hover: false })
          }
          hoveredId = id ?? null
          if (hoveredId !== null) {
            map.setFeatureState({ source: 'zctas', id: hoveredId }, { hover: true })
          }

          const g     = f.properties?.growth
          const color = growthColor(g)
          const growthStr = g != null ? `${g > 0 ? '↑' : '↓'} ${Math.abs(g)}% since 2020` : '—'

          popup.setLngLat(e.lngLat).setHTML(`
            <div style="font-family:'IBM Plex Mono',monospace;min-width:180px">
              <div style="font-size:13px;color:#F0F2F7;font-weight:600;margin-bottom:6px">
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
      })
    })

    return () => {
      if (mapRef.current) {
        (mapRef.current as mapboxgl.Map).remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

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
        .mapboxgl-ctrl-group { background: #13161f !important; border: 1px solid #1e2433 !important; }
        .mapboxgl-ctrl-group button { background: #13161f !important; }
        .mapboxgl-ctrl-group button:hover { background: #1e2433 !important; }
        .mapboxgl-ctrl-icon { filter: invert(1) opacity(0.6); }
        .mapboxgl-ctrl-attrib { background: transparent !important; }
        .mapboxgl-ctrl-attrib a { color: #3a4154 !important; font-size: 8px !important; }
      `}</style>
      <div style={{ position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 10,
            background: '#13161f',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px', color: '#6B7689', letterSpacing: '0.12em' }}>
              LOADING MAP DATA...
            </span>
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '500px' }} />

        {/* Legend */}
        <div style={{
          position: 'absolute', bottom: 24, left: 16,
          background: 'rgba(13,15,20,0.88)',
          border: '1px solid #1e2433',
          padding: '10px 14px',
          display: 'flex', gap: '16px', alignItems: 'center',
          backdropFilter: 'blur(8px)',
        }}>
          {[
            { label: 'Declining',    color: '#FF6B6B' },
            { label: 'Stable',       color: '#3a4561' },
            { label: 'Growing',      color: '#4EAEFF' },
            { label: 'Rapid Growth', color: '#2DD4BF' },
          ].map(({ label, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 10, height: 10, background: color }} />
              <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '9px', color: '#9BA5B7', letterSpacing: '0.06em' }}>{label}</span>
            </div>
          ))}
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '8px', color: '#3a4154', marginLeft: '8px' }}>
            Zoom in to see ZIP labels
          </span>
        </div>
      </div>
    </>
  )
}
