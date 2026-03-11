import { Router } from 'express';

const router = Router();
const FETCH_TIMEOUT = 5_000;

// Search stocks via Naver autocomplete
router.get('/search', async (req, res) => {
  const q = req.query.q;
  if (!q || q.length < 1) return res.json({ items: [] });

  try {
    const url = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(q)}&target=stock`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    const data = await r.json();
    const items = (data.items || [])
      .filter(i => i.nationCode === 'KOR') // Korean stocks only
      .slice(0, 10)
      .map(i => ({
        code: i.code,
        name: i.name,
        market: i.typeName || i.typeCode || '',
      }));
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ items });
  } catch (e) {
    res.json({ items: [], error: e.message });
  }
});

// Get stock detail
router.get('/:code', async (req, res) => {
  const { code } = req.params;
  if (!code || !/^[0-9A-Z]{4,8}$/.test(code)) return res.status(400).json({ error: 'Invalid code' });

  try {
    const url = `https://m.stock.naver.com/api/stock/${code}/basic`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    const d = await r.json();

    // Also fetch chart data (1 month)
    let chart = [];
    try {
      const now = new Date();
      const end = now.toISOString().slice(0, 10).replace(/-/g, '');
      const start = new Date(now - 30 * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
      const chartUrl = `https://api.finance.naver.com/siseJson.naver?symbol=${code}&requestType=1&startTime=${start}&endTime=${end}&timeframe=day`;
      const cr = await fetch(chartUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      });
      const text = await cr.text();
      const rows = text.match(/\["20\d{6}",\s*[\d.]+,\s*[\d.]+,\s*[\d.]+,\s*[\d.]+/g);
      if (rows) {
        chart = rows.map(row => {
          const parts = row.replace(/[[\]"]/g, '').split(',').map(s => s.trim());
          return {
            date: `${parts[0].slice(0,4)}-${parts[0].slice(4,6)}-${parts[0].slice(6,8)}`,
            close: parseFloat(parts[4]),
          };
        });
      }
    } catch {}

    res.set('Cache-Control', 'public, max-age=30');
    res.json({
      code,
      name: d.stockName || '',
      price: d.closePrice || '',
      change: d.compareToPreviousClosePrice || '',
      changeRate: `${d.fluctuationsRatio || 0}%`,
      status: d.marketStatus || 'UNKNOWN',
      high52w: d.high52wPrice || '',
      low52w: d.low52wPrice || '',
      marketCap: d.marketValue || '',
      per: d.per || '',
      pbr: d.pbr || '',
      dividend: d.dividendYield || '',
      volume: d.accumulatedTradingVolume || '',
      chart,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
