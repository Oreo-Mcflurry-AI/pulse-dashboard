import { useState, useEffect, useCallback, useMemo } from 'react';

const BOOKMARKS_KEY = 'pulse-news-bookmarks';
function getBookmarks() {
  try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]'); } catch { return []; }
}
function saveBookmarks(bm) { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bm)); }

// Source credibility badges
const SOURCE_TIERS = {
  // Tier 1: Major wire services & top-tier
  'Reuters': { tier: 1, label: '📡 통신사', color: '#f97316' },
  'AP News': { tier: 1, label: '📡 통신사', color: '#f97316' },
  'The Associated Press': { tier: 1, label: '📡 통신사', color: '#f97316' },
  'Bloomberg': { tier: 1, label: '💎 프리미엄', color: '#8b5cf6' },
  'Financial Times': { tier: 1, label: '💎 프리미엄', color: '#8b5cf6' },
  'The Wall Street Journal': { tier: 1, label: '💎 프리미엄', color: '#8b5cf6' },
  'The Economist': { tier: 1, label: '💎 프리미엄', color: '#8b5cf6' },
  // Tier 2: Major national outlets
  'BBC': { tier: 2, label: '📺 공영', color: '#3b82f6' },
  'BBC News': { tier: 2, label: '📺 공영', color: '#3b82f6' },
  'CNN': { tier: 2, label: '📺 메이저', color: '#3b82f6' },
  'The New York Times': { tier: 2, label: '📰 메이저', color: '#3b82f6' },
  'The Washington Post': { tier: 2, label: '📰 메이저', color: '#3b82f6' },
  'NPR': { tier: 2, label: '📻 공영', color: '#3b82f6' },
  'CNBC': { tier: 2, label: '📺 경제', color: '#3b82f6' },
  'The Guardian': { tier: 2, label: '📰 메이저', color: '#3b82f6' },
  'Al Jazeera': { tier: 2, label: '📺 메이저', color: '#3b82f6' },
  // Korean: Tier 1
  'news.jtbc.co.kr': { tier: 1, label: '📺', color: '#3b82f6' },
  'n.news.naver.com': { tier: 2, label: '🔗 네이버', color: '#22c55e' },
  'news.sbs.co.kr': { tier: 2, label: '📺', color: '#3b82f6' },
  'news.kbs.co.kr': { tier: 2, label: '📺 공영', color: '#3b82f6' },
  'news.mbc.co.kr': { tier: 2, label: '📺 공영', color: '#3b82f6' },
  'chosun.com': { tier: 2, label: '📰 종합', color: '#3b82f6' },
  'joongang.co.kr': { tier: 2, label: '📰 종합', color: '#3b82f6' },
  'hani.co.kr': { tier: 2, label: '📰 종합', color: '#3b82f6' },
  'mk.co.kr': { tier: 2, label: '📊 경제', color: '#f59e0b' },
  'hankyung.com': { tier: 2, label: '📊 경제', color: '#f59e0b' },
  'sedaily.com': { tier: 2, label: '📊 경제', color: '#f59e0b' },
  'mt.co.kr': { tier: 2, label: '📊 경제', color: '#f59e0b' },
  'edaily.co.kr': { tier: 2, label: '📊 경제', color: '#f59e0b' },
  'yonhapnews.co.kr': { tier: 1, label: '📡 통신사', color: '#f97316' },
  'newsis.com': { tier: 2, label: '📡 통신사', color: '#f97316' },
};

function getSourceBadge(source) {
  if (!source) return null;
  // Direct match
  if (SOURCE_TIERS[source]) return SOURCE_TIERS[source];
  // Partial match (for hostnames like "news.jtbc.co.kr" matching against "jtbc")
  const srcLower = source.toLowerCase();
  for (const [key, val] of Object.entries(SOURCE_TIERS)) {
    if (srcLower.includes(key.toLowerCase()) || key.toLowerCase().includes(srcLower)) {
      return val;
    }
  }
  return null;
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  return `${Math.floor(hrs / 24)}일 전`;
}

function NewsSection({ icon, category, articles, bookmarks, onToggleBookmark }) {
  const bmUrls = new Set(bookmarks.map(b => b.url));
  return (
    <div className="mb-4">
      <h3 className="text-xs font-bold uppercase tracking-wider px-3 mb-2" style={{ color: 'var(--text-muted)' }}>
        {icon} {category}
      </h3>
      <div className="space-y-0.5">
        {articles.map((a, i) => (
          <div
            key={i}
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
                {a.pubDate && (Date.now() - new Date(a.pubDate).getTime()) < 3600000 && (
                  <span className="inline-block text-[9px] px-1 py-0.5 mr-1 rounded font-bold align-middle"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>속보</span>
                )}
                {a.title}
              </span>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                  {a.source}
                  {(() => {
                    const badge = getSourceBadge(a.source);
                    if (!badge) return null;
                    return (
                      <span className="text-[8px] px-1 py-0.5 rounded-sm font-medium whitespace-nowrap" style={{
                        background: `${badge.color}18`,
                        color: badge.color,
                        border: `1px solid ${badge.color}30`,
                      }}>{badge.label}</span>
                    );
                  })()}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{timeAgo(a.pubDate)}</span>
              </div>
            </a>
            <div className="flex items-center gap-1 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const text = `${a.title}\n${a.url}`;
                  navigator.clipboard.writeText(text).then(() => {
                    const btn = e.currentTarget;
                    btn.textContent = '✓';
                    setTimeout(() => { btn.textContent = '🔗'; }, 1500);
                  });
                }}
                className="text-xs p-0.5 rounded hover:opacity-70 transition-opacity"
                style={{ color: 'var(--text-muted)' }}
                title="링크 복사"
                aria-label={`${a.title} 링크 복사`}
              >
                🔗
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleBookmark(a); }}
                className="text-sm p-0.5 rounded hover:opacity-70 transition-opacity"
                style={{ color: bmUrls.has(a.url) ? '#f59e0b' : 'var(--text-muted)' }}
                title={bmUrls.has(a.url) ? '북마크 해제' : '북마크'}
                aria-label={bmUrls.has(a.url) ? `${a.title} 북마크 해제` : `${a.title} 북마크`}
                aria-pressed={bmUrls.has(a.url)}
              >
                {bmUrls.has(a.url) ? '★' : '☆'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RefreshCountdown({ lastFetchAt, interval, live }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (live) return; // SSE mode, no countdown needed
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live]);

  if (live) return <span style={{ color: '#22c55e' }}>🟢 실시간</span>;
  if (!lastFetchAt || !interval) return null;

  const elapsed = now - lastFetchAt;
  const remaining = Math.max(0, Math.ceil((interval - elapsed) / 1000));
  const pct = Math.min(100, (elapsed / interval) * 100);

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-block w-8 h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <span className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000" style={{
          width: `${pct}%`,
          background: remaining <= 5 ? '#22c55e' : 'var(--text-muted)',
          opacity: 0.6,
        }} />
      </span>
      <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{remaining}s</span>
    </span>
  );
}

export default function NewsPanel({ data, lastFetchAt, interval, live }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [bookmarks, setBookmarks] = useState(getBookmarks);

  const toggleBookmark = useCallback((article) => {
    setBookmarks(prev => {
      const exists = prev.some(b => b.url === article.url);
      const next = exists
        ? prev.filter(b => b.url !== article.url)
        : [{ title: article.title, url: article.url, source: article.source, pubDate: article.pubDate, savedAt: new Date().toISOString() }, ...prev];
      saveBookmarks(next);
      return next;
    });
  }, []);

  if (!data?.sections?.length && filter !== 'bookmarks') return null;

  const categories = ['all', ...((data?.sections || []).map(s => s.category)), 'bookmarks'];
  const q = search.trim().toLowerCase();

  // Apply category filter, then search filter
  let filtered = filter === 'all' || filter === 'bookmarks' ? (data?.sections || []) : (data?.sections || []).filter(s => s.category === filter);
  if (q) {
    filtered = filtered.map(section => ({
      ...section,
      articles: section.articles.filter(a =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.source || '').toLowerCase().includes(q)
      ),
    })).filter(s => s.articles.length > 0);
  }

  const totalCount = data.sections.reduce((sum, s) => sum + (s.articles?.length || 0), 0);
  const filteredCount = filtered.reduce((sum, s) => sum + (s.articles?.length || 0), 0);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3 px-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>📰 뉴스 브리핑</h2>
        <span className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
          {q ? `${filteredCount}/${totalCount}건` : `${totalCount}건`}
          {data.updatedAt && ` · ${new Date(data.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
          {' · '}
          <RefreshCountdown lastFetchAt={lastFetchAt} interval={interval} live={live} />
        </span>
      </div>
      {/* Search bar */}
      <div className="px-2 mb-2">
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }}>🔍</span>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="뉴스 검색..."
            aria-label="뉴스 키워드 검색"
            className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg outline-none transition-colors"
            style={{
              background: 'var(--bg-hover)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
            onFocus={e => e.target.style.borderColor = 'var(--text-muted)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs"
              style={{ color: 'var(--text-muted)' }}
              aria-label="검색어 지우기"
            >✕</button>
          )}
        </div>
      </div>
      {/* Category filter tabs */}
      <div role="tablist" aria-label="뉴스 카테고리" className="flex gap-1 px-2 mb-3 overflow-x-auto scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            role="tab"
            aria-selected={filter === cat}
            onClick={() => setFilter(cat)}
            className="px-2.5 py-1 text-[11px] rounded-full whitespace-nowrap transition-colors"
            style={{
              background: filter === cat ? 'var(--text-primary)' : 'var(--bg-hover)',
              color: filter === cat ? 'var(--bg-primary)' : 'var(--text-muted)',
              fontWeight: filter === cat ? 600 : 400,
            }}
          >
            {cat === 'all' ? '전체' : cat === 'bookmarks' ? `★ 저장됨${bookmarks.length ? ` (${bookmarks.length})` : ''}` : ((data?.sections || []).find(s => s.category === cat)?.icon || '') + ' ' + cat}
          </button>
        ))}
      </div>
      {filter === 'bookmarks' ? (
        bookmarks.length === 0 ? (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
            저장된 뉴스가 없습니다. 기사에 마우스를 올려 ☆를 클릭하세요.
          </div>
        ) : (
          <NewsSection
            icon="★"
            category="저장된 뉴스"
            articles={q ? bookmarks.filter(a => (a.title || '').toLowerCase().includes(q) || (a.source || '').toLowerCase().includes(q)) : bookmarks}
            bookmarks={bookmarks}
            onToggleBookmark={toggleBookmark}
          />
        )
      ) : filtered.length === 0 && q ? (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
          '{search}'에 대한 검색 결과가 없습니다
        </div>
      ) : filtered.map((section, i) => (
        <NewsSection key={i} {...section} bookmarks={bookmarks} onToggleBookmark={toggleBookmark} />
      ))}
    </div>
  );
}
