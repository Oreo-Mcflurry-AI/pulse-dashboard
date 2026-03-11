import { useState, useCallback } from 'react';

const STORAGE_KEY = 'pulse_widget_layout';

const DEFAULT_WIDGETS = [
  { id: 'sentiment', label: '📊 시장 심리', visible: true },
  { id: 'market', label: '💹 시세 카드', visible: true },
  { id: 'news', label: '📰 뉴스', visible: true },
];

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WIDGETS;
    const saved = JSON.parse(raw);
    // Merge with defaults (in case new widgets were added)
    const savedIds = new Set(saved.map(w => w.id));
    const merged = [
      ...saved,
      ...DEFAULT_WIDGETS.filter(w => !savedIds.has(w.id)),
    ];
    return merged;
  } catch {
    return DEFAULT_WIDGETS;
  }
}

function save(widgets) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
}

export function useWidgetLayout() {
  const [widgets, setWidgets] = useState(load);

  const moveUp = useCallback((id) => {
    setWidgets(prev => {
      const idx = prev.findIndex(w => w.id === id);
      if (idx <= 0) return prev;
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      save(next);
      return next;
    });
  }, []);

  const moveDown = useCallback((id) => {
    setWidgets(prev => {
      const idx = prev.findIndex(w => w.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      save(next);
      return next;
    });
  }, []);

  const toggleVisible = useCallback((id) => {
    setWidgets(prev => {
      const next = prev.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
      save(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    save(DEFAULT_WIDGETS);
    setWidgets(DEFAULT_WIDGETS);
  }, []);

  return { widgets, moveUp, moveDown, toggleVisible, reset };
}
