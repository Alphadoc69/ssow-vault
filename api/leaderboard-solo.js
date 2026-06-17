// api/leaderboard-solo.js
// Keeps only the BEST run per wallet (or per name if no wallet)

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'solo:scores:v2';  // new key so old dupes don't bleed in

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── POST: submit score — one entry per player, keep best ──
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const { name, wallet, level, score, time, result, ts } = body || {};
    if (!name || level == null) return res.status(400).json({ error: 'missing fields' });

    // unique key per player: wallet address if available, else nickname
    const playerKey = wallet ? wallet.toLowerCase() : `nick:${String(name).toLowerCase()}`;
    const sortKey = Number(level) * 1000000 + (Number(score) || 0);

    // check if player already has a better score
    const existing = await redis(['ZSCORE', KEY, playerKey]);
    if (existing !== null && Number(existing) >= sortKey) {
      // existing score is better — don't overwrite
      return res.status(200).json({ ok: true, kept: 'existing' });
    }

    // store player data separately so we can retrieve name/wallet for display
    const entry = JSON.stringify({
      name: String(name).slice(0, 24),
      wallet: wallet || '',
      level: Number(level),
      score: Number(score) || 0,
      time: Number(time) || 0,
      result: result || 'died',
      ts: ts || Date.now()
    });

    // use playerKey as member (unique per player), score as sortKey
    await redis(['ZADD', KEY, sortKey, playerKey]);
    // store entry data in a hash
    await redis(['HSET', `solo:data:${playerKey}`, 'entry', entry]);

    return res.status(200).json({ ok: true, kept: 'new' });
  }

  // ── GET: fetch top scores ──
  if (req.method === 'GET') {
    const qs = req.url?.split('?')[1] || '';
    const params = new URLSearchParams(qs);

    if (params.get('reset') === 'ssow2024') {
      await redis(['DEL', KEY]);
      return res.status(200).json({ ok: true, message: 'leaderboard cleared' });
    }

    // get top 50 player keys sorted by score desc
    const playerKeys = await redis(['ZREVRANGE', KEY, 0, 49]);
    if (!Array.isArray(playerKeys) || !playerKeys.length) {
      return res.status(200).json({ scores: [] });
    }

    // fetch each player's data
    const scores = [];
    for (const pk of playerKeys) {
      const raw = await redis(['HGET', `solo:data:${pk}`, 'entry']);
      if (raw) {
        try { scores.push(JSON.parse(raw)); } catch {}
      }
    }

    return res.status(200).json({ scores });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
