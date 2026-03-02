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

db.exec(`
  CREATE TABLE IF NOT EXISTS market_history (
    symbol TEXT NOT NULL,
    value REAL NOT NULL,
    recorded_at INTEGER NOT NULL
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_mh_symbol_time ON market_history(symbol, recorded_at)`);

export function addHistory(symbol, value) {
  db.prepare('INSERT INTO market_history (symbol, value, recorded_at) VALUES (?, ?, ?)').run(
    symbol, value, Date.now()
  );
  // Keep only last 24h (2880 points at 30s intervals)
  db.prepare('DELETE FROM market_history WHERE symbol = ? AND recorded_at < ?').run(
    symbol, Date.now() - 24 * 60 * 60 * 1000
  );
}

export function getHistory(symbol, limit = 48) {
  return db.prepare(
    'SELECT value, recorded_at FROM market_history WHERE symbol = ? ORDER BY recorded_at DESC LIMIT ?'
  ).all(symbol, limit).reverse();
}

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
