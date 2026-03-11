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

export default router;
