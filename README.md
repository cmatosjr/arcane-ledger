# Arcane Ledger — MTG Deck Analyzer

Commander deck analyzer. Paste a decklist, get a bulk pull list + expensive card hunting guide with live prices from Scryfall.

---

## Deploy to Vercel (free, ~5 minutes)

### 1. Create a GitHub repo

1. Go to [github.com/new](https://github.com/new)
2. Name it `arcane-ledger` (or anything you like)
3. Set to **Public** or **Private** — both work
4. Click **Create repository**

### 2. Push this project

In your terminal, inside this folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/arcane-ledger.git
git push -u origin main
```

### 3. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub (free)
2. Click **Add New → Project**
3. Import your `arcane-ledger` repo
4. Vercel auto-detects Vite — no settings to change
5. Click **Deploy**

You'll get a live URL like `https://arcane-ledger-xyz.vercel.app` in about 60 seconds.

### 4. Share with friends

Send them the Vercel URL. Works on mobile and desktop.

Every time you push to `main`, Vercel redeploys automatically.

---

## Run locally

Requires Node.js 18+

```bash
npm install
npm run dev
```

Open http://localhost:5173

Note: The Scryfall proxy (`/api/scryfall`) only runs on Vercel or in a proper Node server environment. For local dev, you can either:
- Install the [Vercel CLI](https://vercel.com/docs/cli): `npm i -g vercel` then run `vercel dev`
- Or temporarily replace `/api/scryfall?path=...` calls in `src/App.jsx` with direct `https://api.scryfall.com` calls (works in desktop Chrome, not mobile)

---

## Run with Docker

```bash
docker compose up --build
```

Open http://localhost:8080

Note: The Docker setup serves the built frontend only — the Scryfall proxy needs a Node runtime. For Docker with proxy support, use the Vercel CLI or add a small Express server.

---

## How it works

1. User pastes a decklist (any standard MTG format)
2. Basic lands are stripped automatically
3. Each card is looked up via `/api/scryfall` (a Vercel serverless function proxying Scryfall)
4. All printings are fetched and sorted by price
5. Cards are split: **expensive** (≥ threshold) and **bulk** (< threshold)
6. Expensive cards show all printings with prices — gold highlights = cheaper than your threshold
7. Bulk cards show all sets they appear in — for pulling from your collection
