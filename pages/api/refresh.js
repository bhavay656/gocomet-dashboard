import { getDashboardData } from '../../lib/hubspot';
import { writeCache, readCache } from '../../lib/store';

export const config = {
  maxDuration: 300,
};

export default async function handler(req, res) {
  const secret = req.headers['x-refresh-secret'] || req.query.secret;
  if (secret !== process.env.REFRESH_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const apiKey = process.env.HUBSPOT_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'HUBSPOT_API_KEY not configured' });
  }

  try {
    console.log('Starting HubSpot data fetch...');
    const data = await getDashboardData(apiKey);
    const payload = { data, fetchedAt: new Date().toISOString() };
    writeCache(payload);
    console.log('Data fetched and cached successfully');
    return res.status(200).json({
      success: true,
      fetchedAt: payload.fetchedAt,
      months: data.length
    });
  } catch (err) {
    console.error('Refresh error:', err);
    return res.status(500).json({ error: err.message });
  }
}
