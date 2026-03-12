import { useState, useCallback } from 'react';

const STORAGE_KEY = 'pulse_widget_layout';
const PRESETS_KEY = 'pulse_layout_presets';

const DEFAULT_WIDGETS = [
  { id: 'sentiment', label: '📊 시장 심리', visible: true },
  { id: 'market', label: '💹 시세 카드', visible: true },
  { id: 'news', label: '📰 뉴스', visible: true },
];

// Built-in presets
const BUILTIN_PRESETS = [
  { id: 'default', name: '기본', icon: '📊', builtin: true, widgets: DEFAULT_WIDGETS },
  { id: 'compact', name: '간소화', icon: '⚡', builtin: true, widgets: [
    { id: 'market', label: '💹 시세 카드', visible: true },
    { id: 'sentiment', label: '📊 시장 심리', visible: false },
    { id: 'news', label: '📰 뉴스', visible: false },
  ]},
  { id: 'news-first', name: '뉴스 중심', icon: '📰', builtin: true, widgets: [
    { id: 'news', label: '📰 뉴스', visible: true },
    { id: 'market', label: '💹 시세 카드', visible: true },
    { id: 'sentiment', label: '📊 시장 심리', visible: false },
  ]},
];

function loadPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePresets(presets) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

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

  const toggleCollapsed = useCallback((id) => {
    setWidgets(prev => {
      const next = prev.map(w => w.id === id ? { ...w, collapsed: !w.collapsed } : w);
      save(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    save(DEFAULT_WIDGETS);
    setWidgets(DEFAULT_WIDGETS);
  }, []);

  // Preset management
  const [presets, setPresets] = useState(loadPresets);

  const allPresets = [...BUILTIN_PRESETS, ...presets];

  const applyPreset = useCallback((presetId) => {
    const preset = [...BUILTIN_PRESETS, ...presets].find(p => p.id === presetId);
    if (!preset) return;
    // Merge preset widgets with defaults (handle new widgets added later)
    const presetIds = new Set(preset.widgets.map(w => w.id));
    const merged = [
      ...preset.widgets,
      ...DEFAULT_WIDGETS.filter(w => !presetIds.has(w.id)).map(w => ({ ...w, visible: false })),
    ];
    save(merged);
    setWidgets(merged);
  }, [presets]);

  const saveAsPreset = useCallback((name) => {
    const id = 'custom_' + Date.now().toString(36);
    const preset = { id, name, icon: '💾', builtin: false, widgets: [...widgets] };
    const next = [...presets, preset];
    setPresets(next);
    savePresets(next);
    return preset;
  }, [widgets, presets]);

  const deletePreset = useCallback((presetId) => {
    const next = presets.filter(p => p.id !== presetId);
    setPresets(next);
    savePresets(next);
  }, [presets]);

  const renamePreset = useCallback((presetId, newName) => {
    const next = presets.map(p => p.id === presetId ? { ...p, name: newName } : p);
    setPresets(next);
    savePresets(next);
  }, [presets]);

  return { widgets, moveUp, moveDown, toggleVisible, toggleCollapsed, reset, allPresets, applyPreset, saveAsPreset, deletePreset, renamePreset };
}
