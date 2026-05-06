import type {
  AttendanceRecord,
  AttendanceRecords,
  AttendanceStats,
  DayStatus,
  Settings,
  WeeklyDay,
} from './types';

export const MIN_HOURS = 9;

export function toMinutes(h: number, m: number) {
  return h * 60 + m;
}

export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateKey(date: string) {
  return new Date(`${date}T00:00:00`);
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function currentTimeKey(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function nowMinutes(date = new Date()) {
  return toMinutes(date.getHours(), date.getMinutes());
}

export function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return toMinutes(h, m);
}

export function inWindow(settings: Settings, date = new Date()) {
  const n = nowMinutes(date);
  return n >= timeToMinutes(settings.attendanceWindows.inStart) && n <= timeToMinutes(settings.attendanceWindows.inEnd);
}

export function outWindow(settings: Settings, date = new Date()) {
  const n = nowMinutes(date);
  return n >= timeToMinutes(settings.attendanceWindows.outStart) && n <= timeToMinutes(settings.attendanceWindows.outEnd);
}

export function calcDuration(inTime?: string, outTime?: string) {
  if (!inTime || !outTime) return 0;
  const [ih, im] = inTime.split(':').map(Number);
  const [oh, om] = outTime.split(':').map(Number);
  if ([ih, im, oh, om].some(Number.isNaN)) return 0;
  return Math.max(0, (oh * 60 + om - (ih * 60 + im)) / 60);
}

export function formatDuration(hours: number) {
  const safeHours = Number.isFinite(hours) ? Math.max(0, hours) : 0;
  const h = Math.floor(safeHours);
  const m = Math.round((safeHours - h) * 60);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export function formatTime(time?: string) {
  if (!time) return '--:--';
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '--:--';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export function formatWindow(start: string, end: string) {
  return `${formatTime(start)} to ${formatTime(end)}`;
}

export function isWorkingDay(date: string) {
  const day = parseDateKey(date).getDay();
  return day !== 0 && day !== 6;
}

export function getDayStatus(
  date: string,
  record: AttendanceRecord = {},
  settings: Settings,
  today = localDateKey(),
): DayStatus {
  if (record.holiday) return 'holiday';

  const parsed = parseDateKey(date);
  if (parsed.getDay() === 0 || parsed.getDay() === 6) return 'weekend';
  if (date > today) return 'future';
  if (date < settings.startDate) return 'before-start';
  if (!record.in && !record.out) return 'missed';
  if (record.in && record.out) {
    return calcDuration(record.in, record.out) >= MIN_HOURS ? 'full' : 'short';
  }
  return 'partial';
}

export function markIn(records: AttendanceRecords, date = localDateKey(), time = currentTimeKey()) {
  return {
    ...records,
    [date]: { ...(records[date] || {}), in: time },
  };
}

export function markOut(records: AttendanceRecords, date = localDateKey(), time = currentTimeKey()) {
  return {
    ...records,
    [date]: { ...(records[date] || {}), out: time },
  };
}

export function getStats(records: AttendanceRecords, settings: Settings): AttendanceStats {
  const days: { date: string; record: AttendanceRecord }[] = [];
  let cursor = parseDateKey(settings.startDate);
  const end = parseDateKey(localDateKey());

  while (cursor <= end) {
    const key = localDateKey(cursor);
    const record = records[key] || {};
    if (isWorkingDay(key) && !record.holiday) {
      days.push({ date: key, record });
    }
    cursor = addDays(cursor, 1);
  }

  let fullDays = 0;
  let bestStreak = 0;
  let rollingStreak = 0;
  let totalDuration = 0;
  let durationCount = 0;

  for (const day of days) {
    const duration = calcDuration(day.record.in, day.record.out);
    const full = !!day.record.in && !!day.record.out && duration >= MIN_HOURS;
    if (full) {
      fullDays += 1;
      rollingStreak += 1;
      bestStreak = Math.max(bestStreak, rollingStreak);
      totalDuration += duration;
      durationCount += 1;
    } else {
      rollingStreak = 0;
    }
  }

  let streak = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const duration = calcDuration(days[i].record.in, days[i].record.out);
    if (days[i].record.in && days[i].record.out && duration >= MIN_HOURS) {
      streak += 1;
    } else {
      break;
    }
  }

  return {
    streak,
    bestStreak,
    totalDays: days.length,
    fullDays,
    compliance: days.length ? Math.round((fullDays / days.length) * 100) : 0,
    avgDuration: durationCount ? totalDuration / durationCount : 0,
  };
}

export function getWeeklyData(records: AttendanceRecords): WeeklyDay[] {
  const result: WeeklyDay[] = [];
  let cursor = addDays(new Date(), -6);

  for (let i = 0; i < 7; i += 1) {
    const date = localDateKey(cursor);
    const record = records[date] || {};
    result.push({
      date,
      label: cursor.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2),
      duration: calcDuration(record.in, record.out),
    });
    cursor = addDays(cursor, 1);
  }

  return result;
}
