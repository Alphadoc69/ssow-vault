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
  } catch {
    return null;
  }
}

const CACHE_TTL = 300;
const RL_MAX = 30;
const RL_WINDOW = 60;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { wallet, pageKey } = req.query;
  if (!wallet) return res.status(400).json({ error: 'Wallet address required' });

  const isAddress = /^0x[a-fA-F0-9]{40}$/.test(wallet);
  const isEns = /^[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(wallet);
  if (!isAddress && !isEns) {
    return res.status(400).json({ error: 'Invalid Ethereum wallet address or ENS name' });
  }
  if (pageKey && (typeof pageKey !== 'string' || pageKey.length > 500)) {
    return res.status(400).json({ error: 'Invalid page key' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const count = await redis(['INCR', `gallery:rl:${ip}`]);
  if (count !== null) {
    if (count === 1) await redis(['EXPIRE', `gallery:rl:${ip}`, String(RL_WINDOW)]);
    if (count > RL_MAX) return res.status(429).json({ error: 'Too many requests — try again in a moment.' });
  }

  const cacheKey = `gallery:nfts:${wallet.toLowerCase()}:${pageKey || '0'}`;
  const cached = await redis(['GET', cacheKey]);
  if (cached) {
    try {
      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(JSON.parse(cached));
    } catch {}
  }

  const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
  const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;
  if (!ALCHEMY_API_KEY) return res.status(500).json({ error: 'Alchemy API key not configured on server' });

  const CONTRACTS = [
    '0x88091012eedf8dba59d08e27ed7b22008f5d6fe5',
    '0xef920c1df72b8a1e48e976ca78e09fe35bfc6f38',
    '0xc99a7d6c5ebbc7919f69074d11c4056b28cacdb2',
    '0x6eb96c788abe0ee611d0610d4cc3b0463f411f80',
    '0xba705711bec81975dcf8e46143a8c2f1ded9561a'
  ];

  try {
    let url = `https://eth-mainnet.g.alchemy.com/nft/v3/${encodeURIComponent(ALCHEMY_API_KEY)}/getNFTsForOwner?owner=${encodeURIComponent(wallet)}&withMetadata=true&pageSize=100`;
    for (const contract of CONTRACTS) url += `&contractAddresses[]=${encodeURIComponent(contract)}`;
    if (pageKey) url += `&pageKey=${encodeURIComponent(pageKey)}`;

    const response = await fetch(url, { headers: { accept: 'application/json' } });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data?.message || data?.error || `Alchemy error ${response.status}` });
    }

    if (OPENSEA_API_KEY && Array.isArray(data.ownedNfts)) {
      const missing = data.ownedNfts.filter(nft =>
        !nft.image?.cachedUrl && !nft.image?.thumbnailUrl && !nft.image?.pngUrl && !nft.image?.originalUrl && !nft.raw?.metadata?.image
      ).slice(0, 25);

      if (missing.length) {
        const results = await Promise.all(missing.map(async nft => {
          try {
            const contract = nft.contract?.address;
            const tokenId = nft.tokenId;
            if (!contract || !tokenId) return null;
            const r = await fetch(`https://api.opensea.io/api/v2/chain/ethereum/contract/${encodeURIComponent(contract)}/nfts/${encodeURIComponent(tokenId)}`, {
              headers: { accept: 'application/json', 'x-api-key': OPENSEA_API_KEY }
            });
            if (!r.ok) return null;
            const d = await r.json();
            return { contract: contract.toLowerCase(), tokenId, imageUrl: d.nft?.display_image_url || d.nft?.image_url || null };
          } catch { return null; }
        }));

        const imageMap = new Map(results.filter(Boolean).map(x => [`${x.contract}-${x.tokenId}`, x.imageUrl]));
        data.ownedNfts = data.ownedNfts.map(nft => {
          const key = `${(nft.contract?.address || '').toLowerCase()}-${nft.tokenId}`;
          const imageUrl = imageMap.get(key);
          return imageUrl ? { ...nft, openSeaImage: imageUrl } : nft;
        });
      }
    }

    await redis(['SET', cacheKey, JSON.stringify(data), 'EX', String(CACHE_TTL)]);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(data);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch gallery NFTs' });
  }
}
