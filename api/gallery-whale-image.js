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

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { tokenId } = req.query;
  if (!/^\d{1,6}$/.test(String(tokenId || ''))) return res.status(400).json({ error: 'Invalid tokenId' });

  const cacheKey = `gallery:image:${tokenId}`;
  const cached = await redis(['GET', cacheKey]);
  if (cached) {
    try {
      res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
      return res.status(200).json(JSON.parse(cached));
    } catch {}
  }

  const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
  if (!OPENSEA_API_KEY) return res.status(500).json({ error: 'OpenSea API key not configured on server' });
  const CONTRACT = '0x88091012eedf8dba59d08e27ed7b22008f5d6fe5';

  try {
    const response = await fetch(`https://api.opensea.io/api/v2/chain/ethereum/contract/${CONTRACT}/nfts/${tokenId}`, {
      headers: { accept: 'application/json', 'x-api-key': OPENSEA_API_KEY }
    });
    const data = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch whale image' });

    const payload = {
      tokenId,
      imageUrl: data.nft?.display_image_url || data.nft?.image_url || null,
      name: data.nft?.name || `Whale #${tokenId}`
    };
    await redis(['SET', cacheKey, JSON.stringify(payload), 'EX', '86400']);
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    return res.status(200).json(payload);
  } catch {
    return res.status(500).json({ error: 'Failed to reach OpenSea API' });
  }
}
