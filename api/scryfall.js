// api/scryfall.js — Vercel serverless function
// Proxies requests to Scryfall API to avoid CORS issues on mobile browsers.
// Usage:
//   GET /api/scryfall?path=/cards/named&exact=Sol+Ring
//   GET /api/scryfall?path=/cards/search&q=oracleid%3Axxx&unique=prints&order=usd

export default async function handler(req, res) {
  // CORS headers — allow any origin for beta testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { path, ...params } = req.query;

  if (!path) {
    res.status(400).json({ error: 'Missing path parameter' });
    return;
  }

  // Build Scryfall URL
  const qs = new URLSearchParams(params).toString();
  const url = `https://api.scryfall.com${path}${qs ? '?' + qs : ''}`;

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'User-Agent': 'ArcaneLeader/1.0 (MTG deck analyzer beta)',
        'Accept': 'application/json',
      },
    };

    if (req.method === 'POST') {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(req.body);
    }

    const upstream = await fetch(url, fetchOptions);

    const data = await upstream.json();

    // Pass through Scryfall's status code
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach Scryfall', detail: err.message });
  }
}
