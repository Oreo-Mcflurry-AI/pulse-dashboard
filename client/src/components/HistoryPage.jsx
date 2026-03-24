import { useState, useEffect, useRef, useCallback } from 'react';

const SYMBOLS = [
  { key: 'kospi', name: 'KOSPI', color: '#ef4444' },
  { key: 'kosdaq', name: 'KOSDAQ', color: '#f97316' },
  { key: 'sp500', name: 'S&P 500', color: '#3b82f6' },
  { key: 'nasdaq', name: 'NASDAQ', color: '#8b5cf6' },
  { key: 'dow', name: 'DOW', color: '#06b6d4' },
  { key: 'vix', name: 'VIX', color: '#ec4899' },
  { key: 'usdkrw', name: 'USD/KRW', color: '#10b981' },
  { key: 'btc', name: 'BTC/KRW', color: '#f59e0b' },
  { key: 'oil', name: 'WTI', color: '#64748b' },
  { key: 'gold', name: 'GOLD', color: '#eab308' },
  { key: 'fear_greed', name: '공포/탐욕', color: '#a855f7' },
];

const PERIODS = [
  { key: '1m', label: '1개월' },
  { key: '3m', label: '3개월' },
  { key: '6m', label: '6개월' },
  { key: '1y', label: '1년' },
];

function formatNumber(n, symbol) {
  if (n == null) return '-';
  if (symbol === 'btc') return Math.floor(n).toLocaleString('ko-KR');
  if (n >= 10000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '';
  const parts = d.split('-');
  return `${parts[1]}/${parts[2]}`;
}

function Chart({ data, symbol, color, width, height }) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const padding = { top: 20, right: 12, bottom: 30, left: 60 };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const closes = data.map(d => d.close);
    const highs = data.map(d => d.high || d.close);
    const lows = data.map(d => d.low || d.close);
    const allValues = [...highs, ...lows];
    const minV = Math.min(...allValues);
    const maxV = Math.max(...allValues);
    const range = maxV - minV || 1;

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Grid lines & labels
    const gridLines = 5;
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#333';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';

    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartH / gridLines) * i;
      const val = maxV - (range / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.fillText(formatNumber(val, symbol), padding.left - 6, y + 3);
    }

    // X-axis date labels
    ctx.textAlign = 'center';
    const labelCount = Math.min(6, data.length);
    const step = Math.floor(data.length / labelCount);
    for (let i = 0; i < data.length; i += step) {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const y = height - 8;
      ctx.fillText(formatDate(data[i].date), x, y);
    }

    // High-low range area
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const yH = padding.top + ((maxV - highs[i]) / range) * chartH;
      if (i === 0) ctx.moveTo(x, yH);
      else ctx.lineTo(x, yH);
    }
    for (let i = data.length - 1; i >= 0; i--) {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const yL = padding.top + ((maxV - lows[i]) / range) * chartH;
      ctx.lineTo(x, yL);
    }
    ctx.closePath();
    ctx.fillStyle = color + '15';
    ctx.fill();

    // Close price line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    for (let i = 0; i < closes.length; i++) {
      const x = padding.left + (i / (data.length - 1)) * chartW;
      const y = padding.top + ((maxV - closes[i]) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Gradient fill under line
    const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    gradient.addColorStop(0, color + '30');
    gradient.addColorStop(1, color + '05');
    ctx.lineTo(padding.left + chartW, height - padding.bottom);
    ctx.lineTo(padding.left, height - padding.bottom);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();
  }, [data, symbol, color, width, height]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouse = (e) => {
    if (!data || data.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const chartW = width - padding.left - padding.right;
    const relX = x - padding.left;
    if (relX < 0 || relX > chartW) { setTooltip(null); return; }
    const idx = Math.round((relX / chartW) * (data.length - 1));
    const d = data[idx];
    if (d) setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, data: d, idx });
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        style={{ width, height, cursor: 'crosshair' }}
        onMouseMove={handleMouse}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div
          className="absolute pointer-events-none px-2 py-1.5 rounded-lg text-[10px] sm:text-xs z-10"
          style={{
            left: Math.min(tooltip.x + 12, width - 140),
            top: tooltip.y - 60,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="font-medium mb-0.5">{tooltip.data.date}</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5" style={{ color: 'var(--text-muted)' }}>
            <span>시가</span><span className="text-right tabular-nums">{formatNumber(tooltip.data.open, symbol)}</span>
            <span>고가</span><span className="text-right tabular-nums" style={{ color: '#22c55e' }}>{formatNumber(tooltip.data.high, symbol)}</span>
            <span>저가</span><span className="text-right tabular-nums" style={{ color: '#ef4444' }}>{formatNumber(tooltip.data.low, symbol)}</span>
            <span>종가</span><span className="text-right tabular-nums font-medium" style={{ color }}>{formatNumber(tooltip.data.close, symbol)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StatsRow({ data, symbol, color }) {
  if (!data || data.length < 2) return null;
  const first = data[0].close;
  const last = data[data.length - 1].close;
  const change = last - first;
  const changePct = ((change / first) * 100).toFixed(2);
  const highs = data.map(d => d.high || d.close);
  const lows = data.map(d => d.low || d.close);
  const max = Math.max(...highs);
  const min = Math.min(...lows);
  const avg = (data.reduce((s, d) => s + d.close, 0) / data.length);
  const isUp = change >= 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 mt-3 px-1">
      {[
        { label: '시작', value: formatNumber(first, symbol) },
        { label: '현재', value: formatNumber(last, symbol), highlight: true },
        { label: '변동', value: `${isUp ? '+' : ''}${formatNumber(change, symbol)} (${isUp ? '+' : ''}${changePct}%)`, color: isUp ? '#22c55e' : '#ef4444' },
        { label: '최고', value: formatNumber(max, symbol), color: '#22c55e' },
        { label: '최저', value: formatNumber(min, symbol), color: '#ef4444' },
      ].map((s, i) => (
        <div key={i} className="px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-hover)' }}>
          <div className="text-[9px] sm:text-[10px]" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
          <div
            className="text-xs sm:text-sm font-bold tabular-nums"
            style={{ color: s.color || (s.highlight ? color : 'var(--text-primary)') }}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HistoryPage() {
  const [selected, setSelected] = useState('kospi');
  const [period, setPeriod] = useState('3m');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [compare, setCompare] = useState(null); // secondary symbol for comparison
  const [compareData, setCompareData] = useState(null);
  const containerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(600);

  // Responsive chart width
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setChartWidth(Math.min(containerRef.current.offsetWidth - 16, 900));
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const fetchHistory = useCallback(async (sym, per) => {
    try {
      const res = await fetch(`/api/history/${sym}?period=${per}`);
      const json = await res.json();
      let data = json.data || [];
      // Intraday data comes as {time, value} — convert to OHLC format
      if (data.length > 0 && data[0].time && data[0].value != null && !data[0].date) {
        data = data.map(d => ({
          date: d.time.slice(0, 16).replace('T', ' '),
          open: d.value, high: d.value, low: d.value, close: d.value,
        }));
      }
      return data;
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchHistory(selected, period).then(d => {
      if (!cancelled) {
        setData(d);
        setLoading(false);
        if (d.length === 0) setError('데이터가 없습니다');
      }
    });
    return () => { cancelled = true; };
  }, [selected, period, fetchHistory]);

  // Fetch comparison data
  useEffect(() => {
    if (!compare) { setCompareData(null); return; }
    fetchHistory(compare, period).then(setCompareData);
  }, [compare, period, fetchHistory]);

  const sym = SYMBOLS.find(s => s.key === selected);
  const compSym = compare ? SYMBOLS.find(s => s.key === compare) : null;
  const chartHeight = window.innerWidth < 640 ? 220 : 320;

  return (
    <div ref={containerRef} className="px-3 sm:px-4 py-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-bold">📈 시세 히스토리</h2>
      </div>

      {/* Symbol selector */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {SYMBOLS.map(s => (
          <button
            key={s.key}
            onClick={() => { setSelected(s.key); if (compare === s.key) setCompare(null); }}
            className="px-2.5 py-1 text-[10px] sm:text-xs rounded-full transition-all"
            style={{
              background: selected === s.key ? s.color + '20' : 'var(--bg-hover)',
              color: selected === s.key ? s.color : 'var(--text-muted)',
              border: `1px solid ${selected === s.key ? s.color + '50' : 'transparent'}`,
              fontWeight: selected === s.key ? 600 : 400,
            }}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Period selector */}
      <div className="flex gap-1 mb-4">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className="px-3 py-1 text-xs rounded-md transition-colors"
            style={{
              background: period === p.key ? 'var(--text-primary)' : 'var(--bg-hover)',
              color: period === p.key ? 'var(--bg-primary)' : 'var(--text-muted)',
              fontWeight: period === p.key ? 600 : 400,
            }}
          >
            {p.label}
          </button>
        ))}
        {/* Compare toggle */}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>비교:</span>
          <select
            value={compare || ''}
            onChange={(e) => setCompare(e.target.value || null)}
            className="text-[10px] sm:text-xs px-1.5 py-1 rounded"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            <option value="">없음</option>
            {SYMBOLS.filter(s => s.key !== selected).map(s => (
              <option key={s.key} value={s.key}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-xl p-3 sm:p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="w-3 h-0.5 rounded" style={{ background: sym?.color }} />
          <span className="text-xs font-medium">{sym?.name}</span>
          {compSym && (
            <>
              <span className="w-3 h-0.5 rounded" style={{ background: compSym.color }} />
              <span className="text-xs font-medium">{compSym.name}</span>
            </>
          )}
        </div>
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: chartHeight }}>
            <div className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>불러오는 중...</div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center" style={{ height: chartHeight }}>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>⚠️ {error}</div>
          </div>
        ) : (
          <>
            <Chart data={data} symbol={selected} color={sym?.color || '#888'} width={chartWidth} height={chartHeight} />
            {compare && compareData && compareData.length > 0 && (
              <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                <Chart data={compareData} symbol={compare} color={compSym?.color || '#888'} width={chartWidth} height={Math.round(chartHeight * 0.6)} />
              </div>
            )}
          </>
        )}

        {/* Correlation analysis */}
        {compare && compareData && data && data.length > 5 && compareData.length > 5 && (() => {
          // Match dates and compute daily returns
          const mainMap = {};
          data.forEach(d => { mainMap[d.date] = d.close; });
          const compMap = {};
          compareData.forEach(d => { compMap[d.date] = d.close; });
          const commonDates = Object.keys(mainMap).filter(d => compMap[d]).sort();
          if (commonDates.length < 5) return null;

          // Daily returns
          const mainReturns = [];
          const compReturns = [];
          for (let i = 1; i < commonDates.length; i++) {
            const d = commonDates[i], prev = commonDates[i - 1];
            mainReturns.push((mainMap[d] - mainMap[prev]) / mainMap[prev]);
            compReturns.push((compMap[d] - compMap[prev]) / compMap[prev]);
          }

          // Pearson correlation
          const n = mainReturns.length;
          const meanA = mainReturns.reduce((s, v) => s + v, 0) / n;
          const meanB = compReturns.reduce((s, v) => s + v, 0) / n;
          let cov = 0, varA = 0, varB = 0;
          for (let i = 0; i < n; i++) {
            const da = mainReturns[i] - meanA;
            const db = compReturns[i] - meanB;
            cov += da * db;
            varA += da * da;
            varB += db * db;
          }
          const corr = (varA > 0 && varB > 0) ? cov / Math.sqrt(varA * varB) : 0;
          const absCorr = Math.abs(corr);
          const corrLabel = absCorr >= 0.8 ? '매우 강함' : absCorr >= 0.6 ? '강함' : absCorr >= 0.4 ? '보통' : absCorr >= 0.2 ? '약함' : '거의 없음';
          const corrColor = corr >= 0.6 ? '#22c55e' : corr >= 0.2 ? '#3b82f6' : corr >= -0.2 ? '#6b7280' : corr >= -0.6 ? '#f59e0b' : '#ef4444';
          const corrDir = corr > 0.1 ? '양의 상관' : corr < -0.1 ? '음의 상관' : '무상관';

          return (
            <div className="mt-2 p-2 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>📐 상관관계</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: corrColor }}>
                    {corr >= 0 ? '+' : ''}{corr.toFixed(3)}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: corrColor + '20', color: corrColor }}>
                    {corrDir} · {corrLabel}
                  </span>
                </div>
                <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                  {sym?.name} vs {compSym?.name} · {n}일 일간수익률 기준
                </span>
              </div>
              {/* Correlation bar */}
              <div className="mt-1.5 relative h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="absolute top-0 bottom-0 w-px" style={{ left: '50%', background: 'var(--text-muted)', opacity: 0.4 }} />
                <div
                  className="absolute top-0 bottom-0 rounded-full transition-all duration-500"
                  style={{
                    left: corr >= 0 ? '50%' : `${50 + corr * 50}%`,
                    width: `${absCorr * 50}%`,
                    background: corrColor,
                  }}
                />
              </div>
              <div className="flex justify-between mt-0.5 text-[8px]" style={{ color: 'var(--text-muted)' }}>
                <span>-1 (역상관)</span>
                <span>0</span>
                <span>+1 (정상관)</span>
              </div>
            </div>
          );
        })()}

        {/* Stats */}
        {data && data.length > 0 && <StatsRow data={data} symbol={selected} color={sym?.color || '#888'} />}
        {compare && compareData && compareData.length > 0 && (
          <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="text-[10px] font-medium mb-1" style={{ color: compSym?.color }}>{compSym?.name}</div>
            <StatsRow data={compareData} symbol={compare} color={compSym?.color || '#888'} />
          </div>
        )}
      </div>

      {/* Data table */}
      {data && data.length > 0 && (
        <div className="mt-4 rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>일별 데이터 ({data.length}일)</span>
            <button
              onClick={() => {
                const rows = [['날짜', '시가', '고가', '저가', '종가']];
                data.forEach(d => rows.push([d.date, d.open, d.high, d.low, d.close]));
                const csv = rows.map(r => r.join(',')).join('\n');
                const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `${selected}-history-${period}.csv`; a.click();
                URL.revokeObjectURL(url);
              }}
              className="text-[10px] px-2 py-0.5 rounded"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
            >
              📥 CSV
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-[10px] sm:text-xs">
              <thead>
                <tr style={{ background: 'var(--bg-hover)' }}>
                  <th className="px-3 py-1.5 text-left font-medium" style={{ color: 'var(--text-muted)' }}>날짜</th>
                  <th className="px-3 py-1.5 text-right font-medium" style={{ color: 'var(--text-muted)' }}>시가</th>
                  <th className="px-3 py-1.5 text-right font-medium" style={{ color: '#22c55e' }}>고가</th>
                  <th className="px-3 py-1.5 text-right font-medium" style={{ color: '#ef4444' }}>저가</th>
                  <th className="px-3 py-1.5 text-right font-medium" style={{ color: 'var(--text-muted)' }}>종가</th>
                  <th className="px-3 py-1.5 text-right font-medium" style={{ color: 'var(--text-muted)' }}>변동</th>
                </tr>
              </thead>
              <tbody>
                {[...data].reverse().slice(0, 60).map((d, i, arr) => {
                  const prev = i < arr.length - 1 ? arr[i + 1] : null;
                  const change = prev ? ((d.close - prev.close) / prev.close * 100).toFixed(2) : '-';
                  const isUp = change !== '-' && parseFloat(change) >= 0;
                  return (
                    <tr key={d.date} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="px-3 py-1.5 tabular-nums">{d.date}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(d.open, selected)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: '#22c55e' }}>{formatNumber(d.high, selected)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: '#ef4444' }}>{formatNumber(d.low, selected)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-medium">{formatNumber(d.close, selected)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: change === '-' ? 'var(--text-muted)' : isUp ? '#22c55e' : '#ef4444' }}>
                        {change === '-' ? '-' : `${isUp ? '+' : ''}${change}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
