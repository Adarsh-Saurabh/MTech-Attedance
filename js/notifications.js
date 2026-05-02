// notifications.js — permission + scheduling
export const Notifications = {
  async request() {
    if (!('Notification' in window)) return false;
    const p = await Notification.requestPermission();
    return p === 'granted';
  },

  granted() { return 'Notification' in window && Notification.permission === 'granted'; },

  schedule(sw) {
    // Schedule daily reminders via SW messages with ms delay from now
    const now = new Date();
    const reminders = [
      { h:7, m:15, title:'🌅 IN Attendance',     body:'IN window opens in 15 min (7:30 AM). Head to the biometric scanner!' },
      { h:9, m:0,  title:'⚠️ IN Closing Soon',   body:'IN window closes in 30 min (9:30 AM). Give attendance NOW!' },
      { h:16,m:45, title:'🌆 OUT Attendance',    body:'OUT window opens in 15 min (5:00 PM). Plan to give OUT attendance.' },
      { h:21,m:30, title:'⚠️ OUT Closing Soon',  body:'OUT window closes in 30 min (10:00 PM). Don\'t miss it!' },
    ];

    reminders.forEach(({ h, m, title, body }) => {
      const target = new Date(now);
      target.setHours(h, m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1); // schedule tomorrow if past
      const delay = target - now;
      sw.active?.postMessage({ type: 'SCHEDULE_NOTIFICATION', title, body, delay });
    });
  },

  showNow(title, body) {
    if (!this.granted()) return;
    new Notification(title, { body, icon: '/icons/icon-192.png', vibrate: [200,100,200] });
  }
};
