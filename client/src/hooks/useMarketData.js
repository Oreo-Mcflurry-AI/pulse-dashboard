import { useState, useEffect } from 'react';

export function useMarketData(interval = 30000) {
  const [market, setMarket] = useState(null);
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    try {
      const [mRes, nRes] = await Promise.all([
        fetch('/api/market'),
        fetch('/api/news')
      ]);
      const mData = await mRes.json();
      const nData = await nRes.json();
      setMarket(mData);
      setNews(nData);
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, interval);
    return () => clearInterval(id);
  }, [interval]);

  return { market, news, loading, refetch: fetchData };
}
