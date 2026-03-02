export default function MarketCard({ name, value, changeRate }) {
  const rate = parseFloat(changeRate) || 0;
  const isUp = rate > 0;
  const isDown = rate < 0;
  const color = isUp ? 'text-green-400' : isDown ? 'text-red-400' : 'text-slate-400';
  const arrow = isUp ? '▲' : isDown ? '▼' : '';

  return (
    <div className="bg-slate-800 rounded-xl p-4 hover:bg-slate-750 transition-colors border border-slate-700/50">
      <p className="text-xs text-slate-400 font-medium mb-1">{name}</p>
      <p className="text-xl font-bold tabular-nums">{value || '-'}</p>
      <p className={`text-sm font-medium mt-1 ${color}`}>
        {arrow} {changeRate || '0%'}
      </p>
    </div>
  );
}
