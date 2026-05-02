// storage.js — localStorage helpers
const DB = 'nitr_att';

export const Storage = {
  get(key, def = null) {
    try { const v = localStorage.getItem(`${DB}_${key}`); return v ? JSON.parse(v) : def; }
    catch { return def; }
  },
  set(key, val) {
    localStorage.setItem(`${DB}_${key}`, JSON.stringify(val));
  },
  remove(key) { localStorage.removeItem(`${DB}_${key}`); },

  // Profile
  getProfile()       { return this.get('profile'); },
  setProfile(p)      { this.set('profile', p); },

  // Records: { 'YYYY-MM-DD': { in: 'HH:MM', out: 'HH:MM', note: '', holiday: bool } }
  getRecords()       { return this.get('records', {}); },
  getRecord(date)    { return this.getRecords()[date] || {}; },
  setRecord(date, data) {
    const r = this.getRecords();
    r[date] = { ...(r[date] || {}), ...data };
    this.set('records', r);
  },

  // Settings
  getSettings()      { return this.get('settings', { theme: 'dark', notifs: true, startDate: '2026-05-01' }); },
  setSettings(s)     { this.set('settings', s); },

  // Export / Import
  exportJSON() {
    const data = {
      profile:  this.getProfile(),
      records:  this.getRecords(),
      settings: this.getSettings(),
      exported: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nitr_attendance_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  },
  importJSON(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = e => {
        try {
          const d = JSON.parse(e.target.result);
          if (d.profile)  this.setProfile(d.profile);
          if (d.records)  this.set('records', d.records);
          if (d.settings) this.setSettings(d.settings);
          resolve(d);
        } catch { reject(new Error('Invalid file')); }
      };
      r.onerror = () => reject(new Error('Read error'));
      r.readAsText(file);
    });
  },
  exportCSV() {
    const records = this.getRecords();
    const rows = [['Date','IN Time','OUT Time','Duration (hrs)','Status','Note']];
    Object.keys(records).sort().forEach(date => {
      const rec = records[date];
      if (rec.holiday) { rows.push([date,'','','','Holiday','']); return; }
      const dur = rec.in && rec.out ? calcDuration(rec.in, rec.out).toFixed(2) : '';
      const status = rec.holiday ? 'Holiday' : !rec.in && !rec.out ? 'Missed' : !rec.out ? 'Partial' : parseFloat(dur) >= 9 ? 'Full' : 'Short';
      rows.push([date, rec.in||'', rec.out||'', dur, status, rec.note||'']);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `nitr_attendance_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }
};

function calcDuration(inTime, outTime) {
  const [ih,im] = inTime.split(':').map(Number);
  const [oh,om] = outTime.split(':').map(Number);
  return Math.max(0, (oh*60+om - (ih*60+im)) / 60);
}
