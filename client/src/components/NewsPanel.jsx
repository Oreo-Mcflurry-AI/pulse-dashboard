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
      <h3 className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
        {icon} {category}
      </h3>
      <div className="space-y-0.5">
        {articles.map((a, i) => (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2 sm:gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 active:bg-slate-700 transition-colors group"
          >
            <span className="text-xs sm:text-sm text-slate-50 group-hover:text-blue-400 leading-snug flex-1">
              {a.title}
            </span>
            <div className="flex flex-col items-end shrink-0">
              <span className="text-[10px] sm:text-xs text-slate-500">{a.source}</span>
              <span className="text-[10px] sm:text-xs text-slate-600">{timeAgo(a.pubDate)}</span>
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
    <div className="p-3 sm:p-4">
      <h2 className="text-xs sm:text-sm font-semibold text-slate-400 mb-3 sm:mb-4 px-2">📰 뉴스 브리핑</h2>
      {data.sections.map((section, i) => (
        <NewsSection key={i} {...section} />
      ))}
    </div>
  );
}
