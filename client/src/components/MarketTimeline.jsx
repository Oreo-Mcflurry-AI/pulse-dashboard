import { useState, useEffect, useRef, useCallback } from 'react';

const MARKETS = [
  { id: 'nzx', name: 'NZX', city: '웰링턴', tz: 'Pacific/Auckland', open: [10, 0], close: [16, 45], color: '#06b6d4', flag: '🇳🇿' },
  { id: 'asx', name: 'ASX', city: '시드니', tz: 'Australia/Sydney', open: [10, 0], close: [16, 0], color: '#f59e0b', flag: '🇦🇺' },
  { id: 'tse', name: 'TSE', city: '도쿄', tz: 'Asia/Tokyo', open: [9, 0], close: [15, 30], color: '#ef4444', flag: '🇯🇵' },
  { id: 'shcomp', name: 'SSE', city: '상하이', tz: 'Asia/Shanghai', open: [9, 30], close: [15, 0], color: '#dc2626', flag: '🇨🇳' },
  { id: 'hsi', name: 'HKEX', city: '홍콩', tz: 'Asia/Hong_Kong', open: [9, 30], close: [16, 0], color: '#f97316', flag: '🇭🇰' },
  { id: 'krx', name: 'KRX', city: '서울', tz: 'Asia/Seoul', open: [9, 0], close: [15, 30], color: '#3b82f6', flag: '🇰🇷', highlight: true },
  { id: 'sensex', name: 'BSE', city: '뭄바이', tz: 'Asia/Kolkata', open: [9, 15], close: [15, 30], color: '#f97316', flag: '🇮🇳' },
  { id: 'moex', name: 'MOEX', city: '모스크바', tz: 'Europe/Moscow', open: [10, 0], close: [18, 50], color: '#6366f1', flag: '🇷🇺' },
  { id: 'tadawul', name: 'Tadawul', city: '리야드', tz: 'Asia/Riyadh', open: [10, 0], close: [15, 0], color: '#10b981', flag: '🇸🇦' },
  { id: 'jse', name: 'JSE', city: '요하네스버그', tz: 'Africa/Johannesburg', open: [9, 0], close: [17, 0], color: '#eab308', flag: '🇿🇦' },
  { id: 'lse', name: 'LSE', city: '런던', tz: 'Europe/London', open: [8, 0], close: [16, 30], color: '#8b5cf6', flag: '🇬🇧' },
  { id: 'euronext', name: 'Euronext', city: '파리', tz: 'Europe/Paris', open: [9, 0], close: [17, 30], color: '#0ea5e9', flag: '🇫🇷' },
  { id: 'xetra', name: 'Xetra', city: '프랑크푸르트', tz: 'Europe/Berlin', open: [9, 0], close: [17, 30], color: '#64748b', flag: '🇩🇪' },
  { id: 'bvsp', name: 'B3', city: '상파울루', tz: 'America/Sao_Paulo', open: [10, 0], close: [17, 30], color: '#22c55e', flag: '🇧🇷' },
  { id: 'nyse', name: 'NYSE', city: '뉴욕', tz: 'America/New_York', open: [9, 30], close: [16, 0], color: '#3b82f6', flag: '🇺🇸', highlight: true },
  { id: 'nasdaq', name: 'NASDAQ', city: '뉴욕', tz: 'America/New_York', open: [9, 30], close: [16, 0], color: '#8b5cf6', flag: '🇺🇸', highlight: true },
  { id: 'tsx', name: 'TSX', city: '토론토', tz: 'America/Toronto', open: [9, 30], close: [16, 0], color: '#ef4444', flag: '🇨🇦' },
];

function getMarketStatus(market, now) {
  const localStr = now.toLocaleString('en-US', { timeZone: market.tz, hour12: false });
  const local = new Date(localStr);
  const h = local.getHours();
  const m = local.getMinutes();
  const day = local.getDay();
  const totalMin = h * 60 + m;
  const openMin = market.open[0] * 60 + market.open[1];
  const closeMin = market.close[0] * 60 + market.close[1];
  const isWeekday = day >= 1 && day <= 5;
  const isOpen = isWeekday && totalMin >= openMin && totalMin < closeMin;

  // Progress through trading day
  const progress = isOpen ? (totalMin - openMin) / (closeMin - openMin) : 0;

  // Time until next open/close
  let minutesUntil = 0;
  let nextEvent = '';
  if (isOpen) {
    minutesUntil = closeMin - totalMin;
    nextEvent = 'close';
  } else if (isWeekday && totalMin < openMin) {
    minutesUntil = openMin - totalMin;
    nextEvent = 'open';
  } else {
    // After close or weekend
    const daysToMon = day === 5 ? 3 : day === 6 ? 2 : day === 0 ? 1 : 1;
    minutesUntil = daysToMon * 1440 + openMin - totalMin;
    if (minutesUntil < 0) minutesUntil += 7 * 1440;
    nextEvent = 'open';
  }

  const localTimeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  return { isOpen, progress, minutesUntil, nextEvent, localTime: localTimeStr, day };
}

function fmtDuration(mins) {
  if (mins < 60) return `${mins}분`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    return `${d}일 ${h % 24}시간`;
  }
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

function TimelineBar({ markets, now }) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const rowsRef = useRef([]);
  const containerRef = useRef(null);
  const [width, setWidth] = useState(700);

  useEffect(() => {
    const measure = () => {
      if (containerRef.current) setWidth(Math.min(containerRef.current.offsetWidth - 8, 900));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const height = markets.length * 28 + 40;
  const padding = { top: 30, left: 120, right: 12, bottom: 8 };
  const chartW = width - padding.left - padding.right;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Current UTC hour for the 24h timeline
    const utcH = now.getUTCHours();
    const utcM = now.getUTCMinutes();

    // Draw 24h timeline header (UTC hours)
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'center';
    for (let h = 0; h < 24; h += 3) {
      const x = padding.left + (h / 24) * chartW;
      ctx.fillText(`${String(h).padStart(2, '0')}`, x, 12);
      // Vertical grid line
      ctx.strokeStyle = 'rgba(128,128,128,0.1)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 20);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
    }

    // "Now" line
    const nowX = padding.left + ((utcH + utcM / 60) / 24) * chartW;
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(nowX, 18);
    ctx.lineTo(nowX, height - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    // Now label
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 8px system-ui';
    ctx.fillText('NOW', nowX, 20);

    const rows = [];

    // Draw each market row
    markets.forEach((mkt, i) => {
      const y = padding.top + i * 28;
      const status = getMarketStatus(mkt, now);

      // Market label
      ctx.textAlign = 'right';
      ctx.font = mkt.highlight ? 'bold 10px system-ui' : '10px system-ui';
      ctx.fillStyle = status.isOpen ? mkt.color : (getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#888');
      ctx.fillText(`${mkt.flag} ${mkt.name}`, padding.left - 8, y + 13);

      // Calculate UTC open/close times
      // Convert local open/close to UTC by getting offset
      const refDate = new Date(now);
      const localStr = refDate.toLocaleString('en-US', { timeZone: mkt.tz, hour12: false });
      const localDate = new Date(localStr);
      const offsetMs = localDate.getTime() - refDate.getTime();
      const offsetH = offsetMs / 3600000;

      let utcOpen = (mkt.open[0] + mkt.open[1] / 60 - offsetH + 24) % 24;
      let utcClose = (mkt.close[0] + mkt.close[1] / 60 - offsetH + 24) % 24;

      const x1 = padding.left + (utcOpen / 24) * chartW;
      const x2 = padding.left + (utcClose / 24) * chartW;
      const barH = 16;
      const barY = y + 3;

      if (x2 > x1) {
        // Normal bar (doesn't wrap)
        ctx.fillStyle = status.isOpen ? mkt.color + '60' : mkt.color + '20';
        ctx.fillRect(x1, barY, x2 - x1, barH);
        ctx.strokeStyle = mkt.color + '80';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x1, barY, x2 - x1, barH);

        // Progress fill if open
        if (status.isOpen) {
          ctx.fillStyle = mkt.color + 'aa';
          ctx.fillRect(x1, barY, (x2 - x1) * status.progress, barH);
        }

        rows.push({ ...mkt, status, x: x1, y: barY, w: x2 - x1, h: barH });
      } else {
        // Wraps around midnight
        ctx.fillStyle = status.isOpen ? mkt.color + '60' : mkt.color + '20';
        ctx.fillRect(x1, barY, padding.left + chartW - x1, barH);
        ctx.fillRect(padding.left, barY, x2 - padding.left, barH);

        rows.push({ ...mkt, status, x: x1, y: barY, w: padding.left + chartW - x1, h: barH });
        rows.push({ ...mkt, status, x: padding.left, y: barY, w: x2 - padding.left, h: barH });
      }

      // Open/close time labels on bar
      if (Math.abs(x2 - x1) > 60 || x2 < x1) {
        ctx.fillStyle = mkt.color + 'cc';
        ctx.font = '7px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText(`${String(mkt.open[0]).padStart(2, '0')}:${String(mkt.open[1]).padStart(2, '0')}`, x1 + 2, barY + barH - 3);
        ctx.textAlign = 'right';
        const endX = x2 > x1 ? x2 : padding.left + chartW;
        ctx.fillText(`${String(mkt.close[0]).padStart(2, '0')}:${String(mkt.close[1]).padStart(2, '0')}`, endX - 2, barY + barH - 3);
      }
    });

    rowsRef.current = rows;
  }, [markets, now, width, height]);

  useEffect(() => { draw(); }, [draw]);

  const handleMouse = (e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = rowsRef.current.find(r => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
    setTooltip(hit ? { x: mx, y: my, data: hit } : null);
  };

  return (
    <div ref={containerRef} className="relative">
      <canvas
        ref={canvasRef}
        style={{ width, height, cursor: 'default' }}
        onMouseMove={handleMouse}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div
          className="absolute pointer-events-none px-3 py-2 rounded-lg text-xs z-10"
          style={{
            left: Math.min(tooltip.x + 12, width - 200),
            top: tooltip.y - 60,
            background: 'var(--bg-card)',
            border: `1px solid ${tooltip.data.color}40`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="font-bold">{tooltip.data.flag} {tooltip.data.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({tooltip.data.city})</span></div>
          <div className="mt-1 space-y-0.5" style={{ color: 'var(--text-muted)' }}>
            <div>현지시간: <span style={{ color: 'var(--text-primary)' }}>{tooltip.data.status.localTime}</span></div>
            <div>상태: <span style={{ color: tooltip.data.status.isOpen ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
              {tooltip.data.status.isOpen ? '🟢 장중' : '⚫ 장외'}
            </span></div>
            <div>거래시간: {String(tooltip.data.open[0]).padStart(2, '0')}:{String(tooltip.data.open[1]).padStart(2, '0')} ~ {String(tooltip.data.close[0]).padStart(2, '0')}:{String(tooltip.data.close[1]).padStart(2, '0')}</div>
            {tooltip.data.status.isOpen ? (
              <div>마감까지: {fmtDuration(tooltip.data.status.minutesUntil)} ({(tooltip.data.status.progress * 100).toFixed(0)}% 진행)</div>
            ) : (
              <div>개장까지: {fmtDuration(tooltip.data.status.minutesUntil)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarketTimeline() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  const openMarkets = MARKETS.filter(m => getMarketStatus(m, now).isOpen);
  const closedMarkets = MARKETS.filter(m => !getMarketStatus(m, now).isOpen);

  // Next market to open
  const nextToOpen = closedMarkets
    .map(m => ({ ...m, status: getMarketStatus(m, now) }))
    .sort((a, b) => a.status.minutesUntil - b.status.minutesUntil)[0];

  return (
    <div className="px-3 sm:px-4 py-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-bold">🌍 글로벌 마켓 타임라인</h2>
        <span className="text-[10px] sm:text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
          UTC {now.toISOString().slice(11, 16)}
        </span>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        <div className="px-3 py-2 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div className="text-[10px]" style={{ color: '#22c55e' }}>🟢 개장 중</div>
          <div className="text-lg font-bold" style={{ color: '#22c55e' }}>{openMarkets.length}개</div>
          <div className="text-[9px] truncate" style={{ color: 'var(--text-muted)' }}>
            {openMarkets.map(m => m.name).join(', ') || '-'}
          </div>
        </div>
        <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>⚫ 장외</div>
          <div className="text-lg font-bold">{closedMarkets.length}개</div>
        </div>
        {nextToOpen && (
          <div className="px-3 py-2 rounded-lg col-span-2 sm:col-span-1" style={{ background: `${nextToOpen.color}10`, border: `1px solid ${nextToOpen.color}30` }}>
            <div className="text-[10px]" style={{ color: nextToOpen.color }}>⏰ 다음 개장</div>
            <div className="text-sm font-bold">{nextToOpen.flag} {nextToOpen.name}</div>
            <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
              {fmtDuration(nextToOpen.status.minutesUntil)} 후
            </div>
          </div>
        )}
      </div>

      {/* Timeline Chart */}
      <div className="rounded-xl p-2 sm:p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <TimelineBar markets={MARKETS} now={now} />
      </div>

      {/* Market Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
        {MARKETS.map(mkt => {
          const status = getMarketStatus(mkt, now);
          return (
            <div key={mkt.id} className="px-3 py-2 rounded-lg transition-colors"
              style={{
                background: status.isOpen ? `${mkt.color}10` : 'var(--bg-card)',
                border: `1px solid ${status.isOpen ? mkt.color + '30' : 'var(--border)'}`,
                opacity: status.isOpen ? 1 : 0.7,
              }}>
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${status.isOpen ? 'animate-pulse' : ''}`}
                  style={{ background: status.isOpen ? '#22c55e' : '#6b7280' }} />
                <span className="text-xs font-medium">{mkt.flag} {mkt.name}</span>
                <span className="text-[9px] ml-auto tabular-nums" style={{ color: 'var(--text-muted)' }}>{status.localTime}</span>
              </div>
              <div className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {mkt.city} · {String(mkt.open[0]).padStart(2, '0')}:{String(mkt.open[1]).padStart(2, '0')}-{String(mkt.close[0]).padStart(2, '0')}:{String(mkt.close[1]).padStart(2, '0')}
              </div>
              {status.isOpen ? (
                <div className="mt-1">
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full" style={{ width: `${status.progress * 100}%`, background: mkt.color }} />
                  </div>
                  <div className="text-[8px] mt-0.5" style={{ color: mkt.color }}>마감 {fmtDuration(status.minutesUntil)} 후</div>
                </div>
              ) : (
                <div className="text-[8px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  개장 {fmtDuration(status.minutesUntil)} 후
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
