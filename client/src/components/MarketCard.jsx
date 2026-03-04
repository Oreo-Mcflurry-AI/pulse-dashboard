import Sparkline from './Sparkline';

export default function MarketCard({ name, value, changeRate, sparkline }) {
  const rate = parseFloat(changeRate) || 0;
  const isUp = rate > 0;
  const isDown = rate < 0;
  const colorClass = isUp ? 'text-green-500 dark:text-green-400' : isDown ? 'text-red-500 dark:text-red-400' : '';
  const sparkColor = isUp ? 'var(--accent-up)' : isDown ? 'var(--accent-down)' : 'var(--text-muted)';
  const arrow = isUp ? '▲' : isDown ? '▼' : '';

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
      className="rounded-lg sm:rounded-xl p-3 sm:p-4 transition-colors"
      style={{
        background: alertBg || 'var(--bg-card)',
        border: `1px solid ${alertBorder || 'var(--border)'}`,
      }}
    >
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 mb-0.5 sm:mb-1">
            <p className="text-[10px] sm:text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{name}</p>
            {absRate >= 5 && <span className="text-[9px] px-1 py-0.5 rounded" style={{ background: isDown ? 'rgba(220,38,38,0.2)' : 'rgba(34,197,94,0.2)', color: isDown ? '#dc2626' : '#22c55e' }}>급{isDown ? '락' : '등'}</span>}
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
