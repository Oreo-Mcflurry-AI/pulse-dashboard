/**
 * VIX (CBOE Volatility Index) 기반 시장 심리 인디케이터
 * 
 * VIX 구간:
 * 0-12:  극도의 탐욕 (과열)
 * 12-20: 탐욕 (낙관)
 * 20-25: 중립
 * 25-30: 공포
 * 30-40: 높은 공포
 * 40+:   극도의 공포 (패닉)
 */

function getVixSentiment(vixValue) {
  const v = parseFloat(String(vixValue).replace(/,/g, ''));
  if (isNaN(v)) return { label: '데이터 없음', color: '#888', emoji: '⚪', desc: '', barPct: 0 };

  if (v >= 40) return { label: '극도의 공포', color: '#dc2626', emoji: '🔴', desc: '패닉 구간 — 시장 극심한 불확실성', barPct: 100 };
  if (v >= 30) return { label: '높은 공포', color: '#ef4444', emoji: '🟠', desc: '급격한 변동성 — 위험 회피 심화', barPct: 80 };
  if (v >= 25) return { label: '공포', color: '#f59e0b', emoji: '🟡', desc: '변동성 확대 — 경계 필요', barPct: 60 };
  if (v >= 20) return { label: '중립', color: '#6b7280', emoji: '⚪', desc: '평균 수준의 변동성', barPct: 40 };
  if (v >= 12) return { label: '탐욕', color: '#22c55e', emoji: '🟢', desc: '낮은 변동성 — 낙관적 분위기', barPct: 20 };
  return { label: '극도의 탐욕', color: '#a855f7', emoji: '🟣', desc: '과매수 주의 — 안일함 경고', barPct: 10 };
}

export default function MarketSentiment({ data }) {
  if (!data?.vix) return null;

  const vixVal = parseFloat(String(data.vix.value).replace(/,/g, ''));
  const sentiment = getVixSentiment(vixVal);
  const vixChange = data.vix.changeRate;

  return (
    <div
      className="mx-3 sm:mx-4 mt-3 sm:mt-4 p-3 sm:p-4 rounded-xl"
      style={{
        background: 'var(--bg-secondary)',
        border: `1px solid ${sentiment.color}33`,
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg sm:text-xl">{sentiment.emoji}</span>
          <span className="text-sm sm:text-base font-bold" style={{ color: sentiment.color }}>
            {sentiment.label}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {sentiment.desc}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
          <span style={{ color: sentiment.color, fontWeight: 700 }}>VIX {vixVal.toFixed(2)}</span>
          <span>({vixChange})</span>
        </div>
      </div>
      {/* Fear gauge bar */}
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-hover)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${sentiment.barPct}%`,
            background: `linear-gradient(90deg, ${sentiment.color}88, ${sentiment.color})`,
          }}
        />
      </div>
      {/* Scale labels */}
      <div className="flex justify-between mt-1 text-[10px]" style={{ color: 'var(--text-muted)' }}>
        <span>탐욕</span>
        <span>공포</span>
      </div>
    </div>
  );
}
