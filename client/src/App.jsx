import { useState, useEffect } from 'react';
import Header from './components/Header';
import MarketGrid from './components/MarketGrid';
import MarketSentiment from './components/MarketSentiment';
import NewsPanel from './components/NewsPanel';
import BriefingPage from './components/BriefingPage';
import { useMarketData } from './hooks/useMarketData';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const [page, setPage] = useState(window.location.hash === '#briefings' ? 'briefings' : 'dashboard');
  const { market, news, loading, live, refetch } = useMarketData(30000);
  const { dark, toggle } = useTheme();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 5000); return () => clearInterval(t); }, []);

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

        {page === 'dashboard' ? (
          <>
            <MarketSentiment data={market} />
            <MarketGrid data={market} />
            <div style={{ borderTop: '1px solid var(--border)' }} />
            <NewsPanel data={news} />
            <footer className="text-center text-xs py-4 space-y-1" style={{ color: 'var(--text-muted)' }}>
              <div>{live ? '🟢 실시간 스트리밍' : '30초마다 자동 업데이트'} · {new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</div>
              <div style={{ opacity: 0.6 }}>KRX 09:00-15:30 · NYSE 23:30-06:00 (KST)</div>
            </footer>
          </>
        ) : (
          <BriefingPage />
        )}
      </div>
    </div>
  );
}
