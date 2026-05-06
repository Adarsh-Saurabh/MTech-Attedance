import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import type { AttendanceRecords, Profile, Settings } from './types';
import { calcDuration, localDateKey } from './attendance';

type BackupPayload = {
  profile: Profile | null;
  records: AttendanceRecords;
  settings: Settings;
  exported: string;
  source: 'nitr-attendance-mobile';
};

function filenameDate() {
  return localDateKey();
}

function csvEscape(value: unknown) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function shareTextFile(filename: string, content: string, mimeType: string) {
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true, intermediates: true });
  file.write(content);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: `Share ${filename}` });
  }

  return file.uri;
}

export async function exportJSONBackup(
  profile: Profile | null,
  records: AttendanceRecords,
  settings: Settings,
) {
  const payload: BackupPayload = {
    profile,
    records,
    settings,
    exported: new Date().toISOString(),
    source: 'nitr-attendance-mobile',
  };

  return shareTextFile(
    `nitr_attendance_${filenameDate()}.json`,
    JSON.stringify(payload, null, 2),
    'application/json',
  );
}

export async function exportCSV(records: AttendanceRecords) {
  const rows = [['Date', 'IN Time', 'OUT Time', 'Duration (hrs)', 'Status', 'Note']];

  Object.keys(records)
    .sort()
    .forEach((date) => {
      const record = records[date];
      if (record.holiday) {
        rows.push([date, '', '', '', 'Holiday', record.note || '']);
        return;
      }

      const duration = record.in && record.out ? calcDuration(record.in, record.out) : 0;
      const durationText = record.in && record.out ? duration.toFixed(2) : '';
      const status =
        !record.in && !record.out
          ? 'Missed'
          : !record.out
            ? 'Partial'
            : duration >= 9
              ? 'Full'
              : 'Short';

      rows.push([date, record.in || '', record.out || '', durationText, status, record.note || '']);
    });

  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n');
  return shareTextFile(`nitr_attendance_${filenameDate()}.csv`, csv, 'text/csv');
}

export async function pickAndReadJSONBackup() {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.[0]) {
    return null;
  }

  const file = new File(result.assets[0].uri);
  const raw = await file.text();
  const payload = JSON.parse(raw);

  return {
    profile: payload.profile ?? null,
    records: payload.records ?? {},
    settings: payload.settings ?? null,
  } as {
    profile: Profile | null;
    records: AttendanceRecords;
    settings: Settings | null;
  };
}
