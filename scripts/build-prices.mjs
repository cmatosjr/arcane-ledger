#!/usr/bin/env node
/**
 * Streams Scryfall's default_cards bulk JSON and writes public/prices.json.
 * Uses a character-level streaming parser to avoid loading the full ~538MB
 * response into a single string (which exceeds Node's string length limit).
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

const normName = s => s.toLowerCase().replace(/[''`''ʼ]/g, "'")

/**
 * Streams a JSON array response and calls onCard() for each top-level object.
 * Tracks brace/bracket depth and string state to find object boundaries without
 * ever holding the full response as a single string.
 */
async function streamJsonArray(url, onCard) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching bulk data`)

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()

  let depth    = 0
  let inString = false
  let escaped  = false
  let buf      = ''
  let count    = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value, { stream: true })

    for (let i = 0; i < text.length; i++) {
      const ch = text[i]

      // Escape sequences inside strings
      if (escaped) {
        escaped = false
        if (depth >= 2) buf += ch
        continue
      }
      if (ch === '\\' && inString) {
        escaped = true
        if (depth >= 2) buf += ch
        continue
      }

      // String boundaries
      if (ch === '"') {
        inString = !inString
        if (depth >= 2) buf += ch
        continue
      }
      if (inString) {
        if (depth >= 2) buf += ch
        continue
      }

      // Structural characters
      if (ch === '{' || ch === '[') {
        depth++
        if (depth >= 2) buf += ch
        continue
      }
      if (ch === '}' || ch === ']') {
        if (depth >= 2) buf += ch
        depth--
        if (depth === 1 && ch === '}') {
          // Completed one top-level array element (a card object)
          try { onCard(JSON.parse(buf)) } catch { /* skip malformed entries */ }
          buf = ''
          count++
          if (count % 10000 === 0) process.stdout.write(`\r  ${count.toLocaleString()} cards...`)
        }
        continue
      }

      if (depth >= 2) buf += ch
    }
  }

  return count
}

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

  // Step 2: stream the bulk JSON, building the card map
  console.log('Streaming card data...')
  const cardMap = {}

  const total = await streamJsonArray(entry.download_uri, card => {
    if (SKIP_LAYOUTS.has(card.layout)) return
    const price = card.prices?.usd
    if (!price || parseFloat(price) <= 0) return

    const key = normName(card.name)
    if (!cardMap[key]) cardMap[key] = { name: card.name, printings: [] }
    cardMap[key].printings.push({
      set: `${card.set_name} (${card.set.toUpperCase()})`,
      price,
    })
  })

  process.stdout.write(`\r  ${total.toLocaleString()} cards processed\n`)

  // Sort each card's printings cheapest first
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
  console.log(`\n✓ ${count.toLocaleString()} unique cards → ${OUT} (${mb}MB)`)
  console.log(`  Data date: ${date}`)
}

main().catch(err => { console.error(err.message); process.exit(1) })
