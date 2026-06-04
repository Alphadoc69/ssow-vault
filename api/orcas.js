// File location in your repo:  /api/orcas.js
//
// Checks whether a wallet owns any "Secret Society Security Orcas" NFTs.
// The game uses this to unlock the in-game Orca cannon ally.
// Mirrors your /api/whales.js: same Upstash caching + per-IP rate limiting,
// reuses the same env vars, and quietly falls back if Upstash is unreachable.

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

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

const COLLECTION = 'secret-society-security-orcas'; // OpenSea collection slug
const CACHE_TTL  = 300; // seconds an ownership result stays cached
const RL_MAX     = 30;  // max lookups per visitor per minute
const RL_WINDOW  = 60;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { wallet } = req.query;
  if (!wallet || !wallet.startsWith('0x') || wallet.length < 10) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  // rate limit per visitor (skips gracefully if Redis is unavailable)
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const count = await redis(['INCR', `orcas:rl:${ip}`]);
  if (count !== null) {
    if (count === 1) await redis(['EXPIRE', `orcas:rl:${ip}`, String(RL_WINDOW)]);
    if (count > RL_MAX) {
      return res.status(429).json({ error: 'Too many requests — slow down a moment.' });
    }
  }

  // cache lookup
  const cacheKey = `orcas:cache:${wallet.toLowerCase()}`;
  const cached = await redis(['GET', cacheKey]);
  if (cached) {
    try {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(JSON.parse(cached));
    } catch { /* fall through */ }
  }

  const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
  if (!OPENSEA_API_KEY) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }
  const params = new URLSearchParams({ collection: COLLECTION, limit: '200' });
  const url = `https://api.opensea.io/api/v2/chain/ethereum/account/${wallet}/nfts?${params}`;
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json', 'x-api-key': OPENSEA_API_KEY },
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data.errors?.[0] || data.detail || `OpenSea error ${response.status}`,
      });
    }
    const nfts = data.nfts || [];
    const images = nfts.map(n => n.display_image_url || n.image_url || '').filter(Boolean);
    const result = {
      owns: nfts.length > 0,
      count: nfts.length,
      image: images[0] || '',   // kept for backward-compatibility
      images: images.slice(0, 60),
    };
    await redis(['SET', cacheKey, JSON.stringify(result), 'EX', String(CACHE_TTL)]);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reach OpenSea API' });
  }
}
