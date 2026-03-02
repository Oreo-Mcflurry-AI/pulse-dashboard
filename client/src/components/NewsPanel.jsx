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
            style={{ '--hover-bg': 'var(--bg-hover)' }}
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
  if (!data?.sections?.length) return null;
  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold mb-4 px-2" style={{ color: 'var(--text-muted)' }}>📰 뉴스 브리핑</h2>
      {data.sections.map((section, i) => (
        <NewsSection key={i} {...section} />
      ))}
    </div>
  );
}
