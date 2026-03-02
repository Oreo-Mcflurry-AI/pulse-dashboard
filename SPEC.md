# Pulse Dashboard v0.1 — MVP Spec

## 개요
실시간 시세 + 뉴스 대시보드. 다크 테마. 이 서버에서 직접 호스팅.

## 기술 스택
- **Frontend:** React 19 + Vite + TailwindCSS v4
- **Backend:** Express.js (API proxy + RSS 파싱 + 캐싱)
- **DB:** SQLite (better-sqlite3) — 시세 캐시, 뉴스 저장
- **배포:** PM2 + Nginx 리버스 프록시
- **포트:** Backend :4100, Frontend dev :4101, Nginx :80

## 디렉토리 구조
```
pulse-dashboard/
├── client/          # React + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── MarketCard.jsx      # 개별 시세 카드
│   │   │   ├── MarketGrid.jsx      # 시세 카드 그리드
│   │   │   ├── NewsPanel.jsx       # 뉴스 헤드라인 리스트
│   │   │   ├── Header.jsx          # 상단 헤더
│   │   │   └── Layout.jsx          # 전체 레이아웃
│   │   ├── hooks/
│   │   │   └── useMarketData.js    # 시세 데이터 폴링 훅
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── server/          # Express API
│   ├── src/
│   │   ├── routes/
│   │   │   ├── market.js           # GET /api/market — 시세 데이터
│   │   │   └── news.js             # GET /api/news — 뉴스 헤드라인
│   │   ├── services/
│   │   │   ├── marketService.js    # 네이버 시세 API 호출 + 캐싱
│   │   │   └── newsService.js      # Google News RSS 파싱 + 캐싱
│   │   ├── db.js                   # SQLite 초기화
│   │   └── index.js                # Express 앱 진입점
│   └── package.json
├── SPEC.md
└── README.md
```

## API 엔드포인트

### GET /api/market
```json
{
  "kospi": { "value": "2,645.12", "change": "-1.23%", "status": "CLOSE" },
  "kosdaq": { "value": "845.32", "change": "-0.89%", "status": "CLOSE" },
  "usdkrw": { "value": "1,456.20", "change": "+0.45%" },
  "oil": { "value": "82.45", "change": "+10.2%" },
  "btc": { "value": "87,234,000", "change": "-2.1%" },
  "sp500": { "value": "5,954.50", "change": "-0.67%" },
  "nasdaq": { "value": "18,847.28", "change": "-0.92%" },
  "dow": { "value": "43,840.91", "change": "-0.45%" }
}
```

데이터 소스:
- 코스피/코스닥: `m.stock.naver.com/api/index/{KOSPI|KOSDAQ}/basic`
- 환율: `api.stock.naver.com/marketindex/exchange/FX_USDKRW`
- 비트코인: `api.upbit.com/v1/ticker?markets=KRW-BTC`
- 미국지수: `api.stock.naver.com/index/{.DJI|.INX|.IXIC}/basic`
- 유가: WTI 시세 (네이버 or 외부)

캐싱: 30초 TTL (SQLite)

### GET /api/news
```json
{
  "articles": [
    {
      "title": "...",
      "source": "CNN",
      "url": "https://...",
      "pubDate": "2026-03-02T..."
    }
  ]
}
```

데이터 소스: Google News RSS (`news.google.com/rss/search?q=...`)
캐싱: 5분 TTL

## UI 설계

### 레이아웃 (다크 테마)
```
┌─────────────────────────────────────┐
│  🔴 PULSE DASHBOARD     Last: 13:05 │
├─────────────────────────────────────┤
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌────┐ │
│  │KOSPI │ │KOSDAQ│ │USD/  │ │WTI │ │
│  │2,645 │ │845   │ │KRW   │ │82  │ │
│  │-1.23%│ │-0.89%│ │1,456 │ │+10%│ │
│  └──────┘ └──────┘ └──────┘ └────┘ │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌────┐ │
│  │BTC   │ │S&P   │ │NASDAQ│ │DOW │ │
│  │8,723 │ │5,954 │ │18,847│ │43k │ │
│  │-2.1% │ │-0.67%│ │-0.92%│ │-0.4│ │
│  └──────┘ └──────┘ └──────┘ └────┘ │
├─────────────────────────────────────┤
│  📰 Headlines                        │
│  • US-Iran war escalates...    CNN  │
│  • Oil prices surge 13%...    NYT  │
│  • Markets brace for...      CNBC  │
│  • ...                              │
└─────────────────────────────────────┘
```

### 색상
- 배경: `#0f172a` (slate-900)
- 카드: `#1e293b` (slate-800)
- 상승: `#22c55e` (green-500)
- 하락: `#ef4444` (red-500)
- 텍스트: `#f8fafc` (slate-50)

## MVP 범위 (v0.1)
- [x] 시세 8종목 실시간 표시 (30초 폴링)
- [x] 뉴스 헤드라인 10개
- [x] 다크 테마 반응형 UI
- [x] 30초 자동 새로고침
- [x] PM2로 프로세스 관리
- [x] Nginx 리버스 프록시

## 향후 확장 (v0.2+)
- 시세 차트 (mini sparkline)
- 뉴스 카테고리 필터
- 알림 설정
- 포트폴리오 트래커
- WebSocket 실시간 업데이트
