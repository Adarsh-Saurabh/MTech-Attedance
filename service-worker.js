const CACHE = 'nitr-attendance-v1';
const ASSETS = ['./', './index.html', './css/style.css', './js/app.js', './js/storage.js', './js/attendance.js', './js/calendar.js', './js/stats.js', './js/notifications.js', './js/theme.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay } = e.data;
    setTimeout(() => {
      self.registration.showNotification(title, {
        body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png',
        vibrate: [200, 100, 200], tag: title
      });
    }, delay);
  }
});
