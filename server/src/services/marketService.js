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
    memCache = { market, sparklines, updatedAt: Date.now() };
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

export async function getSparklines() {
  if (memCache.sparklines && Date.now() - memCache.updatedAt < CACHE_TTL) {
    return memCache.sparklines;
  }
  const cached = getCache('sparklines');
  if (cached) return cached;
  return buildSparklines();
}
