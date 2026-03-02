import { useState } from 'react';

export default function Header({ updatedAt, onRefresh }) {
  const [spinning, setSpinning] = useState(false);
  const time = updatedAt ? new Date(updatedAt).toLocaleTimeString('ko-KR') : '--:--:--';

  const handleRefresh = async () => {
    if (spinning || !onRefresh) return;
    setSpinning(true);
    await onRefresh();
    setTimeout(() => setSpinning(false), 500);
  };

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-700">
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-red-500 rounded-full animate-pulse" />
        <h1 className="text-base sm:text-xl font-bold tracking-tight">PULSE</h1>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-xs sm:text-sm text-slate-400">{time}</span>
        <button
          onClick={handleRefresh}
          className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          title="새로고침"
        >
          <svg
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${spinning ? 'animate-spin' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </header>
  );
}
