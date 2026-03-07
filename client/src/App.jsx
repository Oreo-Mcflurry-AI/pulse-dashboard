import { useState, useEffect } from 'react';
import MarketGrid from './components/MarketGrid';
import MarketSentiment from './components/MarketSentiment';
import NewsPanel from './components/NewsPanel';
import BriefingPage from './components/BriefingPage';
import PortfolioPage from './components/PortfolioPage';
import { useMarketData } from './hooks/useMarketData';
import { useTheme } from './hooks/useTheme';

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
    window.location.hash === '#portfolio' ? 'portfolio' : 'dashboard'
  );
  const { market, news, loading, live, error, latency, refetch } = useMarketData(30000);
  const { dark, toggle } = useTheme();
  const [now, setNow] = useState(Date.now());
  const [mktStatus, setMktStatus] = useState(getMarketStatus());
  useEffect(() => {
    const t = setInterval(() => { setNow(Date.now()); setMktStatus(getMarketStatus()); }, 5000);
    return () => clearInterval(t);
  }, []);

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
        case 'r': if (page === 'dashboard') refetch(); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, refetch]);

  if (loading && page === 'dashboard') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="animate-pulse text-lg" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-200" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full ${live ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} title={live ? 'LIVE (실시간)' : 'Polling (30s)'} />
            <h1 className="text-base sm:text-xl font-bold tracking-tight cursor-pointer" onClick={() => navigate('dashboard')}>PULSE</h1>
            <nav className="flex items-center gap-1 ml-2 sm:ml-4">
              <button
                onClick={() => navigate('dashboard')}
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
                className="px-2 py-1 text-xs sm:text-sm rounded-md transition-colors"
                style={{
                  background: page === 'portfolio' ? 'var(--bg-hover)' : 'transparent',
                  color: page === 'portfolio' ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: page === 'portfolio' ? 600 : 400,
                }}
              >
                💼 포트폴리오
              </button>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {page === 'dashboard' && (
              <span className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
                {relativeTime(market?.updatedAt)}
              </span>
            )}
            <button
              onClick={toggle}
              className="p-1 transition-colors rounded hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
              title={dark ? '라이트 모드' : '다크 모드'}
            >
              {dark ? '☀️' : '🌙'}
            </button>
            {page === 'dashboard' && (
              <button
                onClick={refetch}
                className="p-1 transition-colors"
                style={{ color: 'var(--text-muted)' }}
                title="새로고침"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>
        </header>

        {/* Error banner */}
        {error && (
          <div className="mx-3 sm:mx-4 mt-3 sm:mt-4 px-3 py-2 rounded-lg flex items-center justify-between text-xs sm:text-sm"
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

        {page === 'dashboard' ? (
          <>
            <MarketSentiment data={market} />
            <MarketGrid data={market} />
            <div style={{ borderTop: '1px solid var(--border)' }} />
            <NewsPanel data={news} />
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
        ) : (
          <PortfolioPage />
        )}
      </div>
    </div>
  );
}
