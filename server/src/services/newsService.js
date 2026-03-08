import RSSParser from 'rss-parser';
import { getCache, setCache } from '../db.js';

const parser = new RSSParser();
const CACHE_TTL = 5 * 60_000; // 5min

// In-memory cache for zero-latency news responses
let newsMemCache = { data: null, updatedAt: 0 };

const NAVER_CLIENT_ID = '_PxpOWWwOgM_A7Dpa2Wv';
const NAVER_CLIENT_SECRET = 'Ctk_vonMB6';

const FEEDS = [
  { category: '글로벌', query: 'world economy markets war', icon: '🌍' },
  { category: '중동', query: 'Iran war Middle East oil', icon: '🔥' },
  { category: '시장', query: 'stock market crypto oil price', icon: '📈' },
];

async function fetchGoogleFeed(query, limit = 5) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const feed = await parser.parseURL(url);
    return feed.items.slice(0, limit).map(item => ({
      title: item.title?.replace(/ - [\w\s]+$/, '') || '',
      source: item.title?.match(/ - ([\w\s]+)$/)?.[1]?.trim() || '',
      url: item.link || '',
      pubDate: item.pubDate || ''
    }));
  } catch {
    return [];
  }
}

async function fetchNaverNews(query, limit = 5) {
  try {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${limit}&sort=date`;
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
      }
    });
    const data = await res.json();
    return (data.items || []).map(item => ({
      title: item.title.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'),
      source: item.originallink ? new URL(item.originallink).hostname.replace('www.', '') : '',
      url: item.link || '',
      pubDate: item.pubDate || ''
    }));
  } catch {
    return [];
  }
}

// Core fetch — called by background prefetcher
async function fetchAllNews() {
  const [googleResults, koreaEcon, koreaMarket] = await Promise.all([
    Promise.all(
      FEEDS.map(async (feed) => ({
        category: feed.category,
        icon: feed.icon,
        articles: await fetchGoogleFeed(feed.query, 5)
      }))
    ),
    fetchNaverNews('경제 증시 환율', 4),
    fetchNaverNews('이란 전쟁 중동', 3),
  ]);

  const koreaArticles = [...koreaMarket, ...koreaEcon].slice(0, 6);

  const sections = [
    ...googleResults,
    { category: '한국', icon: '🇰🇷', articles: koreaArticles }
  ].filter(s => s.articles.length > 0);

  const data = {
    sections,
    updatedAt: new Date().toISOString()
  };

  setCache('news:briefing', data, CACHE_TTL);
  return data;
}

// ─── Background prefetcher (stale-while-revalidate) ───
let newsPrefetchTimer = null;
let newsPrefetchInFlight = false;

async function prefetchNews() {
  if (newsPrefetchInFlight) return;
  newsPrefetchInFlight = true;
  try {
    const data = await fetchAllNews();
    newsMemCache = { data, updatedAt: Date.now() };
  } catch (e) {
    console.error('[news prefetch] error:', e.message);
  } finally {
    newsPrefetchInFlight = false;
  }
}

export function startNewsPrefetch() {
  prefetchNews();
  newsPrefetchTimer = setInterval(prefetchNews, CACHE_TTL);
  return newsPrefetchTimer;
}

export function stopNewsPrefetch() {
  if (newsPrefetchTimer) clearInterval(newsPrefetchTimer);
}

// ─── Public API (near-instant from memory) ───
export async function getNews() {
  // Return in-memory if fresh
  if (newsMemCache.data && Date.now() - newsMemCache.updatedAt < CACHE_TTL) {
    return newsMemCache.data;
  }
  // Fallback: SQLite cache
  const cached = getCache('news:briefing');
  if (cached) return cached;
  // Cold start: fetch on-demand
  return fetchAllNews();
}
