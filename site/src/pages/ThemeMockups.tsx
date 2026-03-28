import { useState } from 'react'

/* ------------------------------------------------------------------ */
/*  Sample data used across all theme mockups                         */
/* ------------------------------------------------------------------ */
const samplePerson = {
  name: 'Raphael William "Ray" Coenen',
  born: '1906-02-15',
  died: '1983-11-30',
  birthplace: 'Kaukauna, Outagamie County, Wisconsin',
  deathPlace: 'Appleton, Outagamie County, Wisconsin',
  father: 'William Peter Coenen',
  mother: 'Mary Agnes Krawczyk',
  spouse: 'Ruby Marie Fuss',
  children: ['Roger Francis Coenen', 'Robert James Coenen', 'Richard John Coenen'],
  occupation: 'Paper Mill Worker',
  burial: 'Holy Cross Cemetery, Kaukauna, Wisconsin',
  confidence: 'high' as const,
}

const sampleStats = [
  { label: 'People', value: 284 },
  { label: 'Generations', value: 11 },
  { label: 'Sources', value: 127 },
  { label: 'Media', value: 89 },
  { label: 'Family Lines', value: 24 },
  { label: 'Oldest Record', value: 1714 },
]

const familyLines = ['Coenen', 'Fuss', 'Krawczyk', 'Larson', 'VandenBoom', 'Hietpas', 'Jansen']

const patrilinealLine = [
  { gen: 1, name: 'Jeremy Michael Coenen', born: '—', died: '', birthplace: 'Appleton, WI' },
  { gen: 2, name: 'Roger Francis Coenen', born: '1942', died: '2016', birthplace: 'Kaukauna, WI' },
  { gen: 3, name: 'Raphael William Coenen', born: '1906', died: '1983', birthplace: 'Kaukauna, WI' },
  { gen: 4, name: 'William Peter Coenen', born: '1878', died: '1952', birthplace: 'Kaukauna, WI' },
  { gen: 5, name: 'Peter Coenen', born: '1847', died: '1918', birthplace: 'Zeeland, NB, NL' },
]

/* ------------------------------------------------------------------ */
/*  Helper: confidence badge                                          */
/* ------------------------------------------------------------------ */
function ConfBadge({ level, colors }: { level: string; colors: Record<string, string> }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${colors[level] || colors.stub}`}>
      {level}
    </span>
  )
}

/* ================================================================== */
/*  THEME 1 — Old World Archive                                       */
/* ================================================================== */
function OldWorldArchive() {
  const bg = '#FFFDD0'
  const ink = '#2C1B0E'
  const accent = '#800020'
  const gold = '#CFB53B'
  const sepia = '#5C4033'
  const conf: Record<string, string> = {
    high: 'background-color: #d4edda; color: #155724;',
    moderate: 'background-color: #fff3cd; color: #856404;',
    low: 'background-color: #f8d7da; color: #721c24;',
    stub: 'background-color: #e2e3e5; color: #383d41;',
  }

  return (
    <div style={{ background: bg, color: ink, fontFamily: "'Playfair Display', 'Georgia', serif" }}>
      {/* Nav */}
      <nav style={{ background: sepia, borderBottom: `3px solid ${gold}`, padding: '0 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <span style={{ color: gold, fontWeight: 700, fontSize: 20, letterSpacing: 2, textTransform: 'uppercase' }}>
            Coenen Ancestry
          </span>
          <div style={{ display: 'flex', gap: 24 }}>
            {['Home', 'Family Tree', 'People', 'Sources', 'Gallery'].map(l => (
              <span key={l} style={{ color: '#FFFDD0', fontSize: 14, cursor: 'pointer', letterSpacing: 1, opacity: l === 'Home' ? 1 : 0.7 }}>{l}</span>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 24px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: sepia, marginBottom: 12 }}>Est. 1714 &middot; Zeeland, Noord-Brabant</div>
        <h1 style={{ fontSize: 48, fontWeight: 700, color: ink, margin: 0, lineHeight: 1.2 }}>
          Coenen Family Ancestry
        </h1>
        <div style={{ width: 80, height: 3, background: gold, margin: '20px auto' }} />
        <p style={{ color: sepia, maxWidth: 600, margin: '0 auto', fontSize: 16, lineHeight: 1.8 }}>
          Tracing the Coenen family from the parish registers of Noord-Brabant to the Fox River Valley of Wisconsin.
          Eleven generations of documented history.
        </p>
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', gap: 16 }}>
          <button style={{ background: accent, color: '#fff', border: 'none', padding: '10px 28px', fontFamily: 'inherit', fontSize: 14, letterSpacing: 1, cursor: 'pointer' }}>
            View Family Tree
          </button>
          <button style={{ background: 'transparent', color: accent, border: `2px solid ${accent}`, padding: '10px 28px', fontFamily: 'inherit', fontSize: 14, letterSpacing: 1, cursor: 'pointer' }}>
            Browse People
          </button>
        </div>
      </div>

      {/* Person card */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 48px' }}>
        <div style={{ border: `2px solid ${sepia}`, background: '#FFF8E7', padding: 32, position: 'relative' }}>
          <div style={{ position: 'absolute', top: -12, left: 32, background: bg, padding: '0 12px', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: sepia }}>
            Person Record
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 28, color: ink }}>{samplePerson.name}</h2>
              <p style={{ margin: '4px 0 0', color: sepia, fontSize: 14 }}>1906 – 1983 &middot; {samplePerson.birthplace}</p>
            </div>
            <span style={{ ...parseInlineStyle(conf.high), padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600 }}>HIGH</span>
          </div>
          <div style={{ borderTop: `1px solid ${gold}`, marginTop: 8, paddingTop: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {([
                  ['Full Name', samplePerson.name],
                  ['Born', `${samplePerson.born} — ${samplePerson.birthplace}`],
                  ['Died', `${samplePerson.died} — ${samplePerson.deathPlace}`],
                  ['Father', samplePerson.father],
                  ['Mother', samplePerson.mother],
                  ['Spouse', samplePerson.spouse],
                  ['Occupation', samplePerson.occupation],
                  ['Burial', samplePerson.burial],
                ] as const).map(([k, v], i) => (
                  <tr key={k} style={{ borderBottom: `1px solid ${gold}30` }}>
                    <td style={{ padding: '8px 12px 8px 0', fontWeight: 600, color: sepia, width: 140, verticalAlign: 'top' }}>{k}</td>
                    <td style={{ padding: '8px 0' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 48px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {sampleStats.map(s => (
          <div key={s.label} style={{ textAlign: 'center', border: `1px solid ${sepia}40`, padding: '16px 8px', background: '#FFF8E7' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: accent }}>{s.value}</div>
            <div style={{ fontSize: 11, color: sepia, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  THEME 2 — Dutch Heritage                                          */
/* ================================================================== */
function DutchHeritage() {
  const navy = '#1E3A5F'
  const ceramic = '#F5F5F0'
  const gold = '#D4A847'
  const terra = '#C67B4F'
  const lightBlue = '#E8EEF4'

  return (
    <div style={{ background: ceramic, color: '#1a1a1a', fontFamily: "'Inter', 'Source Sans Pro', sans-serif" }}>
      {/* Nav */}
      <nav style={{ background: navy, padding: '0 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <span style={{ color: gold, fontWeight: 700, fontSize: 18 }}>
            <span style={{ opacity: 0.6, marginRight: 8 }}>&#9670;</span>Coenen Ancestry
          </span>
          <div style={{ display: 'flex', gap: 24 }}>
            {['Home', 'Family Tree', 'People', 'Sources', 'Gallery'].map(l => (
              <span key={l} style={{ color: '#fff', fontSize: 13, cursor: 'pointer', opacity: l === 'Home' ? 1 : 0.7, fontWeight: 500 }}>{l}</span>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${navy} 0%, #2a5078 100%)`, padding: '64px 24px', textAlign: 'center' }}>
        <p style={{ color: gold, fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', margin: '0 0 12px' }}>Zeeland &middot; Noord-Brabant &middot; Netherlands</p>
        <h1 style={{ color: '#fff', fontSize: 44, fontWeight: 700, margin: 0, fontFamily: "'Libre Baskerville', 'Georgia', serif" }}>
          Coenen Family Ancestry
        </h1>
        <p style={{ color: '#b8c9db', maxWidth: 560, margin: '16px auto 0', fontSize: 15, lineHeight: 1.7 }}>
          From church records in 1714 to the Fox River Valley of Wisconsin. Eleven generations of documented history.
        </p>
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button style={{ background: gold, color: navy, border: 'none', padding: '10px 24px', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            View Family Tree
          </button>
          <button style={{ background: 'transparent', color: '#fff', border: '2px solid rgba(255,255,255,0.3)', padding: '10px 24px', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
            Browse People
          </button>
        </div>
      </div>

      {/* Tile accent strip */}
      <div style={{ height: 6, background: `repeating-linear-gradient(90deg, ${navy} 0px, ${navy} 20px, ${gold} 20px, ${gold} 22px, #fff 22px, #fff 24px)` }} />

      {/* Person card */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ background: navy, padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, color: '#fff', fontSize: 22, fontFamily: "'Libre Baskerville', serif" }}>{samplePerson.name}</h2>
              <p style={{ margin: '4px 0 0', color: '#8ba8c8', fontSize: 13 }}>1906 – 1983 &middot; Kaukauna, Wisconsin</p>
            </div>
            <span style={{ background: '#d4edda', color: '#155724', padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>HIGH</span>
          </div>
          <div style={{ padding: 24 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {([
                  ['Born', `${samplePerson.born} — ${samplePerson.birthplace}`],
                  ['Died', `${samplePerson.died} — ${samplePerson.deathPlace}`],
                  ['Father', samplePerson.father],
                  ['Mother', samplePerson.mother],
                  ['Spouse', samplePerson.spouse],
                  ['Children', samplePerson.children.join(', ')],
                  ['Occupation', samplePerson.occupation],
                  ['Burial', samplePerson.burial],
                ] as const).map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px 12px 10px 0', fontWeight: 600, color: navy, width: 120 }}>{k}</td>
                    <td style={{ padding: '10px 0', color: '#444' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Family Lines */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 20px' }}>
        <h3 style={{ color: navy, fontFamily: "'Libre Baskerville', serif", marginBottom: 12 }}>Family Lines</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {familyLines.map(f => (
            <span key={f} style={{ padding: '6px 16px', borderRadius: 20, border: `1px solid ${navy}30`, fontSize: 13, color: navy, cursor: 'pointer', background: lightBlue }}>
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 24px 48px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {sampleStats.map(s => (
          <div key={s.label} style={{ textAlign: 'center', borderRadius: 8, border: `1px solid ${navy}15`, padding: '16px 8px', background: '#fff' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: navy }}>{s.value}</div>
            <div style={{ fontSize: 11, color: terra, fontWeight: 500, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  THEME 3 — Modern Genealogy (Dashboard)                            */
/* ================================================================== */
function ModernDashboard() {
  const slate = '#1E293B'
  const slateLight = '#334155'
  const violet = '#7C3AED'
  const violetLight = '#EDE9FE'
  const mint = '#10B981'
  const bg = '#0F172A'

  return (
    <div style={{ background: bg, color: '#e2e8f0', fontFamily: "'Inter', -apple-system, sans-serif", display: 'flex', minHeight: 700 }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: slate, borderRight: '1px solid #ffffff10', padding: '20px 0', flexShrink: 0 }}>
        <div style={{ padding: '0 20px 24px', borderBottom: '1px solid #ffffff10' }}>
          <span style={{ color: violet, fontWeight: 700, fontSize: 16 }}>Coenen</span>
          <span style={{ color: '#94a3b8', fontWeight: 400, fontSize: 16, marginLeft: 4 }}>Ancestry</span>
        </div>
        <div style={{ padding: '16px 12px' }}>
          {[
            { icon: '⌂', label: 'Home', active: true },
            { icon: '◉', label: 'Family Tree', active: false },
            { icon: '◎', label: 'People', active: false },
            { icon: '▤', label: 'Sources', active: false },
            { icon: '▦', label: 'Gallery', active: false },
            { icon: '⊞', label: 'Report', active: false },
          ].map(item => (
            <div key={item.label} style={{
              padding: '8px 12px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              marginBottom: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: item.active ? '#ffffff10' : 'transparent',
              color: item.active ? '#fff' : '#94a3b8',
            }}>
              <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>
        <div style={{ padding: '16px 12px', borderTop: '1px solid #ffffff10', marginTop: 'auto' }}>
          <div style={{ background: '#ffffff08', borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#64748b' }}>
            <span style={{ color: mint, fontWeight: 600 }}>284</span> people &middot; <span style={{ color: violet, fontWeight: 600 }}>127</span> sources
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Search bar */}
        <div style={{ padding: '16px 32px', borderBottom: '1px solid #ffffff08', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, background: slateLight, borderRadius: 8, padding: '8px 16px', fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>⌘K</span> Search people, sources, places...
          </div>
        </div>

        {/* Hero / Overview */}
        <div style={{ padding: '32px 32px 24px' }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: '#f1f5f9' }}>Coenen Family Ancestry</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '8px 0 0' }}>
            11 generations &middot; 1714 – present &middot; Netherlands → Wisconsin
          </p>
        </div>

        {/* Stats row */}
        <div style={{ padding: '0 32px 24px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          {sampleStats.map(s => (
            <div key={s.label} style={{ background: slateLight, borderRadius: 10, padding: '16px', border: '1px solid #ffffff08' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Person card */}
        <div style={{ padding: '0 32px 32px' }}>
          <div style={{ background: slateLight, borderRadius: 12, border: '1px solid #ffffff08', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ffffff08' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: `linear-gradient(135deg, ${violet}, ${mint})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16 }}>
                  RC
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: '#f1f5f9' }}>{samplePerson.name}</h2>
                  <p style={{ margin: '2px 0 0', color: '#64748b', fontSize: 12 }}>Gen 3 &middot; 1906 – 1983 &middot; Kaukauna, WI</p>
                </div>
              </div>
              <span style={{ background: '#065f4620', color: mint, padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                High Confidence
              </span>
            </div>
            <div style={{ padding: 24, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {([
                ['Born', '1906-02-15, Kaukauna, WI'],
                ['Died', '1983-11-30, Appleton, WI'],
                ['Father', samplePerson.father],
                ['Mother', samplePerson.mother],
                ['Spouse', samplePerson.spouse],
                ['Occupation', samplePerson.occupation],
              ] as const).map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k}</div>
                  <div style={{ fontSize: 14, color: '#e2e8f0' }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  THEME 4 — Family Roots (Nature)                                   */
/* ================================================================== */
function FamilyRoots() {
  const forest = '#2D5016'
  const cream = '#FFF8F0'
  const bark = '#6B4423'
  const sage = '#9CAF88'
  const sky = '#E8F0FE'

  return (
    <div style={{ background: cream, color: '#333', fontFamily: "'Nunito', 'Quicksand', sans-serif" }}>
      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: `3px solid ${sage}`, padding: '0 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <span style={{ color: forest, fontWeight: 800, fontSize: 20 }}>
            <span style={{ color: sage, marginRight: 6 }}>&#127793;</span>Coenen Ancestry
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {['Home', 'Family Tree', 'People', 'Sources', 'Gallery'].map(l => (
              <span key={l} style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                color: l === 'Home' ? '#fff' : forest,
                background: l === 'Home' ? forest : 'transparent',
              }}>{l}</span>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: `linear-gradient(180deg, #f0f7e8 0%, ${cream} 100%)`, padding: '64px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 44, fontWeight: 800, color: forest, margin: 0 }}>
          Coenen Family Ancestry
        </h1>
        <p style={{ color: bark, maxWidth: 540, margin: '12px auto 0', fontSize: 16, lineHeight: 1.7 }}>
          Rooted in the Netherlands, growing in Wisconsin. Eleven generations of our family story.
        </p>
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button style={{ background: forest, color: '#fff', border: 'none', padding: '12px 28px', borderRadius: 28, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            View Family Tree
          </button>
          <button style={{ background: '#fff', color: forest, border: `2px solid ${sage}`, padding: '12px 28px', borderRadius: 28, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Browse People
          </button>
        </div>
      </div>

      {/* Person card */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ background: '#fff', borderRadius: 20, padding: 32, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', border: `1px solid ${sage}40` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: `linear-gradient(135deg, ${sage}, ${forest})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 20 }}>
              RC
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: forest }}>{samplePerson.name}</h2>
              <p style={{ margin: '2px 0 0', color: bark, fontSize: 13 }}>1906 – 1983 &middot; Kaukauna, Wisconsin</p>
            </div>
            <span style={{ marginLeft: 'auto', background: '#d4edda', color: forest, padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>High</span>
          </div>
          <div style={{ borderTop: `2px dashed ${sage}40`, paddingTop: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {([
                ['Born', '1906-02-15, Kaukauna, WI'],
                ['Died', '1983-11-30, Appleton, WI'],
                ['Father', samplePerson.father],
                ['Mother', samplePerson.mother],
                ['Spouse', samplePerson.spouse],
                ['Occupation', samplePerson.occupation],
                ['Children', samplePerson.children.join(', ')],
                ['Burial', samplePerson.burial],
              ] as const).map(([k, v]) => (
                <div key={k} style={{ background: '#fafdf7', borderRadius: 12, padding: '12px 16px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: sage, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k}</div>
                  <div style={{ fontSize: 14, color: '#333', marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Family Lines */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 20px' }}>
        <h3 style={{ color: forest, marginBottom: 12 }}>Family Lines</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {familyLines.map(f => (
            <span key={f} style={{ padding: '8px 18px', borderRadius: 28, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#e8f5e0', color: forest }}>
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '20px 24px 48px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {sampleStats.map(s => (
          <div key={s.label} style={{ textAlign: 'center', borderRadius: 16, padding: '20px 8px', background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: forest }}>{s.value}</div>
            <div style={{ fontSize: 11, color: bark, fontWeight: 600, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  THEME 5 — Ink & Paper (Monochrome)                                */
/* ================================================================== */
function InkAndPaper() {
  const black = '#111'
  const red = '#9B1B30'
  const lightGray = '#F3F3F3'

  return (
    <div style={{ background: '#fff', color: black, fontFamily: "'EB Garamond', 'Merriweather', 'Georgia', serif" }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid #ddd', padding: '0 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.5 }}>Coenen Ancestry</span>
          <div style={{ display: 'flex', gap: 28 }}>
            {['Home', 'Family Tree', 'People', 'Sources', 'Gallery'].map(l => (
              <span key={l} style={{ fontSize: 14, cursor: 'pointer', color: l === 'Home' ? red : '#555', fontWeight: l === 'Home' ? 600 : 400 }}>{l}</span>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '72px 24px 48px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 48, fontWeight: 400, margin: 0, lineHeight: 1.2, letterSpacing: -1 }}>
          Coenen Family Ancestry
        </h1>
        <hr style={{ border: 'none', borderTop: `2px solid ${red}`, width: 60, margin: '24px auto' }} />
        <p style={{ color: '#666', fontSize: 17, lineHeight: 1.8, maxWidth: 540, margin: '0 auto' }}>
          Tracing the Coenen family from Zeeland, Noord-Brabant, Netherlands to the Fox River
          Valley of Wisconsin. Eleven generations of documented history.
        </p>
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', gap: 16 }}>
          <button style={{ background: black, color: '#fff', border: 'none', padding: '10px 24px', fontSize: 13, cursor: 'pointer', letterSpacing: 0.5, fontFamily: 'inherit' }}>
            View Family Tree
          </button>
          <button style={{ background: 'transparent', color: black, border: `1px solid ${black}`, padding: '10px 24px', fontSize: 13, cursor: 'pointer', letterSpacing: 0.5, fontFamily: 'inherit' }}>
            Browse People
          </button>
        </div>
      </div>

      {/* Person card */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px 48px' }}>
        <div style={{ borderTop: `3px solid ${black}`, paddingTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h2 style={{ fontSize: 26, fontWeight: 400, margin: 0, fontStyle: 'italic' }}>{samplePerson.name}</h2>
            <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1.5, color: '#555', border: '1px solid #ccc', padding: '3px 10px' }}>High</span>
          </div>
          <p style={{ color: '#888', fontSize: 14, margin: '4px 0 20px', fontStyle: 'italic' }}>b. 1906, Kaukauna — d. 1983, Appleton</p>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
            <tbody>
              {([
                ['Full Name', samplePerson.name],
                ['Born', `February 15, 1906 — Kaukauna, Outagamie County, Wisconsin`],
                ['Died', `November 30, 1983 — Appleton, Outagamie County, Wisconsin`],
                ['Father', samplePerson.father],
                ['Mother', samplePerson.mother],
                ['Spouse', samplePerson.spouse],
                ['Children', samplePerson.children.join('; ')],
                ['Occupation', samplePerson.occupation],
                ['Burial', samplePerson.burial],
              ] as const).map(([k, v], i) => (
                <tr key={k} style={{ background: i % 2 === 0 ? lightGray : '#fff' }}>
                  <td style={{ padding: '10px 14px', fontVariant: 'small-caps', fontWeight: 600, color: '#555', width: 140, verticalAlign: 'top' }}>{k}</td>
                  <td style={{ padding: '10px 14px' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patrilineal table */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px 48px' }}>
        <h3 style={{ fontWeight: 400, fontStyle: 'italic', fontSize: 20, marginBottom: 16 }}>Direct Patrilineal Line</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${black}` }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontVariant: 'small-caps', fontWeight: 600, color: '#555' }}>Gen</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontVariant: 'small-caps', fontWeight: 600, color: '#555' }}>Name</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontVariant: 'small-caps', fontWeight: 600, color: '#555' }}>Born</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontVariant: 'small-caps', fontWeight: 600, color: '#555' }}>Died</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontVariant: 'small-caps', fontWeight: 600, color: '#555' }}>Birthplace</th>
            </tr>
          </thead>
          <tbody>
            {patrilinealLine.map((p, i) => (
              <tr key={p.gen} style={{ borderBottom: '1px solid #ddd', background: i % 2 === 0 ? lightGray : '#fff' }}>
                <td style={{ padding: '8px 12px', color: '#888' }}>{p.gen}</td>
                <td style={{ padding: '8px 12px' }}><span style={{ color: red, cursor: 'pointer' }}>{p.name}</span></td>
                <td style={{ padding: '8px 12px', color: '#666' }}>{p.born}</td>
                <td style={{ padding: '8px 12px', color: '#666' }}>{p.died}</td>
                <td style={{ padding: '8px 12px', color: '#888' }}>{p.birthplace}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stats */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px 48px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0, borderTop: `2px solid ${black}`, borderBottom: `2px solid ${black}` }}>
        {sampleStats.map((s, i) => (
          <div key={s.label} style={{ textAlign: 'center', padding: '20px 8px', borderRight: i < sampleStats.length - 1 ? '1px solid #ddd' : 'none' }}>
            <div style={{ fontSize: 24, fontWeight: 400 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#888', fontVariant: 'small-caps', letterSpacing: 1, marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  THEME 6 — Museum Catalogue                                        */
/*  Dark charcoal + warm cream, gallery exhibit labels, copper accent  */
/* ================================================================== */
function MuseumCatalogue() {
  const charcoal = '#1C1C1C'
  const warmWhite = '#FAF7F2'
  const copper = '#B87333'
  const midGray = '#6B6B6B'

  return (
    <div style={{ background: charcoal, color: warmWhite, fontFamily: "'EB Garamond', 'Georgia', serif" }}>
      {/* Nav */}
      <nav style={{ borderBottom: `1px solid #333`, padding: '0 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <span style={{ fontSize: 18, fontWeight: 400, letterSpacing: 3, textTransform: 'uppercase', color: copper }}>Coenen</span>
          <div style={{ display: 'flex', gap: 28 }}>
            {['Home', 'Family Tree', 'People', 'Sources', 'Gallery'].map(l => (
              <span key={l} style={{ fontSize: 13, cursor: 'pointer', color: l === 'Home' ? warmWhite : '#888', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>{l}</span>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '80px 24px 56px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 6, textTransform: 'uppercase', color: copper, marginBottom: 20, fontFamily: "'Inter', sans-serif" }}>Family Archive &middot; Est. 1714</div>
        <h1 style={{ fontSize: 52, fontWeight: 400, margin: 0, lineHeight: 1.15, letterSpacing: -0.5 }}>
          Coenen Family<br />Ancestry
        </h1>
        <div style={{ width: 40, height: 1, background: copper, margin: '28px auto' }} />
        <p style={{ color: '#999', fontSize: 16, lineHeight: 1.9, maxWidth: 500, margin: '0 auto' }}>
          Eleven generations documented from the parish registers of Noord-Brabant to the Fox River Valley of Wisconsin.
        </p>
        <div style={{ marginTop: 36, display: 'flex', justifyContent: 'center', gap: 16 }}>
          <button style={{ background: copper, color: charcoal, border: 'none', padding: '11px 28px', fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>
            View Family Tree
          </button>
          <button style={{ background: 'transparent', color: warmWhite, border: `1px solid #555`, padding: '11px 28px', fontSize: 12, fontWeight: 500, cursor: 'pointer', letterSpacing: 1.5, textTransform: 'uppercase', fontFamily: "'Inter', sans-serif" }}>
            Browse People
          </button>
        </div>
      </div>

      {/* Person card */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 56px' }}>
        <div style={{ background: '#242424', border: '1px solid #333', padding: 0 }}>
          {/* Exhibit label header */}
          <div style={{ padding: '20px 28px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: copper, fontFamily: "'Inter', sans-serif", marginBottom: 4 }}>Person Record</div>
              <h2 style={{ margin: 0, fontSize: 28, fontWeight: 400, fontStyle: 'italic' }}>{samplePerson.name}</h2>
            </div>
            <span style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: '#6B9B6B', border: '1px solid #6B9B6B', padding: '4px 12px', fontFamily: "'Inter', sans-serif" }}>High</span>
          </div>
          <div style={{ padding: '24px 28px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
              <tbody>
                {([
                  ['Full Name', samplePerson.name],
                  ['Born', `February 15, 1906 — Kaukauna, Outagamie County, Wisconsin`],
                  ['Died', `November 30, 1983 — Appleton, Outagamie County, Wisconsin`],
                  ['Father', samplePerson.father],
                  ['Mother', samplePerson.mother],
                  ['Spouse', samplePerson.spouse],
                  ['Children', samplePerson.children.join('; ')],
                  ['Burial', samplePerson.burial],
                ] as const).map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td style={{ padding: '10px 16px 10px 0', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: midGray, width: 130, verticalAlign: 'top', fontFamily: "'Inter', sans-serif" }}>{k}</td>
                    <td style={{ padding: '10px 0', color: '#ddd' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 56px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0, borderTop: `1px solid #333`, borderBottom: `1px solid #333` }}>
        {sampleStats.map((s, i) => (
          <div key={s.label} style={{ textAlign: 'center', padding: '24px 8px', borderRight: i < sampleStats.length - 1 ? '1px solid #333' : 'none' }}>
            <div style={{ fontSize: 26, fontWeight: 400, color: warmWhite }}>{s.value}</div>
            <div style={{ fontSize: 10, color: midGray, letterSpacing: 2, textTransform: 'uppercase', marginTop: 6, fontFamily: "'Inter', sans-serif" }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  THEME 7 — Cartographer                                            */
/*  Old-map tones, deep teal + parchment + engraved feel              */
/* ================================================================== */
function Cartographer() {
  const teal = '#1B4D4D'
  const parchment = '#F5EDDB'
  const umber = '#8B6914'
  const inkDark = '#1a1a16'

  return (
    <div style={{ background: parchment, color: inkDark, fontFamily: "'Libre Baskerville', 'Georgia', serif" }}>
      {/* Nav */}
      <nav style={{ background: teal, padding: '0 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52 }}>
          <span style={{ color: parchment, fontWeight: 700, fontSize: 16 }}>
            <span style={{ color: umber, marginRight: 8 }}>&#9678;</span>Coenen Ancestry
          </span>
          <div style={{ display: 'flex', gap: 24 }}>
            {['Home', 'Family Tree', 'People', 'Sources', 'Gallery'].map(l => (
              <span key={l} style={{ fontSize: 12, color: l === 'Home' ? parchment : '#8CB0B0', cursor: 'pointer', fontWeight: l === 'Home' ? 600 : 400 }}>{l}</span>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: `linear-gradient(180deg, ${teal} 0%, ${teal}dd 40%, ${parchment} 100%)`, padding: '56px 24px 64px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: 4, textTransform: 'uppercase', color: umber, marginBottom: 16 }}>&#9670; Zeeland &middot; Noord-Brabant &middot; Netherlands &#9670;</div>
        <h1 style={{ fontSize: 44, fontWeight: 700, margin: 0, color: parchment, lineHeight: 1.2 }}>
          Coenen Family Ancestry
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '20px 0' }}>
          <div style={{ flex: 1, maxWidth: 80, height: 1, background: umber }} />
          <span style={{ color: umber, fontSize: 20 }}>&#9674;</span>
          <div style={{ flex: 1, maxWidth: 80, height: 1, background: umber }} />
        </div>
        <p style={{ color: '#8CB0B0', maxWidth: 500, margin: '0 auto', fontSize: 15, lineHeight: 1.8 }}>
          Charting the passage of a family across eleven generations, from parish records in 1714 to the present day.
        </p>
        <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center', gap: 14 }}>
          <button style={{ background: umber, color: parchment, border: 'none', padding: '10px 26px', borderRadius: 2, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            View Family Tree
          </button>
          <button style={{ background: 'transparent', color: parchment, border: `1px solid ${parchment}60`, padding: '10px 26px', borderRadius: 2, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Browse People
          </button>
        </div>
      </div>

      {/* Person card */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ border: `2px solid ${teal}`, background: '#FDF8EE', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -1, left: 0, right: 0, height: 4, background: teal }} />
          <div style={{ padding: '24px 28px', borderBottom: `1px solid ${teal}30` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: teal }}>{samplePerson.name}</h2>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#3d7a3d', background: '#d4edda', padding: '3px 12px', borderRadius: 2 }}>High</span>
            </div>
            <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13, fontStyle: 'italic' }}>b. 1906, Kaukauna &mdash; d. 1983, Appleton</p>
          </div>
          <div style={{ padding: '20px 28px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {([
                  ['Born', `February 15, 1906 — Kaukauna, Outagamie Co., WI`],
                  ['Died', `November 30, 1983 — Appleton, Outagamie Co., WI`],
                  ['Father', samplePerson.father],
                  ['Mother', samplePerson.mother],
                  ['Spouse', samplePerson.spouse],
                  ['Children', samplePerson.children.join(', ')],
                  ['Occupation', samplePerson.occupation],
                  ['Burial', samplePerson.burial],
                ] as const).map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: `1px solid ${teal}15` }}>
                    <td style={{ padding: '9px 14px 9px 0', fontWeight: 600, color: teal, width: 120, fontSize: 13 }}>{k}</td>
                    <td style={{ padding: '9px 0', color: '#444' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Patrilineal */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 40px' }}>
        <h3 style={{ color: teal, marginBottom: 12 }}>Direct Patrilineal Line</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#FDF8EE', border: `1px solid ${teal}30` }}>
          <thead>
            <tr style={{ background: teal, color: parchment }}>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Gen</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Name</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Born</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Died</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600 }}>Birthplace</th>
            </tr>
          </thead>
          <tbody>
            {patrilinealLine.map((p, i) => (
              <tr key={p.gen} style={{ borderBottom: `1px solid ${teal}15`, background: i % 2 === 0 ? '#FDF8EE' : '#F7F0DE' }}>
                <td style={{ padding: '8px 12px', color: '#888' }}>{p.gen}</td>
                <td style={{ padding: '8px 12px' }}><span style={{ color: teal, fontWeight: 600, cursor: 'pointer' }}>{p.name}</span></td>
                <td style={{ padding: '8px 12px', color: '#666' }}>{p.born}</td>
                <td style={{ padding: '8px 12px', color: '#666' }}>{p.died}</td>
                <td style={{ padding: '8px 12px', color: '#888' }}>{p.birthplace}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stats */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 48px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
        {sampleStats.map(s => (
          <div key={s.label} style={{ textAlign: 'center', border: `1px solid ${teal}30`, padding: '16px 8px', background: '#FDF8EE' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: teal }}>{s.value}</div>
            <div style={{ fontSize: 10, color: umber, letterSpacing: 1, textTransform: 'uppercase', marginTop: 4, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  THEME 8 — Heritage Press                                          */
/*  Deep indigo + cream, letterpress/book inspired, editorial layout   */
/* ================================================================== */
function HeritagePress() {
  const indigo = '#2C2048'
  const cream = '#FEFCF6'
  const wine = '#6E2C4E'
  const goldMuted = '#9C8A5E'

  return (
    <div style={{ background: cream, color: '#222', fontFamily: "'Cormorant Garamond', 'EB Garamond', 'Georgia', serif" }}>
      {/* Nav */}
      <nav style={{ background: indigo, padding: '0 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 54 }}>
          <span style={{ color: cream, fontSize: 20, fontWeight: 600, letterSpacing: 1 }}>Coenen Ancestry</span>
          <div style={{ display: 'flex', gap: 24 }}>
            {['Home', 'Family Tree', 'People', 'Sources', 'Gallery'].map(l => (
              <span key={l} style={{ fontSize: 13, color: l === 'Home' ? goldMuted : '#aaa', cursor: 'pointer', fontWeight: l === 'Home' ? 600 : 400 }}>{l}</span>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 740, margin: '0 auto', padding: '72px 24px 48px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ flex: 1, maxWidth: 120, height: 2, background: indigo }} />
            <span style={{ fontSize: 12, letterSpacing: 4, textTransform: 'uppercase', color: goldMuted, fontFamily: "'Inter', sans-serif" }}>Est. 1714</span>
            <div style={{ flex: 1, maxWidth: 120, height: 2, background: indigo }} />
          </div>
          <h1 style={{ fontSize: 52, fontWeight: 600, margin: 0, lineHeight: 1.1, color: indigo }}>
            Coenen Family<br />Ancestry
          </h1>
          <p style={{ color: '#777', fontSize: 18, lineHeight: 1.8, maxWidth: 520, margin: '20px auto 0', fontStyle: 'italic' }}>
            Tracing the Coenen family from Zeeland, Noord-Brabant, Netherlands to the Fox River Valley of Wisconsin.
          </p>
          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center', gap: 16 }}>
            <button style={{ background: indigo, color: cream, border: 'none', padding: '12px 28px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              View Family Tree
            </button>
            <button style={{ background: 'transparent', color: indigo, border: `2px solid ${indigo}`, padding: '12px 28px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
              Browse People
            </button>
          </div>
        </div>
      </div>

      {/* Person card — book page style */}
      <div style={{ maxWidth: 740, margin: '0 auto', padding: '0 24px 48px' }}>
        <div style={{ borderLeft: `4px solid ${indigo}`, borderRight: `4px solid ${indigo}`, background: '#fff', padding: 0 }}>
          <div style={{ background: indigo, padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 26, fontWeight: 500, color: cream }}>{samplePerson.name}</h2>
              <p style={{ margin: '2px 0 0', color: goldMuted, fontSize: 14, fontStyle: 'italic' }}>1906 – 1983</p>
            </div>
            <span style={{ background: '#2d6a2d', color: '#d4edda', padding: '4px 14px', borderRadius: 2, fontSize: 11, fontWeight: 600, fontFamily: "'Inter', sans-serif" }}>HIGH</span>
          </div>
          <div style={{ padding: '24px 28px' }}>
            {/* Drop cap bio excerpt */}
            <p style={{ fontSize: 16, lineHeight: 1.9, color: '#444', margin: '0 0 24px' }}>
              <span style={{ float: 'left', fontSize: 56, fontWeight: 700, color: indigo, lineHeight: 0.85, marginRight: 8, marginTop: 4 }}>R</span>
              aphael William "Ray" Coenen was born February 15, 1906 in Kaukauna, Wisconsin to William Peter Coenen and Mary Agnes Krawczyk. He married Ruby Marie Fuss and worked as a paper mill worker in the Fox River Valley.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
              <tbody>
                {([
                  ['Born', `February 15, 1906 — Kaukauna, Outagamie County, WI`],
                  ['Died', `November 30, 1983 — Appleton, Outagamie County, WI`],
                  ['Father', samplePerson.father],
                  ['Mother', samplePerson.mother],
                  ['Spouse', samplePerson.spouse],
                  ['Children', samplePerson.children.join('; ')],
                  ['Burial', samplePerson.burial],
                ] as const).map(([k, v], i) => (
                  <tr key={k} style={{ borderBottom: i < 6 ? `1px solid ${indigo}15` : 'none' }}>
                    <td style={{ padding: '9px 14px 9px 0', fontWeight: 700, color: wine, width: 120, verticalAlign: 'top', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 }}>{k}</td>
                    <td style={{ padding: '9px 0', color: '#333' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ maxWidth: 740, margin: '0 auto', padding: '0 24px 56px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0, border: `2px solid ${indigo}` }}>
          {sampleStats.map((s, i) => (
            <div key={s.label} style={{ textAlign: 'center', padding: '20px 8px', background: i % 2 === 0 ? '#fff' : '#F8F5EE', borderRight: i < sampleStats.length - 1 ? `1px solid ${indigo}20` : 'none' }}>
              <div style={{ fontSize: 26, fontWeight: 600, color: indigo }}>{s.value}</div>
              <div style={{ fontSize: 10, color: goldMuted, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4, fontFamily: "'Inter', sans-serif" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  THEME 9 — Delft Minimal                                           */
/*  Dutch blue + white, clean geometric, tile-pattern accents          */
/* ================================================================== */
function DelftMinimal() {
  const delft = '#003366'
  const white = '#FFFFFF'
  const lightBlue = '#EDF2F7'
  const warmGold = '#C4983A'

  return (
    <div style={{ background: white, color: '#1a1a1a', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Nav */}
      <nav style={{ background: white, borderBottom: `3px solid ${delft}`, padding: '0 24px' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <span style={{ color: delft, fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="1" y="1" width="8" height="8" stroke={delft} strokeWidth="2" /><rect x="11" y="1" width="8" height="8" stroke={delft} strokeWidth="2" /><rect x="1" y="11" width="8" height="8" stroke={delft} strokeWidth="2" /><rect x="11" y="11" width="8" height="8" fill={delft} /></svg>
            Coenen Ancestry
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {['Home', 'Family Tree', 'People', 'Sources', 'Gallery'].map(l => (
              <span key={l} style={{
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                color: l === 'Home' ? white : delft,
                background: l === 'Home' ? delft : 'transparent',
                borderRadius: 4,
              }}>{l}</span>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: delft, padding: '56px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 40, fontWeight: 700, margin: 0, color: white, letterSpacing: -0.5 }}>
          Coenen Family Ancestry
        </h1>
        <p style={{ color: '#8BAAC8', maxWidth: 500, margin: '12px auto 0', fontSize: 15, lineHeight: 1.7 }}>
          From parish registers in 1714 to the Fox River Valley of Wisconsin.
        </p>
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button style={{ background: warmGold, color: '#1a1a1a', border: 'none', padding: '10px 24px', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            View Family Tree
          </button>
          <button style={{ background: 'transparent', color: white, border: `1px solid #fff6`, padding: '10px 24px', borderRadius: 4, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            Browse People
          </button>
        </div>
      </div>
      {/* Tile strip */}
      <div style={{ height: 8, background: `repeating-linear-gradient(90deg, ${delft} 0px, ${delft} 10px, ${white} 10px, ${white} 12px, ${warmGold} 12px, ${warmGold} 14px, ${white} 14px, ${white} 16px)` }} />

      {/* Person card */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ background: lightBlue, borderRadius: 8, overflow: 'hidden', border: `1px solid ${delft}20` }}>
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: delft }}>{samplePerson.name}</h2>
              <p style={{ margin: '2px 0 0', color: '#666', fontSize: 13 }}>1906 – 1983 &middot; Kaukauna, Wisconsin</p>
            </div>
            <span style={{ background: '#d4edda', color: '#155724', padding: '4px 12px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>High</span>
          </div>
          <div style={{ padding: '0 24px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {([
                ['Born', '1906-02-15, Kaukauna, WI'],
                ['Died', '1983-11-30, Appleton, WI'],
                ['Father', samplePerson.father],
                ['Mother', samplePerson.mother],
                ['Spouse', samplePerson.spouse],
                ['Occupation', samplePerson.occupation],
                ['Children', samplePerson.children.join(', ')],
                ['Burial', samplePerson.burial],
              ] as const).map(([k, v]) => (
                <div key={k} style={{ background: white, borderRadius: 6, padding: '10px 14px', border: `1px solid ${delft}10` }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: delft, textTransform: 'uppercase', letterSpacing: 1 }}>{k}</div>
                  <div style={{ fontSize: 14, color: '#333', marginTop: 3 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Family Lines */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 20px' }}>
        <h3 style={{ color: delft, fontSize: 16, fontWeight: 600, marginBottom: 10 }}>Family Lines</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {familyLines.map(f => (
            <span key={f} style={{ padding: '6px 16px', borderRadius: 4, border: `1px solid ${delft}25`, fontSize: 13, fontWeight: 500, color: delft, cursor: 'pointer', background: lightBlue }}>
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 24px 48px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
        {sampleStats.map(s => (
          <div key={s.label} style={{ textAlign: 'center', borderRadius: 6, border: `2px solid ${delft}`, padding: '16px 8px', background: white }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: delft }}>{s.value}</div>
            <div style={{ fontSize: 10, color: warmGold, fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================================================================== */
/*  THEME 10 — Steel & Ink                                            */
/*  Cool grays + black + single warm accent, editorial precision       */
/* ================================================================== */
function SteelAndInk() {
  const black = '#0A0A0A'
  const steel = '#4A5568'
  const warmAccent = '#C07028'
  const offWhite = '#FAFAFA'
  const lightGray = '#F0F0F0'

  return (
    <div style={{ background: offWhite, color: black, fontFamily: "'Merriweather', 'Georgia', serif" }}>
      {/* Nav */}
      <nav style={{ background: black, padding: '0 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 50 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: 1 }}>COENEN ANCESTRY</span>
          <div style={{ display: 'flex', gap: 20 }}>
            {['Home', 'Family Tree', 'People', 'Sources', 'Gallery'].map(l => (
              <span key={l} style={{ fontSize: 12, cursor: 'pointer', color: l === 'Home' ? warmAccent : '#999', fontWeight: 500, letterSpacing: 0.5 }}>{l}</span>
            ))}
          </div>
        </div>
      </nav>
      <div style={{ height: 3, background: `linear-gradient(90deg, ${warmAccent}, ${warmAccent} 20%, ${black} 20%)` }} />

      {/* Hero */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px 48px' }}>
        <div style={{ borderLeft: `4px solid ${warmAccent}`, paddingLeft: 24 }}>
          <h1 style={{ fontSize: 42, fontWeight: 900, margin: 0, lineHeight: 1.15, color: black }}>
            Coenen Family<br />Ancestry
          </h1>
          <p style={{ color: steel, fontSize: 16, lineHeight: 1.8, margin: '16px 0 0', maxWidth: 480 }}>
            Eleven generations documented from the parish registers of Noord-Brabant, Netherlands to the Fox River Valley of Wisconsin.
          </p>
        </div>
        <div style={{ marginTop: 32, display: 'flex', gap: 12 }}>
          <button style={{ background: black, color: '#fff', border: 'none', padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
            View Family Tree
          </button>
          <button style={{ background: 'transparent', color: black, border: `2px solid ${black}`, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
            Browse People
          </button>
        </div>
      </div>

      {/* Person card */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 48px' }}>
        <div style={{ background: '#fff', border: `1px solid #ddd` }}>
          <div style={{ padding: '18px 24px', borderBottom: `1px solid #eee`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: black }}>{samplePerson.name}</h2>
              <p style={{ margin: '2px 0 0', color: steel, fontSize: 13 }}>b. 1906 &middot; d. 1983 &middot; Kaukauna, Wisconsin</p>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: '#3d7a3d', background: '#e8f5e0', padding: '4px 12px', fontFamily: "'Inter', sans-serif" }}>High</span>
          </div>
          <div style={{ padding: '20px 24px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                {([
                  ['Full Name', samplePerson.name],
                  ['Born', `February 15, 1906 — Kaukauna, Outagamie Co., WI`],
                  ['Died', `November 30, 1983 — Appleton, Outagamie Co., WI`],
                  ['Father', samplePerson.father],
                  ['Mother', samplePerson.mother],
                  ['Spouse', samplePerson.spouse],
                  ['Children', samplePerson.children.join('; ')],
                  ['Burial', samplePerson.burial],
                ] as const).map(([k, v], i) => (
                  <tr key={k} style={{ background: i % 2 === 0 ? lightGray : '#fff' }}>
                    <td style={{ padding: '9px 14px', fontWeight: 700, color: steel, width: 130, verticalAlign: 'top', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: "'Inter', sans-serif" }}>{k}</td>
                    <td style={{ padding: '9px 14px', color: '#333' }}>{k === 'Father' || k === 'Mother' || k === 'Spouse' ? <span style={{ color: warmAccent, cursor: 'pointer' }}>{v}</span> : v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Patrilineal */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 48px' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: black, marginBottom: 12, fontFamily: "'Inter', sans-serif", textTransform: 'uppercase', letterSpacing: 1 }}>Direct Patrilineal Line</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, background: '#fff', border: '1px solid #ddd' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${black}` }}>
              {['Gen', 'Name', 'Born', 'Died', 'Birthplace'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: steel, fontFamily: "'Inter', sans-serif" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {patrilinealLine.map((p, i) => (
              <tr key={p.gen} style={{ borderBottom: '1px solid #eee', background: i % 2 === 0 ? lightGray : '#fff' }}>
                <td style={{ padding: '9px 12px', color: '#aaa', fontFamily: "'Inter', sans-serif", fontSize: 12 }}>{p.gen}</td>
                <td style={{ padding: '9px 12px' }}><span style={{ color: warmAccent, cursor: 'pointer', fontWeight: 600 }}>{p.name}</span></td>
                <td style={{ padding: '9px 12px', color: '#666' }}>{p.born}</td>
                <td style={{ padding: '9px 12px', color: '#666' }}>{p.died}</td>
                <td style={{ padding: '9px 12px', color: '#888' }}>{p.birthplace}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stats */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 24px 56px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0, borderTop: `3px solid ${black}`, borderBottom: `1px solid #ddd` }}>
          {sampleStats.map((s, i) => (
            <div key={s.label} style={{ textAlign: 'center', padding: '20px 8px', borderRight: i < sampleStats.length - 1 ? '1px solid #eee' : 'none' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: black }}>{s.value}</div>
              <div style={{ fontSize: 10, color: steel, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4, fontFamily: "'Inter', sans-serif" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  Utility                                                           */
/* ================================================================== */
function parseInlineStyle(str: string): React.CSSProperties {
  const obj: Record<string, string> = {}
  str.split(';').forEach(pair => {
    const [k, v] = pair.split(':').map(s => s.trim())
    if (k && v) {
      const camel = k.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
      obj[camel] = v
    }
  })
  return obj
}

/* ================================================================== */
/*  Main Mockup Page                                                  */
/* ================================================================== */
const themes = [
  { id: 'archive', name: '1. Old World Archive', subtitle: 'Vintage Document', component: OldWorldArchive },
  { id: 'dutch', name: '2. Dutch Heritage', subtitle: 'Netherlands-Inspired', component: DutchHeritage },
  { id: 'modern', name: '3. Modern Genealogy', subtitle: 'Data Dashboard', component: ModernDashboard },
  { id: 'roots', name: '4. Family Roots', subtitle: 'Earth-Tone Nature', component: FamilyRoots },
  { id: 'ink', name: '5. Ink & Paper', subtitle: 'Minimalist Monochrome', component: InkAndPaper },
  { id: 'museum', name: '6. Museum Catalogue', subtitle: 'Dark Charcoal + Copper, Gallery Exhibit', component: MuseumCatalogue },
  { id: 'cartographer', name: '7. Cartographer', subtitle: 'Teal + Parchment, Old-Map Engraved', component: Cartographer },
  { id: 'press', name: '8. Heritage Press', subtitle: 'Deep Indigo + Cream, Letterpress Book', component: HeritagePress },
  { id: 'delft', name: '9. Delft Minimal', subtitle: 'Dutch Blue + White, Clean Geometric', component: DelftMinimal },
  { id: 'steel', name: '10. Steel & Ink', subtitle: 'Cool Gray + Warm Accent, Editorial Precision', component: SteelAndInk },
]

export default function ThemeMockups() {
  const [activeTheme, setActiveTheme] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-stone-900">
      {/* Sticky theme selector */}
      <div className="sticky top-14 z-40 bg-stone-900/95 backdrop-blur-sm border-b border-stone-700 px-4 py-3">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 overflow-x-auto">
            <span className="text-stone-400 text-sm font-medium whitespace-nowrap">Theme Mockups:</span>
            <button
              onClick={() => setActiveTheme(null)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                activeTheme === null ? 'bg-amber-700 text-white' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              Show All
            </button>
            {themes.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTheme(t.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTheme === t.id ? 'bg-amber-700 text-white' : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Theme sections */}
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-12">
        {themes
          .filter(t => !activeTheme || t.id === activeTheme)
          .map(t => (
            <section key={t.id}>
              <div className="mb-4">
                <h2 className="text-2xl font-bold text-white">{t.name}</h2>
                <p className="text-stone-400 text-sm">{t.subtitle}</p>
              </div>
              <div className="rounded-xl overflow-hidden border border-stone-700 shadow-2xl">
                <t.component />
              </div>
            </section>
          ))}
      </div>
    </div>
  )
}
