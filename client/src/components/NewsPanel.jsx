import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { addNotification, shouldNotify } from './NotificationCenter';

// ─── News Alert Keywords ───
const ALERTS_KEY = 'pulse-news-alerts';
function getAlertKeywords() {
  try { return JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]'); } catch { return []; }
}
function saveAlertKeywords(kw) { localStorage.setItem(ALERTS_KEY, JSON.stringify(kw)); }

const BOOKMARKS_KEY = 'pulse-news-bookmarks';
function getBookmarks() {
  try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]'); } catch { return []; }
}
function saveBookmarks(bm) { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bm)); }

const READ_KEY = 'pulse-news-read';
const READ_MAX = 500; // keep last 500 read URLs
function getReadUrls() {
  try { return JSON.parse(localStorage.getItem(READ_KEY) || '[]'); } catch { return []; }
}
function markAsRead(url) {
  const read = getReadUrls();
  if (read.includes(url)) return read;
  const next = [...read, url].slice(-READ_MAX);
  localStorage.setItem(READ_KEY, JSON.stringify(next));
  return next;
}
function clearAllRead() {
  localStorage.removeItem(READ_KEY);
}

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

// ─── Estimated reading time ───
function estimateReadTime(title, source) {
  // Korean news articles average ~600-1200 chars, English ~300-800 words
  // Estimate based on source type and title complexity
  const isKorean = /[가-힣]/.test(title);
  const titleLen = (title || '').length;
  // Longer titles usually indicate longer articles
  const baseMin = isKorean ? 2 : 3;
  const extra = titleLen > 60 ? 1 : titleLen > 40 ? 0.5 : 0;
  // Premium sources tend to have longer articles
  const badge = getSourceBadge(source);
  const premiumBonus = badge?.tier === 1 ? 1 : 0;
  const mins = Math.max(1, Math.round(baseMin + extra + premiumBonus));
  return `${mins}분`;
}

// ─── OG Data (Image + Description) ───
const ogCache = new Map(); // in-memory session cache: url -> { image, description }

function useOgData(url) {
  const [data, setData] = useState(() => ogCache.get(url) || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!url || failed) return;
    if (ogCache.has(url)) { setData(ogCache.get(url)); return; }
    let cancelled = false;
    fetch(`/api/og?url=${encodeURIComponent(url)}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        ogCache.set(url, d);
        setData(d);
        if (!d.image && !d.description) setFailed(true);
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [url, failed]);

  return data;
}

function NewsThumbnail({ url }) {
  const og = useOgData(url);
  const [imgFailed, setImgFailed] = useState(false);

  if (!og?.image || imgFailed) return null;

  return (
    <img
      src={og.image}
      alt=""
      loading="lazy"
      className="rounded shrink-0 object-cover hidden sm:block"
      style={{ width: 56, height: 38, background: 'var(--bg-hover)' }}
      onError={() => setImgFailed(true)}
    />
  );
}

function NewsPopover({ url, children }) {
  const og = useOgData(url);
  const [show, setShow] = useState(false);
  const timerRef = useRef(null);

  const handleEnter = useCallback(() => {
    timerRef.current = setTimeout(() => setShow(true), 400);
  }, []);
  const handleLeave = useCallback(() => {
    clearTimeout(timerRef.current);
    setShow(false);
  }, []);

  if (!og?.description) {
    return children;
  }

  return (
    <div className="relative" onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
      {children}
      {show && (
        <div
          className="absolute left-0 top-full mt-1 z-40 p-2.5 rounded-lg shadow-lg max-w-xs sm:max-w-sm pointer-events-none"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          }}
        >
          <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {og.description}
          </p>
        </div>
      )}
    </div>
  );
}

// Highlight matching keywords in text
function highlightKeywords(text, keywords) {
  if (!keywords || keywords.length === 0 || !text) return text;
  const escaped = keywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);
  if (parts.length <= 1) return text;
  // Use a separate non-global regex for testing
  const testRegex = new RegExp(`^(${escaped.join('|')})$`, 'i');
  return parts.map((part, i) =>
    testRegex.test(part)
      ? <mark key={i} style={{ background: 'rgba(59,130,246,0.25)', color: 'inherit', borderRadius: '2px', padding: '0 1px' }}>{part}</mark>
      : part
  );
}

function NewsSection({ icon, category, articles, bookmarks, onToggleBookmark, readUrls, onMarkRead, alertKeywords }) {
  const bmUrls = new Set(bookmarks.map(b => b.url));
  const readSet = new Set(readUrls || []);
  return (
    <div className="mb-4">
      <h3 className="text-xs font-bold uppercase tracking-wider px-3 mb-2" style={{ color: 'var(--text-muted)' }}>
        {icon} {category}
      </h3>
      <div className="space-y-0.5">
        {articles.map((a, i) => {
          const isRead = readSet.has(a.url);
          return (
          <div
            key={i}
            className="flex items-start gap-2 px-3 py-1.5 rounded-lg transition-colors group"
            style={{ opacity: isRead ? 0.55 : 1 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <NewsThumbnail url={a.url} />
            <NewsPopover url={a.url}>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 flex-1 min-w-0"
              onClick={() => onMarkRead && onMarkRead(a.url)}
            >
              <span className={`text-sm leading-snug flex-1 group-hover:text-blue-500 dark:group-hover:text-blue-400 ${isRead ? 'line-through decoration-1' : ''}`} style={isRead ? { textDecorationColor: 'var(--text-muted)' } : {}}>
                {a.pubDate && (Date.now() - new Date(a.pubDate).getTime()) < 3600000 && (
                  <span className="inline-block text-[9px] px-1 py-0.5 mr-1 rounded font-bold align-middle"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>속보</span>
                )}
                {highlightKeywords(a.title, alertKeywords)}
                {a.sentiment && a.sentiment.label !== 'neutral' && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full ml-1 align-middle" style={{
                    background: a.sentiment.label === 'positive' ? '#22c55e' : '#ef4444',
                  }} title={a.sentiment.label === 'positive' ? '긍정' : '부정'} />
                )}
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
                <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                  {timeAgo(a.pubDate)}
                  <span className="hidden sm:inline text-[8px]" title="예상 읽기 시간">
                    · {estimateReadTime(a.title, a.source)}
                  </span>
                </span>
              </div>
            </a>
            </NewsPopover>
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
          );
        })}
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

function NewsAlertSettings({ keywords, onAdd, onRemove }) {
  const [input, setInput] = useState('');
  const handleAdd = () => {
    const kw = input.trim();
    if (kw && !keywords.includes(kw)) { onAdd(kw); setInput(''); }
  };
  return (
    <div className="px-3 mb-3 p-2.5 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>🔔 뉴스 알림 키워드</span>
        <span className="text-[9px]" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>매칭 시 브라우저 알림</span>
      </div>
      <div className="flex gap-1.5 mb-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="키워드 입력 (예: 코스피, 트럼프, 금리)"
          className="flex-1 px-2 py-1 text-xs rounded"
          style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }}
        />
        <button onClick={handleAdd} className="px-2 py-1 text-xs rounded font-medium" style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}>추가</button>
      </div>
      {keywords.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {keywords.map(kw => (
            <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full" style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
              {kw}
              <button onClick={() => onRemove(kw)} className="hover:opacity-60" style={{ lineHeight: 1 }}>✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewsPanel({ data, lastFetchAt, interval, live }) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [bookmarks, setBookmarks] = useState(getBookmarks);
  const [readUrls, setReadUrls] = useState(getReadUrls);
  const [alertKeywords, setAlertKeywords] = useState(getAlertKeywords);
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const notifiedUrlsRef = useRef(new Set());

  const addAlertKeyword = useCallback((kw) => {
    setAlertKeywords(prev => {
      const next = [...prev, kw];
      saveAlertKeywords(next);
      return next;
    });
  }, []);

  const removeAlertKeyword = useCallback((kw) => {
    setAlertKeywords(prev => {
      const next = prev.filter(k => k !== kw);
      saveAlertKeywords(next);
      return next;
    });
  }, []);

  // Check news against alert keywords
  useEffect(() => {
    if (!data?.sections?.length || alertKeywords.length === 0) return;
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const allArticles = data.sections.flatMap(s => s.articles || []);
    for (const article of allArticles) {
      if (notifiedUrlsRef.current.has(article.url)) continue;
      const title = (article.title || '').toLowerCase();
      const matched = alertKeywords.find(kw => title.includes(kw.toLowerCase()));
      if (matched) {
        notifiedUrlsRef.current.add(article.url);
        if (shouldNotify('news')) {
          addNotification({
            type: 'news',
            title: `뉴스 알림: "${matched}"`,
            body: article.title,
          });
        }
      }
    }
  }, [data, alertKeywords]);

  const handleMarkRead = useCallback((url) => {
    setReadUrls(markAsRead(url));
  }, []);

  const handleClearRead = useCallback(() => {
    clearAllRead();
    setReadUrls([]);
  }, []);

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
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>📰 뉴스 브리핑</h2>
          {data?.sentiment && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
              background: data.sentiment.avgScore > 0 ? 'rgba(34,197,94,0.15)' : data.sentiment.avgScore < 0 ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)',
              color: data.sentiment.avgScore > 0 ? '#22c55e' : data.sentiment.avgScore < 0 ? '#ef4444' : '#eab308',
            }}>
              {data.sentiment.mood}
            </span>
          )}
          <button
            onClick={() => setShowAlertSettings(v => !v)}
            className="text-xs px-1.5 py-0.5 rounded transition-colors"
            style={{
              background: showAlertSettings ? 'rgba(59,130,246,0.15)' : 'transparent',
              color: alertKeywords.length > 0 ? '#3b82f6' : 'var(--text-muted)',
            }}
            title="뉴스 알림 설정"
            aria-label="뉴스 알림 키워드 설정"
          >
            🔔{alertKeywords.length > 0 ? ` ${alertKeywords.length}` : ''}
          </button>
        </div>
        <span className="text-[10px] flex items-center gap-1.5" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
          {readUrls.length > 0 && (
            <button
              onClick={handleClearRead}
              className="px-1.5 py-0.5 rounded hover:opacity-70 transition-opacity"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
              title="읽음 표시 초기화"
            >
              👁 {readUrls.length}읽음 ✕
            </button>
          )}
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
      {/* Alert keyword settings */}
      {showAlertSettings && (
        <NewsAlertSettings keywords={alertKeywords} onAdd={addAlertKeyword} onRemove={removeAlertKeyword} />
      )}
      {/* Sentiment bar */}
      {data?.sentiment && (
        <div className="mx-2 mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>뉴스 감성 분석</span>
            <span className="text-[9px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{data.sentiment.total}건 분석</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden mb-1">
            {data.sentiment.positiveRatio > 0 && (
              <div style={{ width: `${data.sentiment.positiveRatio}%`, background: '#22c55e' }} title={`긍정 ${data.sentiment.positiveRatio}%`} />
            )}
            {data.sentiment.neutralRatio > 0 && (
              <div style={{ width: `${data.sentiment.neutralRatio}%`, background: '#6b7280' }} title={`중립 ${data.sentiment.neutralRatio}%`} />
            )}
            {data.sentiment.negativeRatio > 0 && (
              <div style={{ width: `${data.sentiment.negativeRatio}%`, background: '#ef4444' }} title={`부정 ${data.sentiment.negativeRatio}%`} />
            )}
          </div>
          <div className="flex justify-between text-[9px]">
            <span style={{ color: '#22c55e' }}>🟢 긍정 {data.sentiment.positive}건 ({data.sentiment.positiveRatio}%)</span>
            <span style={{ color: '#6b7280' }}>⚪ 중립 {data.sentiment.neutral}건</span>
            <span style={{ color: '#ef4444' }}>🔴 부정 {data.sentiment.negative}건 ({data.sentiment.negativeRatio}%)</span>
          </div>
        </div>
      )}
      {/* News digest card */}
      {data?.digest && data.digest.themes?.length > 0 && (
        <div className="mx-2 mb-3 px-3 py-2 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
          <div className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>📋 뉴스 요약</div>
          <div className="text-[10px] mb-2" style={{ color: 'var(--text-muted)', opacity: 0.8 }}>{data.digest.headline}</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {data.digest.keywords.slice(0, 8).map(k => (
              <span key={k.word} className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)',
              }}>
                {k.word} <span style={{ opacity: 0.5 }}>×{k.count}</span>
              </span>
            ))}
          </div>
          <div className="space-y-1.5">
            {data.digest.themes.map((theme, i) => (
              <div key={i} className="pl-2" style={{ borderLeft: `2px solid ${theme.articles[0]?.sentiment === 'positive' ? '#22c55e' : theme.articles[0]?.sentiment === 'negative' ? '#ef4444' : '#6b7280'}` }}>
                <div className="text-[10px] font-bold" style={{ color: 'var(--text-primary)' }}>
                  #{theme.keyword} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({theme.count}건)</span>
                </div>
                {theme.articles.slice(0, 2).map((a, j) => (
                  <div key={j} className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {a.title}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
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
                {cat !== 'all' && cat !== 'bookmarks' && (() => {
                  const count = (data?.sections || []).find(s => s.category === cat)?.articles?.length || 0;
                  return count > 0 ? (
                    <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full" style={{
                      background: filter === cat ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                      color: filter === cat ? 'var(--bg-primary)' : 'var(--text-muted)',
                    }}>{count}</span>
                  ) : null;
                })()}
                {cat === 'all' && (() => {
                  const count = (data?.sections || []).reduce((sum, s) => sum + (s.articles?.length || 0), 0);
                  return count > 0 ? (
                    <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full" style={{
                      background: filter === cat ? 'rgba(255,255,255,0.25)' : 'var(--border)',
                      color: filter === cat ? 'var(--bg-primary)' : 'var(--text-muted)',
                    }}>{count}</span>
                  ) : null;
                })()}
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
            readUrls={readUrls}
            onMarkRead={handleMarkRead}
            alertKeywords={alertKeywords}
          />
        )
      ) : filtered.length === 0 && q ? (
        <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
          '{search}'에 대한 검색 결과가 없습니다
        </div>
      ) : filtered.map((section, i) => (
        <NewsSection key={i} {...section} bookmarks={bookmarks} onToggleBookmark={toggleBookmark} readUrls={readUrls} onMarkRead={handleMarkRead} alertKeywords={alertKeywords} />
      ))}
    </div>
  );
}
