import { Router } from 'express';

const router = Router();
const FETCH_TIMEOUT = 10_000;

// Cache calendar data (1 hour — API only updates hourly)
let calendarCache = { data: null, updatedAt: 0 };
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const COUNTRY_FLAGS = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺',
  CAD: '🇨🇦', CHF: '🇨🇭', NZD: '🇳🇿', CNY: '🇨🇳', KRW: '🇰🇷',
  ALL: '🌐',
};

const COUNTRY_NAMES = {
  USD: '미국', EUR: '유로존', GBP: '영국', JPY: '일본', AUD: '호주',
  CAD: '캐나다', CHF: '스위스', NZD: '뉴질랜드', CNY: '중국', KRW: '한국',
};

const IMPACT_LEVELS = {
  'High': 3,
  'Medium': 2,
  'Low': 1,
  'Holiday': 0,
  'Non-Economic': 0,
};

async function fetchCalendar() {
  if (calendarCache.data && Date.now() - calendarCache.updatedAt < CACHE_TTL) {
    return calendarCache.data;
  }

  try {
    const res = await fetch('https://nfs.faireconomy.media/ff_calendar_thisweek.json', {
      headers: {
        'User-Agent': 'PulseDashboard/1.0 (economic-calendar; once-per-hour)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });

    if (!res.ok) throw new Error(`Calendar API: ${res.status}`);
    const raw = await res.json();

    const events = raw.map(e => ({
      title: e.title || '',
      country: e.country || '',
      countryName: COUNTRY_NAMES[e.country] || e.country || '',
      flag: COUNTRY_FLAGS[e.country] || '🏳️',
      date: e.date || '',
      impact: e.impact || 'Low',
      impactLevel: IMPACT_LEVELS[e.impact] || 0,
      forecast: e.forecast || '',
      previous: e.previous || '',
      actual: e.actual || '',
    })).filter(e => e.title && e.date);

    // Sort by date
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Group by date
    const grouped = {};
    events.forEach(e => {
      const dateKey = e.date.slice(0, 10);
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(e);
    });

    const data = {
      events,
      grouped,
      totalEvents: events.length,
      highImpact: events.filter(e => e.impactLevel === 3).length,
      updatedAt: new Date().toISOString(),
    };

    calendarCache = { data, updatedAt: Date.now() };
    return data;
  } catch (e) {
    // Return stale cache if available
    if (calendarCache.data) {
      console.warn('[calendar] Fetch failed, returning stale cache:', e.message);
      return calendarCache.data;
    }
    throw e;
  }
}

router.get('/', async (req, res) => {
  try {
    const data = await fetchCalendar();
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.json(data);
  } catch (e) {
    console.error('[calendar] error:', e.message);
    // Return empty calendar instead of 500
    res.json({
      events: [],
      grouped: {},
      totalEvents: 0,
      highImpact: 0,
      updatedAt: new Date().toISOString(),
      error: 'Calendar data temporarily unavailable',
    });
  }
});

export default router;
