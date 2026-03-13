import { Router } from 'express';

const router = Router();
const FETCH_TIMEOUT = 8_000;

// Cache sector data (refreshed every 5 min)
let sectorCache = { data: null, updatedAt: 0 };
const CACHE_TTL = 5 * 60 * 1000;

async function fetchSectorData() {
  if (sectorCache.data && Date.now() - sectorCache.updatedAt < CACHE_TTL) {
    return sectorCache.data;
  }

  const res = await fetch('https://finance.naver.com/sise/sise_group.naver?type=upjong', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  const buf = await res.arrayBuffer();
  const html = new TextDecoder('euc-kr').decode(buf);

  // Parse sector data with regex (no cheerio dependency needed)
  const pattern = /type=upjong&no=(\d+)">([^<]+)<\/a><\/td>\s*<td class="number">\s*<span class="tah p11 (?:red01|blu01|)">\s*([\+\-]?[\d.]+%)\s*<\/span>/g;
  const sectors = [];
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const id = match[1];
    const name = match[2].trim();
    const changeStr = match[3].replace('%', '');
    const change = parseFloat(changeStr) || 0;

    // Extract stock counts: up, flat, down from subsequent tds
    // Find counts after this sector entry
    const afterMatch = html.slice(match.index + match[0].length, match.index + match[0].length + 300);
    const countMatch = afterMatch.match(/<td class="number">(\d+)<\/td>\s*<td class="number">(\d+)<\/td>\s*<td class="number">(\d+)<\/td>/);
    const up = countMatch ? parseInt(countMatch[1]) : 0;
    const flat = countMatch ? parseInt(countMatch[2]) : 0;
    const down = countMatch ? parseInt(countMatch[3]) : 0;
    const total = up + flat + down;

    sectors.push({
      id,
      name,
      change,
      up,
      flat,
      down,
      total,
      upRatio: total > 0 ? Math.round((up / total) * 100) : 0,
    });
  }

  // Sort by absolute change (biggest movers first)
  sectors.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  const data = {
    sectors,
    updatedAt: new Date().toISOString(),
    count: sectors.length,
  };

  sectorCache = { data, updatedAt: Date.now() };
  return data;
}

router.get('/', async (req, res) => {
  try {
    const data = await fetchSectorData();
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json(data);
  } catch (e) {
    console.error('[sectors] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Sector detail: stocks in a sector ───
const sectorDetailCache = new Map(); // id -> { data, updatedAt }
const DETAIL_TTL = 5 * 60 * 1000;

async function fetchSectorDetail(id) {
  const cached = sectorDetailCache.get(id);
  if (cached && Date.now() - cached.updatedAt < DETAIL_TTL) {
    return cached.data;
  }

  const res = await fetch(`https://finance.naver.com/sise/sise_group_detail.naver?type=upjong&no=${id}`, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });
  const buf = await res.arrayBuffer();
  const html = new TextDecoder('euc-kr').decode(buf);

  // Parse stock rows by splitting on stock code anchors
  const stocks = [];
  const codePattern = /code=(\d+)">([^<]+)<\/a>/g;
  let m;
  while ((m = codePattern.exec(html)) !== null) {
    // Skip non-main links (board, etc.)
    if (!html.slice(Math.max(0, m.index - 30), m.index).includes('item/main')) continue;

    const code = m[1];
    const name = m[2].trim();
    // Look at the ~500 chars after this match for price/change data
    const after = html.slice(m.index, m.index + 600);

    // Price: first <td class="number"...>digits</td>
    const priceMatch = after.match(/<td class="number"[^>]*>\s*([\d,]+)\s*<\/td>/);
    // Direction: bu_pup or bu_pdw
    const dirMatch = after.match(/bu_p(up|dw)/);
    // Change rate: +/-XX.XX%
    const rateMatch = after.match(/([\+\-]?\d+\.\d+%)/);

    if (priceMatch) {
      const direction = dirMatch ? dirMatch[1] : '';
      stocks.push({
        code,
        name,
        price: priceMatch[1],
        changeRate: rateMatch ? (direction === 'dw' && !rateMatch[1].startsWith('-') ? `-${rateMatch[1]}` : rateMatch[1]) : '0%',
        direction: direction === 'up' ? 'up' : direction === 'dw' ? 'down' : 'flat',
      });
    }
  }

  const data = { stocks, updatedAt: new Date().toISOString() };
  sectorDetailCache.set(id, { data, updatedAt: Date.now() });
  return data;
}

router.get('/:id', async (req, res) => {
  try {
    const data = await fetchSectorDetail(req.params.id);
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json(data);
  } catch (e) {
    console.error('[sectors detail] error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

export default router;
