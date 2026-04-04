import { Link } from 'react-router-dom'
import { useSiteConfig } from '../useData'

interface Feature {
  title: string
  path: string
  description: string
  details: string[]
}

const features: Feature[] = [
  {
    title: 'Interactive Family Tree',
    path: '/tree',
    description: 'Explore your ancestry through four different tree views, each designed for a different way of thinking about family relationships.',
    details: [
      'Ancestors — Vertical expanding tree. Click chevrons to reveal parents and grandparents generation by generation. Auto-expands 2 generations on load.',
      'Full Pedigree — See the entire known ancestry at once using an auto-laid-out top-to-bottom graph. Blue lines trace paternal lines, pink traces maternal. Zoom and pan freely.',
      'Navigator — A compact "context window" showing grandparents, parents, the focus person, and children. Click any card to re-center the view on that person. Great for exploration.',
      'Descendants — Collapsible indented tree showing all descendants of any person. Auto-expands 3 levels.',
      'Person Selector — Searchable dropdown at the top to jump to any person. Filter by name or family surname.',
      'Children Slide-Out — Couple cards show a "Children (N)" button that opens a panel listing all children with links to their profiles.',
    ],
  },
  {
    title: 'Family Map',
    path: '/map',
    description: 'A full-screen interactive map showing where your family lived, moved, married, and was buried — from world level down to individual streets and cemeteries.',
    details: [
      'Seven event types — Birth (green), Death (red), Marriage (purple), Burial (gray), Residence (blue), Immigration (amber), Emigration (teal). Each has a color-coded marker.',
      'Marker clustering — At world zoom, events cluster into numbered bubbles. Zoom in to separate them. At maximum zoom, overlapping markers fan out in a spiderfy pattern.',
      'Click any marker — Popup shows the person\'s name, event type, date, location, and a link to their profile page.',
      'Migration paths — Toggle dashed arc lines connecting each person\'s birthplace to their death place. Color-coded by family line. Shows the journey of life at a glance.',
      'Time period slider — Dual-handle range slider to filter events to a specific year range.',
      'Time animation — Press Play to watch the family spread across the map decade by decade. A large year indicator shows the current decade. Marker counts update live.',
      'Heat map mode — Switch from markers to a heat map visualization showing family concentration areas. Great for spotting settlement clusters.',
      'Family line filter — Filter the map to show only specific family surnames.',
      'Build-time geocoding — Location names are automatically geocoded via OpenStreetMap\'s Nominatim API during the data build. Results are cached in geocode-cache.json (editable for corrections).',
    ],
  },
  {
    title: 'Person Pages',
    path: '/people',
    description: 'Each person in the vault gets a detailed profile page with everything known about their life.',
    details: [
      'Vital information table — 25+ fields including birth, death, marriage, burial, religion, occupation, military service, immigration, education, and more.',
      'Biography — Narrative text with inline source citations that link to source detail pages.',
      'Media gallery — Photos, gravestones, newspaper clippings, and documents associated with the person. Click to open in a full-screen lightbox with swipe navigation.',
      'Family units — Spouses and children organized by marriage, with links to all family members.',
      'Confidence badge — Shows data quality level (high, moderate, low, stub) based on source coverage.',
    ],
  },
  {
    title: 'Timeline',
    path: '/timeline',
    description: 'A chronological visualization of all family events spanning centuries.',
    details: [
      'Birth, death, and marriage events plotted on a vertical timeline with year markers.',
      'Color-coded event dots — green for births, red for deaths, purple for marriages.',
      'Click any event for a tooltip with person details and a link to their profile.',
      'Filter by event type (toggle birth/death/marriage) and by family line.',
    ],
  },
  {
    title: 'On This Day',
    path: '/on-this-day',
    description: 'See what happened in your family history on today\'s date across all years.',
    details: [
      'Shows births, deaths, marriages, immigration, military events, baptisms, and more that occurred on today\'s month and day.',
      'Automatic date parsing handles multiple date formats.',
    ],
  },
  {
    title: 'Statistics',
    path: '/stats',
    description: 'Overview charts and numbers about the research collection.',
    details: [
      'People count, source count, media count, generations traced.',
      'Name frequency analysis — most common first names and surnames.',
      'Birth and death decade distribution — bar charts showing when people were born and died.',
      'Lifespan statistics — average lifespan, longest-lived, shortest-lived.',
      'Occupation and religion breakdowns.',
    ],
  },
  {
    title: 'Source Browser',
    path: '/sources',
    description: 'Search and browse all research sources — obituaries, cemetery records, census data, church registers, and more.',
    details: [
      'Filterable by source type (obituary, cemetery, church, census, etc.).',
      'Each source links to a detail page with full transcription, extracted facts, media, and the list of people referenced.',
      'Source reliability ratings and OCR verification status.',
    ],
  },
  {
    title: 'Media Gallery',
    path: '/gallery',
    description: 'Browse all images and documents in the collection.',
    details: [
      'Filter by media type (gravestone, portrait, newspaper, document) and family line.',
      'Full-screen lightbox with keyboard navigation (arrow keys, Escape), mobile swipe, and adjacent image preloading.',
      'Metadata bar showing person, description, and media type.',
    ],
  },
  {
    title: 'Global Search',
    path: '/search',
    description: 'Fuzzy full-text search across all people and sources.',
    details: [
      'Search by name, birthplace, occupation, biography text, source content, or notes.',
      'Highlighted matching snippets in results.',
      'Cmd+K (or Ctrl+K) keyboard shortcut to open search from anywhere.',
    ],
  },
  {
    title: 'Research Gaps',
    path: '/research-gaps',
    description: 'Auto-detected areas where the research needs more work.',
    details: [
      'Missing vital fields per person — highlights what information is still unknown.',
      'Orphaned sources — sources not linked to any person file.',
      'Untranslated documents — non-English sources that need translation.',
      'Broken wikilinks — references to files that don\'t exist.',
      'Priority targets ranked by gap count — focus on the people who need the most work.',
      'Export/copy the full research plan as a markdown checklist.',
    ],
  },
  {
    title: 'Immigration Stories',
    path: '/immigration',
    description: 'Narrative pages about family immigration journeys, rendered from vault markdown.',
    details: [
      'Auto-generated table of contents from headings.',
      'Rich markdown rendering with images and source links.',
    ],
  },
  {
    title: 'Privacy Controls',
    path: '/people',
    description: 'Protect living or sensitive individuals while keeping them in the family tree structure.',
    details: [
      'Set privacy: true on any person file to strip all personal details from the published site.',
      'Private people keep their name and position in the tree but dates, places, vitals, biography, sources, and media are all redacted.',
      'GEDCOM export emits minimal records with RESN confidential for private individuals.',
    ],
  },
]

export default function FeaturesPage() {
  const config = useSiteConfig()

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-stone-800">Site Features</h1>
        <p className="mt-2 text-stone-500">
          Everything available on the {config.familyName} family ancestry site.
        </p>
      </div>

      {/* Quick nav */}
      <div className="mb-10 p-4 bg-stone-50 rounded-lg border border-stone-200">
        <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wider mb-3">Quick Navigation</h2>
        <div className="flex flex-wrap gap-2">
          {features.map(f => (
            <a
              key={f.title}
              href={`#${f.title.toLowerCase().replace(/\s+/g, '-')}`}
              className="text-sm text-amber-700 hover:text-amber-900 bg-white px-2.5 py-1 rounded border border-stone-200 hover:border-amber-200 transition-colors"
            >
              {f.title}
            </a>
          ))}
        </div>
      </div>

      {/* Feature sections */}
      <div className="space-y-12">
        {features.map(f => (
          <section
            key={f.title}
            id={f.title.toLowerCase().replace(/\s+/g, '-')}
            className="scroll-mt-20"
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <h2 className="text-xl font-bold text-stone-800">{f.title}</h2>
              <Link
                to={f.path}
                className="shrink-0 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1 hover:bg-amber-100 transition-colors"
              >
                Open &rarr;
              </Link>
            </div>
            <p className="text-stone-600 mb-4">{f.description}</p>
            <ul className="space-y-2">
              {f.details.map((d, i) => {
                const dashIdx = d.indexOf(' — ')
                return (
                  <li key={i} className="flex gap-2 text-sm text-stone-600">
                    <span className="text-amber-500 shrink-0 mt-0.5">›</span>
                    {dashIdx > 0 ? (
                      <span>
                        <span className="font-medium text-stone-700">{d.slice(0, dashIdx)}</span>
                        {d.slice(dashIdx)}
                      </span>
                    ) : (
                      <span>{d}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      {/* Technical details */}
      <div className="mt-16 pt-8 border-t border-stone-200">
        <h2 className="text-xl font-bold text-stone-800 mb-4">Technical Details</h2>
        <div className="grid sm:grid-cols-2 gap-6 text-sm text-stone-600">
          <div>
            <h3 className="font-semibold text-stone-700 mb-2">Built With</h3>
            <ul className="space-y-1">
              <li>React 19 + TypeScript + Tailwind CSS</li>
              <li>Vite (build tool)</li>
              <li>Leaflet + MarkerCluster + Heat (maps)</li>
              <li>React Flow + Dagre (family trees)</li>
              <li>Fuse.js (fuzzy search)</li>
              <li>Markdown + YAML frontmatter (vault)</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-stone-700 mb-2">Data Pipeline</h3>
            <ul className="space-y-1">
              <li>Vault markdown parsed at build time</li>
              <li>YAML frontmatter + vital info tables extracted</li>
              <li>Locations geocoded via Nominatim (cached)</li>
              <li>Single JSON output for the entire site</li>
              <li>Privacy redaction applied before output</li>
              <li>194 unit tests covering build + validation</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-stone-200 flex gap-4">
        <Link to="/" className="text-sm text-amber-700 hover:text-amber-900 font-medium">
          &larr; Back to home
        </Link>
        <a
          href="https://github.com/jcoenen/ancestry-autoresearch-toolkit"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-stone-500 hover:text-stone-700 font-medium"
        >
          View on GitHub &rarr;
        </a>
      </div>
    </div>
  )
}
