export default function Header({ updatedAt }) {
  const time = updatedAt ? new Date(updatedAt).toLocaleTimeString('ko-KR') : '--:--:--';
  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse" />
        <h1 className="text-base sm:text-xl font-bold tracking-tight">PULSE</h1>
      </div>
      <span className="text-xs sm:text-sm text-slate-400">{time}</span>
    </header>
  );
}
