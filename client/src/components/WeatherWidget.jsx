import { useState, useEffect } from 'react';

export default function WeatherWidget() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/weather')
      .then(r => r.json())
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error || !data) return null;

  const { current, daily } = data;

  return (
    <div
      className="mx-3 sm:mx-4 mt-2 p-3 rounded-xl"
      role="region"
      aria-label="날씨 정보"
      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between">
        {/* Current weather */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">{current.icon}</span>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-bold tabular-nums">{current.temp}°</span>
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                체감 {current.feelsLike}°
              </span>
            </div>
            <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
              {data.city} · {current.desc} · 💧{current.humidity}% · 💨{current.windSpeed}km/h
            </div>
          </div>
        </div>

        {/* 3-day forecast */}
        <div className="hidden sm:flex items-center gap-3">
          {daily.slice(1, 4).map(d => (
            <div key={d.date} className="text-center">
              <div className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>{d.dayOfWeek}</div>
              <div className="text-sm my-0.5">{d.icon}</div>
              <div className="text-[9px] tabular-nums">
                <span style={{ color: '#ef4444' }}>{d.high}°</span>
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <span style={{ color: '#3b82f6' }}>{d.low}°</span>
              </div>
              {d.precipProb != null && d.precipProb > 0 && (
                <div className="text-[8px]" style={{ color: '#3b82f6' }}>💧{d.precipProb}%</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile: compact forecast */}
      <div className="sm:hidden flex justify-around mt-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
        {daily.slice(1, 4).map(d => (
          <div key={d.date} className="text-center">
            <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{d.dayOfWeek}</div>
            <div className="text-xs my-0.5">{d.icon}</div>
            <div className="text-[9px] tabular-nums">
              <span style={{ color: '#ef4444' }}>{d.high}°</span>/<span style={{ color: '#3b82f6' }}>{d.low}°</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
