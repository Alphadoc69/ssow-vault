// File location in your repo:  /api/leaderboard.js
//
// Shared Meta Pit leaderboard + progression, backed by Upstash Redis.
// No npm packages — just fetch to Upstash's REST API.
//
// SETUP (one time): Vercel → project → Storage → add "Upstash for Redis",
// let Vercel create/connect it (auto-adds the env vars below), then redeploy.

const URL   = process.env.KV_REST_API_URL  || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  const r = await fetch(URL, { method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd) });
  return (await r.json()).result;
}
async function pipeline(cmds) {
  const r = await fetch(URL + "/pipeline", { method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds) });
  return (await r.json()).map((x) => x.result);
}

const wkKey = () => "metapit:weekly:" + Math.floor(Date.now() / 6048e5); // 7-day bucket
const ZSET  = { wins: "metapit:wins", streak: "metapit:beststreak", dive: "metapit:bestdive" };

export default async function handler(req, res) {
  if (!URL || !TOKEN) return res.status(200).json({ rows: null, note: "db not connected" });

  try {
    // ---- record a round ----
    if (req.method === "POST") {
      const { wallet, name, won, xp, total } = req.body || {};
      if (!wallet) return res.status(400).json({ error: "missing wallet" });
      const wk = wkKey();
      const cmds = [
        ["HSET", "metapit:names", wallet, String(name || "").slice(0, 18)],
        ["ZINCRBY", "metapit:plays", "1", wallet],
        ["ZINCRBY", "metapit:xp", String(xp || 0), wallet],
        ["ZADD", "metapit:wins", "NX", "0", wallet],          // ensure player shows on board
        ["ZADD", "metapit:bestdive", "GT", String(total || 0), wallet],
      ];
      if (won) {
        cmds.push(["ZINCRBY", "metapit:wins", "1", wallet]);
        cmds.push(["ZINCRBY", wk, "1", wallet]);
        cmds.push(["EXPIRE", wk, "1209600"]);                 // weekly board lives 2 weeks
      }
      await pipeline(cmds);
      // streak (read-modify, so done after the pipeline)
      if (won) {
        const ns = await redis(["HINCRBY", "metapit:streak", wallet, "1"]);
        await redis(["ZADD", "metapit:beststreak", "GT", String(ns), wallet]);
      } else {
        await redis(["HSET", "metapit:streak", wallet, "0"]);
      }
      return res.status(200).json({ ok: true });
    }

    // ---- read a board (+ optional player stats) ----
    const board = req.query.board || "wins";
    const me = req.query.me;
    const zset = board === "weekly" ? wkKey() : (ZSET[board] || ZSET.wins);

    const top = (await redis(["ZREVRANGE", zset, "0", "9", "WITHSCORES"])) || [];
    const rows = [], wallets = [];
    for (let i = 0; i < top.length; i += 2) {
      wallets.push(top[i]);
      rows.push({ wallet: top[i], value: Number(top[i + 1]) });
    }
    if (wallets.length) {
      const names = await redis(["HMGET", "metapit:names", ...wallets]);
      rows.forEach((r, i) => (r.name = (names && names[i]) || null));
    }

    let meObj = null;
    if (me) {
      const r = await pipeline([
        ["ZSCORE", "metapit:xp", me], ["ZSCORE", "metapit:wins", me],
        ["ZSCORE", "metapit:plays", me], ["HGET", "metapit:streak", me],
        ["ZSCORE", "metapit:beststreak", me], ["ZSCORE", "metapit:bestdive", me],
      ]);
      meObj = { xp:+(r[0]||0), wins:+(r[1]||0), plays:+(r[2]||0),
                streak:+(r[3]||0), beststreak:+(r[4]||0), besttotal:+(r[5]||0) };
    }
    return res.status(200).json({ rows, me: meObj, board });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
