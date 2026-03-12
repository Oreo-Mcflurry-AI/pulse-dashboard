import { useState, useEffect, useCallback, useRef } from 'react';
import { marked } from 'marked';

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
});

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
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsPaused, setTtsPaused] = useState(false);
  const ttsRef = useRef(null);

  // Clean up TTS on unmount or page change
  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, []);
  useEffect(() => {
    window.speechSynthesis?.cancel();
    setTtsPlaying(false);
    setTtsPaused(false);
  }, [selected]);

  const handleTts = useCallback(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    if (ttsPlaying && !ttsPaused) {
      synth.pause();
      setTtsPaused(true);
      return;
    }
    if (ttsPlaying && ttsPaused) {
      synth.resume();
      setTtsPaused(false);
      return;
    }

    // Strip markdown/HTML from summary
    const text = (briefing?.summary || '')
      .replace(/#{1,6}\s/g, '')
      .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<[^>]+>/g, '')
      .replace(/[-|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) return;

    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.1;
    utterance.pitch = 1.0;

    // Try to pick a Korean voice
    const voices = synth.getVoices();
    const koVoice = voices.find(v => v.lang.startsWith('ko'));
    if (koVoice) utterance.voice = koVoice;

    utterance.onend = () => { setTtsPlaying(false); setTtsPaused(false); };
    utterance.onerror = () => { setTtsPlaying(false); setTtsPaused(false); };

    ttsRef.current = utterance;
    synth.speak(utterance);
    setTtsPlaying(true);
    setTtsPaused(false);
  }, [briefing, ttsPlaying, ttsPaused]);

  const stopTts = useCallback(() => {
    window.speechSynthesis?.cancel();
    setTtsPlaying(false);
    setTtsPaused(false);
  }, []);

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
          <>
            {/* Date navigation header */}
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={() => {
                  const idx = dates.indexOf(selected);
                  if (idx < dates.length - 1) handleSelect(dates[idx + 1]);
                }}
                disabled={dates.indexOf(selected) >= dates.length - 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-30"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
              >
                ← 이전
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  {formatDateFull(selected)}
                </span>
                <button
                  onClick={() => {
                    const text = `📰 ${formatDateFull(selected)} 브리핑\n\n${briefing?.summary || ''}`;
                    navigator.clipboard.writeText(text).then(() => {
                      const el = document.getElementById('copy-feedback');
                      if (el) { el.textContent = '복사됨!'; setTimeout(() => { el.textContent = ''; }, 2000); }
                    });
                  }}
                  className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
                  title="브리핑 텍스트 복사"
                >
                  📋
                </button>
                <span id="copy-feedback" className="text-[10px]" style={{ color: '#22c55e' }} />
                {/* TTS buttons */}
                {'speechSynthesis' in window && briefing?.summary && (
                  <div className="flex items-center gap-0.5">
                    <button
                      onClick={handleTts}
                      className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
                      style={{
                        background: ttsPlaying ? (ttsPaused ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)') : 'var(--bg-hover)',
                        color: ttsPlaying ? (ttsPaused ? '#eab308' : '#22c55e') : 'var(--text-muted)',
                      }}
                      title={ttsPlaying ? (ttsPaused ? '이어서 재생' : '일시정지') : '음성으로 듣기'}
                    >
                      {ttsPlaying ? (ttsPaused ? '▶️' : '⏸️') : '🔊'}
                    </button>
                    {ttsPlaying && (
                      <button
                        onClick={stopTts}
                        className="text-[10px] px-1 py-0.5 rounded transition-colors"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                        title="정지"
                      >
                        ⏹️
                      </button>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  const idx = dates.indexOf(selected);
                  if (idx > 0) handleSelect(dates[idx - 1]);
                }}
                disabled={dates.indexOf(selected) <= 0}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-colors disabled:opacity-30"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
              >
                다음 →
              </button>
            </div>
            <article
              className="briefing-content"
              dangerouslySetInnerHTML={{ __html: marked.parse(briefing.summary || '') }}
            />
          </>
        )}
      </main>
    </div>
  );
}
