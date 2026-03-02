export default function NewsPanel({ data }) {
  if (!data?.articles?.length) return null;
  return (
    <div className="p-4">
      <h2 className="text-sm font-semibold text-slate-400 mb-3 px-2">📰 HEADLINES</h2>
      <div className="space-y-1">
        {data.articles.map((a, i) => (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 transition-colors group"
          >
            <span className="text-sm text-slate-50 group-hover:text-blue-400 leading-snug flex-1">
              {a.title}
            </span>
            <span className="text-xs text-slate-500 whitespace-nowrap mt-0.5">
              {a.source}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
