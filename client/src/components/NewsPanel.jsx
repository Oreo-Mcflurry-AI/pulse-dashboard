import { useState } from 'react';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}분 전`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}시간 전`;
  return `${Math.floor(hrs / 24)}일 전`;
}

function NewsSection({ icon, category, articles }) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-bold uppercase tracking-wider px-3 mb-2" style={{ color: 'var(--text-muted)' }}>
        {icon} {category}
      </h3>
      <div className="space-y-0.5">
        {articles.map((a, i) => (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 px-3 py-1.5 rounded-lg transition-colors group"
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span className="text-sm leading-snug flex-1 group-hover:text-blue-500 dark:group-hover:text-blue-400">
              {a.title}
            </span>
            <div className="flex flex-col items-end shrink-0">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{a.source}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>{timeAgo(a.pubDate)}</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function NewsPanel({ data }) {
  const [filter, setFilter] = useState('all');

  if (!data?.sections?.length) return null;

  const categories = ['all', ...data.sections.map(s => s.category)];
  const filtered = filter === 'all' ? data.sections : data.sections.filter(s => s.category === filter);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3 px-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>📰 뉴스 브리핑</h2>
        <span className="text-[10px]" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
          {data.sections.reduce((sum, s) => sum + (s.articles?.length || 0), 0)}건
        </span>
      </div>
      {/* Category filter tabs */}
      <div className="flex gap-1 px-2 mb-3 overflow-x-auto scrollbar-hide">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className="px-2.5 py-1 text-[11px] rounded-full whitespace-nowrap transition-colors"
            style={{
              background: filter === cat ? 'var(--text-primary)' : 'var(--bg-hover)',
              color: filter === cat ? 'var(--bg-primary)' : 'var(--text-muted)',
              fontWeight: filter === cat ? 600 : 400,
            }}
          >
            {cat === 'all' ? '전체' : (data.sections.find(s => s.category === cat)?.icon || '') + ' ' + cat}
          </button>
        ))}
      </div>
      {filtered.map((section, i) => (
        <NewsSection key={i} {...section} />
      ))}
    </div>
  );
}
