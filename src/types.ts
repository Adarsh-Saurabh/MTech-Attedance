export type AppScreen = 'dashboard' | 'calendar' | 'stats' | 'settings';

export type ThemeMode = 'dark' | 'light';

export type Profile = {
  name: string;
  roll: string;
};

export type AttendanceLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
};

export type AttendanceRecord = {
  in?: string;
  out?: string;
  note?: string;
  holiday?: boolean;
  inLocation?: AttendanceLocation;
  outLocation?: AttendanceLocation;
};

export type AttendanceRecords = Record<string, AttendanceRecord>;

export type Settings = {
  theme: ThemeMode;
  notificationsEnabled: boolean;
  startDate: string;
  gpsEnabled: boolean;
};

export type DayStatus =
  | 'full'
  | 'short'
  | 'partial'
  | 'missed'
  | 'holiday'
  | 'weekend'
  | 'future'
  | 'before-start';

export type AttendanceStats = {
  streak: number;
  bestStreak: number;
  totalDays: number;
  fullDays: number;
  compliance: number;
  avgDuration: number;
};

export type WeeklyDay = {
  date: string;
  label: string;
  duration: number;
};
