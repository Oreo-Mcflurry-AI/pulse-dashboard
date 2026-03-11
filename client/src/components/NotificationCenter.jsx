import { useState, useEffect, useCallback } from 'react';

// ─── Notification Storage ───
const NOTIF_KEY = 'pulse-notifications';
const NOTIF_SETTINGS_KEY = 'pulse-notif-settings';
const MAX_NOTIFICATIONS = 100;

export function getNotifications() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]'); } catch { return []; }
}

export function addNotification(notif) {
  const list = getNotifications();
  const entry = {
    id: Date.now() + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    read: false,
    ...notif,
  };
  const next = [entry, ...list].slice(0, MAX_NOTIFICATIONS);
  localStorage.setItem(NOTIF_KEY, JSON.stringify(next));

  // Show browser notification if permitted
  const settings = getNotifSettings();
  if (settings.enabled && settings.browser) {
    if ('Notification' in window && Notification.permission === 'granted') {
      const icons = { market: '📊', news: '📰', portfolio: '🎯', system: '⚙️' };
      new Notification(`${icons[notif.type] || '🔔'} ${notif.title}`, {
        body: notif.body || '',
        tag: entry.id,
        silent: settings.silent,
      });
    }
  }
  return entry;
}

export function getNotifSettings() {
  try {
    return {
      enabled: true,
      browser: true,
      silent: false,
      quietStart: 23,
      quietEnd: 8,
      types: { market: true, news: true, portfolio: true, system: true },
      ...JSON.parse(localStorage.getItem(NOTIF_SETTINGS_KEY) || '{}'),
    };
  } catch {
    return { enabled: true, browser: true, silent: false, quietStart: 23, quietEnd: 8, types: { market: true, news: true, portfolio: true, system: true } };
  }
}

export function saveNotifSettings(settings) {
  localStorage.setItem(NOTIF_SETTINGS_KEY, JSON.stringify(settings));
}

export function isQuietTime(settings) {
  if (!settings) settings = getNotifSettings();
  const now = new Date();
  const kstHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getHours();
  if (settings.quietStart > settings.quietEnd) {
    return kstHour >= settings.quietStart || kstHour < settings.quietEnd;
  }
  return kstHour >= settings.quietStart && kstHour < settings.quietEnd;
}

export function shouldNotify(type) {
  const settings = getNotifSettings();
  if (!settings.enabled) return false;
  if (isQuietTime(settings)) return false;
  if (settings.types && !settings.types[type]) return false;
  return true;
}

// ─── Notification Center UI ───
function timeAgo(iso) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return '방금';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

const TYPE_ICONS = { market: '📊', news: '📰', portfolio: '🎯', system: '⚙️' };
const TYPE_LABELS = { market: '시세', news: '뉴스', portfolio: '포트폴리오', system: '시스템' };
const TYPE_COLORS = { market: '#3b82f6', news: '#f59e0b', portfolio: '#10b981', system: '#6b7280' };

export default function NotificationCenter({ isOpen, onClose }) {
  const [notifications, setNotifications] = useState([]);
  const [settings, setSettings] = useState(getNotifSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (isOpen) setNotifications(getNotifications());
  }, [isOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = useCallback(() => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
  }, [notifications]);

  const clearAll = useCallback(() => {
    setNotifications([]);
    localStorage.removeItem(NOTIF_KEY);
  }, []);

  const markRead = useCallback((id) => {
    const updated = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
  }, [notifications]);

  const removeOne = useCallback((id) => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
  }, [notifications]);

  const updateSetting = useCallback((key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveNotifSettings(next);
  }, [settings]);

  const toggleType = useCallback((type) => {
    const next = { ...settings, types: { ...settings.types, [type]: !settings.types[type] } };
    setSettings(next);
    saveNotifSettings(next);
  }, [settings]);

  const requestPermission = useCallback(async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        updateSetting('browser', true);
      }
    }
  }, [updateSetting]);

  const filtered = filter === 'all'
    ? notifications
    : filter === 'unread'
      ? notifications.filter(n => !n.read)
      : notifications.filter(n => n.type === filter);

  if (!isOpen) return null;

  const browserPermission = 'Notification' in window ? Notification.permission : 'unsupported';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.3)' }} />
      <div
        className="relative w-full max-w-sm h-full overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-primary)', borderLeft: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2">
            <span className="text-base">🔔</span>
            <span className="text-sm font-bold">알림 센터</span>
            {unreadCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: '#ef4444', color: '#fff' }}>
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(v => !v)}
              className="p-1.5 rounded-lg transition-colors"
              style={{ background: showSettings ? 'var(--bg-hover)' : 'transparent', color: 'var(--text-muted)' }}
              title="알림 설정"
            >
              ⚙️
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>✕</button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="px-4 py-3 space-y-3" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>알림 설정</div>

            {/* Master toggle */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs">알림 활성화</span>
              <input type="checkbox" checked={settings.enabled} onChange={(e) => updateSetting('enabled', e.target.checked)}
                className="w-4 h-4 accent-blue-500" />
            </label>

            {/* Browser notification */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs">브라우저 알림</span>
              <div className="flex items-center gap-1">
                {browserPermission === 'denied' && <span className="text-[9px]" style={{ color: '#ef4444' }}>차단됨</span>}
                {browserPermission === 'default' && (
                  <button onClick={requestPermission} className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: '#3b82f620', color: '#3b82f6' }}>허용</button>
                )}
                <input type="checkbox" checked={settings.browser} onChange={(e) => updateSetting('browser', e.target.checked)}
                  className="w-4 h-4 accent-blue-500" disabled={browserPermission !== 'granted'} />
              </div>
            </label>

            {/* Silent mode */}
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-xs">소리 없음</span>
              <input type="checkbox" checked={settings.silent} onChange={(e) => updateSetting('silent', e.target.checked)}
                className="w-4 h-4 accent-blue-500" />
            </label>

            {/* Quiet hours */}
            <div>
              <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>조용한 시간 (KST)</div>
              <div className="flex items-center gap-2">
                <select value={settings.quietStart} onChange={(e) => updateSetting('quietStart', parseInt(e.target.value))}
                  className="text-xs px-1.5 py-1 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                </select>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>~</span>
                <select value={settings.quietEnd} onChange={(e) => updateSetting('quietEnd', parseInt(e.target.value))}
                  className="text-xs px-1.5 py-1 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                  {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>)}
                </select>
                {isQuietTime(settings) && <span className="text-[9px]" style={{ color: '#f59e0b' }}>🌙 조용한 시간</span>}
              </div>
            </div>

            {/* Type toggles */}
            <div>
              <div className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>알림 유형</div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(TYPE_LABELS).map(([type, label]) => (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    className="text-[10px] px-2 py-1 rounded-full transition-colors"
                    style={{
                      background: settings.types[type] ? TYPE_COLORS[type] + '20' : 'var(--bg-hover)',
                      color: settings.types[type] ? TYPE_COLORS[type] : 'var(--text-muted)',
                      border: `1px solid ${settings.types[type] ? TYPE_COLORS[type] + '40' : 'transparent'}`,
                    }}
                  >
                    {TYPE_ICONS[type]} {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 px-4 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
          {[
            { key: 'all', label: '전체' },
            { key: 'unread', label: `안읽음${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
            ...Object.entries(TYPE_LABELS).map(([k, v]) => ({ key: k, label: `${TYPE_ICONS[k]} ${v}` })),
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="text-[10px] px-2 py-1 rounded-full transition-colors whitespace-nowrap"
              style={{
                background: filter === f.key ? 'var(--text-primary)' : 'var(--bg-hover)',
                color: filter === f.key ? 'var(--bg-primary)' : 'var(--text-muted)',
                fontWeight: filter === f.key ? 600 : 400,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Actions bar */}
        {notifications.length > 0 && (
          <div className="flex justify-end gap-2 px-4 py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] px-2 py-0.5 rounded"
                style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>
                모두 읽음
              </button>
            )}
            <button onClick={clearAll} className="text-[10px] px-2 py-0.5 rounded"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
              전체 삭제
            </button>
          </div>
        )}

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48" style={{ color: 'var(--text-muted)' }}>
              <span className="text-3xl mb-2">🔕</span>
              <span className="text-xs">알림이 없습니다</span>
            </div>
          ) : (
            filtered.map(n => (
              <div
                key={n.id}
                className="px-4 py-3 transition-colors cursor-pointer hover:opacity-90"
                style={{
                  borderBottom: '1px solid var(--border)',
                  background: n.read ? 'transparent' : (TYPE_COLORS[n.type] || '#888') + '08',
                }}
                onClick={() => markRead(n.id)}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm mt-0.5">{TYPE_ICONS[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{n.title}</span>
                      {!n.read && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: TYPE_COLORS[n.type] || '#3b82f6' }} />}
                    </div>
                    {n.body && (
                      <p className="text-[10px] sm:text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {n.body}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                        style={{ background: (TYPE_COLORS[n.type] || '#888') + '15', color: TYPE_COLORS[n.type] || '#888' }}>
                        {TYPE_LABELS[n.type] || n.type}
                      </span>
                      <span className="text-[9px]" style={{ color: 'var(--text-muted)' }}>{timeAgo(n.timestamp)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeOne(n.id); }}
                    className="text-xs p-1 rounded opacity-0 hover:opacity-100 transition-opacity"
                    style={{ color: 'var(--text-muted)' }}
                    title="삭제"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Badge component for nav ───
export function NotificationBadge({ onClick }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const check = () => {
      const notifs = getNotifications();
      setCount(notifs.filter(n => !n.read).length);
    };
    check();
    const t = setInterval(check, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <button
      onClick={onClick}
      className="relative p-1 transition-colors rounded hover:opacity-80"
      style={{ color: count > 0 ? '#f59e0b' : 'var(--text-muted)' }}
      title="알림 센터"
      aria-label={`알림 ${count > 0 ? `${count}개 안읽음` : '없음'}`}
    >
      🔔
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] flex items-center justify-center text-[8px] font-bold rounded-full"
          style={{ background: '#ef4444', color: '#fff', padding: '0 3px' }}>
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}
