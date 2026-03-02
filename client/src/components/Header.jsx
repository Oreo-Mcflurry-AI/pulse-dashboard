export default function Header({ updatedAt }) {
  const time = updatedAt ? new Date(updatedAt).toLocaleTimeString('ko-KR') : '--:--:--';
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        <h1 className="text-xl font-bold tracking-tight">PULSE DASHBOARD</h1>
      </div>
      <span className="text-sm text-slate-400">Last update: {time}</span>
    </header>
  );
}
