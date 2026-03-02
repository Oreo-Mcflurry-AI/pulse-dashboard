import RSSParser from 'rss-parser';
import { getCache, setCache } from '../db.js';

const parser = new RSSParser();
const CACHE_TTL = 5 * 60_000; // 5min

const FEEDS = [
  { category: '글로벌', query: 'world economy markets war', icon: '🌍' },
  { category: '중동', query: 'Iran war Middle East oil', icon: '🔥' },
  { category: '시장', query: 'stock market crypto oil price', icon: '📈' },
  { category: '한국', query: 'South Korea economy KRW', icon: '🇰🇷' },
];

async function fetchFeed(query, limit = 5) {
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

export async function getNews() {
  const cached = getCache('news:briefing');
  if (cached) return cached;

  const results = await Promise.all(
    FEEDS.map(async (feed) => ({
      category: feed.category,
      icon: feed.icon,
      articles: await fetchFeed(feed.query, 5)
    }))
  );

  const data = {
    sections: results.filter(s => s.articles.length > 0),
    updatedAt: new Date().toISOString()
  };

  setCache('news:briefing', data, CACHE_TTL);
  return data;
}
