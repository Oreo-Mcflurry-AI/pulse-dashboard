import { useState, useEffect } from 'react';

export function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('pulse-theme');
    if (saved) return saved === 'dark';
    return true; // default dark
  });

  useEffect(() => {
    localStorage.setItem('pulse-theme', dark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  return { dark, toggle: () => setDark(d => !d) };
}
