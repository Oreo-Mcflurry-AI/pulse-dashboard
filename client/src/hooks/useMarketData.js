import { useState, useEffect, useCallback, useRef } from 'react';

export function useMarketData(interval = 30000) {
  const [market, setMarket] = useState(null);
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // { message, since }
  const [live, setLive] = useState(false); // true = SSE connected
  const [latency, setLatency] = useState(null); // ms
  const [lastFetchAt, setLastFetchAt] = useState(null); // timestamp of last successful fetch
  const esRef = useRef(null);
  const failCountRef = useRef(0);

  // Fallback: REST polling
  const fetchData = useCallback(async () => {
    const t0 = performance.now();
    try {
      const [mRes, nRes] = await Promise.all([
        fetch('/api/market'),
        fetch('/api/news'),
      ]);
      if (!mRes.ok || !nRes.ok) throw new Error(`API ${mRes.status}/${nRes.status}`);
      const mData = await mRes.json();
      const nData = await nRes.json();
      setLatency(Math.round(performance.now() - t0));
      setMarket(mData);
      setNews(nData);
      setError(null);
      setLastFetchAt(Date.now());
      failCountRef.current = 0;
    } catch (e) {
      console.error('Fetch error:', e);
      failCountRef.current += 1;
      // Only show error after 2+ consecutive failures (avoid flashing on transient network blips)
      if (failCountRef.current >= 2) {
        setError(prev => ({
          message: e.message || '서버 연결 실패',
          since: prev?.since || new Date().toISOString(),
        }));
      }
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
          setError(null);
          failCountRef.current = 0;
          stopPolling(); // SSE connected, stop polling
        };

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.market) setMarket(data.market);
            if (data.news) setNews(data.news);
            setLoading(false);
            setError(null);
            failCountRef.current = 0;
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

  return { market, news, loading, live, error, latency, lastFetchAt, interval, refetch: fetchData };
}
