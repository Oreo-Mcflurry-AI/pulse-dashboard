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

// ─── Keyword-based sentiment analysis ───
const POSITIVE_WORDS = [
  '상승', '급등', '반등', '호재', '수익', '성장', '최고', '돌파', '호실적',
  '강세', '매수', '낙관', '호황', '개선', '확대', '흑자', '사상최고',
  'rally', 'surge', 'gain', 'rise', 'bullish', 'record', 'growth', 'profit',
  'rebound', 'optimism', 'soar', 'boost', 'recovery', 'strong', 'up',
];
const NEGATIVE_WORDS = [
  '하락', '급락', '폭락', '악재', '손실', '위기', '최저', '전쟁', '공포',
  '약세', '매도', '비관', '불황', '적자', '축소', '파산', '침체', '공습',
  'crash', 'fall', 'drop', 'bearish', 'fear', 'loss', 'recession', 'crisis',
  'war', 'plunge', 'sell', 'weak', 'decline', 'slump', 'collapse', 'bomb',
  'missile', 'attack', 'strike', 'sanctions', 'tariff',
];

function analyzeSentiment(title) {
  if (!title) return { score: 0, label: 'neutral' };
  const lower = title.toLowerCase();
  let pos = 0, neg = 0;
  for (const w of POSITIVE_WORDS) if (lower.includes(w.toLowerCase())) pos++;
  for (const w of NEGATIVE_WORDS) if (lower.includes(w.toLowerCase())) neg++;
  const score = pos - neg;
  const label = score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral';
  return { score, label, positive: pos, negative: neg };
}

function computeSentimentSummary(sections) {
  let positive = 0, negative = 0, neutral = 0, totalScore = 0;
  const all = [];
  for (const sec of sections) {
    for (const a of (sec.articles || [])) {
      const s = analyzeSentiment(a.title);
      a.sentiment = s;
      all.push(s);
      if (s.label === 'positive') positive++;
      else if (s.label === 'negative') negative++;
      else neutral++;
      totalScore += s.score;
    }
  }
  const total = all.length || 1;
  return {
    positive, negative, neutral, total: all.length,
    positiveRatio: Math.round((positive / total) * 100),
    negativeRatio: Math.round((negative / total) * 100),
    neutralRatio: Math.round((neutral / total) * 100),
    avgScore: parseFloat((totalScore / total).toFixed(2)),
    mood: totalScore > 2 ? '🟢 낙관' : totalScore < -2 ? '🔴 비관' : '🟡 중립',
  };
}

// ─── News digest: keyword extraction + summary ───
const STOP_WORDS_KR = new Set(['의','가','이','은','는','을','를','에','와','과','도','로','에서','으로','까지','부터','라고','라며','한다','했다','이다','있다','된다','되는','하는','하고','것으로','것이','대한','위해','통해','따르면','밝혔다','전했다','보도했다','알려졌다']);
const STOP_WORDS_EN = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','are','was','were','be','been','being','have','has','had','do','does','did','will','would','could','should','may','might','shall','can','not','no','this','that','it','its','as','if','than','so','up','out','about','into','over','after','before','under','between','through','during','against','without','within','among']);

function extractKeywords(titles) {
  const freq = {};
  for (const title of titles) {
    // Split Korean + English words
    const words = title.replace(/[^\w가-힣\s]/g, '').split(/\s+/).filter(w => w.length >= 2);
    for (const w of words) {
      const lower = w.toLowerCase();
      if (STOP_WORDS_KR.has(lower) || STOP_WORDS_EN.has(lower)) continue;
      if (/^\d+$/.test(w)) continue; // skip pure numbers
      freq[lower] = (freq[lower] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .filter(([, c]) => c >= 2) // mentioned at least twice
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word, count]) => ({ word, count }));
}

function generateDigest(sections, sentimentSummary) {
  const allTitles = sections.flatMap(s => s.articles.map(a => a.title));
  const keywords = extractKeywords(allTitles);
  
  // Group articles by top keywords to find themes
  const themes = [];
  const usedArticles = new Set();
  
  for (const kw of keywords.slice(0, 5)) {
    const related = [];
    for (const sec of sections) {
      for (const a of sec.articles) {
        if (usedArticles.has(a.url)) continue;
        if (a.title.toLowerCase().includes(kw.word)) {
          related.push({ title: a.title, source: a.source, sentiment: a.sentiment?.label || 'neutral' });
          usedArticles.add(a.url);
        }
      }
    }
    if (related.length > 0) {
      themes.push({ keyword: kw.word, count: kw.count, articles: related.slice(0, 3) });
    }
  }

  // Build headline summary
  const topSentiment = sentimentSummary?.mood || '🟡 중립';
  const totalArticles = allTitles.length;
  
  return {
    keywords,
    themes: themes.slice(0, 4),
    headline: `${totalArticles}건 뉴스 분석 · ${topSentiment} · 핵심 키워드: ${keywords.slice(0, 5).map(k => k.word).join(', ')}`,
  };
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

  // Compute sentiment for all articles
  const sentiment = computeSentimentSummary(sections);

  // Generate digest (keywords + themes)
  const digest = generateDigest(sections, sentiment);

  const data = {
    sections,
    sentiment,
    digest,
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
