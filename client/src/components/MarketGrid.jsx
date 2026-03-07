import MarketCard from './MarketCard';

const KEYS = ['kospi', 'kosdaq', 'usdkrw', 'oil', 'gold', 'btc', 'sp500', 'nasdaq', 'dow', 'vix'];

function exportCSV(data) {
  const rows = [['종목', '현재가', '변동', '변동률', '장상태', '시각']];
  KEYS.forEach(key => {
    const d = data[key];
    if (!d) return;
    rows.push([
      d.name || key,
      d.value || '',
      d.change || '',
      d.changeRate || '',
      d.status || '',
      data.updatedAt || '',
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `pulse-market-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function MarketGrid({ data }) {
  if (!data) return null;
  const sparklines = data.sparklines || {};
  return (
    <div className="px-3 sm:px-4">
      <div className="flex justify-end mb-1">
        <button
          onClick={() => exportCSV(data)}
          className="text-[10px] sm:text-xs px-2 py-1 rounded transition-colors"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
          title="시세 CSV 다운로드"
        >
          📥 CSV
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {KEYS.map(key => data[key] && (
          <MarketCard key={key} {...data[key]} sparkline={sparklines[key]} status={data[key].status} />
        ))}
      </div>
    </div>
  );
}
