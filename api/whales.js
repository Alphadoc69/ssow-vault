// File location in your repo:  /api/whales.js
//
// Pulls a wallet's Secret Society of Whales NFTs from OpenSea.
// Adds Upstash CACHING (fewer OpenSea calls + faster loads) and per-IP RATE LIMITING.
// Reuses the same Upstash database as your leaderboard — no new setup, no new env vars.
// If Upstash is ever unreachable, it quietly falls back to working exactly like before.

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

// run one Redis command via Upstash REST; returns null on any problem so the endpoint never breaks
async function redis(cmd) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const r = await fetch(KV_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
    });
    const j = await r.json();
    return j.result;
  } catch {
    return null;
  }
}

const CACHE_TTL = 180; // seconds a wallet's whales stay cached
const RL_MAX    = 30;  // max wallet lookups per visitor per minute
const RL_WINDOW = 60;

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { wallet, next } = req.query;
  if (!wallet) {
    return res.status(400).json({ error: 'Missing wallet address' });
  }
  // Basic wallet format check
  if (!wallet.startsWith('0x') || wallet.length < 10) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  // --- rate limit per visitor (skips gracefully if Redis is unavailable) ---
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const count = await redis(['INCR', `whales:rl:${ip}`]);
  if (count !== null) {
    if (count === 1) await redis(['EXPIRE', `whales:rl:${ip}`, String(RL_WINDOW)]);
    if (count > RL_MAX) {
      return res.status(429).json({ error: 'Too many requests — slow down a moment.' });
    }
  }

  // --- cache lookup: serve a recent result without touching OpenSea ---
  const cacheKey = `whales:cache:${wallet.toLowerCase()}:${next || '0'}`;
  const cached = await redis(['GET', cacheKey]);
  if (cached) {
    try {
      const data = JSON.parse(cached);
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(data);
    } catch {
      /* bad cache entry — fall through and fetch fresh */
    }
  }

  // API key lives here on the server — never sent to the browser
  const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
  if (!OPENSEA_API_KEY) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }
  const params = new URLSearchParams({
    collection: 'secretsocietyofwhales',
    limit: '200',
  });
  if (next) params.set('next', next);
  const url = `https://api.opensea.io/api/v2/chain/ethereum/account/${wallet}/nfts?${params}`;
  try {
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'x-api-key': OPENSEA_API_KEY,
      },
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data.errors?.[0] || data.detail || `OpenSea error ${response.status}`,
      });
    }
    // Save to cache for the next visitor (best-effort)
    await redis(['SET', cacheKey, JSON.stringify(data), 'EX', String(CACHE_TTL)]);
    // Allow browser/CDN to cache for 60 seconds
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reach OpenSea API' });
  }
}
