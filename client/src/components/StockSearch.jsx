import { useState, useEffect, useRef, useCallback } from 'react';

function MiniChart({ data, width = 120, height = 40 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length < 2) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const values = data.map(d => d.close);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const isUp = values[values.length - 1] >= values[0];
    const color = isUp ? '#22c55e' : '#ef4444';

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    values.forEach((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Gradient fill
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, color + '30');
    grad.addColorStop(1, color + '05');
    ctx.fillStyle = grad;
    ctx.fill();
  }, [data, width, height]);

  if (!data || data.length < 2) return null;
  return <canvas ref={canvasRef} style={{ width, height }} />;
}

function fmt(n) {
  if (!n) return '-';
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export default function StockSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pulse_recent_stocks') || '[]'); } catch { return []; }
  });
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 1) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/stock/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.items || []);
      } catch {
        setResults([]);
      }
      setSearchLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const selectStock = useCallback(async (code, name) => {
    setSelected(code);
    setDetail(null);
    setLoading(true);
    setResults([]);
    setQuery(name);

    // Save to recent
    const recent = [{ code, name }, ...recentSearches.filter(r => r.code !== code)].slice(0, 10);
    setRecentSearches(recent);
    localStorage.setItem('pulse_recent_stocks', JSON.stringify(recent));

    try {
      const res = await fetch(`/api/stock/${code}`);
      const data = await res.json();
      setDetail(data);
    } catch {}
    setLoading(false);
  }, [recentSearches]);

  const rate = detail ? parseFloat(detail.changeRate) || 0 : 0;
  const isUp = rate > 0;
  const isDown = rate < 0;
  const colorClass = isUp ? '#22c55e' : isDown ? '#ef4444' : 'var(--text-muted)';

  return (
    <div className="px-3 sm:px-4 py-4 max-w-5xl mx-auto">
      <h2 className="text-base sm:text-lg font-bold mb-4">🔍 종목 검색</h2>

      {/* Search input */}
      <div className="relative mb-4">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setSelected(null); }}
          placeholder="종목명 또는 코드 검색 (예: 삼성전자, 005930)"
          className="w-full px-4 py-2.5 text-sm rounded-xl"
          style={{
            background: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            outline: 'none',
          }}
          onFocus={() => { if (!query && !selected) setResults([]); }}
        />
        {searchLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs animate-pulse" style={{ color: 'var(--text-muted)' }}>...</span>
        )}

        {/* Autocomplete dropdown */}
        {results.length > 0 && !selected && (
          <div className="absolute left-0 right-0 top-full mt-1 rounded-xl overflow-hidden z-20"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
            {results.map(r => (
              <button
                key={r.code}
                onClick={() => selectStock(r.code, r.name)}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-left transition-colors hover:opacity-80"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <span className="text-xs font-medium flex-1">{r.name}</span>
                <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{r.code}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                  style={{ background: r.market.includes('코스닥') ? '#f59e0b20' : '#3b82f620', color: r.market.includes('코스닥') ? '#f59e0b' : '#3b82f6' }}>
                  {r.market}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recent searches */}
      {!selected && !query && recentSearches.length > 0 && (
        <div className="mb-4">
          <div className="text-[10px] font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>최근 검색</div>
          <div className="flex flex-wrap gap-1.5">
            {recentSearches.map(r => (
              <button
                key={r.code}
                onClick={() => selectStock(r.code, r.name)}
                className="text-[10px] sm:text-xs px-2.5 py-1 rounded-full transition-colors"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
              >
                {r.name}
              </button>
            ))}
            <button
              onClick={() => { setRecentSearches([]); localStorage.removeItem('pulse_recent_stocks'); }}
              className="text-[9px] px-2 py-1 rounded-full"
              style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}
            >
              지우기
            </button>
          </div>
        </div>
      )}

      {/* Stock detail */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>불러오는 중...</div>
        </div>
      )}

      {detail && !loading && (
        <div className="space-y-4">
          {/* Main price card */}
          <div className="rounded-xl p-4 sm:p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg sm:text-xl font-bold">{detail.name}</h3>
                  <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{detail.code}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${detail.status === 'OPEN' ? 'bg-green-500 animate-pulse' : ''}`}
                    style={{ background: detail.status === 'OPEN' ? '#22c55e' : '#6b7280' }} />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold tabular-nums">{detail.price}</span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>원</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-medium tabular-nums" style={{ color: colorClass }}>
                    {isUp ? '▲' : isDown ? '▼' : ''} {detail.change} ({detail.changeRate})
                  </span>
                </div>
              </div>
              <MiniChart data={detail.chart} width={140} height={50} />
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: '시가총액', value: detail.marketCap ? `${(parseFloat(String(detail.marketCap).replace(/,/g, '')) / 10000).toFixed(0)}조원` : '-' },
              { label: '거래량', value: detail.volume || '-' },
              { label: 'PER', value: detail.per || '-' },
              { label: 'PBR', value: detail.pbr || '-' },
              { label: '52주 최고', value: fmt(detail.high52w), color: '#22c55e' },
              { label: '52주 최저', value: fmt(detail.low52w), color: '#ef4444' },
              { label: '배당수익률', value: detail.dividend ? `${detail.dividend}%` : '-' },
              { label: '장 상태', value: detail.status === 'OPEN' ? '🟢 장중' : '⚫ 마감' },
            ].map((s, i) => (
              <div key={i} className="px-3 py-2 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
                <div className="text-[9px] sm:text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                <div className="text-xs sm:text-sm font-bold tabular-nums" style={{ color: s.color || 'var(--text-primary)' }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* 1-month chart */}
          {detail.chart && detail.chart.length > 2 && (
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>1개월 추이</div>
              <MiniChart data={detail.chart} width={Math.min(window.innerWidth - 48, 860)} height={120} />
              <div className="flex justify-between mt-1 text-[9px]" style={{ color: 'var(--text-muted)' }}>
                <span>{detail.chart[0]?.date}</span>
                <span>{detail.chart[detail.chart.length - 1]?.date}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!selected && !loading && !query && recentSearches.length === 0 && (
        <div className="flex flex-col items-center justify-center h-48" style={{ color: 'var(--text-muted)' }}>
          <span className="text-3xl mb-2">🔍</span>
          <span className="text-xs">종목명이나 코드를 검색하세요</span>
          <span className="text-[10px] mt-1">예: 삼성전자, SK하이닉스, 005930</span>
        </div>
      )}
    </div>
  );
}
