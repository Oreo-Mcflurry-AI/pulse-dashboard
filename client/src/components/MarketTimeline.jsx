import { useState, useEffect, useRef, useCallback } from 'react';

// Global market sessions (all times in local exchange timezone)
const MARKETS = [
  { id: 'tokyo', name: '도쿄', flag: '🇯🇵', tz: 'Asia/Tokyo', open: [9, 0], close: [15, 0], color: '#ef4444' },
  { id: 'shanghai', name: '상하이', flag: '🇨🇳', tz: 'Asia/Shanghai', open: [9, 30], close: [15, 0], color: '#f97316' },
  { id: 'hk', name: '홍콩', flag: '🇭🇰', tz: 'Asia/Hong_Kong', open: [9, 30], close: [16, 0], color: '#eab308' },
  { id: 'krx', name: 'KRX', flag: '🇰🇷', tz: 'Asia/Seoul', open: [9, 0], close: [15, 30], color: '#22c55e', highlight: true },
  { id: 'mumbai', name: '뭄바이', flag: '🇮🇳', tz: 'Asia/Kolkata', open: [9, 15], close: [15, 30], color: '#14b8a6' },
  { id: 'london', name: '런던', flag: '🇬🇧', tz: 'Europe/London', open: [8, 0], close: [16, 30], color: '#3b82f6' },
  { id: 'frankfurt', name: '프랑크', flag: '🇩🇪', tz: 'Europe/Berlin', open: [9, 0], close: [17, 30], color: '#6366f1' },
  { id: 'nyse', name: 'NYSE', flag: '🇺🇸', tz: 'America/New_York', open: [9, 30], close: [16, 0], color: '#8b5cf6' },
  { id: 'nasdaq', name: 'NASDAQ', flag: '🇺🇸', tz: 'America/New_York', open: [9, 30], close: [16, 0], color: '#a855f7' },
  { id: 'sao', name: '상파울루', flag: '🇧🇷', tz: 'America/Sao_Paulo', open: [10, 0], close: [17, 0], color: '#ec4899' },
];

function getMarketNow(market) {
  const now = new Date();
  const localStr = now.toLocaleString('en-US', { timeZone: market.tz, hour12: false });
  const local = new Date(localStr);
  const h = local.getHours();
  const m = local.getMinutes();
  const day = local.getDay(); // 0=Sun
  const mins = h * 60 + m;
  const openMins = market.open[0] * 60 + market.open[1];
  const closeMins = market.close[0] * 60 + market.close[1];
  const isWeekday = day >= 1 && day <= 5;
  const isOpen = isWeekday && mins >= openMins && mins < closeMins;

  // Time to next open/close
  let nextEvent = null;
  let nextEventType = null;
  if (isOpen) {
    nextEvent = closeMins - mins;
    nextEventType = 'close';
  } else if (isWeekday && mins < openMins) {
    nextEvent = openMins - mins;
    nextEventType = 'open';
  }

  // Convert local open/close to UTC for timeline
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: market.tz });
  const openUTC = new Date(`${todayStr}T${String(market.open[0]).padStart(2,'0')}:${String(market.open[1]).padStart(2,'0')}:00`);
  const closeUTC = new Date(`${todayStr}T${String(market.close[0]).padStart(2,'0')}:${String(market.close[1]).padStart(2,'0')}:00`);

  // Recalculate using timezone offset
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: market.tz, hour: 'numeric', minute: 'numeric', hour12: false });

  return {
    ...market,
    isOpen,
    localTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
    openMins,
    closeMins,
    currentMins: mins,
    isWeekday,
    nextEvent,
    nextEventType,
    progress: isOpen ? Math.round(((mins - openMins) / (closeMins - openMins)) * 100) : 0,
  };
}

function fmtDuration(mins) {
  if (mins == null) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}

function TimelineBar({ markets, kstHour }) {
  const canvasRef = useRef(null);
  const w = 800;
  const h = markets.length * 36 + 40;
  const padLeft = 90;
  const padRight = 20;
  const padTop = 30;
  const barH = 20;
  const rowH = 36;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const chartW = w - padLeft - padRight;

    // X-axis: 24 hours in KST
    // Each pixel = chartW / (24 * 60) minutes
    const pxPerMin = chartW / (24 * 60);

    // Hour grid lines
    ctx.strokeStyle = 'rgba(128,128,128,0.15)';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = 'rgba(128,128,128,0.5)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';

    for (let hr = 0; hr < 24; hr += 3) {
      const x = padLeft + hr * 60 * pxPerMin;
      ctx.beginPath();
      ctx.moveTo(x, padTop - 5);
      ctx.lineTo(x, h);
      ctx.stroke();
      ctx.fillText(`${String(hr).padStart(2, '0')}:00`, x, padTop - 10);
    }

    // Current time line (KST)
    const nowKST = new Date();
    const kstStr = nowKST.toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour12: false });
    const kstDate = new Date(kstStr);
    const nowMins = kstDate.getHours() * 60 + kstDate.getMinutes();
    const nowX = padLeft + nowMins * pxPerMin;

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(nowX, padTop);
    ctx.lineTo(nowX, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // "Now" label
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 9px system-ui';
    ctx.fillText('▼ NOW', nowX, padTop - 2);

    // Draw market bars
    markets.forEach((m, i) => {
      const y = padTop + i * rowH;

      // Market label
      ctx.fillStyle = m.isOpen ? m.color : 'rgba(128,128,128,0.5)';
      ctx.font = m.highlight ? 'bold 11px system-ui' : '11px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(`${m.flag} ${m.name}`, padLeft - 8, y + barH / 2 + 4);

      // Convert market open/close to KST minutes
      const now = new Date();
      const mktOpen = new Date(now.toLocaleDateString('en-CA', { timeZone: m.tz }) + `T${String(m.open[0]).padStart(2,'0')}:${String(m.open[1]).padStart(2,'0')}:00`);
      const mktClose = new Date(now.toLocaleDateString('en-CA', { timeZone: m.tz }) + `T${String(m.close[0]).padStart(2,'0')}:${String(m.close[1]).padStart(2,'0')}:00`);

      // Get KST equivalent times
      const openKST = new Date(mktOpen.toLocaleString('en-US', { timeZone: m.tz }));
      const closeKST = new Date(mktClose.toLocaleString('en-US', { timeZone: m.tz }));

      // Calculate timezone offset from KST
      const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
      const mktNow = new Date(now.toLocaleString('en-US', { timeZone: m.tz }));
      const offsetMins = (kstNow - mktNow) / 60000; // KST - local

      const openKSTMins = m.openMins + offsetMins;
      const closeKSTMins = m.closeMins + offsetMins;

      // Handle wrap-around
      const drawBar = (startMins, endMins) => {
        let s = startMins, e = endMins;
        if (s < 0) s += 24 * 60;
        if (e < 0) e += 24 * 60;
        if (s > 24 * 60) s -= 24 * 60;
        if (e > 24 * 60) e -= 24 * 60;

        if (s < e) {
          const x1 = padLeft + s * pxPerMin;
          const x2 = padLeft + e * pxPerMin;
          // Background bar
          ctx.fillStyle = m.color + '25';
          ctx.beginPath();
          ctx.roundRect(x1, y, x2 - x1, barH, 4);
          ctx.fill();
          // Active portion if open
          if (m.isOpen) {
            const progressX = x1 + (x2 - x1) * (m.progress / 100);
            ctx.fillStyle = m.color + '60';
            ctx.beginPath();
            ctx.roundRect(x1, y, progressX - x1, barH, 4);
            ctx.fill();
          }
          // Border
          ctx.strokeStyle = m.color + '50';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(x1, y, x2 - x1, barH, 4);
          ctx.stroke();
        } else {
          // Wraps around midnight
          const x1a = padLeft + s * pxPerMin;
          const x1b = padLeft + 24 * 60 * pxPerMin;
          const x2a = padLeft;
          const x2b = padLeft + e * pxPerMin;

          ctx.fillStyle = m.color + '25';
          ctx.fillRect(x1a, y, x1b - x1a, barH);
          ctx.fillRect(x2a, y, x2b - x2a, barH);
          ctx.strokeStyle = m.color + '50';
          ctx.lineWidth = 1;
          ctx.strokeRect(x1a, y, x1b - x1a, barH);
          ctx.strokeRect(x2a, y, x2b - x2a, barH);
        }
      };

      drawBar(openKSTMins, closeKSTMins);

      // Open/close time labels on bar
      if (m.isOpen) {
        ctx.fillStyle = m.color;
        ctx.font = 'bold 8px system-ui';
        ctx.textAlign = 'left';
        const barX = padLeft + Math.max(0, openKSTMins) * pxPerMin;
        ctx.fillText('OPEN', barX + 3, y + barH - 3);
      }
    });
  }, [markets, h]);

  useEffect(() => { draw(); }, [draw]);

  return (
    <div className="overflow-x-auto">
      <canvas ref={canvasRef} style={{ width: w, height: h, minWidth: w }} />
    </div>
  );
}

export default function MarketTimeline() {
  const [markets, setMarkets] = useState([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const update = () => {
      setMarkets(MARKETS.map(getMarketNow));
      setNow(new Date());
    };
    update();
    const t = setInterval(update, 30000); // update every 30s
    return () => clearInterval(t);
  }, []);

  const kstStr = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const openMarkets = markets.filter(m => m.isOpen);
  const closedMarkets = markets.filter(m => !m.isOpen);

  return (
    <div className="px-3 sm:px-4 py-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base sm:text-lg font-bold">🌍 글로벌 마켓 타임라인</h2>
        <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>KST {kstStr}</span>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
        {markets.map(m => (
          <div
            key={m.id}
            className="px-3 py-2 rounded-lg transition-colors"
            style={{
              background: m.isOpen ? m.color + '15' : 'var(--bg-card)',
              border: `1px solid ${m.isOpen ? m.color + '30' : 'var(--border)'}`,
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm">{m.flag}</span>
              <span className="text-[10px] sm:text-xs font-medium truncate">{m.name}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${m.isOpen ? 'animate-pulse' : ''}`}
                style={{ background: m.isOpen ? '#22c55e' : '#6b7280' }} />
            </div>
            <div className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
              {m.localTime} 현지
            </div>
            {m.isOpen ? (
              <>
                <div className="w-full h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: m.color + '20' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${m.progress}%`, background: m.color }} />
                </div>
                <div className="text-[9px] mt-0.5" style={{ color: m.color }}>
                  마감까지 {fmtDuration(m.nextEvent)}
                </div>
              </>
            ) : (
              <div className="text-[9px] mt-1" style={{ color: 'var(--text-muted)' }}>
                {m.nextEventType === 'open' ? `개장까지 ${fmtDuration(m.nextEvent)}` :
                 !m.isWeekday ? '주말 휴장' : '폐장'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Timeline Chart */}
      <div className="rounded-xl p-3 sm:p-4 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
          24시간 타임라인 (KST 기준)
        </div>
        <TimelineBar markets={markets} />
      </div>

      {/* Summary */}
      <div className="rounded-xl p-3 sm:p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-bold mb-2" style={{ color: '#22c55e' }}>
              🟢 개장 중 ({openMarkets.length})
            </div>
            {openMarkets.length === 0 ? (
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>현재 개장 중인 시장 없음</div>
            ) : (
              <div className="space-y-1.5">
                {openMarkets.map(m => (
                  <div key={m.id} className="flex items-center gap-2">
                    <span>{m.flag}</span>
                    <span className="text-xs flex-1">{m.name}</span>
                    <span className="text-[10px] tabular-nums" style={{ color: m.color }}>
                      {m.progress}% 진행 · 마감 {fmtDuration(m.nextEvent)} 후
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs font-bold mb-2" style={{ color: '#6b7280' }}>
              ⚫ 폐장 ({closedMarkets.length})
            </div>
            <div className="space-y-1.5">
              {closedMarkets.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <span>{m.flag}</span>
                  <span className="text-xs flex-1" style={{ color: 'var(--text-muted)' }}>{m.name}</span>
                  <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>
                    {m.nextEventType === 'open' ? `개장 ${fmtDuration(m.nextEvent)} 후` :
                     !m.isWeekday ? '주말' : `${String(m.open[0]).padStart(2,'0')}:${String(m.open[1]).padStart(2,'0')} 개장`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
