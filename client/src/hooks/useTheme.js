import { useState, useEffect, useCallback } from 'react';

const THEME_KEY = 'pulse-theme';
const MODE_KEY = 'pulse-theme-mode'; // 'manual' | 'system' | 'auto'

// Auto mode: dark 19:00-07:00 KST
function isNightKST() {
  const kst = new Date(Date.now() + 9 * 3600000);
  const h = kst.getUTCHours();
  return h >= 19 || h < 7;
}

function getSystemPrefersDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
}

function resolveTheme(mode, savedDark) {
  if (mode === 'system') return getSystemPrefersDark();
  if (mode === 'auto') return isNightKST();
  return savedDark; // manual
}

export function useTheme() {
  const [mode, setModeState] = useState(() => {
    if (typeof window === 'undefined') return 'manual';
    return localStorage.getItem(MODE_KEY) || 'manual';
  });

  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem(THEME_KEY);
    const savedDark = saved ? saved === 'dark' : true;
    const m = localStorage.getItem(MODE_KEY) || 'manual';
    return resolveTheme(m, savedDark);
  });

  // Apply theme to DOM
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // Listen system preference changes (for 'system' mode)
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  // Auto mode: check every minute
  useEffect(() => {
    if (mode !== 'auto') return;
    const check = () => setDark(isNightKST());
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [mode]);

  // Manual toggle (only works in manual mode, switches to manual if in other mode)
  const toggle = useCallback(() => {
    setModeState('manual');
    localStorage.setItem(MODE_KEY, 'manual');
    setDark(d => {
      const next = !d;
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
      return next;
    });
  }, []);

  // Switch mode
  const setMode = useCallback((m) => {
    setModeState(m);
    localStorage.setItem(MODE_KEY, m);
    if (m === 'system') {
      setDark(getSystemPrefersDark());
    } else if (m === 'auto') {
      setDark(isNightKST());
    } else {
      // manual: use saved
      const saved = localStorage.getItem(THEME_KEY);
      setDark(saved ? saved === 'dark' : true);
    }
  }, []);

  return { dark, toggle, mode, setMode };
}
