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

// Daily briefings table
db.exec(`
  CREATE TABLE IF NOT EXISTS briefings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT,
    source TEXT,
    url TEXT,
    created_at INTEGER NOT NULL
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_briefings_date ON briefings(date)`);

// Briefing summaries (AI-written daily summary)
db.exec(`
  CREATE TABLE IF NOT EXISTS briefing_summaries (
    date TEXT PRIMARY KEY,
    summary TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )
`);

export function saveBriefing(date, summary, articles) {
  const tx = db.transaction(() => {
    // Save summary
    db.prepare(
      'INSERT OR REPLACE INTO briefing_summaries (date, summary, created_at) VALUES (?, ?, ?)'
    ).run(date, summary, Date.now());

    // Clear old articles for this date, then insert new
    db.prepare('DELETE FROM briefings WHERE date = ?').run(date);
    const insert = db.prepare(
      'INSERT INTO briefings (date, category, title, summary, source, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const a of articles) {
      insert.run(date, a.category || '', a.title, a.summary || '', a.source || '', a.url || '', Date.now());
    }
  });
  tx();
}

export function getBriefingDates() {
  return db.prepare('SELECT DISTINCT date FROM briefing_summaries ORDER BY date DESC LIMIT 60').all().map(r => r.date);
}

export function getBriefingByDate(date) {
  const sum = db.prepare('SELECT summary FROM briefing_summaries WHERE date = ?').get(date);
  const articles = db.prepare('SELECT * FROM briefings WHERE date = ? ORDER BY category, id').all(date);
  return { summary: sum?.summary || '', articles };
}

// OG image cache table
db.exec(`
  CREATE TABLE IF NOT EXISTS og_images (
    url_hash TEXT PRIMARY KEY,
    og_url TEXT,
    fetched_at INTEGER NOT NULL
  )
`);

const OG_TTL = 24 * 60 * 60 * 1000; // 24h

export function getOgImage(urlHash) {
  const row = db.prepare('SELECT og_url, fetched_at FROM og_images WHERE url_hash = ?').get(urlHash);
  if (!row || Date.now() - row.fetched_at > OG_TTL) return null;
  return row.og_url; // may be null (no OG image found)
}

export function setOgImage(urlHash, ogUrl) {
  db.prepare('INSERT OR REPLACE INTO og_images (url_hash, og_url, fetched_at) VALUES (?, ?, ?)').run(
    urlHash, ogUrl || null, Date.now()
  );
}

export default db;
