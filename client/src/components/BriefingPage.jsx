import { useState, useEffect } from 'react';

function renderMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold mt-4 mb-1" style="color:var(--text-primary)">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mt-5 mb-2" style="color:var(--text-primary)">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-2" style="color:var(--text-primary)">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="my-2 space-y-0.5">$&</ul>')
    .replace(/\n\n/g, '<br/><br/>')
    .replace(/\n/g, '<br/>');
}

function DateList({ dates, selected, onSelect }) {
  return (
    <div className="space-y-0.5">
      {dates.map(d => (
        <button
          key={d}
          onClick={() => onSelect(d)}
          className="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
          style={{
            background: d === selected ? 'var(--bg-hover)' : 'transparent',
            color: d === selected ? 'var(--text-primary)' : 'var(--text-muted)',
            fontWeight: d === selected ? 600 : 400,
          }}
        >
          {formatDate(d)}
        </button>
      ))}
      {dates.length === 0 && (
        <p className="text-sm px-3 py-4" style={{ color: 'var(--text-muted)' }}>아직 브리핑이 없습니다</p>
      )}
    </div>
  );
}

function formatDate(d) {
  const dt = new Date(d + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${dt.getMonth() + 1}/${dt.getDate()} (${days[dt.getDay()]})`;
}

function formatDateFull(d) {
  const dt = new Date(d + 'T00:00:00');
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
  return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월 ${dt.getDate()}일 ${days[dt.getDay()]}`;
}

export default function BriefingPage() {
  const [dates, setDates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [briefing, setBriefing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch('/api/briefings').then(r => r.json()).then(d => {
      setDates(d.dates || []);
      if (d.dates?.length) setSelected(d.dates[0]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setBriefing(null);
    fetch(`/api/briefings/${selected}`).then(r => r.json()).then(d => {
      setBriefing(d);
    }).catch(() => {});
  }, [selected]);

  const handleSelect = (d) => {
    setSelected(d);
    setMobileOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>로딩 중...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row min-h-[60vh]">
      {/* Mobile date selector */}
      <div className="md:hidden px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm"
          style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)' }}
        >
          <span>{selected ? formatDate(selected) : '날짜 선택'}</span>
          <span>{mobileOpen ? '▲' : '▼'}</span>
        </button>
        {mobileOpen && (
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg p-1" style={{ background: 'var(--bg-secondary)' }}>
            <DateList dates={dates} selected={selected} onSelect={handleSelect} />
          </div>
        )}
      </div>

      {/* Desktop sidebar */}
      <aside
        className="hidden md:block w-48 shrink-0 p-3 overflow-y-auto"
        style={{ borderRight: '1px solid var(--border)', maxHeight: 'calc(100vh - 120px)' }}
      >
        <h3 className="text-xs font-bold uppercase tracking-wider px-3 mb-2" style={{ color: 'var(--text-muted)' }}>
          📅 날짜
        </h3>
        <DateList dates={dates} selected={selected} onSelect={handleSelect} />
      </aside>

      {/* Main content */}
      <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
        {!selected ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>날짜를 선택해 주세요</p>
        ) : !briefing ? (
          <div className="animate-pulse text-sm" style={{ color: 'var(--text-muted)' }}>로딩 중...</div>
        ) : (
          <div>
            <h2 className="text-lg font-bold mb-4">{formatDateFull(selected)} 브리핑</h2>

            {/* Summary */}
            {briefing.summary && (
              <div
                className="prose prose-sm max-w-none mb-6 leading-relaxed text-sm"
                style={{ color: 'var(--text-primary)' }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(briefing.summary) }}
              />
            )}

            {/* Articles */}
            {briefing.articles?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                  🔗 관련 뉴스
                </h3>
                <div className="space-y-1">
                  {briefing.articles.map((a, i) => (
                    <a
                      key={i}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 px-3 py-2 rounded-lg transition-colors"
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span className="text-sm leading-snug flex-1 hover:text-blue-500">{a.title}</span>
                      <div className="flex flex-col items-end shrink-0">
                        {a.source && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.source}</span>}
                        {a.category && <span className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>{a.category}</span>}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
