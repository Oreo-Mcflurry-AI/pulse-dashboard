import { useState, useEffect, useCallback, useRef } from 'react';

export function useMarketData(interval = 30000) {
  const [market, setMarket] = useState(null);
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false); // true = SSE connected
  const esRef = useRef(null);

  // Fallback: REST polling
  const fetchData = useCallback(async () => {
    try {
      const [mRes, nRes] = await Promise.all([
        fetch('/api/market'),
        fetch('/api/news'),
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
    let pollId = null;
    let reconnectTimeout = null;

    function startPolling() {
      if (!pollId) {
        fetchData();
        pollId = setInterval(fetchData, interval);
      }
    }
    function stopPolling() {
      if (pollId) { clearInterval(pollId); pollId = null; }
    }

    function connectSSE() {
      try {
        const es = new EventSource('/api/stream');
        esRef.current = es;

        es.onopen = () => {
          setLive(true);
          stopPolling(); // SSE connected, stop polling
        };

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.market) setMarket(data.market);
            if (data.news) setNews(data.news);
            setLoading(false);
          } catch { /* ignore parse errors */ }
        };

        es.onerror = () => {
          es.close();
          esRef.current = null;
          setLive(false);
          startPolling(); // fallback to polling
          // Try reconnecting SSE after 10s
          reconnectTimeout = setTimeout(connectSSE, 10000);
        };
      } catch {
        // SSE not supported, stay on polling
        startPolling();
      }
    }

    // Pause on tab hidden, resume on visible
    function onVisibility() {
      if (document.hidden) {
        stopPolling();
        if (esRef.current) {
          esRef.current.close();
          esRef.current = null;
          setLive(false);
        }
      } else {
        connectSSE();
      }
    }

    connectSSE();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      stopPolling();
      if (esRef.current) { esRef.current.close(); esRef.current = null; }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [interval, fetchData]);

  return { market, news, loading, live, refetch: fetchData };
}
