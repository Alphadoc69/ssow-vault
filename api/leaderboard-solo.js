// api/leaderboard-solo.js
// One entry per player (wallet or nickname), keeps best score only

const KV_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const ZKEY = 'solo:lb:v3';   // sorted set: member=playerKey, score=sortKey
const HKEY = 'solo:lb:data'; // hash: field=playerKey, value=JSON entry

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
  } catch (e) { console.error('redis error', e); return null; }
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

    const playerKey = wallet ? wallet.toLowerCase() : `nick_${String(name).toLowerCase().replace(/\s+/g,'_')}`;
    const sortKey = Number(level) * 1000000 + (Number(score) || 0);

    // only update if this is a better score
    const existing = await redis(['ZSCORE', ZKEY, playerKey]);
    if (existing !== null && Number(existing) >= sortKey) {
      return res.status(200).json({ ok: true, kept: 'existing' });
    }

    const entry = JSON.stringify({
      name: String(name).slice(0, 24),
      wallet: wallet || '',
      level: Number(level),
      score: Number(score) || 0,
      time: Number(time) || 0,
      result: result || 'died',
      ts: ts || Date.now()
    });

    // store sort score and entry data atomically
    await redis(['ZADD', ZKEY, sortKey, playerKey]);
    await redis(['HSET', HKEY, playerKey, entry]);

    return res.status(200).json({ ok: true, kept: 'new', level: Number(level) });
  }

  // ── GET: fetch leaderboard ──
  if (req.method === 'GET') {
    const qs = req.url?.split('?')[1] || '';
    const params = new URLSearchParams(qs);

    if (params.get('reset') === 'ssow2024') {
      await redis(['DEL', ZKEY]);
      await redis(['DEL', HKEY]);
      return res.status(200).json({ ok: true, message: 'leaderboard cleared' });
    }

    // get top 50 player keys
    const playerKeys = await redis(['ZREVRANGE', ZKEY, 0, 49]);
    if (!Array.isArray(playerKeys) || !playerKeys.length) {
      return res.status(200).json({ scores: [] });
    }

    // fetch all entries in one HMGET call
    const raw = await redis(['HMGET', HKEY, ...playerKeys]);
    const scores = (Array.isArray(raw) ? raw : []).map(s => {
      if (!s) return null;
      try { return JSON.parse(s); } catch { return null; }
    }).filter(Boolean);

    return res.status(200).json({ scores });
  }

  return res.status(405).json({ error: 'method not allowed' });
}
