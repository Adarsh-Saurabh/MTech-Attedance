// notifications.js — permission + scheduling
export const Notifications = {
  async request() {
    if (!('Notification' in window)) return false;
    const p = await Notification.requestPermission();
    return p === 'granted';
  },

  granted() { return 'Notification' in window && Notification.permission === 'granted'; },

  async setup(swReg) {
    if (!this.granted()) return;
    // 1. Try Periodic Background Sync (Chrome Android — best for background notifications)
    if ('periodicSync' in swReg) {
      try {
        const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
        if (status.state === 'granted') {
          await swReg.periodicSync.register('attendance-reminders', {
            minInterval: 15 * 60 * 1000 // every 15 minutes
          });
          console.log('✅ Periodic Background Sync registered');
        }
      } catch(e) { console.log('Periodic sync not available:', e); }
    }
    // 2. Fallback: schedule via SW messages (works while app is open or SW active)
    this.scheduleFallback(swReg);
  },

  scheduleFallback(swReg) {
    const now = new Date();
    const reminders = [
      { h:7,  m:15, title:'🌅 IN Attendance Reminder',   body:'IN window opens in 15 min (7:30 AM). Head to the biometric scanner!', action:'mark-in' },
      { h:9,  m:0,  title:'⚠️ IN Window Closing Soon',   body:'Only 30 min left! IN window closes at 9:30 AM.', action:'mark-in' },
      { h:16, m:45, title:'🌆 OUT Attendance Reminder',  body:'OUT window opens in 15 min (5:00 PM). Plan your exit!', action:'mark-out' },
      { h:21, m:30, title:'⚠️ OUT Window Closing Soon',  body:'Only 30 min left! OUT window closes at 10:00 PM.', action:'mark-out' },
    ];

    reminders.forEach(({ h, m, title, body, action }) => {
      const target = new Date(now);
      target.setHours(h, m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      const delay = target - now;
      swReg.active?.postMessage({ type: 'SCHEDULE_NOTIFICATION', title, body, delay, action });
    });
  },

  showNow(title, body) {
    if (!this.granted()) return;
    new Notification(title, { body, icon: './icons/icon-192.png', vibrate: [200,100,200] });
  }
};
