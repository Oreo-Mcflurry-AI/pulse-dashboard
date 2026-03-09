import { useState } from 'react';
import MarketCard from './MarketCard';
import ChartModal from './ChartModal';

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

const SORT_OPTIONS = [
  { key: 'default', label: '기본' },
  { key: 'change_desc', label: '▲ 상승순' },
  { key: 'change_asc', label: '▼ 하락순' },
  { key: 'name', label: 'ㄱ-ㄴ 이름순' },
];

function getSortedKeys(data, sortKey) {
  const keys = KEYS.filter(k => data[k]);
  if (sortKey === 'default') return keys;
  // Use spread to avoid mutating the filtered array
  if (sortKey === 'name') return [...keys].sort((a, b) => (data[a].name || a).localeCompare(data[b].name || b, 'ko'));
  if (sortKey === 'change_desc') return [...keys].sort((a, b) => (parseFloat(data[b].changeRate) || 0) - (parseFloat(data[a].changeRate) || 0));
  if (sortKey === 'change_asc') return [...keys].sort((a, b) => (parseFloat(data[a].changeRate) || 0) - (parseFloat(data[b].changeRate) || 0));
  return keys;
}

export default function MarketGrid({ data }) {
  const [modal, setModal] = useState(null);
  const [sort, setSort] = useState('default');

  if (!data) return null;
  const sparklines = data.sparklines || {};
  const week52 = data.week52 || {};
  const sortedKeys = getSortedKeys(data, sort);

  return (
    <div className="px-3 sm:px-4">
      <div className="flex justify-end gap-1 mb-1">
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSort(opt.key)}
            aria-label={`${opt.label} 정렬`}
            aria-pressed={sort === opt.key}
            className="text-[10px] sm:text-xs px-2 py-1 rounded transition-colors"
            style={{
              color: sort === opt.key ? 'var(--bg-primary)' : 'var(--text-muted)',
              background: sort === opt.key ? 'var(--text-primary)' : 'var(--bg-hover)',
              fontWeight: sort === opt.key ? 600 : 400,
            }}
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={() => exportCSV(data)}
          className="text-[10px] sm:text-xs px-2 py-1 rounded transition-colors"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
          title="시세 CSV 다운로드"
          aria-label="시세 데이터 CSV 다운로드"
        >
          📥 CSV
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        {sortedKeys.map(key => (
          <MarketCard
            key={key}
            {...data[key]}
            sparkline={sparklines[key]}
            status={data[key].status}
            week52={week52[key]}
            onClick={(card) => setModal({ ...card, sparkline: sparklines[key], week52: week52[key] })}
          />
        ))}
      </div>
      {modal && (
        <ChartModal
          card={modal}
          sparkline={modal.sparkline}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
