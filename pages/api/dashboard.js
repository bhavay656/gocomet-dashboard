import { getDashboardData } from '../../lib/hubspot';

export const config = {
  maxDuration: 60,
};

// In-memory cache
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const apiKey = process.env.HUBSPOT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'HUBSPOT_API_KEY not configured in environment variables'
    });
  }

  // Return cache if fresh
  if (cache && Date.now() - cacheTime < CACHE_TTL) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.status(200).json(cache);
  }

  try {
    const data = await getDashboardData(apiKey);
    cache = { data, fetchedAt: new Date().toISOString() };
    cacheTime = Date.now();
    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.status(200).json(cache);
  } catch (err) {
    console.error('Dashboard error:', err);
    if (cache) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json({
        ...cache,
        warning: 'Serving stale data due to fetch error'
      });
    }
    return res.status(500).json({ error: err.message });
  }
}
