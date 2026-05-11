export const LANG_KEY = 'pulse-language';

export const translations = {
  ko: {
    nav: {
      dashboard: '대시보드',
      briefings: '📰 브리핑',
      portfolio: '💼 포트폴리오',
      history: '📈 히스토리',
      heatmap: '🗺️ 히트맵',
      calendar: '📅 캘린더',
      search: '🔍 종목',
      timeline: '🌍 타임라인',
      rss: '📡 RSS',
      more: '더보기',
    },
    common: {
      loading: '불러오는 중...',
      skipToContent: '본문으로 건너뛰기',
      mainMenu: '주요 메뉴',
      mobileMenu: '모바일 메뉴',
      languageToggle: '언어 전환',
    },
    dashboard: {
      widgetSettings: '⚙️ 위젯 순서 설정',
      shortcuts: '⌨️ 키보드 단축키',
    },
  },
  en: {
    nav: {
      dashboard: 'Dashboard',
      briefings: '📰 Briefings',
      portfolio: '💼 Portfolio',
      history: '📈 History',
      heatmap: '🗺️ Heatmap',
      calendar: '📅 Calendar',
      search: '🔍 Search',
      timeline: '🌍 Timeline',
      rss: '📡 RSS',
      more: 'More',
    },
    common: {
      loading: 'Loading...',
      skipToContent: 'Skip to main content',
      mainMenu: 'Main navigation',
      mobileMenu: 'Mobile navigation',
      languageToggle: 'Toggle language',
    },
    dashboard: {
      widgetSettings: '⚙️ Widget order settings',
      shortcuts: '⌨️ Keyboard shortcuts',
    },
  },
};

export function resolveInitialLanguage() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'ko' || saved === 'en') return saved;
  } catch {}
  return 'ko';
}

export function makeT(lang) {
  return (key) => {
    const parts = key.split('.');
    let node = translations[lang] || translations.ko;
    for (const part of parts) {
      node = node?.[part];
      if (node == null) break;
    }
    if (typeof node === 'string') return node;

    let fallback = translations.ko;
    for (const part of parts) fallback = fallback?.[part];
    return typeof fallback === 'string' ? fallback : key;
  };
}
