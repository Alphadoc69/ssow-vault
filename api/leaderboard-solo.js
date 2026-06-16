// api/leaderboard-solo.js

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'solo:scores';
const MAX = 100;

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

  // ── POST: submit score ──
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const { name, wallet, level, score, time, result, ts } = body || {};
    if (!name || level == null) return res.status(400).json({ error: 'missing fields' });

    const entry = JSON.stringify({
      name: String(name).slice(0, 24),
      wallet: wallet || '',
      level: Number(level),
      score: Number(score) || 0,
      time: Number(time) || 0,
      result: result || 'died',
      ts: ts || Date.now()
    });

    const sortKey = Number(level) * 1000000 + (Number(score) || 0);
    await redis(['ZADD', KEY, sortKey, entry]);
    await redis(['ZREMRANGEBYRANK', KEY, 0, -(MAX + 1)]);

    return res.status(200).json({ ok: true });
  }

  // ── GET: fetch scores ──
  if (req.method === 'GET') {
    const qs = req.url?.split('?')[1] || '';
    const params = new URLSearchParams(qs);
    if (params.get('reset') === 'ssow2024') {
      await redis(['DEL', KEY]);
      return res.status(200).json({ ok: true, message: 'leaderboard cleared' });
    }

    const raw = await redis(['ZREVRANGE', KEY, 0, 49]);
    const scores = (Array.isArray(raw) ? raw : []).map(s => {
      try { return JSON.parse(s); } catch { return null; }
    }).filter(Boolean);

    return res.status(200).json({ scores });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
