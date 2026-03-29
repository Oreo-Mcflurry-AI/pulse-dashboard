import { useState, useEffect, useCallback } from 'react';

const RSS_KEY = 'pulse_rss_feeds';
const RSS_CACHE_KEY = 'pulse_rss_cache';

// Default suggested feeds
const SUGGESTIONS = [
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage' },
  { name: 'Reuters Business', url: 'https://www.reutersagency.com/feed/?best-topics=business-finance' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml' },
  { name: 'Bloomberg (Asia)', url: 'https://feeds.bloomberg.com/markets/news.rss' },
];

function getFeeds() {
  try { return JSON.parse(localStorage.getItem(RSS_KEY) || '[]'); } catch { return []; }
}
function saveFeeds(feeds) { localStorage.setItem(RSS_KEY, JSON.stringify(feeds)); }

function getCachedArticles() {
  try { return JSON.parse(localStorage.getItem(RSS_CACHE_KEY) || '{}'); } catch { return {}; }
}
function setCachedArticles(data) { localStorage.setItem(RSS_CACHE_KEY, JSON.stringify(data)); }

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff) || diff < 0) return '';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  return `${Math.floor(hrs / 24)}일 전`;
}

export default function RSSFeeds() {
  const [feeds, setFeeds] = useState(getFeeds);
  const [articles, setArticles] = useState({});
  const [loading, setLoading] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newName, setNewName] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');

  const fetchFeed = useCallback(async (feed) => {
    try {
      const res = await fetch(`/api/rss?url=${encodeURIComponent(feed.url)}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      return { ...data, feedName: feed.name, feedUrl: feed.url };
    } catch (e) {
      return { items: [], feedName: feed.name, feedUrl: feed.url, error: e.message };
    }
  }, []);

  const fetchAll = useCallback(async () => {
    if (feeds.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const results = await Promise.allSettled(feeds.map(fetchFeed));
      const map = {};
      let errCount = 0;
      for (const r of results) {
        const data = r.status === 'fulfilled' ? r.value : { items: [], feedName: '?', error: 'fetch failed' };
        map[data.feedUrl] = data;
        if (data.error) errCount++;
      }
      setArticles(map);
      setCachedArticles(map);
      if (errCount > 0 && errCount < feeds.length) setError(`${errCount}개 피드 로딩 실패`);
      else if (errCount === feeds.length && feeds.length > 0) setError('모든 피드 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, [feeds, fetchFeed]);

  useEffect(() => {
    // Load cache first for instant display
    const cached = getCachedArticles();
    if (Object.keys(cached).length > 0) setArticles(cached);
    fetchAll();
  }, [fetchAll]);

  const addFeed = () => {
    const url = newUrl.trim();
    if (!url) return;
    if (feeds.some(f => f.url === url)) { setError('이미 등록된 피드입니다'); return; }
    const name = newName.trim() || url.replace(/^https?:\/\//, '').split('/')[0];
    const next = [...feeds, { name, url, addedAt: new Date().toISOString() }];
    setFeeds(next);
    saveFeeds(next);
    setNewUrl('');
    setNewName('');
    setError('');
  };

  const removeFeed = (url) => {
    const next = feeds.filter(f => f.url !== url);
    setFeeds(next);
    saveFeeds(next);
    const newArticles = { ...articles };
    delete newArticles[url];
    setArticles(newArticles);
    setCachedArticles(newArticles);
  };

  const addSuggestion = (s) => {
    if (feeds.some(f => f.url === s.url)) return;
    const next = [...feeds, { name: s.name, url: s.url, addedAt: new Date().toISOString() }];
    setFeeds(next);
    saveFeeds(next);
  };

  // Merge and sort all articles
  const allArticles = [];
  for (const [url, data] of Object.entries(articles)) {
    if (!data?.items) continue;
    if (filter !== 'all' && url !== filter) continue;
    for (const item of data.items) {
      allArticles.push({ ...item, feedName: data.feedName, feedUrl: url, source: item.source || data.feedName || data.title });
    }
  }
  allArticles.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>📡 RSS 피드</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
            {feeds.length}개 구독
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>로딩중...</span>}
          <button
            onClick={fetchAll}
            className="text-[10px] sm:text-xs px-2 py-1 rounded transition-colors"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
            title="새로고침"
          >🔄</button>
          <button
            onClick={() => setShowManage(v => !v)}
            className="text-[10px] sm:text-xs px-2 py-1 rounded transition-colors"
            style={{
              background: showManage ? 'rgba(59,130,246,0.15)' : 'var(--bg-hover)',
              color: showManage ? '#3b82f6' : 'var(--text-muted)',
            }}
          >⚙️ 관리</button>
        </div>
      </div>

      {error && (
        <div className="mx-2 mb-2 px-3 py-1.5 rounded-lg text-[11px]" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Management panel */}
      {showManage && (
        <div className="mx-2 mb-3 p-3 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
          <div className="text-[11px] font-bold mb-2" style={{ color: 'var(--text-muted)' }}>피드 추가</div>
          <div className="flex gap-1.5 mb-2">
            <input
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="RSS/Atom 피드 URL"
              className="flex-1 px-2 py-1.5 text-xs rounded"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }}
              onKeyDown={e => { if (e.key === 'Enter') addFeed(); }}
            />
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="이름 (선택)"
              className="w-24 px-2 py-1.5 text-xs rounded"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }}
            />
            <button
              onClick={addFeed}
              className="px-3 py-1.5 text-xs rounded font-medium"
              style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
            >추가</button>
          </div>

          {/* Suggestions */}
          <div className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>추천 피드:</div>
          <div className="flex flex-wrap gap-1 mb-3">
            {SUGGESTIONS.map(s => {
              const added = feeds.some(f => f.url === s.url);
              return (
                <button
                  key={s.url}
                  onClick={() => addSuggestion(s)}
                  disabled={added}
                  className="text-[10px] px-2 py-1 rounded-full transition-colors"
                  style={{
                    background: added ? 'rgba(34,197,94,0.1)' : 'var(--bg-card)',
                    color: added ? '#22c55e' : 'var(--text-muted)',
                    border: `1px solid ${added ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                    cursor: added ? 'default' : 'pointer',
                    opacity: added ? 0.7 : 1,
                  }}
                >
                  {added ? '✓ ' : '+ '}{s.name}
                </button>
              );
            })}
          </div>

          {/* Current feeds */}
          {feeds.length > 0 && (
            <div>
              <div className="text-[10px] mb-1.5" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>구독 목록:</div>
              <div className="space-y-1">
                {feeds.map(f => (
                  <div key={f.url} className="flex items-center justify-between px-2 py-1 rounded" style={{ background: 'var(--bg-card)' }}>
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-medium" style={{ color: 'var(--text-primary)' }}>{f.name}</span>
                      <span className="text-[9px] ml-2 truncate" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{f.url}</span>
                      {articles[f.url] && (
                        <span className="text-[9px] ml-1.5" style={{ color: articles[f.url].error ? '#ef4444' : '#22c55e' }}>
                          {articles[f.url].error ? '⚠️ 오류' : `${articles[f.url].items?.length || 0}건`}
                        </span>
                      )}
                    </div>
                    <button onClick={() => removeFeed(f.url)} className="text-xs ml-2 hover:opacity-60" style={{ color: '#ef4444' }}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feed filter tabs */}
      {feeds.length > 1 && (
        <div className="flex gap-1 px-2 mb-3 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setFilter('all')}
            className="px-2.5 py-1 text-[11px] rounded-full whitespace-nowrap transition-colors"
            style={{
              background: filter === 'all' ? 'var(--text-primary)' : 'var(--bg-hover)',
              color: filter === 'all' ? 'var(--bg-primary)' : 'var(--text-muted)',
              fontWeight: filter === 'all' ? 600 : 400,
            }}
          >
            전체 {allArticles.length > 0 && <span className="ml-1 text-[9px] opacity-70">{Object.values(articles).reduce((s, d) => s + (d.items?.length || 0), 0)}</span>}
          </button>
          {feeds.map(f => {
            const count = articles[f.url]?.items?.length || 0;
            return (
              <button
                key={f.url}
                onClick={() => setFilter(f.url)}
                className="px-2.5 py-1 text-[11px] rounded-full whitespace-nowrap transition-colors"
                style={{
                  background: filter === f.url ? 'var(--text-primary)' : 'var(--bg-hover)',
                  color: filter === f.url ? 'var(--bg-primary)' : 'var(--text-muted)',
                  fontWeight: filter === f.url ? 600 : 400,
                }}
              >
                {f.name} {count > 0 && <span className="ml-1 text-[9px] opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {feeds.length === 0 && (
        <div className="text-center py-12">
          <div className="text-3xl mb-3">📡</div>
          <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>RSS 피드를 구독해보세요</p>
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>관심 있는 뉴스 소스의 RSS/Atom 피드를 추가하면 여기서 한눈에 확인할 수 있습니다</p>
          <button
            onClick={() => setShowManage(true)}
            className="px-4 py-2 text-xs rounded-lg font-medium"
            style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
          >
            ⚙️ 피드 추가하기
          </button>
        </div>
      )}

      {/* Article list */}
      {allArticles.length > 0 && (
        <div className="space-y-0.5">
          {allArticles.slice(0, 50).map((a, i) => (
            <div
              key={`${a.feedUrl}-${i}`}
              className="flex items-start gap-2 px-3 py-1.5 rounded-lg transition-colors group"
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 flex-1 min-w-0"
              >
                <span className="text-sm leading-snug flex-1 group-hover:text-blue-500 dark:group-hover:text-blue-400">
                  {a.title}
                </span>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.feedName}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{timeAgo(a.pubDate)}</span>
                </div>
              </a>
            </div>
          ))}
          {allArticles.length > 50 && (
            <p className="text-center text-[10px] py-2" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
              +{allArticles.length - 50}건 더 있음
            </p>
          )}
        </div>
      )}
    </div>
  );
}
