import { getCache, setCache, addHistory, getHistory } from '../db.js';

const CACHE_TTL = 30_000; // 30s

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  return res.json();
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

async function fetchOil() {
  try {
    const d = await fetchJSON('https://api.stock.naver.com/marketindex/productPrice/OIL_CL');
    return {
      value: d.closePrice || '-',
      change: d.compareToPreviousClosePrice || '',
      changeRate: `${d.fluctuationsRatio || 0}%`
    };
  } catch {
    return { value: '-', change: '', changeRate: '-' };
  }
}

export async function getMarketData() {
  const cached = getCache('market');
  if (cached) return cached;

  const [kospi, kosdaq, usdkrw, btc, sp500, nasdaq, dow, oil, vix] = await Promise.all([
    fetchIndex('KOSPI'),
    fetchIndex('KOSDAQ'),
    fetchUSDKRW(),
    fetchBTC(),
    fetchIndex('.INX'),
    fetchIndex('.IXIC'),
    fetchIndex('.DJI'),
    fetchOil(),
    fetchIndex('.VIX')
  ]);

  const data = {
    kospi: { name: 'KOSPI', ...kospi },
    kosdaq: { name: 'KOSDAQ', ...kosdaq },
    usdkrw: { name: 'USD/KRW', ...usdkrw },
    oil: { name: 'WTI', ...oil },
    btc: { name: 'BTC/KRW', ...btc },
    sp500: { name: 'S&P 500', ...sp500 },
    nasdaq: { name: 'NASDAQ', ...nasdaq },
    dow: { name: 'DOW', ...dow },
    vix: { name: 'VIX', ...vix },
    updatedAt: new Date().toISOString()
  };

  // Record history for sparklines
  const symbols = { kospi, kosdaq, usdkrw, oil, btc, sp500, nasdaq, dow, vix };
  for (const [key, val] of Object.entries(symbols)) {
    const num = parseFloat(String(val.value).replace(/,/g, ''));
    if (!isNaN(num) && num > 0) addHistory(key, num);
  }

  setCache('market', data, CACHE_TTL);
  return data;
}

export async function getSparklines() {
  const cached = getCache('sparklines');
  if (cached) return cached;

  const keys = ['kospi', 'kosdaq', 'usdkrw', 'oil', 'btc', 'sp500', 'nasdaq', 'dow', 'vix'];
  const result = {};
  for (const key of keys) {
    result[key] = getHistory(key, 48).map(r => r.value);
  }

  setCache('sparklines', result, 30_000);
  return result;
}
