import { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY = 'pulse_portfolio';
const HISTORY_KEY = 'pulse_portfolio_history';

const PRESETS = [
  { symbol: 'KOSPI', name: '코스피', type: 'index' },
  { symbol: 'KOSDAQ', name: '코스닥', type: 'index' },
  { symbol: 'BTC', name: '비트코인', type: 'crypto' },
  { symbol: 'ETH', name: '이더리움', type: 'crypto' },
  { symbol: 'USD/KRW', name: '달러/원', type: 'fx' },
  { symbol: 'JPY/KRW', name: '엔/원', type: 'fx' },
];

function loadPortfolio() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePortfolio(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(h) {
  // Keep last 90 days max
  const trimmed = h.slice(-90);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}
function recordSnapshot(totalValue, totalPnl) {
  if (totalValue === 0) return;
  const today = new Date().toISOString().slice(0, 10);
  const history = loadHistory();
  const existing = history.findIndex(h => h.date === today);
  const entry = { date: today, value: Math.round(totalValue), pnl: Math.round(totalPnl) };
  if (existing >= 0) {
    history[existing] = entry;
  } else {
    history.push(entry);
  }
  saveHistory(history);
}

function PortfolioChart({ history }) {
  const canvasRef = useRef(null);
  const w = 460, h = 140;

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

    const values = history.map(d => d.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const isUp = values[values.length - 1] >= values[0];
    const lineColor = isUp ? '#22c55e' : '#ef4444';

    // Grid
    ctx.strokeStyle = 'rgba(128,128,128,0.12)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 3; i++) {
      const y = pad.top + (ch / 3) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + cw, y);
      ctx.stroke();
      const val = max - (range / 3) * i;
      ctx.fillStyle = 'rgba(128,128,128,0.5)';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(val >= 10000 ? `${(val / 10000).toFixed(0)}만` : fmt(val), pad.left - 5, y + 3);
    }

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

    // Area
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad.left + (i / (values.length - 1)) * cw;
      const y = pad.top + ch - ((v - min) / range) * ch;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + cw, pad.top + ch);
    ctx.lineTo(pad.left, pad.top + ch);
    ctx.closePath();
    ctx.fillStyle = lineColor + '12';
    ctx.fill();

    // Line
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad.left + (i / (values.length - 1)) * cw;
      const y = pad.top + ch - ((v - min) / range) * ch;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // End dot
    const lastX = pad.left + cw;
    const lastY = pad.top + ch - ((values[values.length - 1] - min) / range) * ch;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = lineColor;
    ctx.fill();
  }, [history]);

  if (history.length < 2) return null;

  const first = history[0].value;
  const last = history[history.length - 1].value;
  const totalReturn = ((last - first) / first * 100);

  return (
    <div className="mb-4 p-3 sm:p-4 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>📈 포트폴리오 추이</span>
        <span className="text-xs font-medium" style={{ color: totalReturn >= 0 ? '#22c55e' : '#ef4444' }}>
          {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(1)}% ({history.length}일)
        </span>
      </div>
      <div className="flex justify-center overflow-x-auto">
        <canvas ref={canvasRef} style={{ width: w, height: h, maxWidth: '100%' }} />
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const [holdings, setHoldings] = useState(loadPortfolio);
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ symbol: '', name: '', buyPrice: '', qty: '', memo: '' });
  const [editingId, setEditingId] = useState(null);
  const [editMemo, setEditMemo] = useState('');

  // Fetch live prices
  const fetchPrices = useCallback(async () => {
    if (holdings.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/market');
      const data = await res.json();
      const p = {};
      // Map market data to symbols
      if (data.indices) {
        for (const idx of data.indices) {
          if (idx.code === 'KOSPI') p['KOSPI'] = { price: parseFloat(idx.price?.replace(/,/g, '')), change: parseFloat(idx.change), pct: parseFloat(idx.pct) };
          if (idx.code === 'KOSDAQ') p['KOSDAQ'] = { price: parseFloat(idx.price?.replace(/,/g, '')), change: parseFloat(idx.change), pct: parseFloat(idx.pct) };
        }
      }
      if (data.fx) {
        for (const f of data.fx) {
          if (f.code === 'USD/KRW' || f.code === 'FX_USDKRW') p['USD/KRW'] = { price: parseFloat(f.price?.replace(/,/g, '')), change: parseFloat(f.change), pct: parseFloat(f.pct) };
          if (f.code === 'JPY/KRW' || f.code === 'FX_JPYKRW') p['JPY/KRW'] = { price: parseFloat(f.price?.replace(/,/g, '')), change: parseFloat(f.change), pct: parseFloat(f.pct) };
        }
      }
      if (data.crypto) {
        for (const c of data.crypto) {
          if (c.code === 'BTC' || c.code === 'KRW-BTC') p['BTC'] = { price: parseFloat(c.price?.replace(/,/g, '')), change: parseFloat(c.change), pct: parseFloat(c.pct) };
          if (c.code === 'ETH' || c.code === 'KRW-ETH') p['ETH'] = { price: parseFloat(c.price?.replace(/,/g, '')), change: parseFloat(c.change), pct: parseFloat(c.pct) };
        }
      }
      setPrices(p);
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
      addedAt: new Date().toISOString(),
    };
    const next = [...holdings, item];
    setHoldings(next);
    savePortfolio(next);
    setForm({ symbol: '', name: '', buyPrice: '', qty: '', memo: '' });
    setShowAdd(false);
  };

  const removeHolding = (id) => {
    const next = holdings.filter(h => h.id !== id);
    setHoldings(next);
    savePortfolio(next);
  };

  const updateHolding = (id, updates) => {
    const next = holdings.map(h => h.id === id ? { ...h, ...updates } : h);
    setHoldings(next);
    savePortfolio(next);
  };

  const selectPreset = (preset) => {
    setForm({ ...form, symbol: preset.symbol, name: preset.name });
  };

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

  // Record daily snapshot
  useEffect(() => {
    if (totalValue > 0 && Object.keys(prices).length > 0) {
      recordSnapshot(totalValue, totalPnl);
    }
  }, [totalValue, totalPnl, prices]);

  const history = loadHistory();

  return (
    <div className="px-4 sm:px-6 py-4 sm:py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-bold">💼 포트폴리오</h2>
          {hasPnl && (
            <p className="text-sm mt-1" style={{ color: pctColor(totalPnl) }}>
              총 손익: {totalPnl >= 0 ? '+' : ''}{fmt(totalPnl)}원
            </p>
          )}
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 text-xs sm:text-sm rounded-lg transition-colors"
          style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
        >
          {showAdd ? '취소' : '+ 추가'}
        </button>
      </div>

      {/* Performance Chart */}
      <PortfolioChart history={history} />

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
                {p.name}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <input
              placeholder="종목코드"
              value={form.symbol}
              onChange={e => setForm({ ...form, symbol: e.target.value })}
              className="px-2 py-1.5 text-xs sm:text-sm rounded-md"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
            <input
              placeholder="종목명"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="px-2 py-1.5 text-xs sm:text-sm rounded-md"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
            <input
              placeholder="매수가"
              type="number"
              value={form.buyPrice}
              onChange={e => setForm({ ...form, buyPrice: e.target.value })}
              className="px-2 py-1.5 text-xs sm:text-sm rounded-md"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
            <input
              placeholder="수량"
              type="number"
              value={form.qty}
              onChange={e => setForm({ ...form, qty: e.target.value })}
              className="px-2 py-1.5 text-xs sm:text-sm rounded-md"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            />
          </div>
          <div className="flex gap-2">
            <input
              placeholder="메모 (선택)"
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
              추가
            </button>
          </div>
        </div>
      )}

      {/* Holdings List */}
      {holdings.length === 0 ? (
        <div className="text-center py-12 sm:py-16" style={{ color: 'var(--text-muted)' }}>
          <div className="text-3xl sm:text-4xl mb-3">📊</div>
          <p className="text-sm sm:text-base">보유 종목이 없습니다</p>
          <p className="text-xs mt-1" style={{ opacity: 0.6 }}>위의 + 추가 버튼으로 종목을 등록하세요</p>
        </div>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {holdings.map(h => {
            const p = prices[h.symbol];
            const pnl = (p && h.buyPrice && h.qty) ? (p.price - h.buyPrice) * h.qty : null;
            const pnlPct = (p && h.buyPrice) ? ((p.price - h.buyPrice) / h.buyPrice * 100) : null;

            return (
              <div
                key={h.id}
                className="flex items-center justify-between p-3 sm:p-4 rounded-xl transition-colors"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm sm:text-base truncate">{h.name}</span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{h.symbol}</span>
                  </div>
                  {editingId === h.id ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        autoFocus
                        value={editMemo}
                        onChange={e => setEditMemo(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { updateHolding(h.id, { memo: editMemo }); setEditingId(null); }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="flex-1 px-1.5 py-0.5 text-xs rounded"
                        style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', outline: 'none' }}
                        placeholder="메모 입력..."
                      />
                      <button onClick={() => { updateHolding(h.id, { memo: editMemo }); setEditingId(null); }} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>✓</button>
                    </div>
                  ) : (
                    <p
                      className="text-xs mt-0.5 cursor-pointer hover:underline"
                      style={{ color: 'var(--text-muted)' }}
                      onClick={() => { setEditingId(h.id); setEditMemo(h.memo || ''); }}
                      title="클릭하여 메모 수정"
                    >
                      {h.memo || '메모 추가...'}
                    </p>
                  )}
                  {h.buyPrice && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      매수 {fmt(h.buyPrice)} × {h.qty || '-'}
                    </p>
                  )}
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
                          {pnl >= 0 ? '+' : ''}{fmt(pnl)}원 ({pnlPct >= 0 ? '+' : ''}{pnlPct?.toFixed(1)}%)
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>시세 없음</div>
                  )}
                </div>
                <button
                  onClick={() => removeHolding(h.id)}
                  className="ml-2 p-1 rounded hover:opacity-60 transition-opacity"
                  style={{ color: 'var(--text-muted)' }}
                  title="삭제"
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
          시세 불러오는 중...
        </div>
      )}
    </div>
  );
}
