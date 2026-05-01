import { useState, useCallback, useEffect } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────

const BASIC_LANDS = new Set([
  'Plains','Island','Swamp','Mountain','Forest','Wastes',
  'Snow-Covered Plains','Snow-Covered Island','Snow-Covered Swamp',
  'Snow-Covered Mountain','Snow-Covered Forest',
])

const SAMPLE_DECK = `1 Sol Ring
1 Arcane Signet
1 Command Tower
1 Fabled Passage
1 Reliquary Tower
1 Hardened Scales
1 Ozolith, the Shattered Spire
1 Primordial Hydra
1 Unbound Flourishing
1 Hydroid Krasis
1 Beast Within
1 Cyclonic Rift
1 Rhystic Study
1 Cultivate
1 Kodama's Reach
6 Forest
7 Island`

// ─── MTGJson price data ───────────────────────────────────────────────────────

const normName = s => s.toLowerCase().replace(/[''`''ʼ]/g, "'")

let _priceData = null

async function loadPrices() {
  if (_priceData) return _priceData
  const res = await fetch('/prices.json')
  if (!res.ok) throw new Error('Price data unavailable — run: npm run build:prices')
  _priceData = await res.json()
  return _priceData
}

// ─── Deck parser ──────────────────────────────────────────────────────────────

function parseDecklist(text) {
  const cards = []
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith('#')) continue
    const m = line.match(/^(\d+)[x×]?\s+(.+?)(?:\s+\([\w\d-]+\))?(?:\s+\d+)?$/i)
    if (m) {
      const name = m[2].trim()
      if (!BASIC_LANDS.has(name)) cards.push({ qty: parseInt(m[1]), name })
    }
  }
  return cards
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:          #0b0d14;
    --surface:     #111520;
    --surface2:    #161b2a;
    --surface3:    #1c2236;
    --border:      rgba(255,255,255,0.07);
    --border-gold: rgba(192,154,80,0.35);
    --gold:        #c09a50;
    --gold-light:  #e2bf7a;
    --gold-dim:    rgba(192,154,80,0.12);
    --teal:        #4ec9a8;
    --teal-dim:    rgba(78,201,168,0.1);
    --red:         #e05c5c;
    --text:        #ddd5c0;
    --text-muted:  #7a7060;
    --text-dim:    #3e3a30;
    --radius:      8px;
    --shadow:      0 8px 32px rgba(0,0,0,0.6);
    --font-display:'Cinzel', serif;
    --font-body:   'Crimson Pro', Georgia, serif;
  }

  html, body, #root { min-height: 100%; background: var(--bg); }
  body {
    font-family: var(--font-body);
    color: var(--text);
    font-size: 15px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(192,154,80,0.2); border-radius: 2px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(192,154,80,0.4); }

  @keyframes fadeUp {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position:-200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes pulse-teal {
    0%,100% { box-shadow: 0 0 0 0 rgba(78,201,168,0.4); }
    50%      { box-shadow: 0 0 0 5px rgba(78,201,168,0); }
  }

  .fade-up { animation: fadeUp .4s ease both; }

  /* ── Wrapper ── */
  .app { min-height:100vh; display:flex; flex-direction:column; }

  /* ── Header ── */
  .header {
    position: relative;
    padding: 32px 40px 24px;
    border-bottom: 1px solid var(--border-gold);
    background: linear-gradient(160deg,#0f1322 0%,var(--bg) 60%);
    overflow: hidden;
  }
  .header::before {
    content:'';
    position:absolute; inset:0;
    background: radial-gradient(ellipse 55% 90% at 8% 50%, rgba(192,154,80,0.07) 0%, transparent 70%);
    pointer-events:none;
  }
  .header-inner {
    position:relative;
    max-width:1140px; margin:0 auto;
    display:flex; align-items:flex-end; justify-content:space-between;
    gap:20px; flex-wrap:wrap;
  }
  .header-eyebrow {
    font-family:var(--font-display);
    font-size:10px; letter-spacing:.25em; color:var(--gold);
    text-transform:uppercase; margin-bottom:6px; opacity:.75;
  }
  .header-title {
    font-family:var(--font-display);
    font-size:clamp(22px,4vw,34px); font-weight:700;
    color:#f0e6cc; letter-spacing:.03em; line-height:1.1;
  }
  .header-title span {
    background: linear-gradient(90deg, var(--gold-light), var(--gold), var(--gold-light));
    background-size:200% auto;
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
    background-clip:text;
    animation: shimmer 4s linear infinite;
  }
  .header-sub { margin-top:5px; font-size:13px; color:var(--text-muted); font-style:italic; }

  .header-stats { display:flex; gap:18px; align-items:center; flex-wrap:wrap; }
  .stat { display:flex; flex-direction:column; align-items:flex-end; gap:1px; }
  .stat-val { font-family:var(--font-display); font-size:21px; color:var(--gold-light); line-height:1; }
  .stat-lbl { font-size:10px; color:var(--text-muted); letter-spacing:.08em; text-transform:uppercase; }
  .stat-div { width:1px; height:32px; background:var(--border-gold); }

  /* ── Input screen ── */
  .input-screen {
    flex:1; max-width:680px; margin:0 auto;
    padding:40px 24px 60px;
    display:flex; flex-direction:column; gap:24px;
    animation: fadeUp .5s ease both;
  }
  .input-intro {
    text-align:center;
  }
  .input-intro h2 {
    font-family:var(--font-display); font-size:16px; color:var(--text);
    letter-spacing:.06em; margin-bottom:8px;
  }
  .input-intro p { font-size:14px; color:var(--text-muted); line-height:1.6; }

  .input-card {
    background:var(--surface);
    border:1px solid var(--border);
    border-radius:var(--radius);
    overflow:hidden;
    box-shadow:var(--shadow);
  }
  .input-card-header {
    padding:14px 18px;
    border-bottom:1px solid var(--border);
    display:flex; align-items:center; justify-content:space-between;
  }
  .input-card-title {
    font-family:var(--font-display); font-size:11px;
    letter-spacing:.12em; text-transform:uppercase; color:var(--text-muted);
  }
  .sample-btn {
    font-family:var(--font-body); font-size:12px;
    background:none; border:1px solid var(--border);
    border-radius:4px; color:var(--text-muted);
    padding:3px 10px; cursor:pointer; transition:all .15s;
  }
  .sample-btn:hover { border-color:var(--gold); color:var(--gold); }

  textarea.decklist {
    width:100%; min-height:220px;
    background:transparent; border:none; outline:none; resize:vertical;
    color:var(--text); font-family:monospace; font-size:13px;
    line-height:1.7; padding:16px 18px;
  }
  textarea.decklist::placeholder { color:var(--text-dim); }

  .input-footer {
    padding:14px 18px;
    border-top:1px solid var(--border);
    display:flex; align-items:center; justify-content:space-between;
    gap:16px; flex-wrap:wrap;
    background:var(--surface2);
  }
  .threshold-group { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .threshold-label { font-size:13px; color:var(--text-muted); }
  .threshold-wrap {
    display:flex; align-items:center; gap:5px;
    background:var(--surface3); border:1px solid var(--border-gold);
    border-radius:6px; padding:5px 10px;
  }
  .threshold-wrap span { color:var(--gold); font-family:var(--font-display); font-size:13px; }
  .threshold-input {
    background:none; border:none; outline:none;
    color:var(--text); font-family:var(--font-body); font-size:14px; width:50px;
  }

  .analyze-btn {
    display:inline-flex; align-items:center; gap:8px;
    padding:10px 24px;
    background:linear-gradient(135deg,#a8842a,var(--gold));
    border:none; border-radius:6px;
    font-family:var(--font-display); font-size:11px; font-weight:700;
    letter-spacing:.1em; color:#0b0d14; cursor:pointer;
    transition:all .2s;
  }
  .analyze-btn:hover:not(:disabled) {
    background:linear-gradient(135deg,var(--gold),var(--gold-light));
    transform:translateY(-1px); box-shadow:0 4px 16px rgba(192,154,80,.35);
  }
  .analyze-btn:disabled { opacity:.4; cursor:not-allowed; }

  /* ── Progress ── */
  .progress-screen {
    flex:1; max-width:540px; margin:0 auto;
    padding:60px 24px;
    display:flex; flex-direction:column; align-items:center; gap:28px;
    animation:fadeUp .4s ease both;
  }
  .progress-spinner {
    width:48px; height:48px;
    border:2px solid var(--border);
    border-top-color:var(--gold);
    border-radius:50%;
    animation:spin .9s linear infinite;
  }
  .progress-title {
    font-family:var(--font-display); font-size:14px;
    letter-spacing:.1em; color:var(--text-muted);
    text-align:center;
  }
  .progress-bar-wrap {
    width:100%; background:var(--surface);
    border:1px solid var(--border); border-radius:6px;
    overflow:hidden; height:6px;
  }
  .progress-bar {
    height:100%;
    background:linear-gradient(90deg,#a8842a,var(--gold-light));
    transition:width .35s ease;
  }
  .progress-detail { font-size:13px; color:var(--text-dim); text-align:center; }
  .progress-cards {
    display:flex; flex-wrap:wrap; gap:6px; justify-content:center;
    max-width:420px;
  }
  .progress-card-chip {
    font-size:11px; padding:2px 8px;
    background:var(--surface2); border:1px solid var(--border);
    border-radius:4px; color:var(--text-muted);
    transition:all .3s;
  }
  .progress-card-chip.done {
    background:var(--gold-dim); border-color:var(--border-gold);
    color:var(--gold);
  }

  /* ── Results ── */
  .results-wrap { flex:1; display:flex; flex-direction:column; }

  .controls-bar {
    background:var(--surface); border-bottom:1px solid var(--border);
    padding:12px 40px;
  }
  .controls-inner {
    max-width:1140px; margin:0 auto;
    display:flex; align-items:center; gap:16px; flex-wrap:wrap;
  }
  .back-btn {
    display:inline-flex; align-items:center; gap:6px;
    font-family:var(--font-display); font-size:10px; letter-spacing:.1em;
    background:none; border:1px solid var(--border); border-radius:5px;
    color:var(--text-muted); padding:6px 12px; cursor:pointer; transition:all .15s;
  }
  .back-btn:hover { border-color:var(--gold); color:var(--gold); }
  .controls-threshold { display:flex; align-items:center; gap:8px; }
  .controls-right { margin-left:auto; display:flex; gap:8px; }

  .btn {
    display:inline-flex; align-items:center; gap:6px;
    padding:6px 14px; border-radius:5px;
    font-family:var(--font-display); font-size:10px; letter-spacing:.08em;
    cursor:pointer; transition:all .15s; border:none;
  }
  .btn-ghost { background:transparent; border:1px solid var(--border); color:var(--text-muted); }
  .btn-ghost:hover { border-color:var(--gold); color:var(--gold); }
  .btn-copied { background:var(--teal-dim) !important; border-color:var(--teal) !important; color:var(--teal) !important; }

  .main-grid {
    flex:1; max-width:1140px; margin:0 auto; width:100%;
    padding:24px 40px 40px;
    display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start;
  }

  /* ── Panel ── */
  .panel {
    background:var(--surface); border-radius:var(--radius);
    border:1px solid var(--border); overflow:hidden; box-shadow:var(--shadow);
  }
  .panel-gold {
    border-color:var(--border-gold);
    box-shadow:0 4px 28px rgba(0,0,0,.5), inset 0 0 0 1px rgba(192,154,80,.06);
  }
  .panel-hd {
    padding:14px 18px;
    display:flex; align-items:center; justify-content:space-between; gap:10px;
    border-bottom:1px solid var(--border);
  }
  .panel-gold .panel-hd {
    background:linear-gradient(135deg,rgba(192,154,80,.07),transparent);
    border-bottom-color:var(--border-gold);
  }
  .panel-title {
    font-family:var(--font-display); font-size:12px; font-weight:600;
    letter-spacing:.1em; text-transform:uppercase; color:var(--gold-light);
    display:flex; align-items:center; gap:7px;
  }
  .panel-bulk .panel-title { color:var(--text); }
  .panel-count { margin-top:2px; font-size:12px; color:var(--text-muted); }
  .panel-body { max-height:580px; overflow-y:auto; padding:2px 0; }

  /* ── Card row ── */
  .card-row {
    padding:10px 18px; border-bottom:1px solid var(--border);
    transition:background .12s;
    animation:fadeUp .3s ease both;
  }
  .card-row:last-child { border-bottom:none; }
  .card-row:hover { background:rgba(255,255,255,0.02); }
  .card-top {
    display:flex; align-items:baseline; gap:8px;
    margin-bottom:5px; flex-wrap:wrap;
  }
  .card-qty { font-family:var(--font-display); font-size:10px; color:var(--text-dim); min-width:14px; }
  .card-name { font-size:14px; font-weight:600; color:#ede3cf; letter-spacing:.01em; }
  .price-badge {
    display:inline-flex; align-items:center; gap:3px;
    background:var(--gold-dim); border:1px solid var(--border-gold);
    border-radius:4px; padding:1px 7px;
    font-family:var(--font-display); font-size:10px; font-weight:600;
    color:var(--gold-light); letter-spacing:.04em;
  }
  .deal-badge {
    display:inline-flex; align-items:center; gap:4px;
    background:var(--teal-dim); border:1px solid rgba(78,201,168,.3);
    border-radius:4px; padding:1px 7px;
    font-size:10px; color:var(--teal);
    animation:pulse-teal 2.5s ease infinite;
  }

  .set-tags { display:flex; flex-wrap:wrap; gap:4px; margin-top:1px; align-items:center; }
  .set-label { font-size:11px; color:var(--text-dim); font-style:italic; margin-right:2px; }
  .set-tag {
    display:inline-flex; align-items:center; gap:4px;
    padding:2px 7px; border-radius:4px; font-size:11px;
    background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07);
    color:#8a8070; white-space:nowrap; transition:all .12s;
  }
  .set-tag:hover { border-color:rgba(192,154,80,.3); color:var(--text); }
  .set-tag-gold { background:var(--gold-dim); border-color:rgba(192,154,80,.4); color:var(--gold-light); }
  .set-price { font-size:10px; color:var(--text-dim); }
  .set-tag-gold .set-price { color:var(--gold); }
  .expand-btn {
    padding:2px 7px; background:none;
    border:1px solid rgba(255,255,255,.06); border-radius:4px;
    color:var(--text-dim); font-size:10px; cursor:pointer; transition:all .12s;
  }
  .expand-btn:hover { border-color:var(--gold); color:var(--gold); }

  /* ── Error notice ── */
  .error-notice {
    max-width:1140px; margin:12px auto 0; padding:0 40px;
  }
  .error-box {
    background:rgba(224,92,92,.07); border:1px solid rgba(224,92,92,.25);
    border-radius:6px; padding:10px 14px;
    font-size:13px; color:#e07070;
  }

  /* ── Footer ── */
  .footer {
    border-top:1px solid var(--border);
    padding:14px 40px;
    display:flex; align-items:center; justify-content:center;
    gap:16px; font-size:11px; color:var(--text-dim); flex-wrap:wrap;
  }
  .footer-dot { opacity:.3; }

  /* ── Responsive ── */
  @media (max-width:760px) {
    .header { padding:22px 18px 18px; }
    .header-stats { display:none; }
    .controls-bar { padding:10px 18px; }
    .controls-right .btn span { display:none; }
    .main-grid { grid-template-columns:1fr; padding:16px 18px 32px; }
    .input-screen { padding:28px 18px 48px; }
    .footer { padding:12px 18px; }
    .error-notice { padding:0 18px; }
  }
`

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyBtn({ text, label }) {
  const [copied, setCopied] = useState(false)
  return (
    <button className={`btn btn-ghost ${copied ? 'btn-copied' : ''}`}
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
      {copied ? '✓ Copied' : label}
    </button>
  )
}

function buildText(cards, isExpensive) {
  return cards.map(c => {
    if (isExpensive) {
      const ps = (c.printings || []).filter(p => p.price).map(p => `${p.set} $${parseFloat(p.price).toFixed(2)}`).join(' | ')
      return `${c.qty}x ${c.name} — ${ps || 'no price data'}`
    }
    return `${c.qty}x ${c.name} — ${(c.printings || []).map(p => p.set).join(', ')}`
  }).join('\n')
}

function buildTCGPlayerText(cards) {
  return cards.map(c => `${c.qty} ${c.name}`).join('\n')
}

function CardRow({ card, threshold, isExpensive }) {
  const [expanded, setExpanded] = useState(false)
  const printings = card.printings || []
  const hasDeal = isExpensive && printings.some(p => p.price && parseFloat(p.price) < threshold)
  const visible = expanded ? printings : printings.slice(0, isExpensive ? 99 : 5)

  return (
    <div className="card-row">
      <div className="card-top">
        <span className="card-qty">{card.qty}×</span>
        <span className="card-name">{card.name}</span>
        {isExpensive && card.lowestPrice && (
          <span className="price-badge">⬡ ${parseFloat(card.lowestPrice).toFixed(2)}</span>
        )}
        {hasDeal && <span className="deal-badge">✦ deal available</span>}
      </div>
      <div className="set-tags">
        <span className="set-label">{isExpensive ? 'printings:' : 'pull from:'}</span>
        {visible.map((p, i) => {
          const isGold = isExpensive && p.price && parseFloat(p.price) < threshold
          return (
            <span key={i} className={`set-tag ${isGold ? 'set-tag-gold' : ''}`}>
              {p.set}
              {isExpensive && p.price && <span className="set-price">${parseFloat(p.price).toFixed(2)}</span>}
            </span>
          )
        })}
        {!expanded && !isExpensive && printings.length > 5 && (
          <button className="expand-btn" onClick={() => setExpanded(true)}>+{printings.length - 5} more</button>
        )}
        {printings.length === 0 && <span style={{fontSize:11,color:'var(--text-dim)'}}>no data</span>}
      </div>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

const VIEWS = { INPUT: 'input', LOADING: 'loading', RESULTS: 'results' }

export default function App() {
  const [view, setView]               = useState(VIEWS.INPUT)
  const [deckText, setDeckText]       = useState('')
  const [threshold, setThreshold]     = useState(2)
  const [progress, setProgress]       = useState({ done: 0, total: 0, current: '', completed: [] })
  const [expensive, setExpensive]     = useState([])
  const [bulk, setBulk]               = useState([])
  const [errors, setErrors]           = useState([])
  const [priceDate, setPriceDate]     = useState(null)

  // Pre-fetch price data as soon as the app loads
  useEffect(() => { loadPrices().then(d => setPriceDate(d.date)).catch(() => {}) }, [])

  const analyze = useCallback(async () => {
    const parsed = parseDecklist(deckText)
    if (!parsed.length) return

    setView(VIEWS.LOADING)
    setProgress({ done: 0, total: parsed.length, current: 'Loading price data…', completed: [] })

    let priceData
    try {
      priceData = await loadPrices()
      setPriceDate(priceData.date)
    } catch (err) {
      setErrors([err.message])
      setExpensive([])
      setBulk([])
      setView(VIEWS.RESULTS)
      return
    }

    const exp = [], blk = [], errs = []

    for (const { qty, name } of parsed) {
      const entry = priceData.cards[normName(name)]
      if (!entry) { errs.push(name); continue }

      const { printings } = entry
      const lowestPrice   = printings[0]?.price || null
      const cardData      = { name: entry.name, qty, lowestPrice, printings }

      if (lowestPrice && parseFloat(lowestPrice) >= threshold) {
        exp.push(cardData)
      } else {
        blk.push(cardData)
      }
    }

    exp.sort((a, b) => parseFloat(b.lowestPrice || 0) - parseFloat(a.lowestPrice || 0))
    blk.sort((a, b) => a.name.localeCompare(b.name))

    setProgress(p => ({ ...p, done: parsed.length, completed: parsed.map(c => c.name) }))
    setExpensive(exp)
    setBulk(blk)
    setErrors(errs)
    setView(VIEWS.RESULTS)
  }, [deckText, threshold])

  const totalValue = expensive.reduce((s, c) => s + parseFloat(c.lowestPrice || 0), 0)
  const dealCount  = expensive.filter(c => (c.printings || []).some(p => p.price && parseFloat(p.price) < threshold)).length
  const pct        = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const cardCount  = expensive.length + bulk.length

  return (
    <>
      <style>{STYLES}</style>
      <div className="app">

        {/* ── Header ── */}
        <header className="header">
          <div className="header-inner">
            <div>
              <div className="header-eyebrow">Commander Deck Intelligence</div>
              <h1 className="header-title"><span>Arcane</span> Ledger</h1>
              <p className="header-sub">MTG deck analyzer · bulk pull list + deal-hunting guide</p>
            </div>
            {view === VIEWS.RESULTS && (
              <div className="header-stats">
                <div className="stat">
                  <span className="stat-val">{cardCount}</span>
                  <span className="stat-lbl">Cards</span>
                </div>
                <div className="stat-div" />
                <div className="stat">
                  <span className="stat-val">{expensive.length}</span>
                  <span className="stat-lbl">Expensive</span>
                </div>
                <div className="stat-div" />
                <div className="stat">
                  <span className="stat-val">{dealCount}</span>
                  <span className="stat-lbl">Deals Found</span>
                </div>
                <div className="stat-div" />
                <div className="stat">
                  <span className="stat-val">${totalValue.toFixed(0)}</span>
                  <span className="stat-lbl">Above Threshold</span>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* ── Input screen ── */}
        {view === VIEWS.INPUT && (
          <div className="input-screen">
            <div className="input-intro">
              <h2>Analyze Your Commander Deck</h2>
              <p>Paste your decklist below. Basic lands are removed automatically. Prices are sourced from MTGJson bulk data — no per-card API calls, instant results.</p>
            </div>

            <div className="input-card">
              <div className="input-card-header">
                <span className="input-card-title">Decklist</span>
                <button className="sample-btn" onClick={() => setDeckText(SAMPLE_DECK)}>Load sample</button>
              </div>
              <textarea
                className="decklist"
                value={deckText}
                onChange={e => setDeckText(e.target.value)}
                placeholder={"1 Sol Ring\n1x Atraxa, Praetors' Voice\n1 Command Tower (CMR)\n1 Cyclonic Rift\n...\n\nSupports: 1 Name, 1x Name, 1 Name (SET)"}
                spellCheck={false}
              />
              <div className="input-footer">
                <div className="threshold-group">
                  <span className="threshold-label">Expensive if ≥</span>
                  <div className="threshold-wrap">
                    <span>$</span>
                    <input type="number" min="0.25" step="0.25" value={threshold}
                      onChange={e => setThreshold(parseFloat(e.target.value) || 2)}
                      className="threshold-input" />
                  </div>
                </div>
                <button className="analyze-btn" onClick={analyze}
                  disabled={!deckText.trim()}>
                  ⬡ Analyze Deck
                </button>
              </div>
            </div>

            <p style={{textAlign:'center',fontSize:12,color:'var(--text-dim)'}}>
              Prices from MTGJson · TCGPlayer non-foil USD
              {priceDate && <> · Updated {priceDate}</>}
            </p>
          </div>
        )}

        {/* ── Loading screen ── */}
        {view === VIEWS.LOADING && (
          <div className="progress-screen">
            <div className="progress-spinner" />
            <div className="progress-title">Consulting the Archives…</div>
            <div style={{width:'100%',maxWidth:420}}>
              <div className="progress-bar-wrap">
                <div className="progress-bar" style={{width:`${pct}%`}} />
              </div>
              <div className="progress-detail" style={{marginTop:8}}>
                <em style={{color:'var(--text-muted)'}}>{progress.current || 'Starting…'}</em>
                &nbsp;·&nbsp;{progress.done}/{progress.total}
              </div>
            </div>
            <div className="progress-cards">
              {parseDecklist(deckText).map(({ name }) => (
                <span key={name}
                  className={`progress-card-chip ${progress.completed.includes(name) ? 'done' : ''}`}>
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {view === VIEWS.RESULTS && (
          <div className="results-wrap">
            <div className="controls-bar">
              <div className="controls-inner">
                <button className="back-btn" onClick={() => setView(VIEWS.INPUT)}>← New Deck</button>
                <div className="controls-threshold threshold-group">
                  <span className="threshold-label" style={{fontSize:13}}>Threshold:</span>
                  <div className="threshold-wrap">
                    <span>$</span>
                    <input type="number" min="0.25" step="0.25" value={threshold}
                      onChange={e => setThreshold(parseFloat(e.target.value) || 2)}
                      className="threshold-input" />
                  </div>
                </div>
                <div className="controls-right">
                  <CopyBtn text={buildText(expensive, true)} label="Copy Hunt List" />
                  <CopyBtn text={buildText(bulk, false)} label="Copy Bulk List" />
                </div>
              </div>
            </div>

            {errors.length > 0 && (
              <div className="error-notice">
                <div className="error-box">
                  ⚠ Could not find: {errors.join(', ')}
                </div>
              </div>
            )}

            <div className="main-grid">
              <div className="panel panel-gold">
                <div className="panel-hd">
                  <div>
                    <div className="panel-title">⬡ Hunt List</div>
                    <div className="panel-count">
                      {expensive.length} cards ≥ ${threshold}
                      {dealCount > 0 && ` · ${dealCount} cheaper printings found`}
                    </div>
                  </div>
                  <CopyBtn text={buildText(expensive, true)} label="Copy" />
                </div>
                <div className="panel-body">
                  {expensive.length === 0
                    ? <div style={{padding:'32px 18px',textAlign:'center',color:'var(--text-dim)',fontStyle:'italic'}}>No cards above threshold</div>
                    : expensive.map((c, i) => <CardRow key={i} card={c} threshold={threshold} isExpensive={true} />)
                  }
                </div>
              </div>

              <div className="panel panel-bulk">
                <div className="panel-hd">
                  <div>
                    <div className="panel-title">◈ Bulk Pull List</div>
                    <div className="panel-count">{bulk.length} cards — pull from your collection</div>
                  </div>
                  <div style={{display:'flex',gap:6}}>
                    <CopyBtn text={buildTCGPlayerText(bulk)} label="TCGPlayer" />
                    <CopyBtn text={buildText(bulk, false)} label="Copy" />
                  </div>
                </div>
                <div className="panel-body">
                  {bulk.length === 0
                    ? <div style={{padding:'32px 18px',textAlign:'center',color:'var(--text-dim)',fontStyle:'italic'}}>No bulk cards</div>
                    : bulk.map((c, i) => <CardRow key={i} card={c} threshold={threshold} isExpensive={false} />)
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        <footer className="footer">
          <span>Basic lands removed automatically</span>
          <span className="footer-dot">·</span>
          <span>Prices via Scryfall API</span>
          <span className="footer-dot">·</span>
          <span>Verify before trading</span>
        </footer>
      </div>
    </>
  )
}
