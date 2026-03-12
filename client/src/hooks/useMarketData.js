import { useState, useEffect, useCallback, useRef } from 'react';
import { addNotification, shouldNotify } from '../components/NotificationCenter';

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
  const alertedRef = useRef(new Set()); // track alerted market moves per session

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

  // Market move alerts (±3% threshold)
  useEffect(() => {
    if (!market || !shouldNotify('market')) return;
    const watchKeys = [
      { key: 'kospi', name: 'KOSPI' },
      { key: 'kosdaq', name: 'KOSDAQ' },
      { key: 'sp500', name: 'S&P 500' },
      { key: 'nasdaq', name: 'NASDAQ' },
      { key: 'btc', name: 'BTC' },
    ];
    for (const { key, name } of watchKeys) {
      const item = market[key];
      if (!item?.changeRate) continue;
      const rate = parseFloat(item.changeRate);
      if (isNaN(rate) || Math.abs(rate) < 3) continue;
      // Alert once per symbol per direction per session
      const alertKey = `${key}_${rate > 0 ? 'up' : 'down'}_3pct`;
      if (alertedRef.current.has(alertKey)) continue;
      alertedRef.current.add(alertKey);
      const dir = rate > 0 ? '급등' : '급락';
      addNotification({
        type: 'market',
        title: `${name} ${dir} ${item.changeRate}`,
        body: `현재 ${item.value} (${rate > 0 ? '+' : ''}${item.changeRate})`,
      });
    }
  }, [market]);

  // New article alerts — compare article URLs between updates
  const prevNewsRef = useRef(null);
  useEffect(() => {
    if (!news?.sections?.length || !shouldNotify('news')) return;
    const currentUrls = new Set();
    const currentArticles = [];
    for (const sec of news.sections) {
      for (const a of (sec.articles || [])) {
        if (a.url) {
          currentUrls.add(a.url);
          currentArticles.push(a);
        }
      }
    }
    if (prevNewsRef.current) {
      const newArticles = currentArticles.filter(a => !prevNewsRef.current.has(a.url));
      if (newArticles.length > 0 && newArticles.length <= 5) {
        // Avoid alerting on initial load (too many "new" articles)
        for (const a of newArticles.slice(0, 3)) {
          addNotification({
            type: 'news',
            title: '📰 새 기사',
            body: a.title,
          });
        }
      }
    }
    prevNewsRef.current = currentUrls;
  }, [news?.updatedAt]);

  return { market, news, loading, live, error, latency, lastFetchAt, interval, refetch: fetchData };
}
