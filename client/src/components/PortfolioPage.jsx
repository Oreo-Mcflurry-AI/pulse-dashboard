import { useState, useEffect, useCallback, useRef } from 'react';
import { addNotification, shouldNotify } from './NotificationCenter';

const STORAGE_KEY = 'pulse_portfolio';
const HISTORY_KEY = 'pulse_portfolio_history';
const PORTFOLIOS_KEY = 'pulse_portfolios'; // list of { id, name }
const ACTIVE_PF_KEY = 'pulse_active_portfolio';
const TRADE_LOG_KEY = 'pulse_trade_log';

// ─── Trade log ───
function getTradeLog(pfId) {
  try { return JSON.parse(localStorage.getItem(`${TRADE_LOG_KEY}_${pfId || 'default'}`) || '[]'); } catch { return []; }
}
function addTradeLog(pfId, entry) {
  const log = getTradeLog(pfId);
  log.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), timestamp: new Date().toISOString(), ...entry });
  // Keep last 200 entries
  localStorage.setItem(`${TRADE_LOG_KEY}_${pfId || 'default'}`, JSON.stringify(log.slice(0, 200)));
}
function clearTradeLog(pfId) {
  localStorage.removeItem(`${TRADE_LOG_KEY}_${pfId || 'default'}`);
}

const PRESETS = [
  { symbol: 'KOSPI', name: '코스피', type: 'index' },
  { symbol: 'KOSDAQ', name: '코스닥', type: 'index' },
  { symbol: 'BTC', name: '비트코인', type: 'crypto' },
  { symbol: 'ETH', name: '이더리움', type: 'crypto' },
  { symbol: 'USD/KRW', name: '달러/원', type: 'fx' },
  { symbol: 'JPY/KRW', name: '엔/원', type: 'fx' },
];

// ─── Multi-portfolio management ───
function getPortfolioList() {
  try {
    const raw = localStorage.getItem(PORTFOLIOS_KEY);
    const list = raw ? JSON.parse(raw) : null;
    if (!list || list.length === 0) {
      // Migration: create default portfolio from existing data
      const defaultList = [{ id: 'default', name: '기본 포트폴리오' }];
      localStorage.setItem(PORTFOLIOS_KEY, JSON.stringify(defaultList));
      return defaultList;
    }
    return list;
  } catch { return [{ id: 'default', name: '기본 포트폴리오' }]; }
}

function savePortfolioList(list) {
  localStorage.setItem(PORTFOLIOS_KEY, JSON.stringify(list));
}

function getActivePortfolioId() {
  return localStorage.getItem(ACTIVE_PF_KEY) || 'default';
}

function setActivePortfolioId(id) {
  localStorage.setItem(ACTIVE_PF_KEY, id);
}

function storageKeyFor(pfId) {
  return pfId === 'default' ? STORAGE_KEY : `${STORAGE_KEY}_${pfId}`;
}

function historyKeyFor(pfId) {
  return pfId === 'default' ? HISTORY_KEY : `${HISTORY_KEY}_${pfId}`;
}

function loadPortfolio(pfId) {
  try {
    const raw = localStorage.getItem(storageKeyFor(pfId || getActivePortfolioId()));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePortfolio(items, pfId) {
  localStorage.setItem(storageKeyFor(pfId || getActivePortfolioId()), JSON.stringify(items));
}

function fmt(n) {
  if (n == null) return '-';
  return Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

function pctColor(pct) {
  if (pct > 0) return 'var(--up, #ef4444)';
  if (pct < 0) return 'var(--down, #3b82f6)';
  return 'var(--text-muted)';
}

function loadHistory(pfId) {
  try { return JSON.parse(localStorage.getItem(historyKeyFor(pfId || getActivePortfolioId())) || '[]'); } catch { return []; }
}
function saveHistory(h, pfId) {
  // Keep last 90 days max
  const trimmed = h.slice(-90);
  localStorage.setItem(historyKeyFor(pfId || getActivePortfolioId()), JSON.stringify(trimmed));
}
function recordSnapshot(totalValue, totalPnl, pfId) {
  if (totalValue === 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const history = loadHistory(pfId);
  const existing = history.findIndex(h => h.date === today);
  const entry = { date: today, value: Math.round(totalValue), pnl: Math.round(totalPnl) };
  if (existing >= 0) {
    history[existing] = entry;
  } else {
    history.push(entry);
  }
  saveHistory(history, pfId);
}

function PortfolioChart({ history, t }) {
  const canvasRef = useRef(null);
  const [benchmark, setBenchmark] = useState(null);
  const [showBenchmark, setShowBenchmark] = useState(true);
  const w = 460, h = 170;

  // Fetch KOSPI benchmark data matching portfolio history dates
  useEffect(() => {
    if (history.length < 2) return;
    // Determine period based on history length
    const days = history.length;
    const period = days > 180 ? '1y' : days > 90 ? '6m' : days > 30 ? '3m' : '1m';
    fetch(`/api/history/kospi?period=${period}`)
      .then(r => r.json())
      .then(resp => {
        const items = resp.data || resp;
        if (items && items.length > 0) {
          // Build date->close map
          const map = {};
          items.forEach(d => { map[d.date] = d.close; });
          // Match portfolio dates
          const matched = history.map(h => ({ date: h.date, close: map[h.date] || null })).filter(d => d.close !== null);
          if (matched.length >= 2) setBenchmark(matched);
        }
      })
      .catch(() => {});
  }, [history]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const pad = { top: 10, right: 10, bottom: 30, left: 60 };
    const cw = w - pad.left - pad.right;
    const ch = h - pad.top - pad.bottom;

    // Normalize to % returns from day 1
    const pfReturns = history.map(d => ((d.value - history[0].value) / history[0].value) * 100);
    let bmReturns = null;
    if (showBenchmark && benchmark && benchmark.length >= 2) {
      bmReturns = benchmark.map(d => ((d.close - benchmark[0].close) / benchmark[0].close) * 100);
    }

    // Calculate combined min/max for Y axis
    const allVals = [...pfReturns, ...(bmReturns || [])];
    let min = Math.min(...allVals);
    let max = Math.max(...allVals);
    // Ensure 0 line is included
    min = Math.min(min, 0);
    max = Math.max(max, 0);
    const range = max - min || 1;

    const isUp = pfReturns[pfReturns.length - 1] >= 0;
    const lineColor = isUp ? '#22c55e' : '#ef4444';
    const bmColor = '#6366f1'; // indigo for KOSPI

    // Grid + Y labels (% returns)
    ctx.strokeStyle = 'rgba(128,128,128,0.12)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (ch / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + cw, y);
      ctx.stroke();
      const val = max - (range / 4) * i;
      ctx.fillStyle = 'rgba(128,128,128,0.5)';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`${val >= 0 ? '+' : ''}${val.toFixed(1)}%`, pad.left - 5, y + 3);
    }

    // Zero line
    const zeroY = pad.top + ch - ((0 - min) / range) * ch;
    ctx.strokeStyle = 'rgba(128,128,128,0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(pad.left, zeroY);
    ctx.lineTo(pad.left + cw, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // X-axis date labels
    ctx.fillStyle = 'rgba(128,128,128,0.5)';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'center';
    const labelInterval = Math.max(1, Math.floor(history.length / 5));
    history.forEach((d, i) => {
      if (i % labelInterval === 0 || i === history.length - 1) {
        const x = pad.left + (i / (history.length - 1)) * cw;
        ctx.fillText(d.date.slice(5), x, h - 5);
      }
    });

    // Helper: draw line
    function drawLine(returns, color, lineW, dashed) {
      if (!returns || returns.length < 2) return;
      ctx.beginPath();
      if (dashed) ctx.setLineDash([5, 3]);
      returns.forEach((v, i) => {
        const x = pad.left + (i / (returns.length - 1)) * cw;
        const y = pad.top + ch - ((v - min) / range) * ch;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = color;
      ctx.lineWidth = lineW;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();
      if (dashed) ctx.setLineDash([]);
    }

    // Draw benchmark first (behind)
    if (bmReturns) {
      drawLine(bmReturns, bmColor + '80', 1.5, true);
      // End label
      const bx = pad.left + cw;
      const by = pad.top + ch - ((bmReturns[bmReturns.length - 1] - min) / range) * ch;
      ctx.fillStyle = bmColor;
      ctx.font = 'bold 8px system-ui';
      ctx.textAlign = 'left';
      // Avoid overlap with portfolio line end
      const labelOffset = Math.abs(by - (pad.top + ch - ((pfReturns[pfReturns.length - 1] - min) / range) * ch)) < 12 ? -12 : 0;
      ctx.fillText('KOSPI', bx - 30, by + labelOffset - 4);
    }

    // Portfolio area
    ctx.beginPath();
    pfReturns.forEach((v, i) => {
      const x = pad.left + (i / (pfReturns.length - 1)) * cw;
      const y = pad.top + ch - ((v - min) / range) * ch;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + cw, zeroY);
    ctx.lineTo(pad.left, zeroY);
    ctx.closePath();
    ctx.fillStyle = lineColor + '12';
    ctx.fill();

    // Portfolio line
    drawLine(pfReturns, lineColor, 2, false);

    // End dot
    const lastX = pad.left + cw;
    const lastY = pad.top + ch - ((pfReturns[pfReturns.length - 1] - min) / range) * ch;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
  }, [history, benchmark, showBenchmark]);

  if (history.length < 2) return null;

  const first = history[0].value;
  const last = history[history.length - 1].value;
  const totalReturn = ((last - first) / first * 100);

  // Benchmark return
  let bmReturn = null;
  let alpha = null;
  if (benchmark && benchmark.length >= 2) {
    bmReturn = ((benchmark[benchmark.length - 1].close - benchmark[0].close) / benchmark[0].close * 100);
    alpha = totalReturn - bmReturn;
  }

  return (
    <div className="mb-4 p-3 sm:p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>📈 {t('portfolio.chartTitle')}</span>
          {benchmark && (
            <button
              onClick={() => setShowBenchmark(v => !v)}
              className="text-[9px] px-1.5 py-0.5 rounded-full transition-colors"
              style={{
                background: showBenchmark ? '#6366f120' : 'var(--bg-hover)',
                color: showBenchmark ? '#6366f1' : 'var(--text-muted)',
                border: `1px solid ${showBenchmark ? '#6366f140' : 'var(--border)'}`,
              }}
            >
              {showBenchmark ? t('portfolio.benchmarkOn') : t('portfolio.benchmarkOff')}
            </button>
          )}
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs font-medium" style={{ color: totalReturn >= 0 ? '#22c55e' : '#ef4444' }}>
            {t('portfolio.myReturn')}: {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(1)}% ({history.length}{t('portfolio.daysUnit')})
          </span>
          {bmReturn !== null && showBenchmark && (
            <div className="flex items-center gap-2">
              <span className="text-[9px]" style={{ color: '#6366f1' }}>
                {t('portfolio.kospi')}: {bmReturn >= 0 ? '+' : ''}{bmReturn.toFixed(1)}%
              </span>
              <span className="text-[9px] font-bold px-1 py-0.5 rounded" style={{
                background: alpha >= 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: alpha >= 0 ? '#22c55e' : '#ef4444',
              }}>
                α {alpha >= 0 ? '+' : ''}{alpha.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-center overflow-x-auto">
        <canvas ref={canvasRef} style={{ width: w, height: h, maxWidth: '100%' }} />
      </div>
    </div>
  );
}

// ─── Returns Calendar Heatmap ───
function ReturnCalendar({ history, t }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  if (!history || history.length < 2) return null;

  // Build daily returns map
  const returnsMap = {};
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const curr = history[i];
    if (prev.value > 0) {
      returnsMap[curr.date] = ((curr.value - prev.value) / prev.value) * 100;
    }
  }

  const [year, mon] = month.split('-').map(Number);
  const firstDay = new Date(year, mon - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, mon, 0).getDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push({ day: d, date: dateStr, ret: returnsMap[dateStr] });
  }

  const getColor = (ret) => {
    if (ret == null) return 'var(--bg-hover)';
    if (ret >= 3) return '#15803d';
    if (ret >= 1.5) return '#22c55e';
    if (ret >= 0.5) return '#86efac';
    if (ret > -0.5) return '#d1d5db';
    if (ret > -1.5) return '#fca5a5';
    if (ret > -3) return '#ef4444';
    return '#b91c1c';
  };

  const prevMonth = () => {
    const d = new Date(year, mon - 2, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const d = new Date(year, mon, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthReturns = days.filter(d => d.ret != null).map(d => d.ret);
  const winDays = monthReturns.filter(r => r > 0).length;
  const lossDays = monthReturns.filter(r => r < 0).length;
  const totalRet = monthReturns.reduce((s, r) => s + r, 0);

  return (
    <div className="mx-3 sm:mx-4 mt-3 p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>◀</button>
          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
            {t('portfolio.monthReturnTitle').replace('{year}', year).replace('{month}', mon)}
          </span>
          <button onClick={nextMonth} className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>▶</button>
        </div>
        <div className="flex items-center gap-2 text-[9px]" style={{ color: 'var(--text-muted)' }}>
          <span style={{ color: '#22c55e' }}>▲{winDays}{t('portfolio.daysUnit')}</span>
          <span style={{ color: '#ef4444' }}>▼{lossDays}{t('portfolio.daysUnit')}</span>
          <span className="font-bold" style={{ color: totalRet >= 0 ? '#22c55e' : '#ef4444' }}>
            {t('portfolio.monthPrefix')} {totalRet >= 0 ? '+' : ''}{totalRet.toFixed(2)}%
          </span>
        </div>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-0.5">
        {t('portfolio.weekdays').split(',').map(d => (
          <div key={d} className="text-center text-[8px] font-medium py-0.5" style={{ color: 'var(--text-muted)' }}>{d}</div>
        ))}
      </div>
      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array(firstDay).fill(null).map((_, i) => <div key={`e${i}`} />)}
        {days.map(({ day, date, ret }) => (
          <div
            key={date}
            className="aspect-square flex flex-col items-center justify-center rounded text-[9px] transition-colors"
            style={{ background: getColor(ret), color: ret != null ? (Math.abs(ret) >= 1.5 ? '#fff' : 'var(--text-primary)') : 'var(--text-muted)', cursor: 'default' }}
            title={ret != null ? `${date}: ${ret >= 0 ? '+' : ''}${ret.toFixed(2)}%` : date}
          >
            <span className="font-medium">{day}</span>
            {ret != null && <span className="text-[7px] leading-none">{ret >= 0 ? '+' : ''}{ret.toFixed(1)}</span>}
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center justify-center gap-1 mt-2">
        {[{ label: '-3%↓', color: '#b91c1c' }, { label: '-1.5%', color: '#ef4444' }, { label: '-0.5%', color: '#fca5a5' }, { label: '0', color: '#d1d5db' }, { label: '+0.5%', color: '#86efac' }, { label: '+1.5%', color: '#22c55e' }, { label: '+3%↑', color: '#15803d' }].map(l => (
          <div key={l.label} className="flex items-center gap-0.5">
            <span className="w-2 h-2 rounded-sm" style={{ background: l.color }} />
            <span className="text-[7px]" style={{ color: 'var(--text-muted)' }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const DONUT_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

function AllocationChart({ holdings, prices, t }) {
  const canvasRef = useRef(null);
  const size = 160;

  // Build slices: only holdings with qty and price
  const slices = holdings
    .map((h, i) => {
      const p = prices[h.symbol];
      if (!p || !h.qty) return null;
      return { name: h.name || h.symbol, value: p.price * h.qty, color: DONUT_COLORS[i % DONUT_COLORS.length] };
    })
    .filter(Boolean)
    .sort((a, b) => b.value - a.value);

  const total = slices.reduce((s, sl) => s + sl.value, 0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || slices.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);

    const cx = size / 2, cy = size / 2, r = size / 2 - 4, innerR = r * 0.55;
    let angle = -Math.PI / 2;

    slices.forEach(sl => {
      const sliceAngle = (sl.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, angle, angle + sliceAngle);
      ctx.arc(cx, cy, innerR, angle + sliceAngle, angle, true);
      ctx.closePath();
      ctx.fillStyle = sl.color;
      ctx.fill();
      angle += sliceAngle;
    });

    // Center text
    ctx.fillStyle = 'rgba(128,128,128,0.7)';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t('portfolio.totalAssets'), cx, cy - 8);
    ctx.fillStyle = getComputedStyle(canvas).color || '#fff';
    ctx.font = 'bold 13px system-ui';
    const totalStr = total >= 100000000 ? `${(total / 100000000).toFixed(1)}억` : total >= 10000 ? `${(total / 10000).toFixed(0)}만` : fmt(total);
    ctx.fillText(totalStr, cx, cy + 8);
  }, [slices, total]);

  if (slices.length === 0) return null;

  return (
    <div className="mb-4 p-3 sm:p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="text-xs font-bold mb-3" style={{ color: 'var(--text-muted)' }}>🥧 {t('portfolio.allocationTitle')}</div>
      <div className="flex items-center gap-4">
        <canvas ref={canvasRef} style={{ width: size, height: size, flexShrink: 0, color: 'var(--text-primary)' }} />
        <div className="flex-1 space-y-1.5 min-w-0">
          {slices.map((sl, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: sl.color }} />
              <span className="truncate flex-1">{sl.name}</span>
              <span className="tabular-nums font-medium" style={{ color: 'var(--text-muted)' }}>
                {(sl.value / total * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Asset Type Classification ───
const ASSET_TYPES = {
  'KOSPI': 'domestic_equity', 'KOSDAQ': 'domestic_equity',
  'S&P 500': 'us_equity', 'NASDAQ': 'us_equity', 'DOW': 'us_equity',
  'BTC': 'crypto', 'ETH': 'crypto',
  'USD/KRW': 'fx', 'JPY/KRW': 'fx',
  'WTI': 'commodity', 'GOLD': 'commodity',
  'VIX': 'hedge',
};

const ASSET_TYPE_LABELS = {
  domestic_equity: { nameKey: 'portfolio.assetDomesticEquity', icon: '🇰🇷', color: '#3b82f6' },
  us_equity: { nameKey: 'portfolio.assetUsEquity', icon: '🇺🇸', color: '#8b5cf6' },
  crypto: { nameKey: 'portfolio.assetCrypto', icon: '₿', color: '#f59e0b' },
  fx: { nameKey: 'portfolio.assetFx', icon: '💱', color: '#10b981' },
  commodity: { nameKey: 'portfolio.assetCommodity', icon: '🛢️', color: '#ef4444' },
  hedge: { nameKey: 'portfolio.assetHedge', icon: '🛡️', color: '#6b7280' },
  other: { nameKey: 'portfolio.assetOther', icon: '📦', color: '#94a3b8' },
};

// Recommended allocations by risk profile
const ALLOCATION_PROFILES = {
  conservative: {
    nameKey: 'portfolio.profileConservative',
    icon: '🛡️',
    descKey: 'portfolio.profileConservativeDesc',
    allocations: { domestic_equity: 20, us_equity: 20, crypto: 0, fx: 10, commodity: 15, hedge: 5, other: 30 },
  },
  balanced: {
    nameKey: 'portfolio.profileBalanced',
    icon: '⚖️',
    descKey: 'portfolio.profileBalancedDesc',
    allocations: { domestic_equity: 25, us_equity: 30, crypto: 5, fx: 5, commodity: 10, hedge: 5, other: 20 },
  },
  aggressive: {
    nameKey: 'portfolio.profileAggressive',
    icon: '🔥',
    descKey: 'portfolio.profileAggressiveDesc',
    allocations: { domestic_equity: 25, us_equity: 35, crypto: 15, fx: 0, commodity: 5, hedge: 5, other: 15 },
  },
};

const REBALANCE_KEY = 'pulse-rebalance-settings';
const REBALANCE_NOTIFIED_KEY = 'pulse-rebalance-notified';

function getRebalanceSettings() {
  try { return JSON.parse(localStorage.getItem(REBALANCE_KEY) || '{}'); } catch { return {}; }
}

function AllocationRecommendation({ holdings, prices, t }) {
  const [profile, setProfile] = useState('balanced');
  const [rebalanceThreshold, setRebalanceThreshold] = useState(() => getRebalanceSettings().threshold || 15);
  const [showRebalanceSettings, setShowRebalanceSettings] = useState(false);
  const rebalanceNotifiedRef = useRef(new Set(
    (() => { try { return JSON.parse(sessionStorage.getItem(REBALANCE_NOTIFIED_KEY) || '[]'); } catch { return []; } })()
  ));

  // Calculate current allocation by asset type
  const typeValues = {};
  let total = 0;
  holdings.forEach(h => {
    const p = prices[h.symbol];
    if (!p || !h.qty) return;
    const val = p.price * h.qty;
    const type = ASSET_TYPES[h.symbol] || ASSET_TYPES[h.name] || 'other';
    typeValues[type] = (typeValues[type] || 0) + val;
    total += val;
  });

  if (total === 0) return null;

  const currentPcts = {};
  for (const [type, val] of Object.entries(typeValues)) {
    currentPcts[type] = (val / total) * 100;
  }

  const recommended = ALLOCATION_PROFILES[profile].allocations;

  // All types that are either in current or recommended
  const allTypes = [...new Set([...Object.keys(currentPcts), ...Object.keys(recommended).filter(k => recommended[k] > 0)])];
  allTypes.sort((a, b) => (currentPcts[b] || 0) - (currentPcts[a] || 0));

  // Calculate deviation score (lower = better balanced)
  const deviation = allTypes.reduce((sum, type) => {
    const curr = currentPcts[type] || 0;
    const rec = recommended[type] || 0;
    return sum + Math.abs(curr - rec);
  }, 0) / 2;

  const deviationLabel = deviation < 10 ? t('portfolio.deviationGood') : deviation < 25 ? t('portfolio.deviationNeedsAdjust') : t('portfolio.deviationConcentrated');
  const deviationColor = deviation < 10 ? '#22c55e' : deviation < 25 ? '#f59e0b' : '#ef4444';

  // Rebalance alert: notify when any asset type exceeds threshold
  const overThreshold = allTypes.filter(type => {
    const curr = currentPcts[type] || 0;
    const rec = recommended[type] || 0;
    return Math.abs(curr - rec) >= rebalanceThreshold;
  });

  useEffect(() => {
    if (overThreshold.length === 0) return;
    const alertKey = `rebalance_${profile}_${overThreshold.sort().join(',')}`;
    if (rebalanceNotifiedRef.current.has(alertKey)) return;
    rebalanceNotifiedRef.current.add(alertKey);
    sessionStorage.setItem(REBALANCE_NOTIFIED_KEY, JSON.stringify([...rebalanceNotifiedRef.current]));
    if (shouldNotify('portfolio')) {
      const typeNames = overThreshold.map(type => {
        const info = ASSET_TYPE_LABELS[type] || ASSET_TYPE_LABELS.other;
        return t(info.nameKey);
      });
      addNotification({
        type: 'portfolio',
        title: t('portfolio.rebalanceNeededTitle'),
        body: t('portfolio.rebalanceNeededBody').replace('{types}', typeNames.join(', ')).replace('{threshold}', rebalanceThreshold),
      });
    }
  }, [overThreshold.length, profile, rebalanceThreshold]);

  return (
    <div className="mb-4 p-3 sm:p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>📊 {t('portfolio.allocationAnalysis')}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: deviationColor + '20', color: deviationColor }}>
            {deviationLabel}
          </span>
          <button
            onClick={() => setShowRebalanceSettings(v => !v)}
            className="text-[9px] px-1.5 py-0.5 rounded transition-colors"
            style={{ background: showRebalanceSettings ? 'rgba(168,85,247,0.15)' : 'transparent', color: overThreshold.length > 0 ? '#a855f7' : 'var(--text-muted)' }}
            title={t('portfolio.rebalanceSettingsTitle')}
          >
            ⚖️{overThreshold.length > 0 ? ` ${overThreshold.length}` : ''}
          </button>
        </div>
        <div className="flex gap-1">
          {Object.entries(ALLOCATION_PROFILES).map(([key, p]) => (
            <button
              key={key}
              onClick={() => setProfile(key)}
              className="text-[10px] px-2 py-1 rounded-full transition-colors"
              style={{
                background: profile === key ? 'var(--text-primary)' : 'var(--bg-hover)',
                color: profile === key ? 'var(--bg-primary)' : 'var(--text-muted)',
                fontWeight: profile === key ? 600 : 400,
              }}
              title={t(p.descKey)}
            >
              {p.icon} {t(p.nameKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Rebalance alert settings */}
      {showRebalanceSettings && (
        <div className="mb-3 p-2.5 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>⚖️ {t('portfolio.rebalanceAlert')}</span>
            <span className="text-[9px]" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{t('portfolio.rebalanceAlertDesc')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t('portfolio.threshold')}</span>
            <input
              type="range" min="5" max="30" step="5"
              value={rebalanceThreshold}
              onChange={e => {
                const v = parseInt(e.target.value);
                setRebalanceThreshold(v);
                localStorage.setItem(REBALANCE_KEY, JSON.stringify({ threshold: v }));
              }}
              className="flex-1 h-1 accent-purple-500"
              style={{ maxWidth: 120 }}
            />
            <span className="text-[10px] font-bold tabular-nums" style={{ color: '#a855f7' }}>{rebalanceThreshold}%p</span>
          </div>
          {overThreshold.length > 0 && (
            <div className="mt-2 text-[9px] px-2 py-1.5 rounded" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>
              {t('portfolio.overThresholdMessage')
                .replace('{types}', overThreshold.map(type => t((ASSET_TYPE_LABELS[type] || ASSET_TYPE_LABELS.other).nameKey)).join(', '))
                .replace('{threshold}', rebalanceThreshold)}
            </div>
          )}
        </div>
      )}

      {/* Bar comparison */}
      <div className="space-y-2">
        {allTypes.map(type => {
          const info = ASSET_TYPE_LABELS[type] || ASSET_TYPE_LABELS.other;
          const curr = currentPcts[type] || 0;
          const rec = recommended[type] || 0;
          const diff = curr - rec;
          const diffColor = Math.abs(diff) < 5 ? 'var(--text-muted)' : diff > 0 ? '#ef4444' : '#3b82f6';
          const diffLabel = Math.abs(diff) < 5 ? t('portfolio.diffOk') : diff > 0 ? t('portfolio.diffOver') : t('portfolio.diffUnder');

          return (
            <div key={type}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px]">{info.icon}</span>
                  <span className="text-[11px] font-medium">{t(info.nameKey)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {curr.toFixed(1)}% / {rec}%
                  </span>
                  <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: diffColor + '15', color: diffColor }}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(1)}% {diffLabel}
                  </span>
                </div>
              </div>
              <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                {/* Current (solid) */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(curr, 100)}%`, background: info.color, opacity: 0.8 }}
                />
                {/* Recommended marker */}
                {rec > 0 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5"
                    style={{ left: `${Math.min(rec, 100)}%`, background: 'var(--text-primary)', opacity: 0.6 }}
                    title={t('portfolio.recommendedWeight').replace('{value}', rec)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-3 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded-sm" style={{ background: '#3b82f6', opacity: 0.8 }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{t('portfolio.currentWeight')}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-0.5 h-3" style={{ background: 'var(--text-primary)', opacity: 0.6 }} />
          <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{t('portfolio.recommendedWeightLabel').replace('{profile}', t(ALLOCATION_PROFILES[profile].nameKey))}</span>
        </div>
        <span className="text-[9px] ml-auto" style={{ color: 'var(--text-muted)' }}>
          {t('portfolio.deviationScore')}: {deviation.toFixed(0)}
        </span>
      </div>
    </div>
  );
}

// ─── Sector Heatmap ───
function SectorHeatmap({ holdings, prices, t }) {
  if (!holdings || holdings.length === 0 || Object.keys(prices).length === 0) return null;

  // Group holdings by asset type with P&L
  const sectors = {};
  for (const h of holdings) {
    const p = prices[h.symbol];
    if (!p) continue;
    const type = ASSET_TYPES[h.symbol] || 'other';
    if (!sectors[type]) sectors[type] = { type, totalValue: 0, totalPnl: 0, items: [] };
    const value = p.price * (h.qty || 1);
    const pnl = h.buyPrice && h.qty ? (p.price - h.buyPrice) * h.qty : 0;
    const pnlPct = h.buyPrice ? ((p.price - h.buyPrice) / h.buyPrice) * 100 : p.pct || 0;
    sectors[type].totalValue += value;
    sectors[type].totalPnl += pnl;
    sectors[type].items.push({ ...h, currentPrice: p.price, pnlPct, dayChange: p.pct || 0 });
  }

  const sectorList = Object.values(sectors).sort((a, b) => b.totalValue - a.totalValue);
  if (sectorList.length === 0) return null;

  const totalValue = sectorList.reduce((s, sec) => s + sec.totalValue, 0);
  const maxAbsPct = Math.max(1, ...sectorList.map(s => Math.abs(s.totalPnl / s.totalValue * 100)));

  return (
    <div className="mb-4 p-3 sm:p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="text-xs font-bold mb-3" style={{ color: 'var(--text-muted)' }}>🗺️ {t('portfolio.sectorHeatmap')}</div>
      <div className="flex flex-wrap gap-1.5">
        {sectorList.map(sec => {
          const info = ASSET_TYPE_LABELS[sec.type] || ASSET_TYPE_LABELS.other;
          const pct = totalValue > 0 ? (sec.totalValue / totalValue * 100) : 0;
          const returnPct = sec.totalValue > 0 ? (sec.totalPnl / sec.totalValue * 100) : 0;
          const intensity = Math.min(1, Math.abs(returnPct) / maxAbsPct);
          const isUp = returnPct >= 0;
          const bg = isUp
            ? `rgba(34, 197, 94, ${0.1 + intensity * 0.4})`
            : `rgba(239, 68, 68, ${0.1 + intensity * 0.4})`;
          const textColor = isUp ? '#22c55e' : '#ef4444';
          // Size proportional to portfolio weight (min 80px)
          const minW = Math.max(80, Math.min(200, pct * 3));

          return (
            <div
              key={sec.type}
              className="rounded-lg p-2 transition-all hover:opacity-90"
              style={{
                background: bg,
                border: `1px solid ${isUp ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                minWidth: `${minW}px`,
                flex: `${Math.max(1, Math.round(pct / 10))}`,
              }}
            >
              <div className="flex items-center gap-1 mb-1">
                <span className="text-[10px]">{info.icon}</span>
                <span className="text-[10px] font-bold truncate">{t(info.nameKey)}</span>
              </div>
              <div className="text-sm font-bold tabular-nums" style={{ color: textColor }}>
                {returnPct >= 0 ? '+' : ''}{returnPct.toFixed(1)}%
              </div>
              <div className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {t('portfolio.weightAndItems').replace('{weight}', pct.toFixed(0)).replace('{count}', sec.items.length)}
              </div>
              {/* Mini items */}
              <div className="mt-1 space-y-0.5">
                {sec.items.slice(0, 3).map(item => {
                  const itemUp = item.dayChange >= 0;
                  return (
                    <div key={item.id} className="flex items-center justify-between text-[8px]">
                      <span className="truncate" style={{ color: 'var(--text-muted)' }}>{item.name}</span>
                      <span className="tabular-nums font-medium" style={{ color: itemUp ? '#22c55e' : '#ef4444' }}>
                        {itemUp ? '+' : ''}{item.dayChange.toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Holdings Related News ───
const SYMBOL_KEYWORDS = {
  'KOSPI': ['코스피', 'KOSPI', '한국 증시', '국내 증시'],
  'KOSDAQ': ['코스닥', 'KOSDAQ'],
  'BTC': ['비트코인', 'BTC', 'Bitcoin', '암호화폐'],
  'ETH': ['이더리움', 'ETH', 'Ethereum'],
  'USD/KRW': ['환율', '달러', 'USD', '원/달러', '원화'],
  'JPY/KRW': ['엔화', '엔/원', 'JPY'],
  'S&P 500': ['S&P', 'S&P500', '미국 증시'],
  'NASDAQ': ['나스닥', 'NASDAQ', 'Nasdaq'],
  'DOW': ['다우', 'DOW', 'Dow Jones'],
  'WTI': ['유가', '원유', 'WTI', 'oil', 'OPEC'],
  'GOLD': ['금값', '금 가격', 'gold', '금시세'],
  'VIX': ['VIX', '공포지수', '변동성'],
};

function HoldingsNews({ holdings, t }) {
  const [news, setNews] = useState(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (holdings.length === 0) return;
    fetch('/api/news')
      .then(r => r.json())
      .then(data => setNews(data))
      .catch(() => {});
  }, [holdings.length]);

  if (!news?.sections?.length || holdings.length === 0) return null;

  // Match articles to holdings
  const allArticles = news.sections.flatMap(s => s.articles || []);
  const matched = [];
  const seen = new Set();

  for (const h of holdings) {
    const keywords = SYMBOL_KEYWORDS[h.symbol] || [h.symbol, h.name].filter(Boolean);
    for (const article of allArticles) {
      if (seen.has(article.url)) continue;
      const title = (article.title || '').toLowerCase();
      if (keywords.some(kw => title.toLowerCase().includes(kw.toLowerCase()))) {
        matched.push({ ...article, matchedSymbol: h.symbol, matchedName: h.name });
        seen.add(article.url);
      }
    }
  }

  if (matched.length === 0) return null;

  const displayed = expanded ? matched : matched.slice(0, 3);

  return (
    <div className="mb-4 p-3 sm:p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>📰 {t('portfolio.holdingsNews')}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
            {matched.length}{t('portfolio.countSuffix')}
          </span>
        </div>
      </div>
      <div className="space-y-1">
        {displayed.map((a, i) => (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 px-2 py-1.5 rounded-lg transition-colors hover:opacity-80"
            style={{ background: 'transparent' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0 mt-0.5 font-medium" style={{
              background: 'var(--bg-hover)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}>
              {a.matchedName || a.matchedSymbol}
            </span>
            <span className="text-xs leading-snug flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
              {a.title}
            </span>
            <span className="text-[9px] shrink-0" style={{ color: 'var(--text-muted)' }}>
              {a.source}
            </span>
          </a>
        ))}
      </div>
      {matched.length > 3 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="mt-2 text-[10px] px-2 py-1 rounded transition-colors w-full"
          style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
        >
          {expanded ? t('portfolio.collapse') : t('portfolio.moreItems').replace('{count}', matched.length - 3)}
        </button>
      )}
    </div>
  );
}

function TradeLogSection({ pfId, t }) {
  const [expanded, setExpanded] = useState(false);
  const [log, setLog] = useState([]);

  useEffect(() => {
    setLog(getTradeLog(pfId));
  }, [pfId, expanded]);

  if (log.length === 0 && !expanded) return null;

  const displayLog = expanded ? log : log.slice(0, 5);

  return (
    <div className="mb-4 rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>📋 {t('portfolio.tradeLog')}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
            {log.length}{t('portfolio.countSuffix')}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {log.length > 0 && (
            <button
              onClick={() => { if (confirm(t('portfolio.clearTradeLogConfirm'))) { clearTradeLog(pfId); setLog([]); } }}
              className="text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
            >
              {t('portfolio.clearAll')}
            </button>
          )}
          {log.length > 5 && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-[9px] px-1.5 py-0.5 rounded"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
            >
              {expanded ? t('portfolio.collapse') : t('portfolio.viewAll').replace('{count}', log.length)}
            </button>
          )}
        </div>
      </div>
      {log.length === 0 ? (
        <div className="px-3 py-4 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
          {t('portfolio.tradeLogEmpty')}
        </div>
      ) : (
        <div className={expanded ? 'max-h-64 overflow-y-auto' : ''}>
          {displayLog.map(t => {
            const isBuy = t.action === 'BUY';
            const actionColor = isBuy ? '#3b82f6' : '#ef4444';
            const actionLabel = isBuy ? t('portfolio.buy') : t('portfolio.sell');
            const pnlColor = t.pnl > 0 ? '#22c55e' : t.pnl < 0 ? '#ef4444' : 'var(--text-muted)';
            return (
              <div key={t.id} className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: actionColor + '15', color: actionColor }}>
                  {actionLabel}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium">{t.name || t.symbol}</span>
                  {t.qty && <span className="text-[10px] ml-1" style={{ color: 'var(--text-muted)' }}>×{t.qty}</span>}
                  {t.price && <span className="text-[10px] ml-1" style={{ color: 'var(--text-muted)' }}>@{fmt(t.price)}</span>}
                  {t.pnl != null && (
                    <span className="text-[10px] ml-1.5 font-medium" style={{ color: pnlColor }}>
                      {t.pnl > 0 ? '+' : ''}{fmt(t.pnl)}
                    </span>
                  )}
                </div>
                <span className="text-[9px] shrink-0" style={{ color: 'var(--text-muted)' }}>
                  {new Date(t.timestamp).toLocaleDateString(t('common.locale'), { month: 'short', day: 'numeric' })}
                  {' '}
                  {new Date(t.timestamp).toLocaleTimeString(t('common.locale'), { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PortfolioPage({ t = (k) => k }) {
  // Multi-portfolio state
  const [pfList, setPfList] = useState(getPortfolioList);
  const [activePfId, setActivePfId] = useState(getActivePortfolioId);
  const [renamingPf, setRenamingPf] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [showPfMenu, setShowPfMenu] = useState(false);

  const switchPortfolio = useCallback((id) => {
    setActivePfId(id);
    setActivePortfolioId(id);
    setHoldings(loadPortfolio(id));
  }, []);

  const addPortfolio = useCallback(() => {
    const id = 'pf_' + Date.now().toString(36);
    const name = t('portfolio.newPortfolioName').replace('{count}', pfList.length + 1);
    const next = [...pfList, { id, name }];
    setPfList(next);
    savePortfolioList(next);
    switchPortfolio(id);
    setShowPfMenu(false);
  }, [pfList, switchPortfolio]);

  const deletePortfolio = useCallback((id) => {
    if (pfList.length <= 1) return; // can't delete last one
    if (!confirm(t('portfolio.deletePortfolioConfirm'))) return;
    const next = pfList.filter(p => p.id !== id);
    setPfList(next);
    savePortfolioList(next);
    localStorage.removeItem(storageKeyFor(id));
    localStorage.removeItem(historyKeyFor(id));
    if (activePfId === id) switchPortfolio(next[0].id);
    setShowPfMenu(false);
  }, [pfList, activePfId, switchPortfolio]);

  const startRenamePf = useCallback((pf) => {
    setRenamingPf(pf.id);
    setRenameValue(pf.name);
  }, []);

  const confirmRenamePf = useCallback(() => {
    if (!renameValue.trim()) return;
    const next = pfList.map(p => p.id === renamingPf ? { ...p, name: renameValue.trim() } : p);
    setPfList(next);
    savePortfolioList(next);
    setRenamingPf(null);
  }, [pfList, renamingPf, renameValue]);

  const [holdings, setHoldings] = useState(() => loadPortfolio(getActivePortfolioId()));
  const [prices, setPrices] = useState({});
  const [usdkrw, setUsdkrw] = useState(null);
  const [showUsd, setShowUsd] = useState(() => localStorage.getItem('pulse_pf_show_usd') === '1');
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ symbol: '', name: '', buyPrice: '', qty: '', memo: '', targetPrice: '', targetDir: 'above', stopLoss: '', takeProfit: '', dividend: '' });
  const [editingId, setEditingId] = useState(null);
  const [editField, setEditField] = useState(null); // 'memo' | 'buyPrice' | 'qty' | 'target'
  const [editMemo, setEditMemo] = useState('');
  const [editBuyPrice, setEditBuyPrice] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editTargetPrice, setEditTargetPrice] = useState('');
  const [editTargetDir, setEditTargetDir] = useState('above'); // 'above' | 'below'
  const notifiedRef = useRef(new Set()); // track notified target alerts
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // Fetch live prices
  const fetchPrices = useCallback(async () => {
    if (holdings.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/market');
      const data = await res.json();
      const p = {};
      // Map flat market API response to portfolio symbols
      const symbolMap = {
        'KOSPI': 'kospi', 'KOSDAQ': 'kosdaq',
        'USD/KRW': 'usdkrw', 'JPY/KRW': 'jpykrw',
        'BTC': 'btc', 'ETH': 'eth',
        'S&P 500': 'sp500', 'NASDAQ': 'nasdaq', 'DOW': 'dow',
        'WTI': 'oil', 'GOLD': 'gold', 'VIX': 'vix',
      };
      for (const [symbol, key] of Object.entries(symbolMap)) {
        const d = data[key];
        if (!d) continue;
        const price = parseFloat(String(d.value).replace(/,/g, ''));
        const pct = parseFloat(d.changeRate) || 0;
        if (!isNaN(price)) p[symbol] = { price, change: parseFloat(d.change) || 0, pct };
      }
      setPrices(p);
      // Capture USD/KRW rate for currency conversion
      if (data.usdkrw?.value) {
        const rate = parseFloat(String(data.usdkrw.value).replace(/,/g, ''));
        if (!isNaN(rate) && rate > 0) setUsdkrw(rate);
      }
    } catch (e) {
      console.error('Portfolio price fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [holdings.length]);

  useEffect(() => { fetchPrices(); }, [fetchPrices]);

  const addHolding = () => {
    if (!form.symbol && !form.name) return;
    const item = {
      id: Date.now().toString(36),
      symbol: form.symbol || form.name,
      name: form.name || form.symbol,
      buyPrice: form.buyPrice ? parseFloat(form.buyPrice) : null,
      qty: form.qty ? parseFloat(form.qty) : null,
      memo: form.memo || '',
      targetPrice: form.targetPrice ? parseFloat(form.targetPrice) : null,
      targetDir: form.targetDir || 'above',
      stopLoss: form.stopLoss ? parseFloat(form.stopLoss) : null,
      takeProfit: form.takeProfit ? parseFloat(form.takeProfit) : null,
      dividend: form.dividend ? parseFloat(form.dividend) : null,
      addedAt: new Date().toISOString(),
    };
    const next = [...holdings, item];
    setHoldings(next);
    savePortfolio(next, activePfId);
    // Log trade
    addTradeLog(activePfId, {
      action: 'BUY',
      symbol: item.symbol,
      name: item.name,
      price: item.buyPrice,
      qty: item.qty,
      memo: item.memo,
    });
    setForm({ symbol: '', name: '', buyPrice: '', qty: '', memo: '', targetPrice: '', targetDir: 'above', stopLoss: '', takeProfit: '', dividend: '' });
    setShowAdd(false);
  };

  const removeHolding = (id) => {
    const removed = holdings.find(h => h.id === id);
    const next = holdings.filter(h => h.id !== id);
    setHoldings(next);
    savePortfolio(next, activePfId);
    // Log trade
    if (removed) {
      const currentPrice = prices[removed.symbol]?.price;
      addTradeLog(activePfId, {
        action: 'SELL',
        symbol: removed.symbol,
        name: removed.name,
        price: currentPrice || removed.buyPrice,
        qty: removed.qty,
        buyPrice: removed.buyPrice,
        pnl: currentPrice && removed.buyPrice && removed.qty ? (currentPrice - removed.buyPrice) * removed.qty : null,
      });
    }
  };

  const updateHolding = (id, updates) => {
    const next = holdings.map(h => h.id === id ? { ...h, ...updates } : h);
    setHoldings(next);
    savePortfolio(next, activePfId);
  };

  const selectPreset = (preset) => {
    setForm({ ...form, symbol: preset.symbol, name: t(`portfolio.presets.${preset.symbol}`) });
  };

  // Drag-to-reorder handlers
  const handleDragStart = (idx) => (e) => {
    setDragIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idx);
  };
  const handleDragOver = (idx) => (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (idx !== dragOverIdx) setDragOverIdx(idx);
  };
  const handleDrop = (idx) => (e) => {
    e.preventDefault();
    if (dragIdx == null || dragIdx === idx) { setDragIdx(null); setDragOverIdx(null); return; }
    const next = [...holdings];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    setHoldings(next);
    savePortfolio(next, activePfId);
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  // Check target price alerts
  useEffect(() => {
    if (Object.keys(prices).length === 0) return;
    holdings.forEach(h => {
      if (!h.targetPrice || !prices[h.symbol]) return;
      const current = prices[h.symbol].price;
      const target = h.targetPrice;
      const dir = h.targetDir || 'above';
      const hit = dir === 'above' ? current >= target : current <= target;
      const key = `${h.id}_${target}_${dir}`;
      if (hit && !notifiedRef.current.has(key)) {
        notifiedRef.current.add(key);
        const label = dir === 'above' ? t('portfolio.above') : t('portfolio.below');
        if (shouldNotify('portfolio')) {
          addNotification({
            type: 'portfolio',
            title: t('portfolio.targetReachedTitle').replace('{name}', h.name),
            body: t('portfolio.targetReachedBody').replace('{current}', fmt(current)).replace('{target}', fmt(target)).replace('{label}', label),
          });
        }
      }
    });
  }, [prices, holdings]);

  // Per-holding P&L alerts (stop-loss / take-profit)
  useEffect(() => {
    if (Object.keys(prices).length === 0) return;
    holdings.forEach(h => {
      if (!h.buyPrice || !prices[h.symbol]) return;
      const current = prices[h.symbol].price;
      const pnlPct = ((current - h.buyPrice) / h.buyPrice) * 100;
      const stopLoss = h.stopLoss ?? null;   // negative %, e.g. -10
      const takeProfit = h.takeProfit ?? null; // positive %, e.g. 20

      if (stopLoss != null && pnlPct <= stopLoss) {
        const key = `${h.id}_sl_${stopLoss}`;
        if (!notifiedRef.current.has(key)) {
          notifiedRef.current.add(key);
          if (shouldNotify('portfolio')) {
            addNotification({
              type: 'portfolio',
              title: t('portfolio.stopLossReachedTitle').replace('{name}', h.name),
              body: t('portfolio.stopLossReachedBody').replace('{pnl}', `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}`).replace('{stopLoss}', stopLoss),
            });
          }
        }
      }
      if (takeProfit != null && pnlPct >= takeProfit) {
        const key = `${h.id}_tp_${takeProfit}`;
        if (!notifiedRef.current.has(key)) {
          notifiedRef.current.add(key);
          if (shouldNotify('portfolio')) {
            addNotification({
              type: 'portfolio',
              title: t('portfolio.takeProfitReachedTitle').replace('{name}', h.name),
              body: t('portfolio.takeProfitReachedBody').replace('{pnl}', pnlPct.toFixed(1)).replace('{takeProfit}', takeProfit),
            });
          }
        }
      }
    });
  }, [prices, holdings]);

  // Calculate P&L
  const totalPnl = holdings.reduce((sum, h) => {
    const p = prices[h.symbol];
    if (!p || !h.buyPrice || !h.qty) return sum;
    return sum + (p.price - h.buyPrice) * h.qty;
  }, 0);

  const totalValue = holdings.reduce((sum, h) => {
    const p = prices[h.symbol];
    if (!p || !h.qty) return sum;
    return sum + p.price * h.qty;
  }, 0);

  const hasPnl = holdings.some(h => h.buyPrice && h.qty && prices[h.symbol]);

  // Dividend summary
  const totalAnnualDividend = holdings.reduce((sum, h) => {
    if (!h.dividend || !h.qty) return sum;
    return sum + h.dividend * h.qty;
  }, 0);
  const totalInvested = holdings.reduce((sum, h) => {
    if (!h.buyPrice || !h.qty) return sum;
    return sum + h.buyPrice * h.qty;
  }, 0);
  const portfolioDividendYield = totalInvested > 0 ? (totalAnnualDividend / totalInvested * 100) : 0;

  // Record daily snapshot + daily return alert
  useEffect(() => {
    if (totalValue > 0 && Object.keys(prices).length > 0) {
      recordSnapshot(totalValue, totalPnl, activePfId);

      // Daily return alert
      const hist = loadHistory(activePfId);
      if (hist.length >= 2) {
        const today = hist[hist.length - 1];
        const yesterday = hist[hist.length - 2];
        if (yesterday.value > 0 && today.date !== yesterday.date) {
          const dailyReturn = ((today.value - yesterday.value) / yesterday.value) * 100;
          const threshold = parseFloat(localStorage.getItem('pulse_pf_alert_threshold') || '3');
          const alertKey = `pf_daily_${today.date}`;
          const alerted = localStorage.getItem(alertKey);
          if (Math.abs(dailyReturn) >= threshold && !alerted && shouldNotify('portfolio')) {
            localStorage.setItem(alertKey, '1');
            addNotification({
              type: 'portfolio',
              title: dailyReturn > 0 ? t('portfolio.dailySurgeTitle') : t('portfolio.dailyDropTitle'),
              body: t('portfolio.dailyReturnBody').replace('{return}', `${dailyReturn > 0 ? '+' : ''}${dailyReturn.toFixed(2)}`).replace('{value}', fmt(today.value - yesterday.value)),
            });
          }
        }
      }
    }
  }, [totalValue, totalPnl, prices]);

  const history = loadHistory(activePfId);
  const activePf = pfList.find(p => p.id === activePfId) || pfList[0];
  const displayPortfolioName = (pf) => (pf?.id === 'default' && pf.name === '기본 포트폴리오') ? t('portfolio.defaultPortfolio') : pf?.name;

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6">
      {/* Portfolio Tabs */}
      <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
        {pfList.map(pf => (
          <div key={pf.id} className="flex items-center gap-0 shrink-0">
            {renamingPf === pf.id ? (
              <form onSubmit={(e) => { e.preventDefault(); confirmRenamePf(); }} className="flex items-center gap-1">
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="text-xs px-2 py-1 rounded w-24"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                  autoFocus
                  onBlur={confirmRenamePf}
                />
              </form>
            ) : (
              <button
                onClick={() => switchPortfolio(pf.id)}
                onDoubleClick={() => startRenamePf(pf)}
                className="px-3 py-1.5 text-xs rounded-lg transition-colors"
                style={{
                  background: activePfId === pf.id ? 'var(--text-primary)' : 'var(--bg-hover)',
                  color: activePfId === pf.id ? 'var(--bg-primary)' : 'var(--text-muted)',
                  fontWeight: activePfId === pf.id ? 600 : 400,
                  border: `1px solid ${activePfId === pf.id ? 'transparent' : 'var(--border)'}`,
                }}
                title={t('portfolio.renameHint')}
              >
                {displayPortfolioName(pf)}
              </button>
            )}
            {activePfId === pf.id && pfList.length > 1 && (
              <button
                onClick={() => deletePortfolio(pf.id)}
                className="text-[10px] px-1 py-0.5 rounded ml-0.5 opacity-40 hover:opacity-100 transition-opacity"
                style={{ color: '#ef4444' }}
                title={t('portfolio.deletePortfolio')}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addPortfolio}
          className="px-2 py-1.5 text-xs rounded-lg transition-colors shrink-0"
          style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px dashed var(--border)' }}
          title={t('portfolio.addPortfolio')}
        >
          +
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">💼 {displayPortfolioName(activePf) || t('portfolio.titleFallback')}</h2>
          {hasPnl && (
            <p className="text-sm mt-1" style={{ color: pctColor(totalPnl) }}>
              {t('portfolio.totalPnl')}: {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}{t('portfolio.currencyWon')}
              {showUsd && usdkrw > 0 && (
                <span className="text-[10px] ml-1.5" style={{ color: 'var(--text-muted)', opacity: 0.8 }}>
                  (${(totalPnl / usdkrw).toLocaleString('en-US', { maximumFractionDigits: 0 })})
                </span>
              )}
              {totalAnnualDividend > 0 && (
                <span className="text-[9px] ml-2 px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
                  💰 {t('portfolio.annualDividend')} {fmt(totalAnnualDividend)}{t('portfolio.currencyWon')} ({portfolioDividendYield.toFixed(2)}%)
                </span>
              )}
              <span className="text-[9px] ml-2 px-1.5 py-0.5 rounded cursor-pointer" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
                title={t('portfolio.dailyAlertTitle')}
                onClick={() => {
                  const cur = localStorage.getItem('pulse_pf_alert_threshold') || '3';
                  const val = prompt(`${t('portfolio.dailyAlertPrompt')}`, cur);
                  if (val && !isNaN(parseFloat(val))) localStorage.setItem('pulse_pf_alert_threshold', val);
                }}
              >
                🔔 ±{localStorage.getItem('pulse_pf_alert_threshold') || '3'}% {t('portfolio.dailyAlertBadge')}
              </span>
            </p>
          )}
          {totalValue > 0 && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {t('portfolio.totalValue')}: {fmt(totalValue)}{t('portfolio.currencyWon')}
              {showUsd && usdkrw > 0 && (
                <span className="ml-1.5" style={{ opacity: 0.8 }}>
                  (${(totalValue / usdkrw).toLocaleString('en-US', { maximumFractionDigits: 0 })})
                </span>
              )}
              {usdkrw > 0 && (
                <span className="text-[9px] ml-1 px-1 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', opacity: 0.6 }}>
                  ₩{fmt(usdkrw)}/$
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {usdkrw > 0 && (
            <button
              onClick={() => { const next = !showUsd; setShowUsd(next); localStorage.setItem('pulse_pf_show_usd', next ? '1' : '0'); }}
              className="px-2 py-1.5 text-[10px] sm:text-xs rounded-lg transition-colors"
              style={{
                background: showUsd ? 'rgba(59,130,246,0.15)' : 'var(--bg-hover)',
                color: showUsd ? '#3b82f6' : 'var(--text-muted)',
                border: `1px solid ${showUsd ? 'rgba(59,130,246,0.3)' : 'var(--border)'}`,
              }}
              title={t('portfolio.usdToggle')}
            >
              💱 USD
            </button>
          )}
          <button
            onClick={() => {
              const csv = [t('portfolio.csvHeader')];
              for (const h of holdings) {
                csv.push([
                  h.symbol, h.name, h.buyPrice ?? '', h.qty ?? '',
                  `"${(h.memo || '').replace(/"/g, '""')}"`,
                  h.stopLoss ?? '', h.takeProfit ?? '', h.dividend ?? ''
                ].join(','));
              }
              const blob = new Blob(['\uFEFF' + csv.join('\n')], { type: 'text/csv;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `portfolio_${activePfId}_${new Date().toISOString().slice(0,10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="px-2 py-1.5 text-[10px] sm:text-xs rounded-lg transition-colors"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            title={t('portfolio.exportCsv')}
          >
            📥 CSV
          </button>
          <label
            className="px-2 py-1.5 text-[10px] sm:text-xs rounded-lg transition-colors cursor-pointer"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
            title={t('portfolio.importCsv')}
          >
            📤 {t('portfolio.import')}
            <input type="file" accept=".csv" className="hidden" onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const text = ev.target.result;
                const lines = text.split('\n').filter(l => l.trim());
                if (lines.length < 2) return;
                const imported = [];
                for (let i = 1; i < lines.length; i++) {
                  // Parse CSV with quoted fields support
                  const parts = [];
                  let current = '', inQuotes = false;
                  for (const ch of lines[i]) {
                    if (ch === '"') { inQuotes = !inQuotes; }
                    else if (ch === ',' && !inQuotes) { parts.push(current.trim()); current = ''; }
                    else { current += ch; }
                  }
                  parts.push(current.trim());
                  const [symbol, name, buyPrice, qty, memo, stopLoss, takeProfit, dividend] = parts;
                  if (!symbol && !name) continue;
                  imported.push({
                    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
                    symbol: symbol || name,
                    name: name || symbol,
                    buyPrice: buyPrice ? parseFloat(buyPrice) : null,
                    qty: qty ? parseFloat(qty) : null,
                    memo: memo || '',
                    stopLoss: stopLoss ? parseFloat(stopLoss) : null,
                    takeProfit: takeProfit ? parseFloat(takeProfit) : null,
                    dividend: dividend ? parseFloat(dividend) : null,
                    addedAt: new Date().toISOString(),
                  });
                }
                if (imported.length > 0) {
                  const merge = confirm(t('portfolio.importConfirm').replace('{count}', imported.length));
                  const next = merge ? [...holdings, ...imported] : imported;
                  setHoldings(next);
                  savePortfolio(next, activePfId);
                }
              };
              reader.readAsText(file);
              e.target.value = '';
            }} />
          </label>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            {showAdd ? t('portfolio.cancel') : t('portfolio.add')}
          </button>
        </div>
      </div>

      {/* Performance Chart */}
      <PortfolioChart history={history} t={t} />

      {/* Returns Calendar Heatmap */}
      <ReturnCalendar history={history} t={t} />

      {/* Allocation Donut Chart */}
      <AllocationChart holdings={holdings} prices={prices} t={t} />

      {/* Allocation Recommendation */}
      <AllocationRecommendation holdings={holdings} prices={prices} t={t} />

      {/* Sector Heatmap */}
      <SectorHeatmap holdings={holdings} prices={prices} t={t} />

      {/* Trade Log */}
      <TradeLogSection pfId={activePfId} t={t} />

      {/* Holdings Related News */}
      <HoldingsNews holdings={holdings} t={t} />

      {/* Add Form */}
      {showAdd && (
        <div className="mb-4 p-3 sm:p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESETS.map(p => (
              <button
                key={p.symbol}
                onClick={() => selectPreset(p)}
                className="px-2 py-1 text-xs rounded-md transition-colors"
                style={{
                  background: form.symbol === p.symbol ? 'var(--text-primary)' : 'var(--bg-hover)',
                  color: form.symbol === p.symbol ? 'var(--bg-primary)' : 'var(--text-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                {t(`portfolio.presets.${p.symbol}`)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <input
              placeholder={t('portfolio.formSymbol')}
              value={form.symbol}
              onChange={e => setForm({ ...form, symbol: e.target.value })}
              className="px-2 py-1.5 text-xs sm:text-sm rounded-md"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
            <input
              placeholder={t('portfolio.formName')}
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="px-2 py-1.5 text-xs sm:text-sm rounded-md"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
            <input
              placeholder={t('portfolio.formBuyPrice')}
              type="number"
              value={form.buyPrice}
              onChange={e => setForm({ ...form, buyPrice: e.target.value })}
              className="px-2 py-1.5 text-xs sm:text-sm rounded-md"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
            <input
              placeholder={t('portfolio.formQty')}
              type="number"
              value={form.qty}
              onChange={e => setForm({ ...form, qty: e.target.value })}
              className="px-2 py-1.5 text-xs sm:text-sm rounded-md"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <select
              value={form.targetDir}
              onChange={e => setForm({ ...form, targetDir: e.target.value })}
              className="px-2 py-1.5 text-xs sm:text-sm rounded-md"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            >
              <option value="above">{t('portfolio.targetAboveOption')}</option>
              <option value="below">{t('portfolio.targetBelowOption')}</option>
            </select>
            <input
              placeholder={t('portfolio.targetPricePlaceholder')}
              type="number"
              value={form.targetPrice}
              onChange={e => setForm({ ...form, targetPrice: e.target.value })}
              className="px-2 py-1.5 text-xs sm:text-sm rounded-md"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="flex gap-2">
            <input
              placeholder={t('portfolio.stopLossPlaceholder')}
              type="number"
              value={form.stopLoss}
              onChange={e => setForm({ ...form, stopLoss: e.target.value })}
              className="flex-1 px-2 py-1.5 text-xs sm:text-sm rounded-md"
              style={{ background: 'var(--bg-primary)', color: '#ef4444', border: '1px solid var(--border)' }}
            />
            <input
              placeholder={t('portfolio.takeProfitPlaceholder')}
              type="number"
              value={form.takeProfit}
              onChange={e => setForm({ ...form, takeProfit: e.target.value })}
              className="flex-1 px-2 py-1.5 text-xs sm:text-sm rounded-md"
              style={{ background: 'var(--bg-primary)', color: '#22c55e', border: '1px solid var(--border)' }}
            />
            <input
              placeholder={t('portfolio.dividendPlaceholder')}
              type="number"
              value={form.dividend}
              onChange={e => setForm({ ...form, dividend: e.target.value })}
              className="flex-1 px-2 py-1.5 text-xs sm:text-sm rounded-md"
              style={{ background: 'var(--bg-primary)', color: '#f59e0b', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="flex gap-2">
            <input
              placeholder={t('portfolio.memoPlaceholder')}
              value={form.memo}
              onChange={e => setForm({ ...form, memo: e.target.value })}
              className="flex-1 px-2 py-1.5 text-xs sm:text-sm rounded-md"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
            <button
              onClick={addHolding}
              className="px-4 py-1.5 text-xs sm:text-sm rounded-md font-medium"
              style={{ background: 'var(--text-primary)', color: 'var(--bg-primary)' }}
            >
              {t('portfolio.formAdd')}
            </button>
          </div>
        </div>
      )}

      {/* Holdings List */}
      {holdings.length === 0 ? (
        <div className="text-center py-12 sm:py-16" style={{ color: 'var(--text-muted)' }}>
          <div className="text-3xl sm:text-4xl mb-3">📊</div>
          <p className="text-sm sm:text-base">{t('portfolio.emptyTitle')}</p>
          <p className="text-xs mt-1" style={{ opacity: 0.6 }}>{t('portfolio.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {holdings.map((h, idx) => {
            const p = prices[h.symbol];
            const pnl = (p && h.buyPrice && h.qty) ? (p.price - h.buyPrice) * h.qty : null;
            const pnlPct = (p && h.buyPrice) ? ((p.price - h.buyPrice) / h.buyPrice * 100) : null;
            const isDragging = dragIdx === idx;
            const isDragOver = dragOverIdx === idx && dragIdx !== idx;

            return (
              <div
                key={h.id}
                draggable
                onDragStart={handleDragStart(idx)}
                onDragOver={handleDragOver(idx)}
                onDrop={handleDrop(idx)}
                onDragEnd={handleDragEnd}
                className="flex items-center justify-between p-3 sm:p-4 rounded-xl transition-all"
                style={{
                  background: 'var(--bg-card)',
                  border: isDragOver ? '1px solid var(--text-primary)' : '1px solid var(--border)',
                  opacity: isDragging ? 0.4 : 1,
                  transform: isDragOver ? 'scale(1.01)' : 'none',
                  cursor: 'grab',
                }}
              >
                {/* Drag handle */}
                <div className="flex items-center mr-2 sm:mr-3 select-none" style={{ color: 'var(--text-muted)', cursor: 'grab' }} title={t('portfolio.dragReorder')}>
                  <span className="text-xs leading-none">⠿</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm sm:text-base truncate">{h.name}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{h.symbol}</span>
                  </div>
                  {editingId === h.id && editField === 'memo' ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        autoFocus
                        value={editMemo}
                        onChange={e => setEditMemo(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { updateHolding(h.id, { memo: editMemo }); setEditingId(null); setEditField(null); }
                          if (e.key === 'Escape') { setEditingId(null); setEditField(null); }
                        }}
                        className="flex-1 px-1.5 py-0.5 text-xs rounded"
                        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }}
                        placeholder={t('portfolio.memoInputPlaceholder')}
                      />
                      <button onClick={() => { updateHolding(h.id, { memo: editMemo }); setEditingId(null); setEditField(null); }} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>✓</button>
                    </div>
                  ) : (
                    <p
                      className="text-xs mt-0.5 cursor-pointer hover:underline"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => { setEditingId(h.id); setEditField('memo'); setEditMemo(h.memo || ''); }}
                      title={t('portfolio.editMemoTitle')}
                    >
                      {h.memo || t('portfolio.addMemo')}
                    </p>
                  )}
                  {editingId === h.id && editField === 'trade' ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        autoFocus
                        type="number"
                        value={editBuyPrice}
                        onChange={e => setEditBuyPrice(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            updateHolding(h.id, { buyPrice: editBuyPrice ? parseFloat(editBuyPrice) : null, qty: editQty ? parseFloat(editQty) : null });
                            setEditingId(null); setEditField(null);
                          }
                          if (e.key === 'Escape') { setEditingId(null); setEditField(null); }
                        }}
                        className="w-20 px-1.5 py-0.5 text-xs rounded"
                        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }}
                        placeholder={t('portfolio.formBuyPrice')}
                      />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>×</span>
                      <input
                        type="number"
                        value={editQty}
                        onChange={e => setEditQty(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            updateHolding(h.id, { buyPrice: editBuyPrice ? parseFloat(editBuyPrice) : null, qty: editQty ? parseFloat(editQty) : null });
                            setEditingId(null); setEditField(null);
                          }
                          if (e.key === 'Escape') { setEditingId(null); setEditField(null); }
                        }}
                        className="w-16 px-1.5 py-0.5 text-xs rounded"
                        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }}
                        placeholder={t('portfolio.formQty')}
                      />
                      <button onClick={() => {
                        updateHolding(h.id, { buyPrice: editBuyPrice ? parseFloat(editBuyPrice) : null, qty: editQty ? parseFloat(editQty) : null });
                        setEditingId(null); setEditField(null);
                      }} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>✓</button>
                    </div>
                  ) : (
                    <p
                      className="text-xs mt-0.5 cursor-pointer hover:underline"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => { setEditingId(h.id); setEditField('trade'); setEditBuyPrice(h.buyPrice ? String(h.buyPrice) : ''); setEditQty(h.qty ? String(h.qty) : ''); }}
                      title={t('portfolio.editTradeTitle')}
                    >
                      {h.buyPrice ? `${t('portfolio.buy')} ${fmt(h.buyPrice)} × ${h.qty || '-'}` : t('portfolio.enterBuyQty')}
                    </p>
                  )}
                  {/* Target Price */}
                  {editingId === h.id && editField === 'target' ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <select
                        value={editTargetDir}
                        onChange={e => setEditTargetDir(e.target.value)}
                        className="px-1 py-0.5 text-xs rounded"
                        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }}
                      >
                        <option value="above">{t('portfolio.aboveShort')}</option>
                        <option value="below">{t('portfolio.belowShort')}</option>
                      </select>
                      <input
                        autoFocus
                        type="number"
                        value={editTargetPrice}
                        onChange={e => setEditTargetPrice(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { updateHolding(h.id, { targetPrice: editTargetPrice ? parseFloat(editTargetPrice) : null, targetDir: editTargetDir }); setEditingId(null); setEditField(null); }
                          if (e.key === 'Escape') { setEditingId(null); setEditField(null); }
                        }}
                        className="w-24 px-1.5 py-0.5 text-xs rounded"
                        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }}
                        placeholder={t('portfolio.targetPrice')}
                      />
                      <button onClick={() => { updateHolding(h.id, { targetPrice: editTargetPrice ? parseFloat(editTargetPrice) : null, targetDir: editTargetDir }); setEditingId(null); setEditField(null); }} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>✓</button>
                      {h.targetPrice && <button onClick={() => { updateHolding(h.id, { targetPrice: null, targetDir: null }); setEditingId(null); setEditField(null); }} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(220,38,38,0.15)', color: '#ef4444' }}>{t('portfolio.delete')}</button>}
                    </div>
                  ) : (
                    <p
                      className="text-xs mt-0.5 cursor-pointer hover:underline"
                      style={{ color: h.targetPrice ? ((() => { const cur = prices[h.symbol]?.price; const hit = h.targetDir === 'below' ? cur <= h.targetPrice : cur >= h.targetPrice; return hit ? '#22c55e' : '#f59e0b'; })()) : 'var(--text-muted)' }}
                      onClick={() => { setEditingId(h.id); setEditField('target'); setEditTargetPrice(h.targetPrice ? String(h.targetPrice) : ''); setEditTargetDir(h.targetDir || 'above'); }}
                      title={t('portfolio.editTargetTitle')}
                    >
                      {h.targetPrice ? (() => {
                        const cur = prices[h.symbol]?.price;
                        const dir = h.targetDir || 'above';
                        const hit = cur && (dir === 'above' ? cur >= h.targetPrice : cur <= h.targetPrice);
                        const label = dir === 'above' ? '↑' : '↓';
                        return t('portfolio.targetDisplay')
                          .replace('{target}', fmt(h.targetPrice))
                          .replace('{label}', label)
                          .replace('{status}', hit ? t('portfolio.reached') : `(${cur ? ((h.targetPrice - cur) / cur * 100).toFixed(1) : '?'}%)`);
                      })() : t('portfolio.setTarget')}
                    </p>
                  )}
                  {/* Stop-loss / Take-profit display */}
                  {/* Dividend display */}
                  {h.dividend != null && h.dividend > 0 && (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className="text-[9px] px-1 py-0.5 rounded cursor-pointer"
                        style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const val = prompt(t('portfolio.dividendPromptCurrent').replace('{name}', h.name).replace('{value}', h.dividend), h.dividend);
                          if (val !== null) updateHolding(h.id, { dividend: val ? parseFloat(val) : null });
                        }}
                        title={t('portfolio.editDividendTitle')}
                      >
                        {t('portfolio.dividendPerShare').replace('{value}', fmt(h.dividend))}
                        {h.qty ? ` · ${t('portfolio.annualAmount').replace('{value}', fmt(h.dividend * h.qty))}` : ''}
                        {h.buyPrice && h.buyPrice > 0 ? ` · ${(h.dividend / h.buyPrice * 100).toFixed(2)}%` : ''}
                      </span>
                    </div>
                  )}
                  {!h.dividend && (
                    <p
                      className="text-[9px] mt-0.5 cursor-pointer hover:underline"
                      style={{ color: 'var(--text-muted)', opacity: 0.5 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const val = prompt(t('portfolio.dividendPrompt').replace('{name}', h.name));
                        if (val && parseFloat(val) > 0) updateHolding(h.id, { dividend: parseFloat(val) });
                      }}
                    >
                      {t('portfolio.setDividend')}
                    </p>
                  )}
                  {(h.stopLoss != null || h.takeProfit != null) && (() => {
                    const pnlPct = (h.buyPrice && p) ? ((p.price - h.buyPrice) / h.buyPrice) * 100 : null;
                    return (
                      <div className="flex gap-2 mt-0.5">
                        {h.stopLoss != null && (
                          <span className="text-[9px] px-1 py-0.5 rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              const val = prompt(t('portfolio.stopLossPrompt').replace('{name}', h.name).replace('{value}', h.stopLoss), h.stopLoss);
                              if (val !== null) updateHolding(h.id, { stopLoss: val ? parseFloat(val) : null });
                            }}
                            title={t('portfolio.editStopLossTitle')}
                            style={{ cursor: 'pointer', background: (pnlPct != null && pnlPct <= h.stopLoss) ? 'rgba(220,38,38,0.2)' : 'rgba(220,38,38,0.08)', color: '#ef4444' }}
                          >
                            {t('portfolio.stopLossBadge').replace('{value}', h.stopLoss)}{pnlPct != null && pnlPct <= h.stopLoss ? ' ⚠️' : ''}
                          </span>
                        )}
                        {h.takeProfit != null && (
                          <span className="text-[9px] px-1 py-0.5 rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              const val = prompt(t('portfolio.takeProfitPrompt').replace('{name}', h.name).replace('{value}', h.takeProfit), h.takeProfit);
                              if (val !== null) updateHolding(h.id, { takeProfit: val ? parseFloat(val) : null });
                            }}
                            title={t('portfolio.editTakeProfitTitle')}
                            style={{ cursor: 'pointer', background: (pnlPct != null && pnlPct >= h.takeProfit) ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.08)', color: '#22c55e' }}
                          >
                            {t('portfolio.takeProfitBadge').replace('{value}', h.takeProfit)}{pnlPct != null && pnlPct >= h.takeProfit ? ' 🎉' : ''}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="text-right ml-3">
                  {p ? (
                    <>
                      <div className="font-mono text-sm sm:text-base font-semibold">{fmt(p.price)}</div>
                      <div className="text-xs" style={{ color: pctColor(p.pct) }}>
                        {p.pct > 0 ? '+' : ''}{p.pct?.toFixed(2)}%
                      </div>
                      {pnl != null && (
                        <div className="text-xs font-medium" style={{ color: pctColor(pnl) }}>
                          {pnl >= 0 ? '+' : ''}{fmt(pnl)}{t('portfolio.currencyWon')} ({pnlPct >= 0 ? '+' : ''}{pnlPct?.toFixed(1)}%)
                          {showUsd && usdkrw > 0 && (
                            <span className="text-[9px] ml-1" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                              ${(pnl / usdkrw).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('portfolio.noPrice')}</div>
                  )}
                </div>
                <button
                  onClick={() => removeHolding(h.id)}
                  className="ml-2 p-1 rounded hover:opacity-60 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                  title={t('portfolio.delete')}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {loading && (
        <div className="text-center text-xs mt-4" style={{ color: 'var(--text-muted)' }}>
          {t('portfolio.loadingPrices')}
        </div>
      )}
    </div>
  );
}
