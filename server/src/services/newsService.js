import RSSParser from 'rss-parser';
import { getCache, setCache } from '../db.js';

const parser = new RSSParser();
const CACHE_TTL = 5 * 60_000; // 5min

export async function getNews(query = 'world economy markets') {
  const cacheKey = `news:${query}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
    const feed = await parser.parseURL(url);

    const articles = feed.items.slice(0, 15).map(item => ({
      title: item.title?.replace(/ - [\w\s]+$/, '') || '',
      source: item.title?.match(/ - ([\w\s]+)$/)?.[1]?.trim() || '',
      url: item.link || '',
      pubDate: item.pubDate || ''
    }));

    const data = { articles, updatedAt: new Date().toISOString() };
    setCache(cacheKey, data, CACHE_TTL);
    return data;
  } catch (e) {
    return { articles: [], updatedAt: new Date().toISOString(), error: e.message };
  }
}
