// File location in your repo:  /api/wealthy.js
//
// Counts a wallet's Wealthy Whales across BOTH collections (Gen1 + Gen2),
// treated identically. Used to unlock the XP multiplier, pearls, and the vault.
// Mirrors /api/whales.js: same Upstash caching + per-IP rate limiting, same env vars.

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
  } catch { return null; }
}

const COLLECTIONS = ['ssowwealthywhales', 'wealthy-whales-gen2']; // both treated the same
const CACHE_TTL = 300;
const RL_MAX = 30, RL_WINDOW = 60;

async function fetchCollection(wallet, slug, key) {
  const params = new URLSearchParams({ collection: slug, limit: '200' });
  const url = `https://api.opensea.io/api/v2/chain/ethereum/account/${wallet}/nfts?${params}`;
  const r = await fetch(url, { headers: { accept: 'application/json', 'x-api-key': key } });
  if (!r.ok) return [];
  const d = await r.json();
  return d.nfts || [];
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { wallet } = req.query;
  if (!wallet || !wallet.startsWith('0x') || wallet.length < 10)
    return res.status(400).json({ error: 'Invalid wallet address' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const count = await redis(['INCR', `wealthy:rl:${ip}`]);
  if (count !== null) {
    if (count === 1) await redis(['EXPIRE', `wealthy:rl:${ip}`, String(RL_WINDOW)]);
    if (count > RL_MAX) return res.status(429).json({ error: 'Too many requests — slow down a moment.' });
  }

  const cacheKey = `wealthy:cache:${wallet.toLowerCase()}`;
  const cached = await redis(['GET', cacheKey]);
  if (cached) { try { res.setHeader('X-Cache', 'HIT'); return res.status(200).json(JSON.parse(cached)); } catch {} }

  const KEY = process.env.OPENSEA_API_KEY;
  if (!KEY) return res.status(500).json({ error: 'API key not configured on server' });

  try {
    const lists = await Promise.all(COLLECTIONS.map(s => fetchCollection(wallet, s, KEY)));
    const nfts = lists.flat();
    const images = nfts.map(n => n.display_image_url || n.image_url || '').filter(Boolean).slice(0, 60);
    const result = { owns: nfts.length > 0, count: nfts.length, images };
    await redis(['SET', cacheKey, JSON.stringify(result), 'EX', String(CACHE_TTL)]);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reach OpenSea API' });
  }
}
