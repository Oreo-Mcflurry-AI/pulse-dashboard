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
    briefing: {
      empty: '아직 브리핑이 없습니다',
      selectDate: '날짜 선택',
      selectDatePrompt: '날짜를 선택해 주세요',
      prev: '이전',
      next: '다음',
      copied: '복사됨!',
      copyBriefing: '브리핑 텍스트 복사',
    },
    calendar: {
      title: '📅 경제 캘린더',
      weekSummary: '이번주 {total}건 · 주요 {high}건',
      filterAll: '전체',
      filterHigh: '🔴 주요만',
      filterMediumUp: '🟡+ 보통↑',
      showPast: '지난 일정',
      loading: '캘린더 불러오는 중...',
      noEvents: '표시할 이벤트가 없습니다',
      today: '오늘',
      countSuffix: '건',
      legendTime: '시간은 KST 기준',
      legendHigh: '🔴 높음 = 시장 영향 큼',
      legendMedium: '🟡 보통 = 시장 영향 중간',
      legendLow: '⚪ 낮음 = 시장 영향 적음',
      legendSource: '출처: ForexFactory',
    },
    app: {
      liveStatusTitle: 'LIVE (실시간)',
      pollingStatusTitle: 'Polling (30s)',
      liveConnected: '실시간 연결됨',
      pollingMode: '폴링 모드',
      marketAlertSettings: '마켓 알림 설정',
      marketAlertThreshold: '마켓 알림 임계값 설정',
      reset: '초기화',
      presets: '프리셋',
      presetNamePlaceholder: '프리셋 이름',
      save: '저장',
      deletePreset: '프리셋 삭제',
      show: '표시',
      hidden: '숨김',
      expand: '펼치기',
      collapse: '접기',
      collapsed: '접힘',
      reconnectFailed: '서버 연결 실패',
      showingLastData: '마지막 데이터 표시 중',
      retry: '재시도',
      marketSummary: '📊 현재 시장 요약',
      close: '닫기',
      realtimeStreaming: '🟢 실시간 스트리밍',
      autoUpdate30s: '30초마다 자동 업데이트',
      krxOpen: '장중',
      krxClosed: '장외',
      nyseOpen: '장중',
      nyseClosed: '장외',
      opensIn: '후 개장',
      visitCountSuffix: '번째 방문',
      justNow: '방금',
      secondsAgo: '초 전',
      minutesAgo: '분 전',
      days: '일',
      hours: '시간',
      minutes: '분',
      shortcutsDisabledInInput: '입력 필드 포커스 시 단축키 비활성',
      moreMenu: '더보기 메뉴',
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
    briefing: {
      empty: 'No briefings yet',
      selectDate: 'Select date',
      selectDatePrompt: 'Please select a date',
      prev: 'Previous',
      next: 'Next',
      copied: 'Copied!',
      copyBriefing: 'Copy briefing text',
    },
    calendar: {
      title: '📅 Economic Calendar',
      weekSummary: 'This week {total} events · {high} high impact',
      filterAll: 'All',
      filterHigh: '🔴 High only',
      filterMediumUp: '🟡+ Medium↑',
      showPast: 'Show past',
      loading: 'Loading calendar...',
      noEvents: 'No events to display',
      today: 'Today',
      countSuffix: '',
      legendTime: 'Times are in KST',
      legendHigh: '🔴 High = strong market impact',
      legendMedium: '🟡 Medium = moderate market impact',
      legendLow: '⚪ Low = light market impact',
      legendSource: 'Source: ForexFactory',
    },
    app: {
      liveStatusTitle: 'LIVE (Realtime)',
      pollingStatusTitle: 'Polling (30s)',
      liveConnected: 'Realtime connected',
      pollingMode: 'Polling mode',
      marketAlertSettings: 'Market alert settings',
      marketAlertThreshold: 'Set market alert thresholds',
      reset: 'Reset',
      presets: 'Presets',
      presetNamePlaceholder: 'Preset name',
      save: 'Save',
      deletePreset: 'Delete preset',
      show: 'Show',
      hidden: 'Hidden',
      expand: 'Expand',
      collapse: 'Collapse',
      collapsed: 'Collapsed',
      reconnectFailed: 'Server connection failed',
      showingLastData: 'Showing last known data',
      retry: 'Retry',
      marketSummary: '📊 Market summary',
      close: 'Close',
      realtimeStreaming: '🟢 Realtime streaming',
      autoUpdate30s: 'Auto update every 30s',
      krxOpen: 'Open',
      krxClosed: 'Closed',
      nyseOpen: 'Open',
      nyseClosed: 'Closed',
      opensIn: 'until open',
      visitCountSuffix: 'th visit',
      justNow: 'Just now',
      secondsAgo: 's ago',
      minutesAgo: 'm ago',
      days: 'd',
      hours: 'h',
      minutes: 'm',
      shortcutsDisabledInInput: 'Shortcuts disabled while typing in input fields',
      moreMenu: 'More menu',
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
