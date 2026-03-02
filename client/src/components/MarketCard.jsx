import Sparkline from './Sparkline';

export default function MarketCard({ name, value, changeRate, sparkline }) {
  const rate = parseFloat(changeRate) || 0;
  const isUp = rate > 0;
  const isDown = rate < 0;
  const color = isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-slate-400';
  const sparkColor = isUp ? '#4ade80' : isDown ? '#f87171' : '#94a3b8';
  const arrow = isUp ? '▲' : isDown ? '▼' : '';

  return (
    <div className="bg-slate-800 rounded-lg sm:rounded-xl p-3 sm:p-4 hover:bg-slate-750 transition-colors border border-slate-700/50">
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs text-slate-400 font-medium mb-0.5 sm:mb-1">{name}</p>
          <p className="text-base sm:text-xl font-bold tabular-nums truncate">{value || '-'}</p>
          <p className={`text-xs sm:text-sm font-medium mt-0.5 sm:mt-1 ${color}`}>
            {arrow} {changeRate || '0%'}
          </p>
        </div>
        <div className="hidden sm:block">
          <Sparkline data={sparkline} color={sparkColor} />
        </div>
        <div className="block sm:hidden">
          <Sparkline data={sparkline} color={sparkColor} width={48} height={18} />
        </div>
      </div>
    </div>
  );
}
