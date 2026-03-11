import { useState, useEffect, useMemo } from 'react';

const IMPACT_COLORS = {
  3: { bg: '#ef444420', border: '#ef444440', text: '#ef4444', label: '🔴 높음' },
  2: { bg: '#f59e0b20', border: '#f59e0b40', text: '#f59e0b', label: '🟡 보통' },
  1: { bg: '#6b728020', border: '#6b728040', text: '#6b7280', label: '⚪ 낮음' },
  0: { bg: '#6b728010', border: '#6b728020', text: '#6b728080', label: '📅 휴일' },
};

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const kst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return `${String(kst.getHours()).padStart(2, '0')}:${String(kst.getMinutes()).padStart(2, '0')}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()} (${DAY_NAMES[d.getDay()]})`;
}

function isToday(dateStr) {
  const now = new Date();
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return dateStr === kst.toISOString().slice(0, 10);
}

function isPast(dateStr) {
  const now = new Date();
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  return dateStr < kst.toISOString().slice(0, 10);
}

function EventRow({ event }) {
  const colors = IMPACT_COLORS[event.impactLevel] || IMPACT_COLORS[1];
  const time = formatTime(event.date);
  const hasResult = event.actual !== '';
  const now = new Date();
  const eventTime = new Date(event.date);
  const isPastEvent = eventTime < now;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 transition-colors"
      style={{
        borderLeft: `3px solid ${colors.border}`,
        background: hasResult ? 'transparent' : colors.bg,
        opacity: isPastEvent && !hasResult ? 0.6 : 1,
      }}
    >
      {/* Time */}
      <span className="text-[10px] sm:text-xs tabular-nums w-10 shrink-0" style={{ color: 'var(--text-muted)' }}>
        {time || '--:--'}
      </span>

      {/* Flag + Country */}
      <span className="text-sm shrink-0">{event.flag}</span>

      {/* Title */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{event.title}</div>
        <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
          {event.countryName}
        </div>
      </div>

      {/* Impact dots */}
      <div className="flex gap-0.5 shrink-0">
        {[1, 2, 3].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: i <= event.impactLevel ? colors.text : 'var(--border)' }}
          />
        ))}
      </div>

      {/* Forecast / Actual / Previous */}
      <div className="text-right shrink-0 w-28 sm:w-36">
        {hasResult ? (
          <div className="flex items-center gap-1 justify-end">
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>결과:</span>
            <span className="text-xs font-bold" style={{ color: '#22c55e' }}>{event.actual}</span>
          </div>
        ) : event.forecast ? (
          <div className="flex items-center gap-1 justify-end">
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>예상:</span>
            <span className="text-xs tabular-nums">{event.forecast}</span>
          </div>
        ) : null}
        {event.previous && (
          <div className="flex items-center gap-1 justify-end">
            <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>이전:</span>
            <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)' }}>{event.previous}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'high' | 'USD' | 'EUR' etc
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    fetch('/api/calendar')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!data?.grouped) return {};
    const result = {};
    for (const [date, events] of Object.entries(data.grouped)) {
      if (!showPast && isPast(date)) continue;
      let evts = events;
      if (filter === 'high') evts = evts.filter(e => e.impactLevel >= 3);
      else if (filter === 'medium+') evts = evts.filter(e => e.impactLevel >= 2);
      else if (filter !== 'all') evts = evts.filter(e => e.country === filter);
      if (evts.length > 0) result[date] = evts;
    }
    return result;
  }, [data, filter, showPast]);

  const dates = Object.keys(filtered).sort();
  const countries = useMemo(() => {
    if (!data?.events) return [];
    const set = new Set(data.events.map(e => e.country).filter(Boolean));
    return [...set].sort();
  }, [data]);

  return (
    <div className="px-3 sm:px-4 py-4 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold">📅 경제 캘린더</h2>
          {data && (
            <p className="text-[10px] sm:text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              이번주 {data.totalEvents}건 · 주요 {data.highImpact}건
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {[
          { key: 'all', label: '전체' },
          { key: 'high', label: '🔴 주요만' },
          { key: 'medium+', label: '🟡+ 보통↑' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="text-[10px] sm:text-xs px-2.5 py-1 rounded-full transition-colors"
            style={{
              background: filter === f.key ? 'var(--text-primary)' : 'var(--bg-hover)',
              color: filter === f.key ? 'var(--bg-primary)' : 'var(--text-muted)',
              fontWeight: filter === f.key ? 600 : 400,
            }}
          >
            {f.label}
          </button>
        ))}
        <span className="w-px mx-1" style={{ background: 'var(--border)' }} />
        {countries.slice(0, 8).map(c => {
          const flag = { USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', CNY: '🇨🇳', NZD: '🇳🇿' }[c] || '🏳️';
          return (
            <button
              key={c}
              onClick={() => setFilter(filter === c ? 'all' : c)}
              className="text-[10px] sm:text-xs px-2 py-1 rounded-full transition-colors"
              style={{
                background: filter === c ? 'var(--text-primary)' : 'var(--bg-hover)',
                color: filter === c ? 'var(--bg-primary)' : 'var(--text-muted)',
              }}
            >
              {flag} {c}
            </button>
          );
        })}
        <label className="flex items-center gap-1 ml-auto text-[10px] cursor-pointer" style={{ color: 'var(--text-muted)' }}>
          <input type="checkbox" checked={showPast} onChange={() => setShowPast(!showPast)} className="w-3 h-3" />
          지난 일정
        </label>
      </div>

      {/* Calendar */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>캘린더 불러오는 중...</div>
        </div>
      ) : dates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48" style={{ color: 'var(--text-muted)' }}>
          <span className="text-3xl mb-2">📭</span>
          <span className="text-xs">표시할 이벤트가 없습니다</span>
          {data?.error && <span className="text-[10px] mt-1" style={{ color: '#f59e0b' }}>{data.error}</span>}
        </div>
      ) : (
        <div className="space-y-3">
          {dates.map(date => {
            const today = isToday(date);
            return (
              <div key={date} className="rounded-xl overflow-hidden" style={{
                background: 'var(--bg-card)',
                border: `1px solid ${today ? '#3b82f640' : 'var(--border)'}`,
              }}>
                {/* Date header */}
                <div className="flex items-center gap-2 px-3 py-2" style={{
                  background: today ? '#3b82f615' : 'var(--bg-hover)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <span className="text-xs font-bold" style={{ color: today ? '#3b82f6' : 'var(--text-primary)' }}>
                    {formatDate(date)}
                  </span>
                  {today && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: '#3b82f620', color: '#3b82f6' }}>오늘</span>}
                  <span className="text-[9px] ml-auto" style={{ color: 'var(--text-muted)' }}>
                    {filtered[date].length}건
                    {filtered[date].filter(e => e.impactLevel >= 3).length > 0 &&
                      ` · 🔴 ${filtered[date].filter(e => e.impactLevel >= 3).length}`
                    }
                  </span>
                </div>
                {/* Events */}
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {filtered[date].map((event, i) => (
                    <EventRow key={`${event.date}-${i}`} event={event} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3 text-[9px]" style={{ color: 'var(--text-muted)' }}>
        <span>시간은 KST 기준</span>
        <span>🔴 높음 = 시장 영향 큼</span>
        <span>🟡 보통 = 시장 영향 중간</span>
        <span>⚪ 낮음 = 시장 영향 적음</span>
        <span>출처: ForexFactory</span>
      </div>
    </div>
  );
}
