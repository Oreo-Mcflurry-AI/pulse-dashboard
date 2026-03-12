import { useState, useRef, useCallback } from 'react';
import Sparkline from './Sparkline';

export default function MarketCard({ name, value, changeRate, sparkline, status, week52, relatedNews, onClick, isFavorite, onToggleFavorite }) {
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

  // Long-press / double-click to toggle favorite
  const longPressRef = useRef(null);
  const [showFavFeedback, setShowFavFeedback] = useState(false);

  const handleFavToggle = useCallback(() => {
    if (onToggleFavorite) {
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
        background: alertBg || 'var(--bg-card)',
        border: `1px solid ${alertBorder || (isFavorite ? 'rgba(234,179,8,0.4)' : 'var(--border)')}`,
      }}
      onClick={() => onClick && onClick({ name, value, changeRate, sparkline, status })}
      onDoubleClick={(e) => { e.preventDefault(); handleFavToggle(); }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
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
          </p>
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
      {relatedNews && (
        <div className="mt-1.5 pt-1.5" style={{ borderTop: '1px solid var(--border)' }}>
          <a
            href={relatedNews.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] sm:text-[10px] leading-tight block truncate hover:underline"
            style={{ color: 'var(--text-muted)' }}
            title={relatedNews.title}
            onClick={(e) => e.stopPropagation()}
          >
            📰 {relatedNews.title}
          </a>
        </div>
      )}
      {/* Favorite toggle feedback */}
      {showFavFeedback && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg sm:rounded-xl pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.3)', zIndex: 10 }}>
          <span className="text-2xl" style={{ animation: 'bounceUp 0.4s ease-out' }}>
            {isFavorite ? '★' : '☆'}
          </span>
        </div>
      )}
    </div>
  );
}
