const CACHE = 'nitr-attendance-v3';
const ASSETS = ['./', './index.html', './css/style.css', './js/app.js', './js/storage.js', './js/attendance.js', './js/calendar.js', './js/stats.js', './js/notifications.js', './js/theme.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

// Network First, fallback to cache
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Update cache with new version if successful
        const resClone = res.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, resClone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const action = e.notification.data?.action;
  const url = action ? `/?action=${action}` : '/';
  e.waitUntil(clients.openWindow(url));
});

// ── Periodic Background Sync (Chrome Android) ─────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'attendance-reminders') {
    e.waitUntil(checkAndNotify());
  }
});

async function checkAndNotify() {
  const now = new Date();
  const totalMin = now.getHours() * 60 + now.getMinutes();
  const day = now.getDay();

  // Skip weekends
  if (day === 0 || day === 6) return;

  const reminders = [
    { min: 7*60+15, window: 20, title: '🌅 IN Attendance Reminder',    body: 'IN window opens in 15 min (7:30 AM). Head to the biometric scanner!', action: 'mark-in' },
    { min: 9*60+0,  window: 20, title: '⚠️ IN Window Closing Soon',    body: 'Only 30 min left! IN window closes at 9:30 AM.', action: 'mark-in' },
    { min: 16*60+45,window: 20, title: '🌆 OUT Attendance Reminder',   body: 'OUT window opens in 15 min (5:00 PM). Plan your exit!', action: 'mark-out' },
    { min: 21*60+30,window: 20, title: '⚠️ OUT Window Closing Soon',   body: 'Only 30 min left! OUT window closes at 10:00 PM.', action: 'mark-out' },
  ];

  for (const r of reminders) {
    if (totalMin >= r.min && totalMin <= r.min + r.window) {
      const existing = await self.registration.getNotifications({ tag: r.title });
      if (existing.length === 0) {
        await self.registration.showNotification(r.title, {
          body: r.body,
          icon: './icons/icon-192.png',
          badge: './icons/icon-192.png',
          vibrate: [200, 100, 200],
          tag: r.title,
          data: { action: r.action },
          requireInteraction: true
        });
      }
    }
  }
}

// ── Message-based scheduling (fallback when app is open) ───
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay, action } = e.data;
    setTimeout(async () => {
      const existing = await self.registration.getNotifications({ tag: title });
      if (existing.length === 0) {
        self.registration.showNotification(title, {
          body, icon: './icons/icon-192.png', badge: './icons/icon-192.png',
          vibrate: [200, 100, 200], tag: title,
          data: { action }, requireInteraction: true
        });
      }
    }, delay);
  }
});
