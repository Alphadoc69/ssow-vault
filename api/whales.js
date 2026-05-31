export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { wallet, next } = req.query;

  if (!wallet) {
    return res.status(400).json({ error: 'Missing wallet address' });
  }

  // Basic wallet format check
  if (!wallet.startsWith('0x') || wallet.length < 10) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  // API key lives here on the server — never sent to the browser
  const OPENSEA_API_KEY = process.env.OPENSEA_API_KEY;

  if (!OPENSEA_API_KEY) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  const params = new URLSearchParams({
    collection: 'secretsocietyofwhales',
    limit: '200',
  });
  if (next) params.set('next', next);

  const url = `https://api.opensea.io/api/v2/chain/ethereum/account/${wallet}/nfts?${params}`;

  try {
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'x-api-key': OPENSEA_API_KEY,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.errors?.[0] || data.detail || `OpenSea error ${response.status}`,
      });
    }

    // Allow browser to cache for 60 seconds
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate');
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: 'Failed to reach OpenSea API' });
  }
}
