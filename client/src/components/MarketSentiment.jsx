/**
 * 종합 공포/탐욕 지수 (Fear & Greed Index)
 * 
 * 5가지 시그널 종합:
 * 1. VIX (40%) - 시장 변동성 기대치
 * 2. 주식시장 모멘텀 (20%) - KOSPI/S&P500 변동률
 * 3. 안전자산 수요 (15%) - 금 가격 변동
 * 4. 환율 변동 (15%) - USD/KRW (상승=공포)
 * 5. 시장 폭 (10%) - 상승 시장 vs 하락 시장 비율
 * 
 * 점수: 0(극공포) ~ 100(극탐욕)
 */

import { useRef, useEffect } from 'react';

// VIX → 0~100 score (inverted: high VIX = low score = fear)
function vixScore(vixValue) {
  const v = parseFloat(String(vixValue).replace(/,/g, ''));
  if (isNaN(v)) return 50;
  // VIX 10 → 100(extreme greed), VIX 20 → 50(neutral), VIX 40 → 0(extreme fear)
  return Math.max(0, Math.min(100, 100 - ((v - 10) / 30) * 100));
}

// Change rate → score (positive change = greed, negative = fear)
function momentumScore(changeRate) {
  const r = parseFloat(changeRate) || 0;
  // -5% → 0, 0% → 50, +5% → 100
  return Math.max(0, Math.min(100, 50 + r * 10));
}

// Gold change → score (gold up = fear = lower score)
function goldScore(changeRate) {
  const r = parseFloat(changeRate) || 0;
  // Gold +3% → fear(20), Gold 0% → neutral(50), Gold -3% → greed(80)
  return Math.max(0, Math.min(100, 50 - r * 10));
}

// USD/KRW → score (KRW weakening = fear)
function fxScore(changeRate) {
  const r = parseFloat(changeRate) || 0;
  // USD/KRW +1% → fear(30), 0% → neutral(50), -1% → greed(70)
  return Math.max(0, Math.min(100, 50 - r * 20));
}

// Market breadth: count how many markets are up vs down
function breadthScore(data) {
  const keys = ['kospi', 'kosdaq', 'sp500', 'nasdaq', 'dow'];
  let up = 0, total = 0;
  for (const k of keys) {
    if (!data[k]) continue;
    total++;
    if ((parseFloat(data[k].changeRate) || 0) > 0) up++;
  }
  return total > 0 ? (up / total) * 100 : 50;
}

function computeFearGreed(data) {
  if (!data) return { score: 50, signals: [] };
  
  const signals = [];
  
  // 1. VIX (40%)
  const vix = data.vix ? vixScore(data.vix.value) : 50;
  signals.push({ name: 'VIX', score: vix, weight: 0.40, raw: data.vix?.value || '-' });
  
  // 2. Market momentum (20%) — average of KOSPI + S&P500
  const kospiM = data.kospi ? momentumScore(data.kospi.changeRate) : 50;
  const spM = data.sp500 ? momentumScore(data.sp500.changeRate) : 50;
  const momentum = (kospiM + spM) / 2;
  signals.push({ name: '모멘텀', score: momentum, weight: 0.20, raw: `KOSPI ${data.kospi?.changeRate || '0%'} / S&P ${data.sp500?.changeRate || '0%'}` });
  
  // 3. Safe haven (15%) — gold
  const gold = data.gold ? goldScore(data.gold.changeRate) : 50;
  signals.push({ name: '안전자산', score: gold, weight: 0.15, raw: `금 ${data.gold?.changeRate || '0%'}` });
  
  // 4. FX (15%)
  const fx = data.usdkrw ? fxScore(data.usdkrw.changeRate) : 50;
  signals.push({ name: '환율', score: fx, weight: 0.15, raw: `USD/KRW ${data.usdkrw?.changeRate || '0%'}` });
  
  // 5. Market breadth (10%)
  const breadth = breadthScore(data);
  signals.push({ name: '시장 폭', score: breadth, weight: 0.10, raw: `${Math.round(breadth)}% 상승` });
  
  const score = signals.reduce((sum, s) => sum + s.score * s.weight, 0);
  return { score: Math.round(score), signals };
}

function getSentimentFromScore(score) {
  if (score >= 80) return { label: '극도의 탐욕', color: '#a855f7', emoji: '🟣', desc: '과매수 주의 — 안일함 경고' };
  if (score >= 60) return { label: '탐욕', color: '#22c55e', emoji: '🟢', desc: '낙관적 분위기 — 상승 모멘텀' };
  if (score >= 40) return { label: '중립', color: '#6b7280', emoji: '⚪', desc: '관망세 — 방향 탐색 중' };
  if (score >= 25) return { label: '공포', color: '#f59e0b', emoji: '🟡', desc: '불안 심리 확산 — 경계 구간' };
  if (score >= 10) return { label: '높은 공포', color: '#ef4444', emoji: '🟠', desc: '위험 회피 심화 — 변동성 확대' };
  return { label: '극도의 공포', color: '#dc2626', emoji: '🔴', desc: '패닉 — 극단적 불확실성' };
}

// Semicircular gauge using Canvas
function FearGreedGauge({ score, sentiment }) {
  const canvasRef = useRef(null);
  const size = 140;
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = (size * 0.65) * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size * 0.65);
    
    const cx = size / 2;
    const cy = size * 0.58;
    const r = size * 0.42;
    const lineWidth = 12;
    
    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0, false);
    ctx.strokeStyle = 'rgba(128,128,128,0.15)';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Gradient arc (fear red → neutral gray → greed green)
    const gradient = ctx.createLinearGradient(0, 0, size, 0);
    gradient.addColorStop(0, '#dc2626');
    gradient.addColorStop(0.25, '#ef4444');
    gradient.addColorStop(0.4, '#f59e0b');
    gradient.addColorStop(0.5, '#6b7280');
    gradient.addColorStop(0.65, '#22c55e');
    gradient.addColorStop(0.85, '#a855f7');
    gradient.addColorStop(1, '#a855f7');
    
    const endAngle = Math.PI + (score / 100) * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, endAngle, false);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Needle
    const needleAngle = Math.PI + (score / 100) * Math.PI;
    const needleLen = r - 8;
    const nx = cx + Math.cos(needleAngle) * needleLen;
    const ny = cy + Math.sin(needleAngle) * needleLen;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = sentiment.color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = sentiment.color;
    ctx.fill();
    
    // Score text
    ctx.fillStyle = sentiment.color;
    ctx.font = 'bold 20px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(score, cx, cy - 8);
    
    // Label
    ctx.fillStyle = 'rgba(128,128,128,0.7)';
    ctx.font = '8px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('공포', 8, cy + 4);
    ctx.textAlign = 'right';
    ctx.fillText('탐욕', size - 8, cy + 4);
  }, [score, sentiment]);
  
  return <canvas ref={canvasRef} style={{ width: size, height: size * 0.65 }} />;
}

function MarketStatus({ label, status }) {
  const isOpen = status === 'OPEN' || status === 'PREOPEN';
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded"
      style={{
        background: isOpen ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
        color: isOpen ? '#22c55e' : 'var(--text-muted)',
      }}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'animate-pulse' : ''}`}
        style={{ background: isOpen ? '#22c55e' : '#6b7280' }}
      />
      {label} {isOpen ? '장중' : '마감'}
    </span>
  );
}

export default function MarketSentiment({ data }) {
  if (!data?.vix) return null;

  const { score, signals } = computeFearGreed(data);
  const sentiment = getSentimentFromScore(score);
  const vixVal = parseFloat(String(data.vix.value).replace(/,/g, ''));
  const vixChange = data.vix.changeRate;

  const kospiStatus = data.kospi?.status;
  const usStatus = data.sp500?.status;

  return (
    <div
      className="mx-3 sm:mx-4 mt-3 sm:mt-4 p-3 sm:p-4 rounded-xl"
      role="region"
      aria-label="시장 심리 지표"
      aria-live="polite"
      style={{
        background: 'var(--bg-secondary)',
        border: `1px solid ${sentiment.color}33`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg sm:text-xl">{sentiment.emoji}</span>
          <span className="text-sm sm:text-base font-bold" style={{ color: sentiment.color }}>
            {sentiment.label}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums" style={{ background: sentiment.color + '20', color: sentiment.color }}>
            {score}/100
          </span>
          <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
            {sentiment.desc}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          {kospiStatus && <MarketStatus label="🇰🇷" status={kospiStatus} />}
          {usStatus && <MarketStatus label="🇺🇸" status={usStatus} />}
          <span style={{ color: sentiment.color, fontWeight: 700 }}>VIX {vixVal.toFixed(2)}</span>
          <span>({vixChange})</span>
        </div>
      </div>

      {/* Gauge + signals */}
      <div className="flex items-start gap-4">
        {/* Gauge (desktop) */}
        <div className="hidden sm:flex flex-col items-center shrink-0">
          <FearGreedGauge score={score} sentiment={sentiment} />
        </div>

        {/* Signal breakdown */}
        <div className="flex-1 space-y-1.5">
          {signals.map(s => {
            const barColor = s.score >= 60 ? '#22c55e' : s.score >= 40 ? '#6b7280' : s.score >= 25 ? '#f59e0b' : '#ef4444';
            return (
              <div key={s.name}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-medium">{s.name} <span style={{ color: 'var(--text-muted)' }}>({Math.round(s.weight * 100)}%)</span></span>
                  <span className="text-[9px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{s.raw}</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${s.score}%`, background: barColor }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: simple bar instead of gauge */}
      <div className="sm:hidden mt-2">
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${score}%`,
              background: `linear-gradient(90deg, #dc2626, #f59e0b, #22c55e, #a855f7)`,
            }}
          />
        </div>
        <div className="flex justify-between mt-0.5 text-[9px]" style={{ color: 'var(--text-muted)' }}>
          <span>극공포 0</span>
          <span>100 극탐욕</span>
        </div>
      </div>

      {/* KOSPI extreme move alert */}
      {data.kospi && (() => {
        const kr = parseFloat(String(data.kospi.changeRate).replace('%',''));
        if (isNaN(kr) || Math.abs(kr) < 5) return null;
        const up = kr > 0;
        return (
          <div className="mt-2 px-2 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
            style={{
              background: up ? 'rgba(34,197,94,0.1)' : 'rgba(220,38,38,0.1)',
              color: up ? '#22c55e' : '#dc2626',
              border: `1px solid ${up ? 'rgba(34,197,94,0.3)' : 'rgba(220,38,38,0.3)'}`,
            }}>
            <span>{up ? '🚀' : '🔻'}</span>
            <span>코스피 {data.kospi.changeRate} {Math.abs(kr) >= 8 ? (up ? '서킷브레이커급 급등' : '서킷브레이커급 급락') : (up ? '급등' : '급락')}</span>
          </div>
        );
      })()}
    </div>
  );
}
