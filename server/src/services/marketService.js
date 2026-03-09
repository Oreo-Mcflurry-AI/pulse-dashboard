import { getCache, setCache, addHistory, getHistory } from '../db.js';

const CACHE_TTL = 30_000; // 30s
const FETCH_TIMEOUT = 5_000; // 5s per external call

// In-memory cache for zero-latency responses
let memCache = { market: null, sparklines: null, updatedAt: 0 };

async function fetchJSON(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchIndex(code) {
  try {
    const isNaver = code.startsWith('.');
    const url = isNaver
      ? `https://api.stock.naver.com/index/${code}/basic`
      : `https://m.stock.naver.com/api/index/${code}/basic`;
    const d = await fetchJSON(url);
    return {
      value: d.closePrice || d.nowVal || '0',
      change: `${d.compareToPreviousClosePrice || ''}`,
      changeRate: `${d.fluctuationsRatio || 0}%`,
      status: d.marketStatus || 'UNKNOWN'
    };
  } catch (e) {
    return { value: '-', change: '', changeRate: '-', status: 'ERROR' };
  }
}

async function fetchUSDKRW() {
  try {
    const d = await fetchJSON('https://api.stock.naver.com/marketindex/exchange/FX_USDKRW');
    return {
      value: d.exchangeInfo?.closePrice || '-',
      change: d.exchangeInfo?.compareToPreviousClosePrice || '',
      changeRate: `${d.exchangeInfo?.fluctuationsRatio || 0}%`
    };
  } catch {
    return { value: '-', change: '', changeRate: '-' };
  }
}

async function fetchBTC() {
  try {
    const d = await fetchJSON('https://api.upbit.com/v1/ticker?markets=KRW-BTC');
    const t = d[0];
    const price = Math.floor(t.trade_price).toLocaleString('ko-KR');
    const rate = (t.signed_change_rate * 100).toFixed(2);
    return {
      value: price,
      change: `${t.signed_change_price}`,
      changeRate: `${rate}%`
    };
  } catch {
    return { value: '-', change: '', changeRate: '-' };
  }
}

async function fetchCommodity(category, code) {
  try {
    const d = await fetchJSON(`https://api.stock.naver.com/marketindex/${category}/${code}`);
    return {
      value: d.closePrice || '-',
      change: d.compareToPreviousClosePrice || '',
      changeRate: `${d.fluctuationsRatio || 0}%`
    };
  } catch {
    return { value: '-', change: '', changeRate: '-' };
  }
}

// ─── 52-week high/low ───
const WEEK52_TTL = 6 * 60 * 60 * 1000; // 6h — changes slowly
let week52Cache = { data: null, updatedAt: 0 };

async function fetch52WeekFromNaver(code) {
  // US indices: stockItemTotalInfos in basic endpoint
  try {
    const d = await fetchJSON(`https://api.stock.naver.com/index/${code}/basic`);
    const infos = d.stockItemTotalInfos || [];
    const high = infos.find(i => i.code === 'highPriceOf52Weeks');
    const low = infos.find(i => i.code === 'lowPriceOf52Weeks');
    if (high && low) {
      return {
        high: parseFloat(String(high.value).replace(/,/g, '')),
        low: parseFloat(String(low.value).replace(/,/g, '')),
        highDate: high.keyDesc || '',
        lowDate: low.keyDesc || ''
      };
    }
  } catch {}
  return null;
}

async function fetch52WeekFromSiseJson(symbol) {
  // Domestic indices: siseJson endpoint (1 year daily data)
  try {
    const now = new Date();
    const end = now.toISOString().slice(0, 10).replace(/-/g, '');
    const start = new Date(now - 365 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
    const url = `https://api.finance.naver.com/siseJson.naver?symbol=${symbol}&requestType=1&startTime=${start}&endTime=${end}&timeframe=day`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    const text = await res.text();
    // Parse JS array rows: ["20250310", open, high, low, close, volume, ...]
    const rows = text.match(/\["20\d{6}",\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*[\d.]+/g);
    if (!rows || rows.length === 0) return null;
    let high = -Infinity, low = Infinity, highDate = '', lowDate = '';
    for (const row of rows) {
      const parts = row.replace(/[[\]"]/g, '').split(',').map(s => s.trim());
      const date = parts[0];
      const h = parseFloat(parts[2]);
      const l = parseFloat(parts[3]);
      if (h > high) { high = h; highDate = `${date.slice(0,4)}.${date.slice(4,6)}.${date.slice(6,8)}.`; }
      if (l < low) { low = l; lowDate = `${date.slice(0,4)}.${date.slice(4,6)}.${date.slice(6,8)}.`; }
    }
    return { high, low, highDate, lowDate };
  } catch {}
  return null;
}

async function fetchAll52WeekData() {
  if (week52Cache.data && Date.now() - week52Cache.updatedAt < WEEK52_TTL) {
    return week52Cache.data;
  }
  const [kospi, kosdaq, sp500, nasdaq, dow, vix] = await Promise.all([
    fetch52WeekFromSiseJson('KOSPI'),
    fetch52WeekFromSiseJson('KOSDAQ'),
    fetch52WeekFromNaver('.INX'),
    fetch52WeekFromNaver('.IXIC'),
    fetch52WeekFromNaver('.DJI'),
    fetch52WeekFromNaver('.VIX'),
  ]);
  const data = { kospi, kosdaq, sp500, nasdaq, dow, vix };
  week52Cache = { data, updatedAt: Date.now() };
  return data;
}

// Core fetch — called by background prefetcher and on-demand fallback
async function fetchAllMarketData() {
  const [kospi, kosdaq, usdkrw, btc, sp500, nasdaq, dow, oil, gold, vix] = await Promise.all([
    fetchIndex('KOSPI'),
    fetchIndex('KOSDAQ'),
    fetchUSDKRW(),
    fetchBTC(),
    fetchIndex('.INX'),
    fetchIndex('.IXIC'),
    fetchIndex('.DJI'),
    fetchCommodity('energy', 'CLcv1'),
    fetchCommodity('metals', 'GCcv1'),
    fetchIndex('.VIX')
  ]);

  const data = {
    kospi: { name: 'KOSPI', ...kospi },
    kosdaq: { name: 'KOSDAQ', ...kosdaq },
    usdkrw: { name: 'USD/KRW', ...usdkrw },
    oil: { name: 'WTI', ...oil },
    gold: { name: 'GOLD', ...gold },
    btc: { name: 'BTC/KRW', ...btc },
    sp500: { name: 'S&P 500', ...sp500 },
    nasdaq: { name: 'NASDAQ', ...nasdaq },
    dow: { name: 'DOW', ...dow },
    vix: { name: 'VIX', ...vix },
    updatedAt: new Date().toISOString()
  };

  // Record history for sparklines
  const symbols = { kospi, kosdaq, usdkrw, oil, gold, btc, sp500, nasdaq, dow, vix };
  for (const [key, val] of Object.entries(symbols)) {
    const num = parseFloat(String(val.value).replace(/,/g, ''));
    if (!isNaN(num) && num > 0) addHistory(key, num);
  }

  setCache('market', data, CACHE_TTL);
  return data;
}

function buildSparklines() {
  const keys = ['kospi', 'kosdaq', 'usdkrw', 'oil', 'gold', 'btc', 'sp500', 'nasdaq', 'dow', 'vix'];
  const result = {};
  for (const key of keys) {
    result[key] = getHistory(key, 48).map(r => r.value);
  }
  setCache('sparklines', result, CACHE_TTL);
  return result;
}

// ─── Background prefetcher (stale-while-revalidate) ───
let prefetchTimer = null;
let prefetchInFlight = false;

async function prefetch() {
  if (prefetchInFlight) return;
  prefetchInFlight = true;
  try {
    const market = await fetchAllMarketData();
    const sparklines = buildSparklines();
    // 52-week data (fetched less frequently, has its own cache)
    const week52 = await fetchAll52WeekData().catch(() => null);
    memCache = { market, sparklines, week52, updatedAt: Date.now() };
  } catch (e) {
    // Keep stale memCache on failure; log for debugging
    console.error('[market prefetch] error:', e.message);
  } finally {
    prefetchInFlight = false;
  }
}

// Start background loop — runs immediately then every CACHE_TTL
export function startMarketPrefetch() {
  prefetch(); // initial fetch
  prefetchTimer = setInterval(prefetch, CACHE_TTL);
  return prefetchTimer;
}

export function stopMarketPrefetch() {
  if (prefetchTimer) clearInterval(prefetchTimer);
}

// ─── Public API (near-instant from memory) ───
export async function getMarketData() {
  // Return in-memory if fresh
  if (memCache.market && Date.now() - memCache.updatedAt < CACHE_TTL) {
    return memCache.market;
  }
  // Fallback: SQLite cache
  const cached = getCache('market');
  if (cached) return cached;
  // Cold start: fetch on-demand
  return fetchAllMarketData();
}

export async function getWeek52() {
  if (memCache.week52) return memCache.week52;
  return fetchAll52WeekData().catch(() => ({}));
}

export async function getSparklines() {
  if (memCache.sparklines && Date.now() - memCache.updatedAt < CACHE_TTL) {
    return memCache.sparklines;
  }
  const cached = getCache('sparklines');
  if (cached) return cached;
  return buildSparklines();
}
