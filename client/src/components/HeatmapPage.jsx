import { useState, useEffect, useRef, useCallback } from 'react';
import MarketTimeline from './MarketTimeline';

function getColor(change) {
  const abs = Math.abs(change);
  if (change > 0) {
    // Green scale
    if (abs >= 5) return { bg: '#14532d', text: '#4ade80' };
    if (abs >= 3) return { bg: '#166534', text: '#86efac' };
    if (abs >= 2) return { bg: '#15803d', text: '#bbf7d0' };
    if (abs >= 1) return { bg: '#16a34a20', text: '#22c55e' };
    return { bg: '#16a34a10', text: '#22c55e90' };
  } else if (change < 0) {
    // Red scale
    if (abs >= 5) return { bg: '#7f1d1d', text: '#f87171' };
    if (abs >= 3) return { bg: '#991b1b', text: '#fca5a5' };
    if (abs >= 2) return { bg: '#b91c1c', text: '#fecaca' };
    if (abs >= 1) return { bg: '#dc262620', text: '#ef4444' };
    return { bg: '#dc262610', text: '#ef444490' };
  }
  return { bg: 'var(--bg-hover)', text: 'var(--text-muted)' };
}

function Treemap({ sectors, width, height }) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const rectsRef = useRef([]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sectors.length) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Simple treemap layout (squarified-ish)
    const totalWeight = sectors.reduce((s, sec) => s + Math.max(sec.total, 1), 0);
    const rects = [];
    let x = 0, y = 0, rowH = 0;
    let remaining = [...sectors];
    let areaLeft = width * height;

    // Simple strip layout
    const stripLayout = (items, x0, y0, w0, h0) => {
      if (items.length === 0) return;
      const totalW = items.reduce((s, i) => s + Math.max(i.total, 1), 0);
      let cx = x0, cy = y0;
      const isHorizontal = w0 >= h0;

      items.forEach((item, idx) => {
        const ratio = Math.max(item.total, 1) / totalW;
        let rw, rh;
        if (isHorizontal) {
          rw = w0 * ratio;
          rh = h0;
        } else {
          rw = w0;
          rh = h0 * ratio;
        }
        rects.push({ ...item, x: cx, y: cy, w: rw, h: rh });
        if (isHorizontal) cx += rw;
        else cy += rh;
      });
    };

    // Split into rows for better aspect ratios
    const splitSize = Math.ceil(Math.sqrt(sectors.length));
    const rows = [];
    for (let i = 0; i < sectors.length; i += splitSize) {
      rows.push(sectors.slice(i, i + splitSize));
    }

    const rowCount = rows.length;
    let curY = 0;
    rows.forEach((row, ri) => {
      const rowTotal = row.reduce((s, i) => s + Math.max(i.total, 1), 0);
      const rowRatio = rowTotal / totalWeight;
      const rh = height * rowRatio;
      stripLayout(row, 0, curY, width, rh);
      curY += rh;
    });

    rectsRef.current = rects;

    // Draw rectangles
    rects.forEach(r => {
      const colors = getColor(r.change);
      // Fill
      ctx.fillStyle = colors.bg;
      ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      // Border
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);

      // Labels (only if enough space)
      if (r.w > 40 && r.h > 25) {
        ctx.fillStyle = colors.text;
        const fontSize = Math.min(Math.max(r.w / 8, 9), 13);
        ctx.font = `bold ${fontSize}px system-ui`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const centerX = r.x + r.w / 2;
        const centerY = r.y + r.h / 2;

        // Sector name
        const name = r.name.length > 8 && r.w < 80 ? r.name.slice(0, 7) + '…' : r.name;
        ctx.fillText(name, centerX, centerY - fontSize * 0.6);

        // Change rate
        const sign = r.change >= 0 ? '+' : '';
        ctx.font = `${fontSize * 0.85}px system-ui`;
        ctx.fillText(`${sign}${r.change.toFixed(2)}%`, centerX, centerY + fontSize * 0.5);
      } else if (r.w > 20 && r.h > 15) {
        // Minimal label
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 8px system-ui';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const sign = r.change >= 0 ? '+' : '';
        ctx.fillText(`${sign}${r.change.toFixed(1)}%`, r.x + r.w / 2, r.y + r.h / 2);
      }
    });
  }, [sectors, width, height]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouse = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = rectsRef.current.find(r => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
    if (hit) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, data: hit });
    } else {
      setTooltip(null);
    }
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        style={{ width, height, cursor: 'crosshair', borderRadius: 8 }}
        onMouseMove={handleMouse}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div
          className="absolute pointer-events-none px-3 py-2 rounded-lg text-xs z-10"
          style={{
            left: Math.min(tooltip.x + 12, width - 180),
            top: Math.max(tooltip.y - 70, 4),
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="font-bold mb-1">{tooltip.data.name}</div>
          <div className="space-y-0.5" style={{ color: 'var(--text-muted)' }}>
            <div>변동률: <span style={{ color: getColor(tooltip.data.change).text, fontWeight: 600 }}>
              {tooltip.data.change >= 0 ? '+' : ''}{tooltip.data.change.toFixed(2)}%
            </span></div>
            <div>종목: {tooltip.data.total}개 (🔺{tooltip.data.up} ➖{tooltip.data.flat} 🔻{tooltip.data.down})</div>
            <div>상승비: {tooltip.data.upRatio}%</div>
            {tooltip.data.weightPct != null && <div>시장 비중: {tooltip.data.weightPct}%</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function SectorList({ sectors, sortKey, onSort }) {
  const sorted = [...sectors].sort((a, b) => {
    if (sortKey === 'change_desc') return b.change - a.change;
    if (sortKey === 'change_asc') return a.change - b.change;
    if (sortKey === 'name') return a.name.localeCompare(b.name, 'ko');
    if (sortKey === 'total') return b.total - a.total;
    return Math.abs(b.change) - Math.abs(a.change); // default: abs change
  });

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-1 px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-medium flex-1" style={{ color: 'var(--text-muted)' }}>업종별 상세 ({sectors.length}개)</span>
        {[
          { key: 'default', label: '변동폭' },
          { key: 'change_desc', label: '▲' },
          { key: 'change_asc', label: '▼' },
          { key: 'name', label: 'ㄱ-ㄴ' },
          { key: 'total', label: '규모' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => onSort(s.key)}
            className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
            style={{
              background: sortKey === s.key ? 'var(--text-primary)' : 'var(--bg-hover)',
              color: sortKey === s.key ? 'var(--bg-primary)' : 'var(--text-muted)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="max-h-80 overflow-y-auto">
        {sorted.map((s, i) => {
          const colors = getColor(s.change);
          return (
            <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 transition-colors hover:opacity-80"
              style={{ borderBottom: '1px solid var(--border)' }}>
              <span className="text-[10px] w-5 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>{i + 1}</span>
              <span className="text-xs flex-1 truncate">{s.name}</span>
              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                <div className="h-full rounded-full" style={{
                  width: `${s.upRatio}%`,
                  background: s.upRatio > 60 ? '#22c55e' : s.upRatio < 40 ? '#ef4444' : '#eab308',
                }} />
              </div>
              <span className="text-[10px] w-12 text-right tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {s.total}종목
              </span>
              <span className="text-[9px] w-10 text-right tabular-nums hidden sm:inline-block" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                {s.weightPct}%
              </span>
              <span className="text-xs font-bold w-16 text-right tabular-nums" style={{ color: colors.text }}>
                {s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HeatmapPage() {
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('default');
  const [view, setView] = useState('treemap'); // 'treemap' | 'list'
  const containerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(600);

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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/sectors')
      .then(r => r.json())
      .then(data => {
        if (!cancelled) {
          setSectors(data.sectors || []);
          setLoading(false);
        }
      })
      .catch(e => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  // Add weight percentage to sectors
  const totalStocks = sectors.reduce((s, sec) => s + sec.total, 0);
  const sectorsWithWeight = sectors.map(s => ({
    ...s,
    weightPct: totalStocks > 0 ? (s.total / totalStocks * 100).toFixed(1) : 0,
  }));

  // Summary stats
  const upCount = sectorsWithWeight.filter(s => s.change > 0).length;
  const downCount = sectorsWithWeight.filter(s => s.change < 0).length;
  const flatCount = sectorsWithWeight.filter(s => s.change === 0).length;
  const topGainers = [...sectorsWithWeight].sort((a, b) => b.change - a.change).slice(0, 3);
  const topLosers = [...sectorsWithWeight].sort((a, b) => a.change - b.change).slice(0, 3);

  const chartHeight = window.innerWidth < 640 ? 300 : 450;

  return (
    <div ref={containerRef} className="px-3 sm:px-4 py-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-bold">🗺️ 업종별 히트맵</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setView('treemap')}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{
              background: view === 'treemap' ? 'var(--text-primary)' : 'var(--bg-hover)',
              color: view === 'treemap' ? 'var(--bg-primary)' : 'var(--text-muted)',
            }}
          >
            🗺️ 맵
          </button>
          <button
            onClick={() => setView('list')}
            className="text-xs px-2 py-1 rounded transition-colors"
            style={{
              background: view === 'list' ? 'var(--text-primary)' : 'var(--bg-hover)',
              color: view === 'list' ? 'var(--bg-primary)' : 'var(--text-muted)',
            }}
          >
            📋 목록
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      {sectorsWithWeight.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div className="text-[10px]" style={{ color: '#22c55e' }}>상승 업종</div>
            <div className="text-lg font-bold" style={{ color: '#22c55e' }}>{upCount}개</div>
          </div>
          <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <div className="text-[10px]" style={{ color: '#ef4444' }}>하락 업종</div>
            <div className="text-lg font-bold" style={{ color: '#ef4444' }}>{downCount}개</div>
          </div>
          <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-[10px]" style={{ color: '#22c55e' }}>🔥 Top</div>
            <div className="text-xs font-medium truncate">{topGainers[0]?.name} +{topGainers[0]?.change.toFixed(1)}%</div>
          </div>
          <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-[10px]" style={{ color: '#ef4444' }}>🧊 Bottom</div>
            <div className="text-xs font-medium truncate">{topLosers[0]?.name} {topLosers[0]?.change.toFixed(1)}%</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center" style={{ height: 300 }}>
          <div className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>업종 데이터 불러오는 중...</div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center" style={{ height: 300 }}>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>⚠️ {error}</div>
        </div>
      ) : view === 'treemap' ? (
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', padding: 8 }}>
          <Treemap sectors={sectorsWithWeight} width={chartWidth - 16} height={chartHeight} />
        </div>
      ) : null}

      {/* Always show list below (or as main view) */}
      <div className={view === 'treemap' ? 'mt-4' : ''}>
        <SectorList sectors={sectorsWithWeight} sortKey={sortKey} onSort={setSortKey} />
      </div>

      {/* Global Market Timeline */}
      <div className="mt-6" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
        <MarketTimeline />
      </div>
    </div>
  );
}
