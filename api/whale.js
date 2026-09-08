// api/whale.js — OPTIONAL Vercel function. Returns a single whale's artwork by
// token ID, so the Cigar Club finder can show the image when you type a number.
// (Rarity + traits already come from rarity-data.js on the client — this is
//  only for the picture.) Your existing /api/whales is wallet-based, so it
//  can't fetch one whale by number; this fills that gap.
//
// Reuses the same OpenSea key your /api/whales already uses:
//   Vercel -> Settings -> Environment Variables -> OPENSEA_API_KEY
// Contract defaults to the one in cards.html; override with SSOW_CONTRACT.
// If you never deploy this file, the map still works -- it just shows the
// placeholder instead of the artwork.

const CONTRACT = process.env.SSOW_CONTRACT || '0x42d2b41c5bb1f73f06d5adaa85e23b44f75c4cd2';
const CHAIN = 'ethereum';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');

  const id = String((req.query && req.query.id) || '').trim();
  if (!/^\d+$/.test(id) || +id < 1 || +id > 10000) {
    return res.status(400).json({ error: 'id must be a whale number 1-10000' });
  }

  const key = process.env.OPENSEA_API_KEY;
  if (!key) return res.status(500).json({ error: 'OPENSEA_API_KEY is not set on the server' });

  try {
    const url = `https://api.opensea.io/api/v2/chain/${CHAIN}/contract/${CONTRACT}/nfts/${id}`;
    const r = await fetch(url, { headers: { 'X-API-KEY': key, accept: 'application/json' } });
    if (!r.ok) return res.status(r.status).json({ error: `opensea responded ${r.status}` });
    const { nft } = await r.json();
    return res.status(200).json({
      id: +id,
      name: (nft && nft.name) || `Whale #${id}`,
      image: (nft && (nft.display_image_url || nft.image_url)) || '',
    });
  } catch (e) {
    return res.status(502).json({ error: 'failed to reach OpenSea' });
  }
};
