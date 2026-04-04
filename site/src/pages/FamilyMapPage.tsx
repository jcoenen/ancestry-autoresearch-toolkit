import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, ZoomControl, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import 'leaflet.heat'
import { usePeople, useGeocodedLocations, extractYear } from '../useData'
import type { Person } from '../types'
import FamilyFilterDropdown from '../components/FamilyFilterDropdown'

/* ── Types ───────────────────────────────────────────────────── */

type EventType = 'birth' | 'death' | 'marriage' | 'burial' | 'residence' | 'immigration' | 'emigration'
type ViewMode = 'markers' | 'heatmap'

interface MapEvent {
  id: string
  personId: string
  personName: string
  personSlug: string
  family: string
  type: EventType
  location: string
  coords: [number, number]
  year: number | null
  dateStr: string
}

interface MigrationPath {
  personId: string
  personName: string
  personSlug: string
  family: string
  from: [number, number]
  to: [number, number]
  fromLabel: string
  toLabel: string
  birthYear: number | null
  deathYear: number | null
}

/* ── Event colors & labels ───────────────────────────────────── */

const EVENT_CONFIG: Record<EventType, { color: string; bg: string; text: string; border: string; label: string }> = {
  birth:       { color: '#10b981', bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', label: 'Born' },
  death:       { color: '#ef4444', bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200',     label: 'Died' },
  marriage:    { color: '#a855f7', bg: 'bg-purple-50',   text: 'text-purple-700',  border: 'border-purple-200',  label: 'Married' },
  burial:      { color: '#78716c', bg: 'bg-stone-100',   text: 'text-stone-600',   border: 'border-stone-300',   label: 'Buried' },
  residence:   { color: '#3b82f6', bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200',    label: 'Resided' },
  immigration: { color: '#f59e0b', bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200',   label: 'Immigrated' },
  emigration:  { color: '#14b8a6', bg: 'bg-teal-50',     text: 'text-teal-700',    border: 'border-teal-200',    label: 'Emigrated' },
}

const FAMILY_COLORS = [
  '#b45309', '#0369a1', '#9333ea', '#be123c', '#15803d',
  '#c2410c', '#1d4ed8', '#7e22ce', '#a21caf', '#166534',
  '#92400e', '#0284c7', '#6d28d9', '#e11d48', '#047857',
]

/* ── Marker icons ────────────────────────────────────────────── */

function createMarkerIcon(type: EventType): L.DivIcon {
  const color = EVENT_CONFIG[type].color
  return L.divIcon({
    className: '',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
    html: `<div style="
      width: 14px; height: 14px; border-radius: 50%;
      background: ${color}; border: 2px solid white;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    "></div>`,
  })
}

const MARKER_ICONS: Record<EventType, L.DivIcon> = {
  birth:       createMarkerIcon('birth'),
  death:       createMarkerIcon('death'),
  marriage:    createMarkerIcon('marriage'),
  burial:      createMarkerIcon('burial'),
  residence:   createMarkerIcon('residence'),
  immigration: createMarkerIcon('immigration'),
  emigration:  createMarkerIcon('emigration'),
}

/* ── Extract map events from people ──────────────────────────── */

function extractMapEvents(
  people: Person[],
  geocoded: Record<string, [number, number] | null>,
): MapEvent[] {
  const events: MapEvent[] = []

  function tryAdd(person: Person, type: EventType, location: string, dateStr: string) {
    if (!location) return
    const coords = geocoded[location]
    if (!coords) return
    events.push({
      id: `${person.id}-${type}`,
      personId: person.id,
      personName: person.name,
      personSlug: person.slug,
      family: person.family,
      type,
      location,
      coords,
      year: extractYear(dateStr || ''),
      dateStr: dateStr || '',
    })
  }

  for (const p of people) {
    if (p.privacy) continue
    tryAdd(p, 'birth', p.birthplace, p.born)
    tryAdd(p, 'death', p.deathPlace, p.died)
    tryAdd(p, 'burial', p.burial, p.died)
    tryAdd(p, 'residence', p.residence, '')
    tryAdd(p, 'immigration', p.immigration, '')
    tryAdd(p, 'emigration', p.emigration, '')

    for (const sp of p.spouses) {
      if (!sp.marriageDate) continue
      if (sp.id && sp.id < p.id) continue
      const yearMatch = sp.marriageDate.match(/(\d{4})/)
      if (yearMatch) {
        const afterYear = sp.marriageDate.slice(sp.marriageDate.indexOf(yearMatch[1]) + 4).replace(/^[,\s]+/, '')
        if (afterYear) {
          tryAdd(p, 'marriage', afterYear, sp.marriageDate)
        }
      }
    }
  }

  return events
}

/* ── Extract migration paths ─────────────────────────────────── */

function extractMigrationPaths(
  people: Person[],
  geocoded: Record<string, [number, number] | null>,
): MigrationPath[] {
  const paths: MigrationPath[] = []
  for (const p of people) {
    if (p.privacy) continue
    const from = p.birthplace && geocoded[p.birthplace]
    const to = p.deathPlace && geocoded[p.deathPlace]
    if (!from || !to) continue
    // Skip if same location
    if (from[0] === to[0] && from[1] === to[1]) continue
    paths.push({
      personId: p.id,
      personName: p.name,
      personSlug: p.slug,
      family: p.family,
      from,
      to,
      fromLabel: p.birthplace,
      toLabel: p.deathPlace,
      birthYear: extractYear(p.born),
      deathYear: extractYear(p.died),
    })
  }
  return paths
}

/* ── MarkerCluster component ─────────────────────────────────── */

function MarkerClusterLayer({ events }: { events: MapEvent[] }) {
  const map = useMap()
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)

  useEffect(() => {
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current)
    }

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      chunkedLoading: true,
    })

    for (const event of events) {
      const marker = L.marker(event.coords, { icon: MARKER_ICONS[event.type] })
      const cfg = EVENT_CONFIG[event.type]
      marker.bindPopup(`
        <div style="min-width: 180px; font-family: system-ui, sans-serif;">
          <span style="
            display: inline-block; font-size: 11px; font-weight: 600;
            padding: 1px 8px; border-radius: 9999px;
            background: ${cfg.color}20; color: ${cfg.color};
            margin-bottom: 4px;
          ">${cfg.label}</span>
          <div style="font-size: 14px; font-weight: 600; color: #292524; margin-top: 2px;">
            ${event.personName}
          </div>
          ${event.dateStr ? `<div style="font-size: 12px; color: #78716c; margin-top: 2px;">${event.dateStr}</div>` : ''}
          <div style="font-size: 12px; color: #a8a29e; margin-top: 1px;">${event.location}</div>
          <a href="/people/${event.personSlug}" style="
            display: inline-block; margin-top: 6px;
            font-size: 12px; color: #b45309; font-weight: 500;
            text-decoration: none;
          ">View profile &rarr;</a>
        </div>
      `, { closeButton: false })
      cluster.addLayer(marker)
    }

    map.addLayer(cluster)
    clusterRef.current = cluster

    if (events.length > 0) {
      const bounds = L.latLngBounds(events.map(e => e.coords))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
    }

    return () => {
      map.removeLayer(cluster)
    }
  }, [map, events])

  return null
}

/* ── Heat map layer ──────────────────────────────────────────── */

function HeatMapLayer({ events }: { events: MapEvent[] }) {
  const map = useMap()
  const layerRef = useRef<L.Layer | null>(null)

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current)
    }

    const points: [number, number, number][] = events.map(e => [e.coords[0], e.coords[1], 1])
    const layer = L.heatLayer(points, {
      radius: 25,
      blur: 15,
      maxZoom: 10,
      gradient: { 0.2: '#ffffb2', 0.4: '#fd8d3c', 0.6: '#f03b20', 0.8: '#bd0026', 1.0: '#800026' },
    })

    map.addLayer(layer)
    layerRef.current = layer

    if (events.length > 0) {
      const bounds = L.latLngBounds(events.map(e => e.coords))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
    }

    return () => {
      map.removeLayer(layer)
    }
  }, [map, events])

  return null
}

/* ── FitBounds helper ────────────────────────────────────────── */

function FitBounds({ events }: { events: MapEvent[] }) {
  const map = useMap()
  const prevLengthRef = useRef(events.length)

  useEffect(() => {
    if (events.length === prevLengthRef.current) return
    prevLengthRef.current = events.length
    if (events.length > 0) {
      const bounds = L.latLngBounds(events.map(e => e.coords))
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
    }
  }, [map, events])

  return null
}

/* ── Migration line arc helper ───────────────────────────────── */

function getArcPoints(from: [number, number], to: [number, number]): [number, number][] {
  const points: [number, number][] = []
  const midLat = (from[0] + to[0]) / 2
  const midLng = (from[1] + to[1]) / 2
  // Offset the midpoint perpendicular to the line for a curve effect
  const dx = to[1] - from[1]
  const dy = to[0] - from[0]
  const dist = Math.sqrt(dx * dx + dy * dy)
  const offset = dist * 0.15
  const offsetLat = midLat + (dx / dist) * offset
  const offsetLng = midLng - (dy / dist) * offset

  const steps = 20
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    // Quadratic bezier
    const lat = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * offsetLat + t * t * to[0]
    const lng = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * offsetLng + t * t * to[1]
    points.push([lat, lng])
  }
  return points
}

/* ── Year range slider ───────────────────────────────────────── */

function YearRangeSlider({
  min, max, value, onChange,
}: {
  min: number; max: number
  value: [number, number]
  onChange: (v: [number, number]) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px] text-stone-400">
        <span>{value[0]}</span>
        <span>{value[1]}</span>
      </div>
      <div className="relative h-5">
        <input
          type="range"
          min={min}
          max={max}
          value={value[0]}
          onChange={e => {
            const v = Number(e.target.value)
            if (v <= value[1]) onChange([v, value[1]])
          }}
          className="absolute w-full h-1 top-2 appearance-none bg-stone-200 rounded pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value[1]}
          onChange={e => {
            const v = Number(e.target.value)
            if (v >= value[0]) onChange([value[0], v])
          }}
          className="absolute w-full h-1 top-2 appearance-none bg-transparent rounded pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10"
        />
      </div>
    </div>
  )
}

/* ── Time animation controls ─────────────────────────────────── */

function useTimeAnimation(min: number, max: number, step: number) {
  const [playing, setPlaying] = useState(false)
  const [currentYear, setCurrentYear] = useState(max)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const play = useCallback(() => {
    setPlaying(true)
    setCurrentYear(min)
  }, [min])

  const pause = useCallback(() => {
    setPlaying(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    pause()
    setCurrentYear(max)
  }, [pause, max])

  useEffect(() => {
    if (!playing) return
    intervalRef.current = setInterval(() => {
      setCurrentYear(prev => {
        const next = prev + step
        if (next > max) {
          setPlaying(false)
          return max
        }
        return next
      })
    }, 800)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [playing, max, step])

  return { playing, currentYear, play, pause, reset }
}

/* ── Sidebar filter panel content (shared between desktop & mobile) ── */

function FilterContent({
  filtered, allEvents, typeFilter, toggleType, familyFilter, setFamilyFilter,
  families, counts, yearRange, setYearRange, yearBounds,
  showMigrationLines, setShowMigrationLines, migrationCount,
  viewMode, setViewMode,
  animation,
}: {
  filtered: MapEvent[]
  allEvents: MapEvent[]
  typeFilter: Set<EventType>
  toggleType: (t: EventType) => void
  familyFilter: Set<string>
  setFamilyFilter: (s: Set<string>) => void
  families: string[]
  counts: Record<string, number>
  yearRange: [number, number]
  setYearRange: (r: [number, number]) => void
  yearBounds: [number, number]
  showMigrationLines: boolean
  setShowMigrationLines: (v: boolean) => void
  migrationCount: number
  viewMode: ViewMode
  setViewMode: (v: ViewMode) => void
  animation: ReturnType<typeof useTimeAnimation>
}) {
  const ALL_TYPES: EventType[] = ['birth', 'death', 'marriage', 'burial', 'residence', 'immigration', 'emigration']

  return (
    <div className="space-y-4">
      {/* Event type toggles */}
      <div>
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Event Types</h3>
        <div className="space-y-1">
          {ALL_TYPES.map(type => {
            const active = typeFilter.has(type)
            const cfg = EVENT_CONFIG[type]
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors text-left ${
                  active ? `${cfg.bg} ${cfg.text}` : 'text-stone-400 hover:bg-stone-50'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: active ? cfg.color : '#d6d3d1' }}
                />
                {cfg.label}
                <span className="text-xs opacity-60 ml-auto">{counts[type]}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Family filter */}
      <div>
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Family Line</h3>
        <FamilyFilterDropdown
          families={families}
          selected={familyFilter}
          onChange={setFamilyFilter}
        />
      </div>

      {/* Year range slider */}
      <div>
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Time Period</h3>
        <YearRangeSlider
          min={yearBounds[0]}
          max={yearBounds[1]}
          value={yearRange}
          onChange={setYearRange}
        />
      </div>

      {/* Time animation */}
      <div>
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Time Animation</h3>
        <div className="flex items-center gap-2">
          {animation.playing ? (
            <button
              onClick={animation.pause}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
              Pause
            </button>
          ) : (
            <button
              onClick={animation.play}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
            >
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              Play
            </button>
          )}
          <button
            onClick={animation.reset}
            className="px-2.5 py-1.5 rounded-md text-xs font-medium text-stone-500 hover:bg-stone-50 border border-stone-200"
          >
            Reset
          </button>
          {animation.playing && (
            <span className="text-xs font-mono text-amber-700 ml-auto">{animation.currentYear}</span>
          )}
        </div>
      </div>

      {/* View mode toggle */}
      <div>
        <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">View Mode</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('markers')}
            className={`flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'markers'
                ? 'bg-stone-800 text-white'
                : 'text-stone-500 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            Markers
          </button>
          <button
            onClick={() => setViewMode('heatmap')}
            className={`flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'heatmap'
                ? 'bg-stone-800 text-white'
                : 'text-stone-500 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            Heat Map
          </button>
        </div>
      </div>

      {/* Migration lines toggle */}
      {viewMode === 'markers' && (
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showMigrationLines}
              onChange={e => setShowMigrationLines(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-stone-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm text-stone-600">
              Migration paths
              <span className="text-xs text-stone-400 ml-1">({migrationCount})</span>
            </span>
          </label>
        </div>
      )}

      {/* Legend */}
      <div className="pt-2 border-t border-stone-100">
        <p className="text-[10px] text-stone-400">
          Click markers for details. Zoom in to separate clustered events.
        </p>
      </div>
    </div>
  )
}

/* ── Main page ───────────────────────────────────────────────── */

export default function FamilyMapPage() {
  const people = usePeople()
  const geocoded = useGeocodedLocations()
  const allEvents = useMemo(() => extractMapEvents(people, geocoded), [people, geocoded])
  const allMigrations = useMemo(() => extractMigrationPaths(people, geocoded), [people, geocoded])

  // Filters
  const [typeFilter, setTypeFilter] = useState<Set<EventType>>(new Set(['birth', 'death', 'marriage']))
  const [familyFilter, setFamilyFilter] = useState<Set<string>>(new Set())
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showMigrationLines, setShowMigrationLines] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('markers')

  // Year bounds from data
  const yearBounds = useMemo<[number, number]>(() => {
    const years = allEvents.map(e => e.year).filter((y): y is number => y !== null)
    if (years.length === 0) return [1800, 2026]
    return [Math.min(...years), Math.max(...years)]
  }, [allEvents])
  const [yearRange, setYearRange] = useState<[number, number]>(yearBounds)
  // Sync year range when bounds change
  useEffect(() => { setYearRange(yearBounds) }, [yearBounds])

  const animation = useTimeAnimation(yearBounds[0], yearBounds[1], 10)

  const families = useMemo(() => {
    const set = new Set(people.map(p => p.family).filter(Boolean))
    return Array.from(set).sort()
  }, [people])

  // Build family-to-color map for migration lines
  const familyColorMap = useMemo(() => {
    const map = new Map<string, string>()
    families.forEach((f, i) => map.set(f, FAMILY_COLORS[i % FAMILY_COLORS.length]))
    return map
  }, [families])

  const filtered = useMemo(() => {
    const effectiveMaxYear = animation.playing ? animation.currentYear : yearRange[1]
    const effectiveMinYear = animation.playing ? yearBounds[0] : yearRange[0]
    return allEvents.filter(e => {
      if (!typeFilter.has(e.type)) return false
      if (familyFilter.size > 0 && !familyFilter.has(e.family)) return false
      if (e.year !== null) {
        if (e.year < effectiveMinYear || e.year > effectiveMaxYear) return false
      }
      return true
    })
  }, [allEvents, typeFilter, familyFilter, yearRange, animation.playing, animation.currentYear, yearBounds])

  const filteredMigrations = useMemo(() => {
    return allMigrations.filter(m => {
      if (familyFilter.size > 0 && !familyFilter.has(m.family)) return false
      const effectiveMaxYear = animation.playing ? animation.currentYear : yearRange[1]
      const effectiveMinYear = animation.playing ? yearBounds[0] : yearRange[0]
      // Show migration if either birth or death falls in range
      if (m.birthYear !== null && m.birthYear > effectiveMaxYear) return false
      if (m.deathYear !== null && m.deathYear < effectiveMinYear) return false
      return true
    })
  }, [allMigrations, familyFilter, yearRange, animation.playing, animation.currentYear, yearBounds])

  const toggleType = (type: EventType) => {
    setTypeFilter(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const ALL_TYPES: EventType[] = ['birth', 'death', 'marriage', 'burial', 'residence', 'immigration', 'emigration']

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const type of ALL_TYPES) c[type] = 0
    for (const e of allEvents) {
      if (familyFilter.size > 0 && !familyFilter.has(e.family)) continue
      c[e.type]++
    }
    return c
  }, [allEvents, familyFilter])

  const filterProps = {
    filtered, allEvents, typeFilter, toggleType, familyFilter, setFamilyFilter,
    families, counts, yearRange, setYearRange, yearBounds,
    showMigrationLines, setShowMigrationLines, migrationCount: filteredMigrations.length,
    viewMode, setViewMode, animation,
  }

  return (
    <div className="relative" style={{ height: 'calc(100vh - 3.5rem)' }}>
      {/* Filter panel — desktop sidebar */}
      <div className="hidden sm:block absolute top-0 left-0 z-10 w-60 h-full bg-white/95 backdrop-blur-sm border-r border-stone-200 overflow-y-auto">
        <div className="p-4 space-y-4">
          <div>
            <h1 className="text-lg font-bold text-stone-800">Family Map</h1>
            <p className="text-xs text-stone-500 mt-0.5">
              {filtered.length} events from {new Set(filtered.map(e => e.personId)).size} people
            </p>
          </div>
          <FilterContent {...filterProps} />
        </div>
      </div>

      {/* Filter panel — mobile floating button + overlay */}
      <div className="sm:hidden absolute top-3 left-3 z-10">
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg shadow-md border border-stone-200 text-sm font-medium text-stone-700"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
          {(typeFilter.size < ALL_TYPES.length || familyFilter.size > 0) && (
            <span className="w-2 h-2 bg-amber-500 rounded-full" />
          )}
        </button>
        {filtersOpen && (
          <div className="absolute top-full left-0 mt-2 w-72 max-h-[70vh] overflow-y-auto bg-white rounded-lg shadow-lg border border-stone-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-stone-800">Filters</h3>
              <button onClick={() => setFiltersOpen(false)} className="text-stone-400 hover:text-stone-600">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <FilterContent {...filterProps} />
          </div>
        )}
      </div>

      {/* Time animation year indicator */}
      {animation.playing && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white/90 backdrop-blur-sm rounded-lg shadow-md border border-amber-200 px-4 py-2">
          <span className="text-2xl font-bold text-amber-700 font-mono">{animation.currentYear}</span>
        </div>
      )}

      {/* Map */}
      <MapContainer
        center={[45, -40]}
        zoom={3}
        className="w-full h-full isolate"
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="topright" />

        {viewMode === 'markers' ? (
          <MarkerClusterLayer events={filtered} />
        ) : (
          <HeatMapLayer events={filtered} />
        )}

        {/* Migration lines */}
        {viewMode === 'markers' && showMigrationLines && filteredMigrations.map(m => (
          <Polyline
            key={m.personId}
            positions={getArcPoints(m.from, m.to)}
            pathOptions={{
              color: familyColorMap.get(m.family) || '#b45309',
              weight: 2,
              opacity: 0.6,
              dashArray: '6 4',
            }}
          >
          </Polyline>
        ))}

        <FitBounds events={filtered} />
      </MapContainer>
    </div>
  )
}
