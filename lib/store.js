import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join('/tmp', 'dashboard-cache.json');

export function readCache() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Cache read error:', e);
  }
  return null;
}

export function writeCache(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data), 'utf8');
    return true;
  } catch (e) {
    console.error('Cache write error:', e);
    return false;
  }
}
