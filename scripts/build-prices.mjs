#!/usr/bin/env node
/**
 * Downloads Scryfall's bulk card data and writes public/prices.json.
 * Skips if the existing file is less than 20 hours old.
 *
 * Usage:
 *   node scripts/build-prices.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

const OUT = 'public/prices.json'

const SKIP_LAYOUTS = new Set([
  'token', 'double_faced_token', 'art_series', 'emblem',
  'planar', 'scheme', 'vanguard', 'conspiracy',
])

const normName = s => s.toLowerCase().replace(/[''`‘’ʼ]/g, "'")

async function main() {
  // Skip if the existing file is recent enough
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

  // Step 1: get the download URL from Scryfall's bulk-data manifest
  process.stdout.write('Fetching Scryfall bulk-data manifest... ')
  const manifest = await fetch('https://api.scryfall.com/bulk-data').then(r => r.json())
  const entry    = manifest.data.find(d => d.type === 'default_cards')
  if (!entry) throw new Error('default_cards not found in Scryfall bulk-data manifest')
  console.log(`found (${(entry.size / 1e6).toFixed(0)}MB)`)

  // Step 2: download — Scryfall serves this gzip-compressed; fetch decodes automatically
  process.stdout.write('Downloading... ')
  const cards = await fetch(entry.download_uri).then(r => r.json())
  console.log(`${cards.length.toLocaleString()} printings`)

  // Step 3: group by card name, cheapest printing first
  process.stdout.write('Building price index... ')
  const cardMap = {}

  for (const card of cards) {
    if (SKIP_LAYOUTS.has(card.layout)) continue
    const price = card.prices?.usd
    if (!price || parseFloat(price) <= 0) continue

    const key = normName(card.name)
    if (!cardMap[key]) cardMap[key] = { name: card.name, printings: [] }
    cardMap[key].printings.push({
      set: `${card.set_name} (${card.set.toUpperCase()})`,
      price,
    })
  }

  for (const c of Object.values(cardMap)) {
    c.printings.sort((a, b) => parseFloat(a.price) - parseFloat(b.price))
  }

  // Index DFCs and split cards by front-face name so "Delver of Secrets" matches
  for (const [key, card] of Object.entries({ ...cardMap })) {
    const front    = card.name.split(' // ')[0].trim()
    const frontKey = normName(front)
    if (frontKey !== key && !cardMap[frontKey]) cardMap[frontKey] = card
  }

  if (!existsSync('public')) mkdirSync('public', { recursive: true })

  const date   = entry.updated_at.slice(0, 10)
  const output = { date, cards: cardMap }
  const json   = JSON.stringify(output)
  writeFileSync(OUT, json)

  const count = Object.keys(cardMap).length
  const mb    = (Buffer.byteLength(json) / 1e6).toFixed(1)
  console.log(`${count.toLocaleString()} unique cards`)
  console.log(`\n✓ ${OUT} (${mb}MB) — data date: ${date}`)
}

main().catch(err => { console.error(err.message); process.exit(1) })
