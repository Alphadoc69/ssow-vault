// File location in your repo:  /api/pearls.js
//
// The Pearl Vault for Wealthy Whale holders. Pearls persist per wallet in Upstash.
// GET  ?wallet=0x...                      -> { pearls }
// POST { wallet, action:'add',   amount } -> banks pearls (capped per call)   -> { pearls }
// POST { wallet, action:'spend', amount } -> spends pearls (never below zero) -> { pearls }
//
// Anti-cheat guardrails (it is NOT cryptographically secure — see notes in chat):
//  - 'add' is capped per call (MAX_ADD) so nobody can inject a huge balance at once
//  - per-IP rate limiting
//  - 'spend' can never push the balance below zero
// For real security you'd add wallet-signature auth; fine to add later if pearls ever matter.

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

const MAX_ADD = 300;       // most pearls bankable in a single save
const RL_MAX = 60, RL_WINDOW = 60;

function keyFor(wallet) { return `pearls:bal:${String(wallet).toLowerCase()}`; }

export default async function handler(req, res) {
  // rate limit everyone
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const c = await redis(['INCR', `pearls:rl:${ip}`]);
  if (c !== null) {
    if (c === 1) await redis(['EXPIRE', `pearls:rl:${ip}`, String(RL_WINDOW)]);
    if (c > RL_MAX) return res.status(429).json({ error: 'Too many requests' });
  }

  if (req.method === 'GET') {
    const { wallet } = req.query;
    if (!wallet || !wallet.startsWith('0x')) return res.status(400).json({ error: 'Invalid wallet' });
    const bal = parseInt(await redis(['GET', keyFor(wallet)])) || 0;
    return res.status(200).json({ pearls: bal });
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const { wallet, action } = body || {};
    let amount = parseInt(body && body.amount) || 0;
    if (!wallet || !String(wallet).startsWith('0x')) return res.status(400).json({ error: 'Invalid wallet' });
    if (amount <= 0) { const bal = parseInt(await redis(['GET', keyFor(wallet)])) || 0; return res.status(200).json({ pearls: bal }); }

    const k = keyFor(wallet);
    const current = parseInt(await redis(['GET', k])) || 0;

    if (action === 'add') {
      amount = Math.min(amount, MAX_ADD);           // cap injection
      const next = current + amount;
      await redis(['SET', k, String(next)]);
      return res.status(200).json({ pearls: next });
    }
    if (action === 'spend') {
      if (amount > current) return res.status(400).json({ error: 'Not enough pearls', pearls: current });
      const next = current - amount;
      await redis(['SET', k, String(next)]);
      return res.status(200).json({ pearls: next });
    }
    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
