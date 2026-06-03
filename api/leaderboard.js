// File location in your repo:  /api/leaderboard.js
//
// Shared, persistent Meta Pit leaderboard backed by Upstash Redis.
// No npm packages — it just calls Upstash's REST API with fetch.
//
// SETUP (one time):
//   1. In Vercel → your project → Storage (or Marketplace) → add "Upstash for Redis".
//      Let Vercel create/connect a database. It auto-adds the env vars below.
//   2. Redeploy. That's it — credentials live on the server, never in the browser.
//
// It reads whichever env-var names the integration provides.

const URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN  || process.env.UPSTASH_REDIS_REST_TOKEN;

// run a single Redis command, e.g. redis(["ZINCRBY","metapit:wins","1","0xabc"])
async function redis(cmd) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  return j.result;
}
// run several commands in one round-trip
async function pipeline(cmds) {
  const r = await fetch(URL + "/pipeline", {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  const j = await r.json();
  return j.map((x) => x.result);
}

export default async function handler(req, res) {
  if (!URL || !TOKEN) {
    return res.status(200).json({ rows: null, note: "leaderboard db not connected yet" });
  }

  try {
    // ---- record a round result ----
    if (req.method === "POST") {
      const { wallet, name, won } = req.body || {};
      if (!wallet) return res.status(400).json({ error: "missing wallet" });
      const cmds = [
        ["HSET", "metapit:names", wallet, String(name || "").slice(0, 18)],
        ["ZINCRBY", "metapit:plays", "1", wallet],
      ];
      if (won) cmds.push(["ZINCRBY", "metapit:wins", "1", wallet]);
      // make sure a winless player still appears on the board with 0 wins
      else cmds.push(["ZADD", "metapit:wins", "NX", "0", wallet]);
      await pipeline(cmds);
      return res.status(200).json({ ok: true });
    }

    // ---- read the top 10 ----
    const top = await redis(["ZREVRANGE", "metapit:wins", "0", "9", "WITHSCORES"]); // [member,score,...]
    const rows = [];
    const wallets = [];
    for (let i = 0; i < (top || []).length; i += 2) {
      wallets.push(top[i]);
      rows.push({ wallet: top[i], wins: Number(top[i + 1]) });
    }
    if (wallets.length) {
      const [names, plays] = await pipeline([
        ["HMGET", "metapit:names", ...wallets],
        ["ZMSCORE", "metapit:plays", ...wallets],
      ]);
      rows.forEach((r, i) => {
        r.name = (names && names[i]) || null;
        r.plays = plays && plays[i] != null ? Number(plays[i]) : r.wins;
      });
    }
    return res.status(200).json({ rows });
  } catch (e) {
    return res.status(500).json({ error: String(e) });
  }
}
