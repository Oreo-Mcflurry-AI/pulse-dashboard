import Header from './components/Header';
import MarketGrid from './components/MarketGrid';
import NewsPanel from './components/NewsPanel';
import { useMarketData } from './hooks/useMarketData';
import { useTheme } from './hooks/useTheme';

export default function App() {
  const { market, news, loading, refetch } = useMarketData(30000);
  const { dark, toggle } = useTheme();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="animate-pulse text-lg" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen transition-colors duration-200" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="max-w-5xl mx-auto">
        <Header updatedAt={market?.updatedAt} onRefresh={refetch} dark={dark} onToggleTheme={toggle} />
        <MarketGrid data={market} />
        <div style={{ borderTop: '1px solid var(--border)' }} />
        <NewsPanel data={news} />
        <footer className="text-center text-xs py-4" style={{ color: 'var(--text-muted)' }}>
          30초마다 자동 업데이트 · Powered by Pulse Dashboard
        </footer>
      </div>
    </div>
  );
}
