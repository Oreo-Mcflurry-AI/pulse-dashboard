import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import MarketCard from './MarketCard';
import ChartModal from './ChartModal';
import { addNotification, shouldNotify } from './NotificationCenter';

// ─── Favorites ───
const FAV_KEY = 'pulse-market-favorites';
function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}
function saveFavorites(favs) { localStorage.setItem(FAV_KEY, JSON.stringify(favs)); }

const KEYS = ['kospi', 'kosdaq', 'usdkrw', 'oil', 'gold', 'btc', 'sp500', 'nasdaq', 'dow', 'vix'];

// Keyword mapping for matching news to market cards
const MARKET_KEYWORDS = {
  kospi: ['코스피', 'KOSPI', '한국 증시', '국내 증시'],
  kosdaq: ['코스닥', 'KOSDAQ'],
  usdkrw: ['환율', '달러', 'USD', '원화', '원/달러'],
  oil: ['유가', '원유', 'WTI', 'crude', 'oil', 'OPEC'],
  gold: ['금값', '금 가격', 'gold', '금시세'],
  btc: ['비트코인', 'BTC', 'Bitcoin', '가상화폐', '암호화폐'],
  sp500: ['S&P', 'S&P500', '미국 증시', '월가', 'Wall Street'],
  nasdaq: ['나스닥', 'NASDAQ', 'Nasdaq', '기술주'],
  dow: ['다우', 'DOW', 'Dow Jones'],
  vix: ['VIX', '공포지수', '변동성'],
};

function findRelatedNews(key, news) {
  if (!news?.sections?.length) return null;
  const keywords = MARKET_KEYWORDS[key] || [];
  if (keywords.length === 0) return null;
  for (const section of news.sections) {
    for (const article of (section.articles || [])) {
      const title = (article.title || '').toLowerCase();
      if (keywords.some(kw => title.toLowerCase().includes(kw.toLowerCase()))) {
        return article;
      }
    }
  }
  return null;
}

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

function getSortedKeys(data, sortKey, favorites) {
  const keys = KEYS.filter(k => data[k]);
  const favSet = new Set(favorites || []);
  // Always put favorites first, then sort within each group
  const sortFn = (a, b) => {
    if (sortKey === 'name') return (data[a].name || a).localeCompare(data[b].name || b, 'ko');
    if (sortKey === 'change_desc') return (parseFloat(data[b].changeRate) || 0) - (parseFloat(data[a].changeRate) || 0);
    if (sortKey === 'change_asc') return (parseFloat(data[a].changeRate) || 0) - (parseFloat(data[b].changeRate) || 0);
    return 0; // default: preserve order
  };
  if (favorites && favorites.length > 0) {
    const favKeys = keys.filter(k => favSet.has(data[k]?.name));
    const nonFavKeys = keys.filter(k => !favSet.has(data[k]?.name));
    if (sortKey !== 'default') { favKeys.sort(sortFn); nonFavKeys.sort(sortFn); }
    return [...favKeys, ...nonFavKeys];
  }
  if (sortKey === 'default') return keys;
  return [...keys].sort(sortFn);
}

export default function MarketGrid({ data, news }) {
  const [modal, setModal] = useState(null);
  const [sort, setSort] = useState('default');
  const [favorites, setFavorites] = useState(getFavorites);

  const toggleFavorite = useCallback((name) => {
    setFavorites(prev => {
      const next = prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name];
      saveFavorites(next);
      return next;
    });
  }, []);

  // ─── Market change alerts ───
  const prevDataRef = useRef(null);
  const ALERT_THRESHOLD = 2; // ±2% change triggers notification

  useEffect(() => {
    if (!data) return;
    const prev = prevDataRef.current;
    prevDataRef.current = data;
    if (!prev) return; // skip first render

    for (const key of KEYS) {
      const curr = data[key];
      const old = prev[key];
      if (!curr || !old) continue;

      const currRate = parseFloat(curr.changeRate) || 0;
      const oldRate = parseFloat(old.changeRate) || 0;
      const currVal = parseFloat(String(curr.value).replace(/,/g, '')) || 0;
      const oldVal = parseFloat(String(old.value).replace(/,/g, '')) || 0;

      // Alert if: crossed ±2% threshold OR value changed > 1% between updates
      const crossedThreshold = Math.abs(currRate) >= ALERT_THRESHOLD && Math.abs(oldRate) < ALERT_THRESHOLD;
      const bigSwing = oldVal > 0 && Math.abs((currVal - oldVal) / oldVal * 100) >= 1;

      if ((crossedThreshold || bigSwing) && shouldNotify('market')) {
        const arrow = currRate > 0 ? '▲' : currRate < 0 ? '▼' : '';
        const label = bigSwing && !crossedThreshold ? '급변' : currRate >= ALERT_THRESHOLD ? '급등' : '급락';
        addNotification({
          type: 'market',
          title: `${curr.name} ${label} ${arrow}${curr.changeRate}`,
          body: `현재가: ${curr.value}`,
        });
      }
    }
  }, [data]);

  const relatedNews = useMemo(() => {
    if (!news?.sections?.length) return {};
    const result = {};
    for (const key of KEYS) {
      result[key] = findRelatedNews(key, news);
    }
    return result;
  }, [news]);

  if (!data) return null;
  const sparklines = data.sparklines || {};
  const week52 = data.week52 || {};
  const volume = data.volume || {};
  const weeklyChange = data.weeklyChange || {};
  const sortedKeys = getSortedKeys(data, sort, favorites);

  // Quick summary chips for top 5 markets
  const summaryKeys = ['kospi', 'kosdaq', 'usdkrw', 'btc', 'sp500'];
  const summaryItems = summaryKeys.map(k => data[k]).filter(Boolean);

  return (
    <div className="px-3 sm:px-4">
      {/* Quick glance summary bar */}
      {summaryItems.length > 0 && (
        <div className="flex items-center gap-2 mb-2 px-1 overflow-x-auto scrollbar-hide" role="status" aria-label="마켓 요약">
          {summaryItems.map(item => {
            const rate = parseFloat(item.changeRate) || 0;
            const isVix = item.name === 'VIX';
            const isUp = isVix ? rate < 0 : rate > 0;
            const isDown = isVix ? rate > 0 : rate < 0;
            return (
              <span key={item.name} className="text-[10px] sm:text-[11px] whitespace-nowrap tabular-nums" style={{ color: isUp ? 'var(--accent-up)' : isDown ? 'var(--accent-down)' : 'var(--text-muted)' }}>
                {item.name} {rate > 0 ? '▲' : rate < 0 ? '▼' : ''}{item.changeRate}
              </span>
            );
          })}
          {data.updatedAt && (
            <span className="text-[9px] ml-auto whitespace-nowrap" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
              {new Date(data.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      )}
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
            volume={volume[key]}
            weeklyChange={weeklyChange[key]}
            relatedNews={relatedNews[key]}
            isFavorite={favorites.includes(data[key]?.name)}
            onToggleFavorite={toggleFavorite}
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
