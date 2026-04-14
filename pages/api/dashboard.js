import { getDashboardData } from '../../lib/hubspot';
import { readCache, writeCache } from '../../lib/store';

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const apiKey = process.env.HUBSPOT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'HUBSPOT_API_KEY not configured in environment variables'
    });
  }

  // Try to read from cache first
  const cached = readCache();
  if (cached) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    const ageHours = age / (1000 * 60 * 60);

    // Return cache if less than 25 hours old
    if (ageHours < 25) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('X-Cache-Age', `${ageHours.toFixed(1)}h`);
      return res.status(200).json(cached);
    }
  }

  // Cache is stale or missing — fetch fresh data
  try {
    console.log('Cache miss — fetching from HubSpot...');
    const data = await getDashboardData(apiKey);
    const payload = { data, fetchedAt: new Date().toISOString() };
    writeCache(payload);
    res.setHeader('X-Cache', 'MISS');
    return res.status(200).json(payload);
  } catch (err) {
    console.error('Fetch error:', err);
    if (cached) {
      res.setHeader('X-Cache', 'STALE');
      return res.status(200).json({
        ...cached,
        warning: 'Serving cached data — refresh failed'
      });
    }
    return res.status(500).json({ error: err.message });
  }
}
