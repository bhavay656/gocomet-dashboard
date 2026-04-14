import { getDashboardData } from '../../lib/hubspot';

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const apiKey = process.env.HUBSPOT_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'HUBSPOT_API_KEY not configured in environment variables' });

  if (cache && Date.now() - cacheTime < CACHE_TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cache);
  }

  try {
    const data = await getDashboardData(apiKey);
    cache = { data, fetchedAt: new Date().toISOString() };
    cacheTime = Date.now();
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(cache);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
