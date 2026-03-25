import { useState, useRef, useCallback } from 'react';
import Sparkline from './Sparkline';

function HoverDetail({ week52, value, weeklyChange, volume, name }) {
  if (!week52 || week52.high == null) return null;
  const current = parseFloat(String(value).replace(/,/g, ''));
  const range = week52.high - week52.low;
  const pct = range > 0 ? ((current - week52.low) / range * 100).toFixed(1) : '50.0';
  const fromHigh = range > 0 ? ((week52.high - current) / week52.high * 100).toFixed(1) : '0';
  const fromLow = range > 0 ? ((current - week52.low) / week52.low * 100).toFixed(1) : '0';

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-50 px-3 py-2 rounded-lg pointer-events-none whitespace-nowrap"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
        minWidth: 180,
      }}
    >
      <div className="text-[10px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{name}</div>
      <div className="space-y-0.5 text-[9px]" style={{ color: 'var(--text-muted)' }}>
        <div className="flex justify-between gap-3">
          <span>52주 위치</span>
          <span className="font-medium tabular-nums" style={{ color: parseFloat(pct) > 70 ? '#22c55e' : parseFloat(pct) < 30 ? '#ef4444' : 'var(--text-primary)' }}>
            {pct}%
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span>고점 대비</span>
          <span className="tabular-nums">-{fromHigh}%</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>저점 대비</span>
          <span className="tabular-nums">+{fromLow}%</span>
        </div>
        {weeklyChange && (
          <div className="flex justify-between gap-3">
            <span>주간 변동</span>
            <span className="font-medium tabular-nums" style={{ color: parseFloat(weeklyChange) > 0 ? '#22c55e' : parseFloat(weeklyChange) < 0 ? '#ef4444' : 'var(--text-muted)' }}>
              {parseFloat(weeklyChange) > 0 ? '+' : ''}{weeklyChange}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MarketCard({ name, value, changeRate, sparkline, status, week52, volume, weeklyChange, relatedNews, onClick, isFavorite, onToggleFavorite }) {
  const rate = parseFloat(changeRate) || 0;
  const isVix = name === 'VIX';
  // VIX: up = fear (red), down = calm (green) — inverted colors
  const isUp = isVix ? rate < 0 : rate > 0;
  const isDown = isVix ? rate > 0 : rate < 0;
  const changeColor = isUp ? 'var(--accent-up)' : isDown ? 'var(--accent-down)' : 'var(--text-muted)';
  const sparkColor = isUp ? 'var(--accent-up)' : isDown ? 'var(--accent-down)' : 'var(--text-muted)';
  const arrow = rate > 0 ? '▲' : rate < 0 ? '▼' : '';

  // VIX fear level badge
  const vixVal = isVix ? parseFloat(String(value).replace(/,/g, '')) : 0;
  const vixLevel = isVix ? (vixVal >= 30 ? '🔴 극공포' : vixVal >= 20 ? '🟡 경계' : '🟢 안정') : '';

  // Alert styling for extreme moves (±3% or more)
  const absRate = Math.abs(rate);
  let alertBg = '';
  let alertBorder = '';
  if (absRate >= 5) {
    alertBg = isDown ? 'rgba(220, 38, 38, 0.12)' : 'rgba(34, 197, 94, 0.12)';
    alertBorder = isDown ? 'rgba(220, 38, 38, 0.4)' : 'rgba(34, 197, 94, 0.4)';
  } else if (absRate >= 3) {
    alertBg = isDown ? 'rgba(220, 38, 38, 0.06)' : 'rgba(34, 197, 94, 0.06)';
    alertBorder = isDown ? 'rgba(220, 38, 38, 0.25)' : 'rgba(34, 197, 94, 0.25)';
  }

  // Status-based background gradient
  const statusBg = !alertBg ? (
    status === 'OPEN' ? 'linear-gradient(135deg, var(--bg-card) 0%, rgba(34,197,94,0.04) 100%)' :
    status === 'PREOPEN' ? 'linear-gradient(135deg, var(--bg-card) 0%, rgba(234,179,8,0.04) 100%)' :
    'var(--bg-card)'
  ) : alertBg;

  // Long-press / double-click to toggle favorite
  const longPressRef = useRef(null);
  const [showFavFeedback, setShowFavFeedback] = useState(false);
  const [showHover, setShowHover] = useState(false);
  const hoverTimerRef = useRef(null);

  const handleFavToggle = useCallback(() => {
    if (onToggleFavorite) {
      if (navigator.vibrate) navigator.vibrate([15, 30, 15]);
      onToggleFavorite(name);
      setShowFavFeedback(true);
      setTimeout(() => setShowFavFeedback(false), 800);
    }
  }, [name, onToggleFavorite]);

  const handlePointerDown = useCallback(() => {
    longPressRef.current = setTimeout(handleFavToggle, 600);
  }, [handleFavToggle]);

  const handlePointerUp = useCallback(() => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  }, []);

  return (
    <div
      className="rounded-lg sm:rounded-xl p-3 sm:p-4 transition-colors cursor-pointer hover:opacity-90 relative"
      role="button"
      tabIndex={0}
      aria-label={`${name} ${value} ${changeRate || '0%'} 상세 차트 보기${isFavorite ? ' (즐겨찾기)' : ''}`}
      style={{
        background: statusBg,
        border: `1px solid ${alertBorder || (isFavorite ? 'rgba(234,179,8,0.4)' : status === 'OPEN' ? 'rgba(34,197,94,0.12)' : 'var(--border)')}`,
      }}
      onClick={() => {
        if (navigator.vibrate) navigator.vibrate(10);
        onClick && onClick({ name, value, changeRate, sparkline, status });
      }}
      onDoubleClick={(e) => { e.preventDefault(); handleFavToggle(); }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={() => { hoverTimerRef.current = setTimeout(() => setShowHover(true), 500); }}
      onMouseLeave={() => { clearTimeout(hoverTimerRef.current); setShowHover(false); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick && onClick({ name, value, changeRate, sparkline, status }); }}}
    >
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 mb-0.5 sm:mb-1">
            <p className="text-[10px] sm:text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              {isFavorite && <span className="text-[8px] mr-0.5" style={{ color: '#eab308' }}>★</span>}
              {name}
            </p>
            {status === 'OPEN' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" title="장중" />}
            {status === 'PREOPEN' && <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" title="프리마켓" />}
            {status && (
              <span className="text-[8px] sm:text-[9px] px-1 py-0.5 rounded" style={{
                background: status === 'OPEN' ? 'rgba(34,197,94,0.15)' : status === 'PREOPEN' ? 'rgba(234,179,8,0.15)' : 'rgba(107,114,128,0.15)',
                color: status === 'OPEN' ? '#22c55e' : status === 'PREOPEN' ? '#eab308' : 'var(--text-muted)',
              }}>{status === 'OPEN' ? 'LIVE' : status === 'PREOPEN' ? '프리' : '마감'}</span>
            )}
            {absRate >= 5 && <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: isDown ? 'rgba(220,38,38,0.2)' : 'rgba(34,197,94,0.2)', color: isDown ? '#dc2626' : '#22c55e' }}>급{isDown ? '락' : '등'}</span>}
            {vixLevel && <span className="text-[8px] sm:text-[9px]">{vixLevel}</span>}
          </div>
          <p className="text-base sm:text-xl font-bold tabular-nums truncate">{value || '-'}</p>
          <p className="text-xs sm:text-sm font-medium mt-0.5 sm:mt-1" style={{ color: changeColor }}>
            {arrow && (
              <span className="inline-block" style={{
                animation: absRate >= 1
                  ? (rate > 0 ? 'bounceUp 1.5s ease-in-out infinite' : 'bounceDown 1.5s ease-in-out infinite')
                  : undefined,
              }}>{arrow}</span>
            )}{' '}{changeRate || '0%'}
            {weeklyChange && (
              <span className="text-[8px] sm:text-[9px] ml-1.5 px-1 py-0.5 rounded" style={{
                background: 'var(--bg-hover)',
                color: parseFloat(weeklyChange) > 0 ? 'var(--accent-up)' : parseFloat(weeklyChange) < 0 ? 'var(--accent-down)' : 'var(--text-muted)',
                opacity: 0.8,
              }} title="주간 변동률">
                W {parseFloat(weeklyChange) > 0 ? '+' : ''}{weeklyChange}
              </span>
            )}
          </p>
          {volume && volume.volume > 0 && (
            <p className="text-[9px] sm:text-[10px] mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
              📊 {volume.volumeLabel || (volume.volume >= 1000000 ? `${(volume.volume / 1000000).toFixed(1)}M` : volume.volume >= 1000 ? `${(volume.volume / 1000).toFixed(0)}K` : volume.volume)}
              {volume.changeRatio && (() => {
                const vr = parseFloat(volume.changeRatio);
                return vr !== 0 ? (
                  <span style={{ color: vr > 0 ? 'var(--accent-up)' : 'var(--accent-down)', marginLeft: 3 }}>
                    {vr > 0 ? '↑' : '↓'}{Math.abs(vr).toFixed(0)}%
                  </span>
                ) : null;
              })()}
            </p>
          )}
        </div>
        <div className="hidden sm:block">
          <Sparkline data={sparkline} color={sparkColor} />
        </div>
        <div className="block sm:hidden">
          <Sparkline data={sparkline} color={sparkColor} width={40} height={16} />
        </div>
      </div>
      {week52 && week52.high != null && week52.low != null && (() => {
        const current = parseFloat(String(value).replace(/,/g, ''));
        const range = week52.high - week52.low;
        const pct = range > 0 ? Math.max(0, Math.min(100, ((current - week52.low) / range) * 100)) : 50;
        const lowStr = week52.low >= 1000 ? week52.low.toLocaleString('en-US', { maximumFractionDigits: 0 }) : week52.low.toLocaleString('en-US', { maximumFractionDigits: 2 });
        const highStr = week52.high >= 1000 ? week52.high.toLocaleString('en-US', { maximumFractionDigits: 0 }) : week52.high.toLocaleString('en-US', { maximumFractionDigits: 2 });
        return (
          <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[8px] sm:text-[9px]" style={{ color: 'var(--text-muted)' }}>52주 최저</span>
              <span className="text-[8px] sm:text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>52W Range</span>
              <span className="text-[8px] sm:text-[9px]" style={{ color: 'var(--text-muted)' }}>52주 최고</span>
            </div>
            <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
              <div className="absolute inset-y-0 left-0 rounded-full" style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, var(--accent-down), ${pct > 50 ? 'var(--accent-up)' : 'var(--text-muted)'})`,
              }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full border border-white dark:border-gray-800" style={{
                left: `calc(${pct}% - 4px)`,
                background: sparkColor,
                boxShadow: '0 0 3px rgba(0,0,0,0.3)',
              }} />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[8px] sm:text-[9px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{lowStr}</span>
              <span className="text-[8px] sm:text-[9px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{highStr}</span>
            </div>
          </div>
        );
      })()}
      {relatedNews && (() => {
        const items = Array.isArray(relatedNews) ? relatedNews : [relatedNews];
        if (items.length === 0) return null;
        return (
          <div className="mt-1.5 pt-1.5 space-y-0.5" style={{ borderTop: '1px solid var(--border)' }}>
            {items.slice(0, 3).map((news, i) => (
              <a
                key={i}
                href={news.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] sm:text-[10px] leading-tight block truncate hover:underline"
                style={{ color: 'var(--text-muted)', opacity: i === 0 ? 1 : 0.7 }}
                title={news.title}
                onClick={(e) => e.stopPropagation()}
              >
                {i === 0 ? '📰' : '·'} {news.title}
              </a>
            ))}
          </div>
        );
      })()}
      {/* Favorite toggle feedback */}
      {showFavFeedback && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg sm:rounded-xl pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.3)', zIndex: 10 }}>
          <span className="text-2xl" style={{ animation: 'bounceUp 0.4s ease-out' }}>
            {isFavorite ? '★' : '☆'}
          </span>
        </div>
      )}
      {showHover && <HoverDetail week52={week52} value={value} weeklyChange={weeklyChange} volume={volume} name={name} />}
    </div>
  );
}
