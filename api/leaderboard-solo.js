// api/leaderboard-solo.js
// Vercel serverless function — deploy to /api/leaderboard-solo.js
// Uses Upstash Redis (same KV as the rest of thewhaleclub.xyz)

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = 'solo:scores';
const MAX_SCORES = 100;

async function kv(cmd) {
  const r = await fetch(`${UPSTASH_URL}/${cmd.join('/')}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` }
  });
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'POST') {
    // Submit a score
    const { name, wallet, level, score, time, result, ts } = req.body || {};
    if (!name || !level) return res.status(400).json({ error: 'missing fields' });

    const entry = JSON.stringify({ name, wallet: wallet||'', level, score: score||0, time: time||0, result: result||'died', ts: ts||Date.now() });

    // Store as sorted set — score = level * 1000000 + score (level is primary rank)
    const sortKey = (level * 1000000) + (score || 0);
    await kv(['ZADD', KEY, sortKey, entry]);

    // Trim to top MAX_SCORES
    await kv(['ZREMRANGEBYRANK', KEY, 0, -(MAX_SCORES + 1)]);

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    // Fetch top scores (highest level first)
    const result = await kv(['ZREVRANGE', KEY, 0, 49, 'WITHSCORES']);
    const raw = result.result || [];

    const scores = [];
    for (let i = 0; i < raw.length; i += 2) {
      try {
        const entry = JSON.parse(raw[i]);
        scores.push(entry);
      } catch (e) {}
    }

    return res.status(200).json({ scores });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
