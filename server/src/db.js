import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '..', 'cache.db'));

db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS cache (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  )
`);

export function getCache(key) {
  const row = db.prepare('SELECT value, expires_at FROM cache WHERE key = ?').get(key);
  if (!row || Date.now() > row.expires_at) return null;
  return JSON.parse(row.value);
}

export function setCache(key, value, ttlMs) {
  db.prepare('INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)').run(
    key, JSON.stringify(value), Date.now() + ttlMs
  );
}

export default db;
