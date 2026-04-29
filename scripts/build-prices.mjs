#!/usr/bin/env node
/**
 * Downloads MTGJson bulk data and writes public/prices.json.
 * Skips if the existing file is less than 20 hours old.
 *
 * Usage:
 *   node scripts/build-prices.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { gunzip } from 'node:zlib'
import { promisify } from 'node:util'

const gunzipAsync = promisify(gunzip)
const BASE = 'https://mtgjson.com/api/v5'
const OUT  = 'public/prices.json'

const SKIP_LAYOUTS = new Set([
  'token', 'double_faced_token', 'art_series', 'emblem',
  'planar', 'scheme', 'vanguard', 'conspiracy',
])

const normName = s => s.toLowerCase().replace(/[''`‘’ʼ]/g, "'")

async function fetchGzip(name) {
  process.stdout.write(`  ${name}... `)
  const res = await fetch(`${BASE}/${name}.json.gz`)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${name}`)
  const buf = Buffer.from(await res.arrayBuffer())
  process.stdout.write(`${(buf.length / 1e6).toFixed(1)}MB → parsing... `)
  const json = JSON.parse((await gunzipAsync(buf)).toString('utf8'))
  console.log('done')
  return json
}

async function main() {
  // Skip re-download if file is recent enough
  if (existsSync(OUT)) {
    try {
      const { date } = JSON.parse(readFileSync(OUT, 'utf8'))
      const ageH = (Date.now() - new Date(date).getTime()) / 3.6e6
      if (ageH < 20) {
        console.log(`prices.json is current (${date}, ${ageH.toFixed(1)}h old) — skipping`)
        return
      }
    } catch {}
  }

  console.log('Downloading MTGJson bulk data...')
  const [identifiers, prices, setList] = await Promise.all([
    fetchGzip('AllIdentifiers'),
    fetchGzip('AllPrices'),
    fetchGzip('SetList'),
  ])

  // set code (uppercase) → set name
  const setNames = Object.fromEntries(
    (setList.data ?? []).map(s => [s.code.toUpperCase(), s.name])
  )

  console.log('Building price index...')
  const cardMap = {}

  for (const [uuid, card] of Object.entries(identifiers.data)) {
    if (SKIP_LAYOUTS.has(card.layout)) continue
    if (!card.availability?.includes('paper')) continue

    const retail = prices.data[uuid]?.paper?.tcgplayer?.retail?.normal
    if (!retail) continue

    const latestDate = Object.keys(retail).sort().at(-1)
    if (!latestDate) continue
    const price = retail[latestDate]
    if (!price || price <= 0) continue

    const code = card.setCode.toUpperCase()
    const printing = {
      set: `${setNames[code] ?? code} (${code})`,
      price: price.toFixed(2),
    }

    // Index by full name; also index by front face for DFCs and split cards
    const names = [card.name]
    const front = card.name.split(' // ')[0].trim()
    if (front !== card.name) names.push(front)

    for (const n of names) {
      const key = normName(n)
      if (!cardMap[key]) cardMap[key] = { name: n, printings: [] }
      cardMap[key].printings.push(printing)
    }
  }

  // Sort each card's printings cheapest first
  for (const card of Object.values(cardMap)) {
    card.printings.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
  }

  if (!existsSync('public')) mkdirSync('public', { recursive: true })

  const output = { date: identifiers.meta.date, cards: cardMap }
  const json   = JSON.stringify(output)
  writeFileSync(OUT, json)

  const mb    = (Buffer.byteLength(json) / 1e6).toFixed(1)
  const count = Object.keys(cardMap).length
  console.log(`\n✓ ${count.toLocaleString()} cards → ${OUT} (${mb}MB)`)
  console.log(`  Data date: ${output.date}`)
}

main().catch(err => { console.error(err.message); process.exit(1) })
