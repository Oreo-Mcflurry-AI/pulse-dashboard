import Header from './components/Header';
import MarketGrid from './components/MarketGrid';
import NewsPanel from './components/NewsPanel';
import { useMarketData } from './hooks/useMarketData';

export default function App() {
  const { market, news, loading } = useMarketData(30000);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400 animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-5xl mx-auto">
        <Header updatedAt={market?.updatedAt} />
        <MarketGrid data={market} />
        <div className="border-t border-slate-700" />
        <NewsPanel data={news} />
      </div>
    </div>
  );
}
