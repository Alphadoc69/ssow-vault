// api/leaderboard-solo.js — deploy to /api/ on GitHub
// Uses Upstash Redis REST API (pipeline format)

const KEY = 'solo:scores';
const MAX = 100;

async function upstash(...args) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  });
  const data = await r.json();
  return data.result !== undefined ? data.result : data;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── POST: submit score ──
  if (req.method === 'POST') {
    const { name, wallet, level, score, time, result, ts } = req.body || {};
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

    // sort key: level is primary, score secondary
    const sortKey = Number(level) * 1000000 + (Number(score) || 0);

    await upstash('ZADD', KEY, sortKey, entry);
    await upstash('ZREMRANGEBYRANK', KEY, 0, -(MAX + 1));

    return res.status(200).json({ ok: true });
  }

  // ── GET: fetch scores ──
  if (req.method === 'GET') {
    // Secret reset
    const qs = req.url?.split('?')[1] || '';
    const params = new URLSearchParams(qs);
    if (params.get('reset') === 'ssow2024') {
      await upstash('DEL', KEY);
      return res.status(200).json({ ok: true, message: 'leaderboard cleared' });
    }

    // Top 50, highest first
    const raw = await upstash('ZREVRANGE', KEY, 0, 49);
    const scores = (Array.isArray(raw) ? raw : []).map(s => {
      try { return JSON.parse(s); } catch { return null; }
    }).filter(Boolean);

    return res.status(200).json({ scores });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
