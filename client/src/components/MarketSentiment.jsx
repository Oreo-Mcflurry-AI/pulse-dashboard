function getSentiment(changeRate) {
  const rate = parseFloat(String(changeRate).replace('%', ''));
  if (isNaN(rate)) return { label: '데이터 없음', color: '#888', emoji: '⚪', level: 0 };
  if (rate <= -5) return { label: '극도의 공포', color: '#dc2626', emoji: '🔴', level: -3, desc: '패닉 매도 구간' };
  if (rate <= -3) return { label: '공포', color: '#ef4444', emoji: '🟠', level: -2, desc: '급락 경계' };
  if (rate <= -1) return { label: '불안', color: '#f59e0b', emoji: '🟡', level: -1, desc: '하락 압력' };
  if (rate <= 1) return { label: '안정', color: '#22c55e', emoji: '🟢', level: 0, desc: '보합권' };
  if (rate <= 3) return { label: '낙관', color: '#3b82f6', emoji: '🔵', level: 1, desc: '상승 모멘텀' };
  return { label: '과열', color: '#a855f7', emoji: '🟣', level: 2, desc: '과매수 주의' };
}

export default function MarketSentiment({ data }) {
  if (!data?.kospi) return null;

  const kospi = getSentiment(data.kospi.changeRate);
  const sp500 = getSentiment(data.sp500?.changeRate);

  const barWidth = Math.min(Math.abs(parseFloat(String(data.kospi.changeRate).replace('%', '')) || 0) * 10, 100);
  const isNeg = parseFloat(String(data.kospi.changeRate).replace('%', '')) < 0;

  return (
    <div
      className="mx-3 sm:mx-4 mt-3 sm:mt-4 p-3 sm:p-4 rounded-xl"
      style={{
        background: 'var(--bg-secondary)',
        border: `1px solid ${kospi.color}33`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg sm:text-xl">{kospi.emoji}</span>
          <span className="text-sm sm:text-base font-bold" style={{ color: kospi.color }}>
            {kospi.label}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {kospi.desc}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span>코스피 {data.kospi.changeRate}</span>
          {data.sp500 && <span>S&P {data.sp500.changeRate}</span>}
        </div>
      </div>
      {/* Sentiment bar */}
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${barWidth}%`,
            background: kospi.color,
            marginLeft: isNeg ? 0 : 'auto',
            marginRight: isNeg ? 'auto' : 0,
          }}
        />
      </div>
    </div>
  );
}
