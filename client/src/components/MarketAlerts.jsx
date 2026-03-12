import { useState, useEffect, useCallback, useRef } from 'react';
import { addNotification, shouldNotify } from './NotificationCenter';

// ─── Storage ───
const ALERTS_KEY = 'pulse-market-alerts';
const FIRED_KEY = 'pulse-market-alerts-fired';

const MARKET_NAMES = {
  kospi: 'KOSPI',
  kosdaq: 'KOSDAQ',
  usdkrw: 'USD/KRW',
  btc: 'BTC/KRW',
  sp500: 'S&P 500',
  nasdaq: 'NASDAQ',
  dow: 'DOW',
  oil: 'WTI',
  gold: 'GOLD',
  vix: 'VIX',
};

const MARKET_ICONS = {
  kospi: '🇰🇷', kosdaq: '🇰🇷', usdkrw: '💱', btc: '₿',
  sp500: '🇺🇸', nasdaq: '🇺🇸', dow: '🇺🇸', oil: '🛢️', gold: '🥇', vix: '😨',
};

const CONDITION_LABELS = {
  change_above: '변동률 ≥',
  change_below: '변동률 ≤',
  price_above: '가격 ≥',
  price_below: '가격 ≤',
};

// Default thresholds (suggestions)
const DEFAULT_THRESHOLDS = {
  kospi: { change: 2.0, price: null },
  kosdaq: { change: 2.5, price: null },
  usdkrw: { change: 1.0, price: 1500 },
  btc: { change: 5.0, price: null },
  sp500: { change: 2.0, price: null },
  nasdaq: { change: 2.5, price: null },
  dow: { change: 2.0, price: null },
  oil: { change: 3.0, price: null },
  gold: { change: 2.0, price: null },
  vix: { change: 10.0, price: 30 },
};

export function getAlerts() {
  try { return JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]'); } catch { return []; }
}

export function saveAlerts(alerts) {
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

function getFired() {
  try { return JSON.parse(localStorage.getItem(FIRED_KEY) || '{}'); } catch { return {}; }
}

function setFired(key) {
  const fired = getFired();
  fired[key] = Date.now();
  // Clean old entries (>24h)
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const k of Object.keys(fired)) {
    if (fired[k] < cutoff) delete fired[k];
  }
  localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
}

function wasFiredRecently(key, cooldownMs = 30 * 60 * 1000) {
  const fired = getFired();
  return fired[key] && (Date.now() - fired[key] < cooldownMs);
}

// ─── Alert Checking Hook ───
export function useMarketAlertChecker(market) {
  const prevRef = useRef(null);

  useEffect(() => {
    if (!market) return;
    const alerts = getAlerts().filter(a => a.enabled);
    if (alerts.length === 0) return;
    if (!shouldNotify('market')) return;

    for (const alert of alerts) {
      const item = market[alert.market];
      if (!item) continue;

      const currentPrice = parseFloat(String(item.value).replace(/,/g, ''));
      const changeRate = parseFloat(item.changeRate) || 0;
      if (isNaN(currentPrice)) continue;

      const alertKey = `${alert.id}-${alert.condition}`;
      if (wasFiredRecently(alertKey)) continue;

      let triggered = false;
      let message = '';

      switch (alert.condition) {
        case 'change_above':
          if (Math.abs(changeRate) >= alert.threshold) {
            triggered = true;
            message = `${MARKET_NAMES[alert.market]} 변동률 ${changeRate > 0 ? '+' : ''}${changeRate.toFixed(2)}% (임계값: ±${alert.threshold}%)`;
          }
          break;
        case 'change_below':
          if (changeRate <= -alert.threshold) {
            triggered = true;
            message = `${MARKET_NAMES[alert.market]} ${changeRate.toFixed(2)}% 하락 (임계값: -${alert.threshold}%)`;
          }
          break;
        case 'price_above':
          if (currentPrice >= alert.threshold) {
            triggered = true;
            message = `${MARKET_NAMES[alert.market]} ${currentPrice.toLocaleString()} 돌파 (목표: ${alert.threshold.toLocaleString()})`;
          }
          break;
        case 'price_below':
          if (currentPrice <= alert.threshold) {
            triggered = true;
            message = `${MARKET_NAMES[alert.market]} ${currentPrice.toLocaleString()} 하회 (기준: ${alert.threshold.toLocaleString()})`;
          }
          break;
      }

      if (triggered) {
        setFired(alertKey);
        addNotification({
          type: 'market',
          title: `🚨 ${MARKET_NAMES[alert.market]} 알림`,
          body: message,
        });
      }
    }

    prevRef.current = market;
  }, [market?.updatedAt]);
}

// ─── Alert Settings UI ───
export default function MarketAlertSettings({ isOpen, onClose }) {
  const [alerts, setAlerts] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newAlert, setNewAlert] = useState({
    market: 'kospi',
    condition: 'change_above',
    threshold: 2.0,
  });

  useEffect(() => {
    if (isOpen) setAlerts(getAlerts());
  }, [isOpen]);

  const save = useCallback((next) => {
    setAlerts(next);
    saveAlerts(next);
  }, []);

  const addAlert = useCallback(() => {
    const alert = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ...newAlert,
      threshold: parseFloat(newAlert.threshold) || 0,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    const next = [...alerts, alert];
    save(next);
    setAdding(false);
    setNewAlert({ market: 'kospi', condition: 'change_above', threshold: 2.0 });
  }, [alerts, newAlert, save]);

  const toggleAlert = useCallback((id) => {
    const next = alerts.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a);
    save(next);
  }, [alerts, save]);

  const removeAlert = useCallback((id) => {
    const next = alerts.filter(a => a.id !== id);
    save(next);
  }, [alerts, save]);

  const addQuickAlerts = useCallback(() => {
    const quickAlerts = [
      { market: 'kospi', condition: 'change_above', threshold: 2.0 },
      { market: 'usdkrw', condition: 'price_above', threshold: 1500 },
      { market: 'btc', condition: 'change_above', threshold: 5.0 },
      { market: 'vix', condition: 'price_above', threshold: 30 },
      { market: 'nasdaq', condition: 'change_above', threshold: 2.5 },
    ].map(a => ({
      ...a,
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      enabled: true,
      createdAt: new Date().toISOString(),
    }));
    save([...alerts, ...quickAlerts]);
  }, [alerts, save]);

  if (!isOpen) return null;

  const isChange = newAlert.condition.startsWith('change_');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)' }} />
      <div
        className="relative w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col rounded-xl"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="text-base">🚨</span>
            <span className="text-sm font-bold">마켓 알림 설정</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
              {alerts.filter(a => a.enabled).length}개 활성
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>

        {/* Alert list */}
        <div className="flex-1 overflow-y-auto">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12" style={{ color: 'var(--text-muted)' }}>
              <span className="text-3xl mb-2">📊</span>
              <span className="text-xs mb-1">설정된 알림이 없습니다</span>
              <span className="text-[10px] mb-4" style={{ color: 'var(--text-muted)' }}>변동률이나 가격 기준으로 알림을 받아보세요</span>
              <button
                onClick={addQuickAlerts}
                className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                style={{ background: '#3b82f620', color: '#3b82f6', border: '1px solid #3b82f640' }}
              >
                ⚡ 추천 알림 한번에 추가
              </button>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {alerts.map(alert => (
                <div key={alert.id} className="px-4 py-3 flex items-center gap-3" style={{ opacity: alert.enabled ? 1 : 0.5 }}>
                  <span className="text-base">{MARKET_ICONS[alert.market] || '📊'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">{MARKET_NAMES[alert.market]}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                        background: alert.condition.includes('above') ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                        color: alert.condition.includes('above') ? '#ef4444' : '#22c55e',
                      }}>
                        {CONDITION_LABELS[alert.condition]}
                      </span>
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {alert.condition.startsWith('change_')
                        ? `±${alert.threshold}%`
                        : alert.threshold.toLocaleString()
                      }
                      <span className="text-[9px] ml-2" style={{ color: 'var(--text-muted)' }}>
                        쿨다운 30분
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className="text-[10px] px-2 py-1 rounded transition-colors"
                    style={{
                      background: alert.enabled ? 'rgba(34,197,94,0.15)' : 'var(--bg-hover)',
                      color: alert.enabled ? '#22c55e' : 'var(--text-muted)',
                    }}
                  >
                    {alert.enabled ? 'ON' : 'OFF'}
                  </button>
                  <button
                    onClick={() => removeAlert(alert.id)}
                    className="text-[10px] p-1 rounded transition-colors hover:opacity-80"
                    style={{ color: '#ef4444' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add new alert */}
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
          {adding ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={newAlert.market}
                  onChange={(e) => {
                    const mkt = e.target.value;
                    const def = DEFAULT_THRESHOLDS[mkt] || {};
                    setNewAlert(a => ({
                      ...a,
                      market: mkt,
                      threshold: a.condition.startsWith('change_') ? (def.change || 2.0) : (def.price || 100),
                    }));
                  }}
                  className="flex-1 text-xs px-2 py-1.5 rounded"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                >
                  {Object.entries(MARKET_NAMES).map(([k, v]) => (
                    <option key={k} value={k}>{MARKET_ICONS[k]} {v}</option>
                  ))}
                </select>
                <select
                  value={newAlert.condition}
                  onChange={(e) => {
                    const cond = e.target.value;
                    const def = DEFAULT_THRESHOLDS[newAlert.market] || {};
                    setNewAlert(a => ({
                      ...a,
                      condition: cond,
                      threshold: cond.startsWith('change_') ? (def.change || 2.0) : (def.price || 100),
                    }));
                  }}
                  className="text-xs px-2 py-1.5 rounded"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                >
                  {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    type="number"
                    step={isChange ? '0.1' : '1'}
                    value={newAlert.threshold}
                    onChange={(e) => setNewAlert(a => ({ ...a, threshold: e.target.value }))}
                    className="w-full text-xs px-2 py-1.5 rounded pr-8"
                    style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
                    placeholder="임계값"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {isChange ? '%' : ''}
                  </span>
                </div>
                <button
                  onClick={addAlert}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={{ background: '#3b82f6', color: '#fff' }}
                >
                  추가
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="text-xs px-2 py-1.5 rounded-lg transition-colors"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
                >
                  취소
                </button>
              </div>
              {/* Quick suggestion */}
              <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>
                💡 추천: {MARKET_NAMES[newAlert.market]} {isChange ? `±${DEFAULT_THRESHOLDS[newAlert.market]?.change || 2}%` : DEFAULT_THRESHOLDS[newAlert.market]?.price || ''}
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setAdding(true)}
                className="flex-1 text-xs py-2 rounded-lg font-medium transition-colors"
                style={{ background: '#3b82f620', color: '#3b82f6', border: '1px dashed #3b82f640' }}
              >
                + 새 알림 추가
              </button>
              {alerts.length > 0 && (
                <button
                  onClick={() => save([])}
                  className="text-[10px] px-2 py-1 rounded-lg transition-colors"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                >
                  전체 삭제
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
