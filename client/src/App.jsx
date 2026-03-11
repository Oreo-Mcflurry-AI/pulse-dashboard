import { useState, useEffect } from 'react';
import MarketGrid from './components/MarketGrid';
import MarketSentiment from './components/MarketSentiment';
import NewsPanel from './components/NewsPanel';
import BriefingPage from './components/BriefingPage';
import PortfolioPage from './components/PortfolioPage';
import HistoryPage from './components/HistoryPage';
import NotificationCenter, { NotificationBadge } from './components/NotificationCenter';
import { useMarketData } from './hooks/useMarketData';
import { useTheme } from './hooks/useTheme';
import { useWidgetLayout } from './hooks/useWidgetLayout';

function getMarketStatus() {
  const now = new Date();
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const kstH = kst.getHours(), kstM = kst.getMinutes(), kstDay = kst.getDay();
  const etH = et.getHours(), etM = et.getMinutes(), etDay = et.getDay();
  const kstMin = kstH * 60 + kstM;
  const etMin = etH * 60 + etM;
  const krxOpen = kstDay >= 1 && kstDay <= 5 && kstMin >= 540 && kstMin < 930; // 09:00-15:30
  const nyseOpen = etDay >= 1 && etDay <= 5 && etMin >= 570 && etMin < 960; // 09:30-16:00

  // Next open countdown
  function nextOpen(tzNow, day, min, openMin, closeMin) {
    // Returns minutes until next open, or null if open now
    if (day >= 1 && day <= 5 && min >= openMin && min < closeMin) return null; // open now
    let daysAhead = 0;
    let targetDay = day;
    let targetMin = openMin;
    if (day >= 1 && day <= 5 && min < openMin) {
      daysAhead = 0; // today, before open
    } else if (day === 5 && min >= closeMin) {
      daysAhead = 3; // Friday after close -> Monday
    } else if (day === 6) {
      daysAhead = 2; // Saturday -> Monday
    } else if (day === 0) {
      daysAhead = 1; // Sunday -> Monday
    } else {
      daysAhead = 1; // weekday after close -> next day
    }
    const minsLeft = (daysAhead * 24 * 60) + (targetMin - min);
    if (minsLeft <= 0) return (minsLeft + 7 * 24 * 60); // fallback
    return minsLeft;
  }

  const krxNext = krxOpen ? null : nextOpen(kst, kstDay, kstMin, 540, 930);
  const nyseNext = nyseOpen ? null : nextOpen(et, etDay, etMin, 570, 960);

  function fmtCountdown(mins) {
    if (mins == null) return null;
    const d = Math.floor(mins / 1440);
    const h = Math.floor((mins % 1440) / 60);
    const m = mins % 60;
    if (d > 0) return `${d}일 ${h}시간`;
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분`;
  }

  return { krxOpen, nyseOpen, krxCountdown: fmtCountdown(krxNext), nyseCountdown: fmtCountdown(nyseNext) };
}

export default function App() {
  const [page, setPage] = useState(
    window.location.hash === '#briefings' ? 'briefings' :
    window.location.hash === '#portfolio' ? 'portfolio' :
    window.location.hash === '#history' ? 'history' : 'dashboard'
  );
  const { market, news, loading, live, error, latency, lastFetchAt, interval, refetch } = useMarketData(30000);
  const { dark, toggle } = useTheme();
  const { widgets, moveUp, moveDown, toggleVisible, reset: resetLayout } = useWidgetLayout();
  const [showLayoutSettings, setShowLayoutSettings] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [mktStatus, setMktStatus] = useState(getMarketStatus());
  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); setMktStatus(getMarketStatus()); }, 5000);
    return () => clearInterval(t);
  }, []);

  // Update browser tab title with live market data
  useEffect(() => {
    if (!market?.kospi) { document.title = 'PULSE'; return; }
    const k = market.kospi;
    const rate = parseFloat(k.changeRate) || 0;
    const arrow = rate > 0 ? '▲' : rate < 0 ? '▼' : '';
    document.title = `${k.value} ${arrow}${k.changeRate || ''} | PULSE`;
  }, [market]);

  const relativeTime = (iso) => {
    if (!iso) return '--:--:--';
    const diff = Math.floor((now - new Date(iso).getTime()) / 1000);
    if (diff < 5) return '방금';
    if (diff < 60) return `${diff}초 전`;
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    return new Date(iso).toLocaleTimeString('ko-KR');
  };

  const navigate = (p) => {
    setPage(p);
    window.location.hash = p === 'dashboard' ? '' : p;
  };

  // Keyboard shortcuts: 1=대시보드, 2=브리핑, 3=포트폴리오, r=새로고침
  useEffect(() => {
    const onKey = (e) => {
      // Ignore when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case '1': navigate('dashboard'); break;
        case '2': navigate('briefings'); break;
        case '3': navigate('portfolio'); break;
        case '4': navigate('history'); break;
        case 'r': if (page === 'dashboard') refetch(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, refetch]);

  if (loading && page === 'dashboard') {
    return (
      <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
        <div className="max-w-5xl mx-auto">
          {/* Skeleton header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: 'var(--bg-hover)' }} />
              <div className="w-16 h-5 rounded animate-pulse" style={{ background: 'var(--bg-hover)' }} />
            </div>
            <div className="w-20 h-4 rounded animate-pulse" style={{ background: 'var(--bg-hover)' }} />
          </div>
          {/* Skeleton sentiment bar */}
          <div className="mx-3 sm:mx-4 mt-3 sm:mt-4 p-4 rounded-xl animate-pulse" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full" style={{ background: 'var(--bg-hover)' }} />
              <div className="w-24 h-4 rounded" style={{ background: 'var(--bg-hover)' }} />
            </div>
            <div className="w-full h-1.5 rounded-full" style={{ background: 'var(--bg-hover)' }} />
          </div>
          {/* Skeleton market cards */}
          <div className="px-3 sm:px-4 mt-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-lg sm:rounded-xl p-3 sm:p-4 animate-pulse" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="w-16 h-3 rounded mb-2" style={{ background: 'var(--bg-hover)' }} />
                  <div className="w-24 h-5 rounded mb-1" style={{ background: 'var(--bg-hover)' }} />
                  <div className="w-14 h-3 rounded" style={{ background: 'var(--bg-hover)' }} />
                </div>
              ))}
            </div>
          </div>
          {/* Skeleton news */}
          <div className="p-4 mt-3" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="w-24 h-4 rounded mb-3 animate-pulse" style={{ background: 'var(--bg-hover)' }} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 animate-pulse">
                <div className="flex-1 h-4 rounded" style={{ background: 'var(--bg-hover)' }} />
                <div className="w-16 h-3 rounded" style={{ background: 'var(--bg-hover)' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-200" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
      <div className="max-w-5xl mx-auto">
        <header role="banner" className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${live ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} title={live ? 'LIVE (실시간)' : 'Polling (30s)'} role="status" aria-label={live ? '실시간 연결됨' : '폴링 모드'} />
            <h1 className="text-base sm:text-xl font-bold tracking-tight cursor-pointer" onClick={() => navigate('dashboard')}>PULSE</h1>
            <nav aria-label="주요 메뉴" className="flex items-center gap-1 ml-2 sm:ml-4">
              <button
                onClick={() => navigate('dashboard')}
                aria-current={page === 'dashboard' ? 'page' : undefined}
                className="px-2 py-1 text-xs sm:text-sm rounded-md transition-colors"
                style={{
                  background: page === 'dashboard' ? 'var(--bg-hover)' : 'transparent',
                  color: page === 'dashboard' ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: page === 'dashboard' ? 600 : 400,
                }}
              >
                대시보드
              </button>
              <button
                onClick={() => navigate('briefings')}
                aria-current={page === 'briefings' ? 'page' : undefined}
                className="px-2 py-1 text-xs sm:text-sm rounded-md transition-colors"
                style={{
                  background: page === 'briefings' ? 'var(--bg-hover)' : 'transparent',
                  color: page === 'briefings' ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: page === 'briefings' ? 600 : 400,
                }}
              >
                📰 브리핑
              </button>
              <button
                onClick={() => navigate('portfolio')}
                aria-current={page === 'portfolio' ? 'page' : undefined}
                className="px-2 py-1 text-xs sm:text-sm rounded-md transition-colors"
                style={{
                  background: page === 'portfolio' ? 'var(--bg-hover)' : 'transparent',
                  color: page === 'portfolio' ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: page === 'portfolio' ? 600 : 400,
                }}
              >
                💼 포트폴리오
              </button>
              <button
                onClick={() => navigate('history')}
                aria-current={page === 'history' ? 'page' : undefined}
                className="px-2 py-1 text-xs sm:text-sm rounded-md transition-colors"
                style={{
                  background: page === 'history' ? 'var(--bg-hover)' : 'transparent',
                  color: page === 'history' ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: page === 'history' ? 600 : 400,
                }}
              >
                📈 히스토리
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {page === 'dashboard' && (
              <span className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
                {relativeTime(market?.updatedAt)}
              </span>
            )}
            <NotificationBadge onClick={() => setShowNotifications(true)} />
            <button
              onClick={toggle}
              className="p-1 transition-colors rounded hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
              title={dark ? '라이트 모드' : '다크 모드'}
              aria-label={dark ? '라이트 모드로 전환' : '다크 모드로 전환'}
            >
              {dark ? '☀️' : '🌙'}
            </button>
            {page === 'dashboard' && (
              <>
                <button
                  onClick={() => setShowLayoutSettings(v => !v)}
                  className="p-1 transition-colors rounded hover:opacity-80"
                  style={{ color: showLayoutSettings ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  title="위젯 설정"
                  aria-label="위젯 레이아웃 설정"
                  aria-pressed={showLayoutSettings}
                >
                  ⚙️
                </button>
                <button
                  onClick={refetch}
                  className="p-1 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  title="새로고침"
                  aria-label="데이터 새로고침"
                >
                  <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div role="alert" className="mx-3 sm:mx-4 mt-3 sm:mt-4 px-3 py-2 rounded-lg flex items-center justify-between text-xs sm:text-sm"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
            }}
          >
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>서버 연결 실패 — {error.message}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                (마지막 데이터 표시 중)
              </span>
            </div>
            <button
              onClick={refetch}
              className="px-2 py-1 rounded text-xs font-medium transition-colors"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
              }}
            >
              재시도
            </button>
          </div>
        )}

        <main id="main-content">
        {page === 'dashboard' ? (
          <>
            {/* Widget layout settings panel */}
            {showLayoutSettings && (
              <div className="mx-3 sm:mx-4 mt-3 sm:mt-4 p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>⚙️ 위젯 순서 설정</span>
                  <button onClick={resetLayout} className="text-[10px] px-2 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>초기화</button>
                </div>
                <div className="space-y-1">
                  {widgets.map((w, i) => (
                    <div key={w.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: w.visible ? 'var(--bg-hover)' : 'transparent', opacity: w.visible ? 1 : 0.5 }}>
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveUp(w.id)} disabled={i === 0} className="text-[10px] leading-none disabled:opacity-20" style={{ color: 'var(--text-muted)' }} aria-label={`${w.label} 위로`}>▲</button>
                        <button onClick={() => moveDown(w.id)} disabled={i === widgets.length - 1} className="text-[10px] leading-none disabled:opacity-20" style={{ color: 'var(--text-muted)' }} aria-label={`${w.label} 아래로`}>▼</button>
                      </div>
                      <span className="text-xs flex-1">{w.label}</span>
                      <button
                        onClick={() => toggleVisible(w.id)}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ background: w.visible ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: w.visible ? '#22c55e' : '#ef4444' }}
                        aria-label={`${w.label} ${w.visible ? '숨기기' : '표시'}`}
                      >
                        {w.visible ? '표시' : '숨김'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Dynamic widget rendering based on layout order */}
            {widgets.filter(w => w.visible).map(w => {
              switch (w.id) {
                case 'sentiment': return <MarketSentiment key={w.id} data={market} />;
                case 'market': return <MarketGrid key={w.id} data={market} news={news} />;
                case 'news': return (
                  <div key={w.id}>
                    <div style={{ borderTop: '1px solid var(--border)' }} />
                    <NewsPanel data={news} lastFetchAt={lastFetchAt} interval={interval} live={live} />
                  </div>
                );
                default: return null;
              }
            })}
            <footer className="text-center text-xs py-4 space-y-1" style={{ color: 'var(--text-muted)' }}>
              <div>{live ? '🟢 실시간 스트리밍' : '30초마다 자동 업데이트'} · {new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}{latency != null ? ` · ${latency}ms` : ''}</div>
              <div style={{ opacity: 0.6 }}>
                {mktStatus.krxOpen ? '🟢' : '⚫'} KRX {mktStatus.krxOpen ? '장중' : '장외'}{mktStatus.krxCountdown ? ` (${mktStatus.krxCountdown} 후 개장)` : ' (09:00-15:30)'}
                {' · '}
                {mktStatus.nyseOpen ? '🟢' : '⚫'} NYSE {mktStatus.nyseOpen ? '장중' : '장외'}{mktStatus.nyseCountdown ? ` (${mktStatus.nyseCountdown} 후 개장)` : ' (23:30-06:00 KST)'}
              </div>
            </footer>
          </>
        ) : page === 'briefings' ? (
          <BriefingPage />
        ) : page === 'portfolio' ? (
          <PortfolioPage />
        ) : (
          <HistoryPage />
        )}
        </main>
      </div>
      <NotificationCenter isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
    </div>
  );
}
