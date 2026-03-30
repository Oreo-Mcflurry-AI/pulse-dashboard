import { Router } from 'express';
import { getMarketData, getSparklines, getWeek52, getVolume, getIntraday } from '../services/marketService.js';

const router = Router();

// ─── Weekly change cache ───
let weeklyCache = { data: null, updatedAt: 0 };
const WEEKLY_TTL = 30 * 60 * 1000; // 30min

async function getWeeklyChange() {
  if (weeklyCache.data && Date.now() - weeklyCache.updatedAt < WEEKLY_TTL) {
    return weeklyCache.data;
  }
  // Use siseJson for domestic, Naver API for others
  const symbols = {
    kospi: { type: 'sise', code: 'KOSPI' },
    kosdaq: { type: 'sise', code: 'KOSDAQ' },
    sp500: { type: 'naver', code: '.INX' },
    nasdaq: { type: 'naver', code: '.IXIC' },
    dow: { type: 'naver', code: '.DJI' },
    vix: { type: 'naver', code: '.VIX' },
    gold: { type: 'commodity', code: 'metals/GCcv1' },
    oil: { type: 'commodity', code: 'energy/CLcv1' },
    usdkrw: { type: 'commodity', code: 'exchange/FX_USDKRW' },
    btc: { type: 'upbit' },
  };

  const result = {};
  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000);

  await Promise.all(Object.entries(symbols).map(async ([key, { type, code }]) => {
    try {
      if (type === 'sise') {
        const end = now.toISOString().slice(0, 10).replace(/-/g, '');
        const start = weekAgo.toISOString().slice(0, 10).replace(/-/g, '');
        const url = `https://api.finance.naver.com/siseJson.naver?symbol=${code}&requestType=1&startTime=${start}&endTime=${end}&timeframe=day`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
        const text = await res.text();
        const rows = text.match(/\["20\d{6}",\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*[\d.]+/g);
        if (rows && rows.length >= 2) {
          const first = parseFloat(rows[0].replace(/[[\]"]/g, '').split(',')[4]);
          const last = parseFloat(rows[rows.length - 1].replace(/[[\]"]/g, '').split(',')[4]);
          result[key] = first > 0 ? ((last - first) / first * 100).toFixed(2) + '%' : null;
        }
      } else if (type === 'naver') {
        // US indices: use chart/foreign/index endpoint
        const now = new Date();
        const end = now.toISOString().slice(0, 10).replace(/-/g, '');
        const start = new Date(now - 14 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
        const url = `https://api.stock.naver.com/chart/foreign/index/${encodeURIComponent(code)}/day?startDateTime=${start}0000&endDateTime=${end}2359`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
        const data = await res.json();
        if (Array.isArray(data) && data.length >= 5) {
          const latest = parseFloat(data[data.length - 1].closePrice) || 0;
          const weekIdx = Math.max(0, data.length - 6); // ~5 trading days ago
          const weekAgoPrice = parseFloat(data[weekIdx].closePrice) || 0;
          if (weekAgoPrice > 0) result[key] = ((latest - weekAgoPrice) / weekAgoPrice * 100).toFixed(2) + '%';
        }
      } else if (type === 'commodity') {
        const url = `https://api.stock.naver.com/marketindex/${code}/prices?page=1&pageSize=10`;
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) });
        const prices = await res.json();
        if (Array.isArray(prices) && prices.length >= 5) {
          const latest = parseFloat(String(prices[0].closePrice).replace(/,/g, ''));
          const weekAgoPrice = parseFloat(String(prices[Math.min(4, prices.length - 1)].closePrice).replace(/,/g, ''));
          if (weekAgoPrice > 0) result[key] = ((latest - weekAgoPrice) / weekAgoPrice * 100).toFixed(2) + '%';
        }
      } else if (type === 'upbit') {
        const url = 'https://api.upbit.com/v1/candles/days?market=KRW-BTC&count=7';
        const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
        const candles = await res.json();
        if (Array.isArray(candles) && candles.length >= 5) {
          const latest = candles[0].trade_price;
          const weekAgo = candles[Math.min(4, candles.length - 1)].trade_price;
          if (weekAgo > 0) result[key] = ((latest - weekAgo) / weekAgo * 100).toFixed(2) + '%';
        }
      }
    } catch {}
  }));

  weeklyCache = { data: result, updatedAt: Date.now() };
  return result;
}

router.get('/', async (req, res) => {
  try {
    const [data, sparklines, week52, volume, weeklyChange, intraday] = await Promise.all([
      getMarketData(),
      getSparklines(),
      getWeek52(),
      getVolume(),
      getWeeklyChange(),
      getIntraday(),
    ]);
    res.set('Cache-Control', 'public, max-age=15, stale-while-revalidate=30');
    res.json({ ...data, sparklines, week52, volume, weeklyChange, intraday });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
