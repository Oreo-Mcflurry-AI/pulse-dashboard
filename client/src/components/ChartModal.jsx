import { useEffect, useRef, useState } from 'react';

function DetailChart({ data = [], color = '#94a3b8', width = 500, height = 200 }) {
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

    const pad = { top: 10, right: 10, bottom: 25, left: 55 };
    const cw = width - pad.left - pad.right;
    const ch = height - pad.top - pad.bottom;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Grid lines
    ctx.strokeStyle = 'rgba(128,128,128,0.15)';
    ctx.lineWidth = 0.5;
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = pad.top + (ch / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + cw, y);
      ctx.stroke();

      // Y-axis labels
      const val = max - (range / gridLines) * i;
      ctx.fillStyle = 'rgba(128,128,128,0.6)';
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(val >= 1000 ? val.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) : val.toFixed(2), pad.left - 6, y + 3);
    }

    // Area fill
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = pad.left + (i / (data.length - 1)) * cw;
      const y = pad.top + ch - ((v - min) / range) * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + cw, pad.top + ch);
    ctx.lineTo(pad.left, pad.top + ch);
    ctx.closePath();
    ctx.fillStyle = color + '15';
    ctx.fill();

    // Line
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = pad.left + (i / (data.length - 1)) * cw;
      const y = pad.top + ch - ((v - min) / range) * ch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Current value dot (last point)
    const lastX = pad.left + cw;
    const lastY = pad.top + ch - ((data[data.length - 1] - min) / range) * ch;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }, [data, color, width, height]);

  if (!data || data.length < 2) {
    return (
      <div className="flex items-center justify-center" style={{ width, height, color: 'var(--text-muted)' }}>
        <span className="text-sm">차트 데이터 없음</span>
      </div>
    );
  }

  return <canvas ref={canvasRef} style={{ width, height }} />;
}

function CurrencyConverter({ exchangeRate }) {
  const [usd, setUsd] = useState('1');
  const [krw, setKrw] = useState(String(Math.round(exchangeRate)));
  const [direction, setDirection] = useState('usd'); // which field was last edited

  const handleUsd = (v) => {
    setUsd(v);
    setDirection('usd');
    const num = parseFloat(v);
    if (!isNaN(num)) setKrw(String(Math.round(num * exchangeRate)));
    else setKrw('');
  };
  const handleKrw = (v) => {
    setKrw(v);
    setDirection('krw');
    const num = parseFloat(v);
    if (!isNaN(num)) setUsd((num / exchangeRate).toFixed(2));
    else setUsd('');
  };

  return (
    <div className="mt-4 rounded-xl p-3" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)' }}>
      <div className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
        💱 환율 계산기
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-[10px] block mb-1" style={{ color: 'var(--text-muted)' }}>USD ($)</label>
          <input
            type="number"
            value={usd}
            onChange={e => handleUsd(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm font-bold tabular-nums outline-none"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            onFocus={e => e.target.style.borderColor = 'var(--text-muted)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
        <span className="text-lg mt-4" style={{ color: 'var(--text-muted)' }}>⇄</span>
        <div className="flex-1">
          <label className="text-[10px] block mb-1" style={{ color: 'var(--text-muted)' }}>KRW (₩)</label>
          <input
            type="number"
            value={krw}
            onChange={e => handleKrw(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm font-bold tabular-nums outline-none"
            style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
            onFocus={e => e.target.style.borderColor = 'var(--text-muted)'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
          />
        </div>
      </div>
      <div className="text-[10px] mt-1.5 text-right" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
        1 USD = {exchangeRate.toLocaleString('ko-KR')} KRW
      </div>
    </div>
  );
}

export default function ChartModal({ card, sparkline, onClose }) {
  if (!card) return null;

  const rate = parseFloat(card.changeRate) || 0;
  const isVix = card.name === 'VIX';
  const isUp = isVix ? rate < 0 : rate > 0;
  const isDown = isVix ? rate > 0 : rate < 0;
  const color = isUp ? '#22c55e' : isDown ? '#ef4444' : '#94a3b8';
  const arrow = rate > 0 ? '▲' : rate < 0 ? '▼' : '';

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl p-5 shadow-2xl"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold">{card.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-2xl font-bold tabular-nums">{card.value}</span>
              <span className="text-sm font-medium" style={{ color }}>
                {arrow} {card.changeRate || '0%'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
          >
            ✕
          </button>
        </div>

        {/* Chart */}
        <div className="flex justify-center">
          <DetailChart data={sparkline} color={color} width={460} height={200} />
        </div>

        {/* Stats */}
        {sparkline && sparkline.length >= 2 && (
          <div className="grid grid-cols-4 gap-3 mt-4 text-center">
            {[
              { label: '최고', val: Math.max(...sparkline) },
              { label: '최저', val: Math.min(...sparkline) },
              { label: '평균', val: (sparkline.reduce((a, b) => a + b, 0) / sparkline.length) },
              { label: '데이터', val: `${sparkline.length}개` },
            ].map(({ label, val }) => (
              <div key={label} className="rounded-lg p-2" style={{ background: 'var(--bg-hover)' }}>
                <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
                <div className="text-xs font-bold tabular-nums mt-0.5">
                  {typeof val === 'number' ? (val >= 1000 ? val.toLocaleString('ko-KR', { maximumFractionDigits: 0 }) : val.toFixed(2)) : val}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Currency converter for USD/KRW */}
        {card.name && card.name.includes('USD/KRW') && (() => {
          const exRate = parseFloat(String(card.value).replace(/,/g, ''));
          return !isNaN(exRate) ? <CurrencyConverter exchangeRate={exRate} /> : null;
        })()}
      </div>
    </div>
  );
}
