import { useState, useEffect, useCallback } from 'react';

export function useMarketData(interval = 30000) {
  const [market, setMarket] = useState(null);
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchData();

    let id = null;

    function start() {
      if (!id) id = setInterval(fetchData, interval);
    }
    function stop() {
      if (id) { clearInterval(id); id = null; }
    }

    // Pause polling when tab is hidden, resume when visible
    function onVisibility() {
      if (document.hidden) {
        stop();
      } else {
        fetchData(); // refresh immediately on return
        start();
      }
    }

    start();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [interval, fetchData]);

  return { market, news, loading, refetch: fetchData };
}
