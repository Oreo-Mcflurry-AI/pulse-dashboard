import Sparkline from './Sparkline';

export default function MarketCard({ name, value, changeRate, sparkline }) {
  const rate = parseFloat(changeRate) || 0;
  const isUp = rate > 0;
  const isDown = rate < 0;
  const colorClass = isUp ? 'text-green-500 dark:text-green-400' : isDown ? 'text-red-500 dark:text-red-400' : '';
  const sparkColor = isUp ? 'var(--accent-up)' : isDown ? 'var(--accent-down)' : 'var(--text-muted)';
  const arrow = isUp ? '▲' : isDown ? '▼' : '';

  return (
    <div
      className="rounded-lg sm:rounded-xl p-3 sm:p-4 transition-colors"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-medium mb-0.5 sm:mb-1" style={{ color: 'var(--text-muted)' }}>{name}</p>
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
