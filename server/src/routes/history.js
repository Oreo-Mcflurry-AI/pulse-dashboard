import { Router } from 'express';
import db from '../db.js';

const router = Router();
const FETCH_TIMEOUT = 8_000;

// Symbol mapping for Naver siseJson (domestic)
const SISE_SYMBOLS = {
  kospi: 'KOSPI',
  kosdaq: 'KOSDAQ',
};

// Symbol mapping for Naver stock API (US indices, commodities)
const NAVER_INDEX_CODES = {
  sp500: '.INX',
  nasdaq: '.IXIC',
  dow: '.DJI',
  vix: '.VIX',
};

// In-memory cache for history (1h TTL)
const historyCache = new Map();
const HISTORY_TTL = 60 * 60 * 1000;

function getCached(key) {
  const entry = historyCache.get(key);
  if (entry && Date.now() - entry.ts < HISTORY_TTL) return entry.data;
  return null;
}

function setCached(key, data) {
  historyCache.set(key, { data, ts: Date.now() });
}

// Fetch daily OHLC from Naver siseJson (domestic indices)
async function fetchSiseHistory(symbol, days = 365) {
  const now = new Date();
  const end = now.toISOString().slice(0, 10).replace(/-/g, '');
  const start = new Date(now - days * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://api.finance.naver.com/siseJson.naver?symbol=${symbol}&requestType=1&startTime=${start}&endTime=${end}&timeframe=day`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  const text = await res.text();
  const rows = text.match(/\["20\d{6}",\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*[\d.]+/g);
  if (!rows) return [];
  return rows.map(row => {
    const parts = row.replace(/[[\]"]/g, '').split(',').map(s => s.trim());
    return {
      date: `${parts[0].slice(0,4)}-${parts[0].slice(4,6)}-${parts[0].slice(6,8)}`,
      open: parseFloat(parts[1]),
      high: parseFloat(parts[2]),
      low: parseFloat(parts[3]),
      close: parseFloat(parts[4]),
    };
  });
}

// Fetch daily data from Naver stock API (US indices)
async function fetchNaverIndexHistory(code, days = 365) {
  // Use chart data endpoint
  const now = new Date();
  const end = now.toISOString().slice(0, 10).replace(/-/g, '');
  const start = new Date(now - days * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://api.stock.naver.com/chart/foreign/index/${encodeURIComponent(code)}/day?startDateTime=${start}0000&endDateTime=${end}2359`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map(d => {
        const raw = d.localDate || d.localTradedAt || '';
        const date = raw.length === 8 ? `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}` : raw.slice(0, 10);
        return {
          date,
          open: parseFloat(d.openPrice) || 0,
          high: parseFloat(d.highPrice) || 0,
          low: parseFloat(d.lowPrice) || 0,
          close: parseFloat(d.closePrice) || 0,
        };
      }).filter(d => d.date && d.close > 0);
    }
  } catch {}
  return [];
}

// Get 24h intraday from our DB
function getIntradayFromDB(symbol, hours = 24) {
  const since = Date.now() - hours * 60 * 60 * 1000;
  const rows = db.prepare(
    'SELECT value, recorded_at FROM market_history WHERE symbol = ? AND recorded_at > ? ORDER BY recorded_at ASC'
  ).all(symbol, since);
  return rows.map(r => ({
    time: new Date(r.recorded_at).toISOString(),
    value: r.value,
  }));
}

// GET /api/history/:symbol?period=1m|3m|6m|1y&type=daily|intraday
router.get('/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const period = req.query.period || '3m';
  const type = req.query.type || 'daily';

  // Intraday from DB
  if (type === 'intraday' || symbol === 'fear_greed') {
    // fear_greed only has intraday DB data (no external daily API)
    const hours = symbol === 'fear_greed' ? { '1m': 720, '3m': 2160, '6m': 4320, '1y': 8760, '24h': 24 }[period] || 168 : 24;
    const data = getIntradayFromDB(symbol, hours);
    res.set('Cache-Control', 'public, max-age=30');
    return res.json({ symbol, period: symbol === 'fear_greed' ? period : '24h', type: 'intraday', data });
  }

  // Daily data
  const daysMap = { '1m': 30, '3m': 90, '6m': 180, '1y': 365 };
  const days = daysMap[period] || 90;

  const cacheKey = `${symbol}_${period}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return res.json(cached);
  }

  try {
    let data = [];

    if (SISE_SYMBOLS[symbol]) {
      data = await fetchSiseHistory(SISE_SYMBOLS[symbol], days);
    } else if (NAVER_INDEX_CODES[symbol]) {
      data = await fetchNaverIndexHistory(NAVER_INDEX_CODES[symbol], days);
    } else if (symbol === 'usdkrw') {
      // USD/KRW from siseJson
      data = await fetchSiseHistory('FX_USDKRW', days).catch(() => []);
      if (data.length === 0) {
        // Fallback: try exchange API
        data = await fetchNaverExchangeHistory(days);
      }
    } else if (symbol === 'btc') {
      // BTC from Upbit (90 day max for daily candles)
      data = await fetchUpbitHistory(Math.min(days, 200));
    } else if (symbol === 'oil') {
      data = await fetchNaverCommodityHistory('energy', 'CLcv1', days);
    } else if (symbol === 'gold') {
      data = await fetchNaverCommodityHistory('metals', 'GCcv1', days);
    }

    const result = { symbol, period, type: 'daily', data };
    if (data.length > 0) setCached(cacheKey, result);

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Upbit daily candles
async function fetchUpbitHistory(days) {
  const url = `https://api.upbit.com/v1/candles/days?market=KRW-BTC&count=${days}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(d => ({
    date: d.candle_date_time_kst?.slice(0, 10) || '',
    open: d.opening_price,
    high: d.high_price,
    low: d.low_price,
    close: d.trade_price,
  })).filter(d => d.date).reverse();
}

// Naver commodity history
async function fetchNaverCommodityHistory(category, code, days) {
  const now = new Date();
  const end = now.toISOString().slice(0, 10).replace(/-/g, '');
  const start = new Date(now - days * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://api.stock.naver.com/chart/marketindex/${category}/${code}/day?startDateTime=${start}0000&endDateTime=${end}2359`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map(d => {
        const raw = d.localDate || d.localTradedAt || d.date || '';
        const date = raw.length === 8 ? `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}` : raw.slice(0, 10);
        return {
          date,
          open: parseFloat(d.openPrice || d.open) || 0,
          high: parseFloat(d.highPrice || d.high) || 0,
          low: parseFloat(d.lowPrice || d.low) || 0,
          close: parseFloat(d.closePrice || d.close) || 0,
        };
      }).filter(d => d.date && d.close > 0);
    }
  } catch {}
  return [];
}

// Exchange rate history fallback
async function fetchNaverExchangeHistory(days) {
  const now = new Date();
  const end = now.toISOString().slice(0, 10).replace(/-/g, '');
  const start = new Date(now - days * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://api.stock.naver.com/chart/marketindex/exchange/FX_USDKRW/day?startDateTime=${start}0000&endDateTime=${end}2359`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map(d => {
        const raw = d.localDate || d.localTradedAt || '';
        const date = raw.length === 8 ? `${raw.slice(0,4)}-${raw.slice(4,6)}-${raw.slice(6,8)}` : raw.slice(0, 10);
        return {
          date,
          open: parseFloat(d.openPrice) || 0,
          high: parseFloat(d.highPrice) || 0,
          low: parseFloat(d.lowPrice) || 0,
          close: parseFloat(d.closePrice) || 0,
        };
      }).filter(d => d.date && d.close > 0);
    }
  } catch {}
  return [];
}

// GET /api/history - list available symbols
router.get('/', (req, res) => {
  res.json({
    symbols: [
      { key: 'kospi', name: 'KOSPI', type: 'index' },
      { key: 'kosdaq', name: 'KOSDAQ', type: 'index' },
      { key: 'sp500', name: 'S&P 500', type: 'index' },
      { key: 'nasdaq', name: 'NASDAQ', type: 'index' },
      { key: 'dow', name: 'DOW', type: 'index' },
      { key: 'vix', name: 'VIX', type: 'volatility' },
      { key: 'usdkrw', name: 'USD/KRW', type: 'fx' },
      { key: 'btc', name: 'BTC/KRW', type: 'crypto' },
      { key: 'oil', name: 'WTI', type: 'commodity' },
      { key: 'gold', name: 'GOLD', type: 'commodity' },
      { key: 'fear_greed', name: '공포/탐욕', type: 'sentiment' },
    ],
  });
});

export default router;
