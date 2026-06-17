// api/leaderboard-solo.js
// Simple approach: store each player score as a JSON string at a key
// All player keys tracked in a list

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
  } catch (e) { return null; }
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

    // unique player key
    const pk = wallet ? `solo:p:${wallet.toLowerCase()}` : `solo:p:nick_${String(name).toLowerCase().replace(/\s+/g,'_')}`;
    const sortKey = Number(level) * 1000000 + (Number(score) || 0);

    // check existing best
    const existing = await redis(['GET', pk]);
    if (existing) {
      try {
        const prev = JSON.parse(existing);
        const prevKey = prev.level * 1000000 + (prev.score || 0);
        if (prevKey >= sortKey) {
          return res.status(200).json({ ok: true, kept: 'existing' });
        }
      } catch {}
    }

    // save new best
    const entry = JSON.stringify({
      name: String(name).slice(0, 24),
      wallet: wallet || '',
      level: Number(level),
      score: Number(score) || 0,
      time: Number(time) || 0,
      result: result || 'died',
      ts: ts || Date.now()
    });

    await redis(['SET', pk, entry]);
    // track player key in a set
    await redis(['SADD', 'solo:players', pk]);

    return res.status(200).json({ ok: true, kept: 'new' });
  }

  // ── GET: fetch leaderboard ──
  if (req.method === 'GET') {
    const qs = req.url?.split('?')[1] || '';
    const params = new URLSearchParams(qs);

    if (params.get('reset') === 'ssow2024') {
      const keys = await redis(['SMEMBERS', 'solo:players']) || [];
      for (const k of keys) await redis(['DEL', k]);
      await redis(['DEL', 'solo:players']);
      return res.status(200).json({ ok: true, message: 'leaderboard cleared' });
    }

    // get all player keys
    const keys = await redis(['SMEMBERS', 'solo:players']) || [];
    if (!keys.length) return res.status(200).json({ scores: [] });

    // fetch each player's best score
    const scores = [];
    for (const k of keys) {
      const raw = await redis(['GET', k]);
      if (raw) {
        try { scores.push(JSON.parse(raw)); } catch {}
      }
    }

    // sort by level desc, then score desc
    scores.sort((a, b) => b.level !== a.level ? b.level - a.level : b.score - a.score);

    return res.status(200).json({ scores: scores.slice(0, 50) });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
