import Sparkline from './Sparkline';

export default function MarketCard({ name, value, changeRate, sparkline, status, onClick }) {
  const rate = parseFloat(changeRate) || 0;
  const isVix = name === 'VIX';
  // VIX: up = fear (red), down = calm (green) — inverted colors
  const isUp = isVix ? rate < 0 : rate > 0;
  const isDown = isVix ? rate > 0 : rate < 0;
  const colorClass = isUp ? 'text-green-500 dark:text-green-400' : isDown ? 'text-red-500 dark:text-red-400' : '';
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

  return (
    <div
      className="rounded-lg sm:rounded-xl p-3 sm:p-4 transition-colors cursor-pointer hover:opacity-90"
      role="button"
      tabIndex={0}
      aria-label={`${name} ${value} ${changeRate || '0%'} 상세 차트 보기`}
      style={{
        background: alertBg || 'var(--bg-card)',
        border: `1px solid ${alertBorder || 'var(--border)'}`,
      }}
      onClick={() => onClick && onClick({ name, value, changeRate, sparkline, status })}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick && onClick({ name, value, changeRate, sparkline, status }); }}}
    >
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 mb-0.5 sm:mb-1">
            <p className="text-[10px] sm:text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{name}</p>
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
          <p className={`text-xs sm:text-sm font-medium mt-0.5 sm:mt-1 ${colorClass}`}>
            {arrow} {changeRate || '0%'}
          </p>
        </div>
        <div className="hidden sm:block">
          <Sparkline data={sparkline} color={sparkColor} />
        </div>
        <div className="block sm:hidden">
          <Sparkline data={sparkline} color={sparkColor} width={40} height={16} />
        </div>
      </div>
    </div>
  );
}
