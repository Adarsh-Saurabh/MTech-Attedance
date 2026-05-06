import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AttendanceRecords, Profile, Settings } from './types';

const DB = '@nitr_attendance';

const keys = {
  profile: `${DB}:profile`,
  records: `${DB}:records`,
  settings: `${DB}:settings`,
};

export const defaultSettings: Settings = {
  theme: 'dark',
  notificationsEnabled: false,
  startDate: '2026-05-01',
  gpsEnabled: false,
  attendanceWindows: {
    inStart: '07:30',
    inEnd: '09:30',
    outStart: '17:00',
    outEnd: '22:00',
  },
};

async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function setJSON<T>(key: string, value: T) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export const Storage = {
  getProfile() {
    return getJSON<Profile | null>(keys.profile, null);
  },

  setProfile(profile: Profile) {
    return setJSON(keys.profile, profile);
  },

  getRecords() {
    return getJSON<AttendanceRecords>(keys.records, {});
  },

  setRecords(records: AttendanceRecords) {
    return setJSON(keys.records, records);
  },

  async setRecord(date: string, data: AttendanceRecords[string]) {
    const records = await this.getRecords();
    records[date] = { ...(records[date] || {}), ...data };
    await this.setRecords(records);
    return records;
  },

  getSettings() {
    return getJSON<Settings>(keys.settings, defaultSettings);
  },

  setSettings(settings: Settings) {
    return setJSON(keys.settings, settings);
  },

  async clearAll() {
    await AsyncStorage.multiRemove(Object.values(keys));
  },
};
