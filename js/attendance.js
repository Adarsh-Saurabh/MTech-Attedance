// attendance.js — core attendance logic
import { Storage } from './storage.js';

export const IN_START  = { h:7,  m:30 };
export const IN_END    = { h:9,  m:30 };
export const OUT_START = { h:17, m:0  };
export const OUT_END   = { h:22, m:0  };
export const MIN_HOURS = 9;

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function toMinutes(h, m) { return h * 60 + m; }

export function nowMinutes() {
  const n = new Date();
  return toMinutes(n.getHours(), n.getMinutes());
}

export function inWindow()  { const n=nowMinutes(); return n>=toMinutes(IN_START.h,IN_START.m) && n<=toMinutes(IN_END.h,IN_END.m); }
export function outWindow() { const n=nowMinutes(); return n>=toMinutes(OUT_START.h,OUT_START.m) && n<=toMinutes(OUT_END.h,OUT_END.m); }

export function calcDuration(inTime, outTime) {
  const [ih,im] = inTime.split(':').map(Number);
  const [oh,om] = outTime.split(':').map(Number);
  return Math.max(0, (oh*60+om - (ih*60+im)) / 60);
}

export function formatDuration(hrs) {
  const h = Math.floor(hrs), m = Math.round((hrs-h)*60);
  return `${h}h ${m.toString().padStart(2,'0')}m`;
}

export function getDayStatus(date) {
  const rec = Storage.getRecord(date);
  if (rec.holiday) return 'holiday';
  const d = new Date(date + 'T00:00:00');
  const today = new Date(todayKey() + 'T00:00:00');
  // weekends
  if (d.getDay() === 0 || d.getDay() === 6) return 'weekend';
  if (d > today) return 'future';
  // check start date
  const { startDate } = Storage.getSettings();
  if (date < startDate) return 'before-start';
  if (!rec.in && !rec.out) return 'missed';
  if (rec.in && rec.out) {
    const dur = calcDuration(rec.in, rec.out);
    return dur >= MIN_HOURS ? 'full' : 'short';
  }
  return 'partial';
}

export function markIN() {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  Storage.setRecord(todayKey(), { in: time });
  return time;
}

export function markOUT() {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
  Storage.setRecord(todayKey(), { out: time });
  return time;
}

export function getStats() {
  const records = Storage.getRecords();
  const { startDate } = Storage.getSettings();
  const today = todayKey();

  let streak = 0, bestStreak = 0, curStreak = 0;
  let totalDays = 0, fullDays = 0, totalDur = 0, durCount = 0;

  // collect all working days from startDate to today
  const d = new Date(startDate + 'T00:00:00');
  const end = new Date(today + 'T00:00:00');
  const days = [];

  while (d <= end) {
    const key = d.toISOString().slice(0,10);
    const day = d.getDay();
    if (day !== 0 && day !== 6) {
      const rec = records[key] || {};
      if (!rec.holiday) {
        days.push({ key, rec });
      }
    }
    d.setDate(d.getDate() + 1);
  }

  totalDays = days.length;
  days.forEach(({ key, rec }) => {
    const isFull = rec.in && rec.out && calcDuration(rec.in, rec.out) >= MIN_HOURS;
    if (isFull) {
      fullDays++;
      curStreak++;
      bestStreak = Math.max(bestStreak, curStreak);
      const dur = calcDuration(rec.in, rec.out);
      totalDur += dur; durCount++;
    } else {
      curStreak = 0;
    }
  });

  // current streak from end
  streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    const { rec } = days[i];
    const isFull = rec.in && rec.out && calcDuration(rec.in, rec.out) >= MIN_HOURS;
    if (isFull) streak++;
    else break;
  }

  return {
    streak, bestStreak, totalDays, fullDays,
    compliance: totalDays > 0 ? Math.round((fullDays/totalDays)*100) : 0,
    avgDuration: durCount > 0 ? totalDur/durCount : 0
  };
}

export function getWeeklyData() {
  const records = Storage.getRecords();
  const result = [];
  const d = new Date();
  d.setDate(d.getDate() - 6);
  for (let i = 0; i < 7; i++) {
    const key = d.toISOString().slice(0,10);
    const rec = records[key] || {};
    const dur = rec.in && rec.out ? calcDuration(rec.in, rec.out) : 0;
    result.push({ date: key, dur, label: d.toLocaleDateString('en',{weekday:'short'}) });
    d.setDate(d.getDate() + 1);
  }
  return result;
}
