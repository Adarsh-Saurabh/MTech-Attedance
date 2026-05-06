import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  calcDuration,
  formatDuration,
  formatTime,
  formatWindow,
  getDayStatus,
  getStats,
  getWeeklyData,
  inWindow,
  localDateKey,
  markIn,
  markOut,
  outWindow,
} from './src/attendance';
import { exportCSV, exportJSONBackup, pickAndReadJSONBackup } from './src/backup';
import {
  cancelAttendanceReminders,
  configureNotificationChannel,
  notificationsGranted,
  scheduleAttendanceReminders,
} from './src/notifications';
import { Storage, defaultSettings } from './src/storage';
import { getPalette } from './src/theme';
import type { AppScreen, AttendanceRecord, AttendanceRecords, Profile, Settings } from './src/types';

type TimePickerTarget = 'modalIn' | 'modalOut' | 'inStart' | 'inEnd' | 'outStart' | 'outEnd';

type TimePickerState = {
  target: TimePickerTarget;
  title: string;
  value: string;
  allowClear?: boolean;
};

const navItems: { id: AppScreen; label: string }[] = [
  { id: 'dashboard', label: 'Home' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'stats', label: 'Stats' },
  { id: 'settings', label: 'Settings' },
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [records, setRecords] = useState<AttendanceRecords>({});
  const [screen, setScreen] = useState<AppScreen>('dashboard');
  const [name, setName] = useState('');
  const [roll, setRoll] = useState('');
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [modalIn, setModalIn] = useState('');
  const [modalOut, setModalOut] = useState('');
  const [modalNote, setModalNote] = useState('');
  const [modalHoliday, setModalHoliday] = useState(false);
  const [timePicker, setTimePicker] = useState<TimePickerState | null>(null);

  const colors = getPalette(settings.theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = localDateKey();
  const todayRecord = records[today] || {};
  const stats = useMemo(() => getStats(records, settings), [records, settings]);

  useEffect(() => {
    async function load() {
      const [savedProfile, savedSettings, savedRecords] = await Promise.all([
        Storage.getProfile(),
        Storage.getSettings(),
        Storage.getRecords(),
      ]);
      setProfile(savedProfile);
      setSettings(mergeSettings(savedSettings));
      setRecords(savedRecords);
      await configureNotificationChannel();
      if (savedSettings.notificationsEnabled && !(await notificationsGranted())) {
        setSettings((current) => ({ ...current, notificationsEnabled: false }));
      }
      setLoading(false);
    }
    load();
  }, []);

  async function completeOnboarding() {
    const nextProfile = { name: name.trim(), roll: roll.trim() };
    if (!nextProfile.name || !nextProfile.roll) {
      Alert.alert('Missing details', 'Please enter your name and roll number.');
      return;
    }
    await Storage.setProfile(nextProfile);
    await Storage.setSettings(settings);
    setProfile(nextProfile);
  }

  async function persistRecords(nextRecords: AttendanceRecords) {
    setRecords(nextRecords);
    await Storage.setRecords(nextRecords);
  }

  async function handleMarkIn() {
    if (todayRecord.in) return;
    await persistRecords(markIn(records));
  }

  async function handleMarkOut() {
    if (!todayRecord.in) {
      Alert.alert('Mark IN first', 'You need an IN time before marking OUT.');
      return;
    }
    if (todayRecord.out) return;
    await persistRecords(markOut(records));
  }

  function openDay(date: string) {
    const record = records[date] || {};
    setSelectedDate(date);
    setModalIn(record.in || '');
    setModalOut(record.out || '');
    setModalNote(record.note || '');
    setModalHoliday(!!record.holiday);
  }

  async function saveDay() {
    if (!selectedDate) return;
    const status = getDayStatus(selectedDate, records[selectedDate], settings);
    const future = status === 'future';
    const nextRecord: AttendanceRecord = future
      ? { ...(records[selectedDate] || {}), holiday: modalHoliday }
      : {
          ...(records[selectedDate] || {}),
          in: modalIn || undefined,
          out: modalOut || undefined,
          note: modalNote.trim(),
          holiday: modalHoliday,
        };
    const nextRecords = { ...records, [selectedDate]: nextRecord };
    await persistRecords(nextRecords);
    setSelectedDate(null);
  }

  async function updateSettings(nextSettings: Settings) {
    setSettings(nextSettings);
    await Storage.setSettings(nextSettings);
  }

  async function handleNotificationToggle(enabled: boolean) {
    if (enabled) {
      const scheduled = await scheduleAttendanceReminders(settings);
      if (!scheduled) {
        Alert.alert('Permission needed', 'Notifications were not enabled on this device.');
        await updateSettings({ ...settings, notificationsEnabled: false });
        return;
      }
      await updateSettings({ ...settings, notificationsEnabled: true });
    } else {
      await cancelAttendanceReminders();
      await updateSettings({ ...settings, notificationsEnabled: false });
    }
  }

  async function handleExportJSON() {
    try {
      await exportJSONBackup(profile, records, settings);
    } catch {
      Alert.alert('Export failed', 'Could not create the JSON backup.');
    }
  }

  async function handleExportCSV() {
    try {
      await exportCSV(records);
    } catch {
      Alert.alert('Export failed', 'Could not create the CSV export.');
    }
  }

  async function handleImportJSON() {
    try {
      const imported = await pickAndReadJSONBackup();
      if (!imported) return;

      const nextProfile = imported.profile || profile;
      if (!nextProfile) {
        Alert.alert('Import failed', 'The selected backup does not include a profile.');
        return;
      }
      const nextSettings = imported.settings ? mergeSettings(imported.settings) : settings;
      await Storage.setProfile(nextProfile);
      await Storage.setRecords(imported.records);
      await Storage.setSettings(nextSettings);
      setProfile(nextProfile);
      setRecords(imported.records);
      setSettings(nextSettings);
      Alert.alert('Import complete', 'Your backup has been restored.');
    } catch {
      Alert.alert('Import failed', 'Please choose a valid NITR Attendance JSON backup.');
    }
  }

  async function applyPickedTime(time?: string) {
    if (!timePicker) return;

    if (timePicker.target === 'modalIn') setModalIn(time || '');
    if (timePicker.target === 'modalOut') setModalOut(time || '');

    if (['inStart', 'inEnd', 'outStart', 'outEnd'].includes(timePicker.target) && time) {
      const nextSettings = {
        ...settings,
        attendanceWindows: {
          ...settings.attendanceWindows,
          [timePicker.target]: time,
        },
      };
      await updateSettings(nextSettings);
      if (nextSettings.notificationsEnabled) {
        await scheduleAttendanceReminders(nextSettings);
      }
    }

    setTimePicker(null);
  }

  async function resetApp() {
    Alert.alert('Reset all data?', 'This will delete profile, settings, and attendance records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await Storage.clearAll();
          setProfile(null);
          setRecords({});
          setSettings(defaultSettings);
          setScreen('dashboard');
          setName('');
          setRoll('');
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centerScreen}>
        <Text style={styles.mutedText}>Loading attendance app...</Text>
        <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
      </View>
    );
  }

  if (!profile) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.onboardingScreen}
      >
        <View style={styles.onboardingCard}>
          <Text style={styles.logo}>NITR</Text>
          <Text style={styles.h1}>NITR Attendance</Text>
          <Text style={styles.subText}>Track your biometric attendance. Never miss a session.</Text>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Full name</Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setName}
              placeholder="e.g. Adarsh Kumar"
              placeholderTextColor={colors.text3}
              style={styles.input}
              value={name}
            />
          </View>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Roll number</Text>
            <TextInput
              autoCapitalize="characters"
              onChangeText={setRoll}
              placeholder="e.g. 224EC1234"
              placeholderTextColor={colors.text3}
              style={styles.input}
              value={roll}
            />
          </View>
          <Pressable onPress={completeOnboarding} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Start Tracking</Text>
          </Pressable>
        </View>
        <StatusBar style="light" />
      </KeyboardAvoidingView>
    );
  }

  const duration = calcDuration(todayRecord.in, todayRecord.out);
  const elapsed = todayRecord.in && !todayRecord.out ? calcDuration(todayRecord.in, currentClock()) : 0;
  const durationValue = todayRecord.out ? duration : elapsed;
  const durationPct = Math.min((durationValue / 12) * 100, 100);

  return (
    <View style={styles.app}>
      <View style={styles.topbar}>
        <View>
          <Text style={styles.topbarTitle}>NITR Attendance</Text>
          <Text style={styles.topbarSub}>{profile.roll}</Text>
        </View>
        <Pressable
          onPress={() => updateSettings({ ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' })}
          style={styles.iconButton}
        >
          <Text style={styles.iconButtonText}>{settings.theme === 'dark' ? 'Light' : 'Dark'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {screen === 'dashboard' && (
          <>
            <View style={styles.todayCard}>
              <Text style={styles.dateText}>
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </Text>
              <Text style={styles.sectionTitleBig}>Today's Attendance</Text>

              <View style={styles.attendanceRow}>
                <AttendanceBox label="IN" time={todayRecord.in} styles={styles} />
                <AttendanceBox label="OUT" time={todayRecord.out} styles={styles} />
              </View>

              <View style={styles.actionRow}>
                <Pressable
                  disabled={!!todayRecord.in}
                  onPress={handleMarkIn}
                  style={[styles.actionButton, !!todayRecord.in && styles.disabledButton]}
                >
                  <Text style={styles.actionButtonText}>Mark IN</Text>
                </Pressable>
                <Pressable
                  disabled={!!todayRecord.out || !todayRecord.in}
                  onPress={handleMarkOut}
                  style={[styles.actionButtonAlt, (!!todayRecord.out || !todayRecord.in) && styles.disabledButton]}
                >
                  <Text style={styles.actionButtonText}>Mark OUT</Text>
                </Pressable>
              </View>

              {!!todayRecord.in && (
                <View style={styles.durationWrap}>
                  <View style={styles.durationLabel}>
                    <Text style={styles.mutedText}>Duration</Text>
                    <Text style={styles.mutedText}>
                      {formatDuration(durationValue)}
                      {todayRecord.out ? (duration >= 9 ? ' OK' : ' Short') : ' elapsed'}
                    </Text>
                  </View>
                  <View style={styles.durationBar}>
                    <View
                      style={[
                        styles.durationFill,
                        duration < 9 && todayRecord.out ? styles.durationWarn : null,
                        { width: `${durationPct}%` },
                      ]}
                    />
                  </View>
                </View>
              )}

              <Text style={styles.hintText}>
                {inWindow(settings)
                  ? `Good time to mark IN: ${formatWindow(settings.attendanceWindows.inStart, settings.attendanceWindows.inEnd)}`
                  : outWindow(settings)
                    ? `Good time to mark OUT: ${formatWindow(settings.attendanceWindows.outStart, settings.attendanceWindows.outEnd)}`
                    : 'You can mark attendance at any time.'}
              </Text>
            </View>

            <Text style={styles.sectionHeader}>Quick Stats</Text>
            <View style={styles.statsGrid}>
              <StatCard label="Current Streak" value={`${stats.streak}`} styles={styles} />
              <StatCard label="Compliance" value={`${stats.compliance}%`} styles={styles} />
              <StatCard label="Days Present" value={`${stats.fullDays}/${stats.totalDays}`} styles={styles} wide />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recommended Windows</Text>
              <View style={styles.twoColumn}>
                <View>
                  <Text style={styles.primaryText}>Ideal IN Time</Text>
                  <Text style={styles.mutedText}>
                    {formatWindow(settings.attendanceWindows.inStart, settings.attendanceWindows.inEnd)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.indigoText}>Ideal OUT Time</Text>
                  <Text style={styles.mutedText}>
                    {formatWindow(settings.attendanceWindows.outStart, settings.attendanceWindows.outEnd)}
                  </Text>
                </View>
              </View>
              <Text style={styles.warningText}>Minimum 9 hours between IN and OUT.</Text>
            </View>
          </>
        )}

        {screen === 'calendar' && (
          <CalendarScreen
            colors={colors}
            monthCursor={monthCursor}
            onChangeMonth={setMonthCursor}
            onOpenDay={openDay}
            records={records}
            settings={settings}
            styles={styles}
          />
        )}

        {screen === 'stats' && <StatsScreen records={records} stats={stats} styles={styles} />}

        {screen === 'settings' && (
          <SettingsScreen
            onExportCSV={handleExportCSV}
            onExportJSON={handleExportJSON}
            onImportJSON={handleImportJSON}
            onReset={resetApp}
            onSelectTime={(target, title, value) => setTimePicker({ target, title, value })}
            onToggleNotifications={handleNotificationToggle}
            onUpdateSettings={updateSettings}
            profile={profile}
            settings={settings}
            styles={styles}
          />
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        {navItems.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => setScreen(item.id)}
            style={[styles.navItem, screen === item.id && styles.navItemActive]}
          >
            <Text style={[styles.navText, screen === item.id && styles.navTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <Modal animationType="slide" onRequestClose={() => setSelectedDate(null)} transparent visible={!!selectedDate}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{selectedDate}</Text>
            {selectedDate && getDayStatus(selectedDate, records[selectedDate], settings) === 'future' ? (
              <Text style={styles.hintBox}>Future dates can only be marked as holidays.</Text>
            ) : (
              <>
                <TimeField
                  label="IN time"
                  onPress={() => setTimePicker({ target: 'modalIn', title: 'Choose IN time', value: modalIn, allowClear: true })}
                  styles={styles}
                  value={modalIn}
                />
                <TimeField
                  label="OUT time"
                  onPress={() => setTimePicker({ target: 'modalOut', title: 'Choose OUT time', value: modalOut, allowClear: true })}
                  styles={styles}
                  value={modalOut}
                />
                <Text style={styles.label}>Note</Text>
                <TextInput
                  multiline
                  onChangeText={setModalNote}
                  placeholder="Optional note"
                  placeholderTextColor={colors.text3}
                  style={[styles.input, styles.textArea]}
                  value={modalNote}
                />
              </>
            )}
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>Mark as Holiday</Text>
                <Text style={styles.settingSub}>Ignored in compliance stats</Text>
              </View>
              <Switch
                onValueChange={setModalHoliday}
                thumbColor="#ffffff"
                trackColor={{ false: colors.bg3, true: colors.primary }}
                value={modalHoliday}
              />
            </View>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setSelectedDate(null)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveDay} style={styles.primaryButtonSmall}>
                <Text style={styles.primaryButtonText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <TimePickerModal
        onCancel={() => setTimePicker(null)}
        onConfirm={applyPickedTime}
        picker={timePicker}
        styles={styles}
      />

      <StatusBar style={settings.theme === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

function mergeSettings(settings: Partial<Settings> | null): Settings {
  return {
    ...defaultSettings,
    ...(settings || {}),
    attendanceWindows: {
      ...defaultSettings.attendanceWindows,
      ...(settings?.attendanceWindows || {}),
    },
  };
}

function currentClock() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function AttendanceBox({
  label,
  time,
  styles,
}: {
  label: string;
  time?: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={[styles.attBox, !!time && styles.attBoxDone]}>
      <Text style={styles.attLabel}>{label}</Text>
      <Text style={styles.attTime}>{formatTime(time)}</Text>
      <Text style={styles.attState}>{time ? 'Done' : 'Pending'}</Text>
    </View>
  );
}

function StatCard({
  label,
  value,
  styles,
  wide,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
  wide?: boolean;
}) {
  return (
    <View style={[styles.statCard, wide && styles.statCardWide]}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function TimeField({
  label,
  onPress,
  styles,
  value,
}: {
  label: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  value?: string;
}) {
  return (
    <View style={styles.timeFieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onPress} style={styles.timeField}>
        <Text style={value ? styles.timeFieldValue : styles.timeFieldPlaceholder}>
          {value ? formatTime(value) : 'Not set'}
        </Text>
        <Text style={styles.timeFieldAction}>Change</Text>
      </Pressable>
    </View>
  );
}

function TimePickerModal({
  onCancel,
  onConfirm,
  picker,
  styles,
}: {
  onCancel: () => void;
  onConfirm: (time?: string) => void;
  picker: TimePickerState | null;
  styles: ReturnType<typeof createStyles>;
}) {
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);

  useEffect(() => {
    if (!picker) return;
    const initial = picker.value || currentClock();
    const [h, m] = initial.split(':').map(Number);
    setHour(Number.isNaN(h) ? 0 : h);
    setMinute(Number.isNaN(m) ? 0 : m);
  }, [picker]);

  if (!picker) return null;

  function adjustHour(delta: number) {
    setHour((current) => (current + delta + 24) % 24);
  }

  function adjustMinute(delta: number) {
    setMinute((current) => {
      const total = hour * 60 + current + delta;
      const normalized = ((total % 1440) + 1440) % 1440;
      setHour(Math.floor(normalized / 60));
      return normalized % 60;
    });
  }

  function useNow() {
    const [h, m] = currentClock().split(':').map(Number);
    setHour(h);
    setMinute(m);
  }

  const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return (
    <Modal animationType="fade" onRequestClose={onCancel} transparent visible>
      <View style={styles.modalBackdrop}>
        <View style={styles.timePickerModal}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{picker.title}</Text>
          <Text style={styles.timePickerDisplay}>{formatTime(value)}</Text>
          <Text style={styles.timePickerSub}>{value}</Text>

          <View style={styles.timePickerGrid}>
            <View style={styles.timePickerColumn}>
              <Text style={styles.settingLabel}>Hour</Text>
              <Pressable onPress={() => adjustHour(1)} style={styles.timeStepButton}>
                <Text style={styles.secondaryButtonText}>+</Text>
              </Pressable>
              <Text style={styles.timeNumber}>{String(hour).padStart(2, '0')}</Text>
              <Pressable onPress={() => adjustHour(-1)} style={styles.timeStepButton}>
                <Text style={styles.secondaryButtonText}>-</Text>
              </Pressable>
            </View>

            <View style={styles.timePickerColumn}>
              <Text style={styles.settingLabel}>Minute</Text>
              <Pressable onPress={() => adjustMinute(5)} style={styles.timeStepButton}>
                <Text style={styles.secondaryButtonText}>+5</Text>
              </Pressable>
              <Text style={styles.timeNumber}>{String(minute).padStart(2, '0')}</Text>
              <Pressable onPress={() => adjustMinute(-5)} style={styles.timeStepButton}>
                <Text style={styles.secondaryButtonText}>-5</Text>
              </Pressable>
            </View>
          </View>

          <Pressable onPress={useNow} style={styles.secondaryWideButton}>
            <Text style={styles.secondaryButtonText}>Use Current Time</Text>
          </Pressable>

          <View style={styles.modalActions}>
            {picker.allowClear && (
              <Pressable onPress={() => onConfirm(undefined)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Clear</Text>
              </Pressable>
            )}
            <Pressable onPress={onCancel} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(value)} style={styles.primaryButtonSmall}>
              <Text style={styles.primaryButtonText}>Set Time</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CalendarScreen({
  colors,
  monthCursor,
  onChangeMonth,
  onOpenDay,
  records,
  settings,
  styles,
}: {
  colors: ReturnType<typeof getPalette>;
  monthCursor: Date;
  onChangeMonth: (date: Date) => void;
  onOpenDay: (date: string) => void;
  records: AttendanceRecords;
  settings: Settings;
  styles: ReturnType<typeof createStyles>;
}) {
  const year = monthCursor.getFullYear();
  const month = monthCursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: offset }, (_, i) => ({ key: `empty-${i}`, date: '', day: '' })).concat(
    Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { key: date, date, day: String(day) };
    }),
  );

  function shiftMonth(delta: number) {
    onChangeMonth(new Date(year, month + delta, 1));
  }

  return (
    <>
      <View style={styles.card}>
        <View style={styles.calendarHeader}>
          <Pressable onPress={() => shiftMonth(-1)} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>Prev</Text>
          </Pressable>
          <Text style={styles.cardTitle}>
            {monthCursor.toLocaleDateString('en', { month: 'long', year: 'numeric' })}
          </Text>
          <Pressable onPress={() => shiftMonth(1)} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>Next</Text>
          </Pressable>
        </View>
        <View style={styles.calendarGrid}>
          {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
            <Text key={day} style={styles.dayName}>
              {day}
            </Text>
          ))}
          {cells.map((cell) => {
            if (!cell.date) return <View key={cell.key} style={styles.calendarDay} />;
            const status = getDayStatus(cell.date, records[cell.date], settings);
            const disabled = status === 'before-start';
            return (
              <Pressable
                disabled={disabled}
                key={cell.key}
                onPress={() => onOpenDay(cell.date)}
                style={[
                  styles.calendarDay,
                  status === 'full' && { backgroundColor: 'rgba(0,212,170,0.2)', borderColor: colors.primary },
                  (status === 'short' || status === 'partial') && {
                    backgroundColor: 'rgba(245,158,11,0.16)',
                    borderColor: colors.amber,
                  },
                  status === 'missed' && { backgroundColor: 'rgba(239,68,68,0.14)', borderColor: colors.red },
                  (status === 'holiday' || status === 'weekend') && { backgroundColor: colors.bg3 },
                  status === 'future' && { opacity: 0.35 },
                  cell.date === localDateKey() && { borderColor: colors.primary, borderWidth: 2 },
                ]}
              >
                <Text style={styles.calendarDayText}>{cell.day}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <Text style={styles.hintText}>Tap any date after your start date to view or edit.</Text>
    </>
  );
}

function StatsScreen({
  records,
  stats,
  styles,
}: {
  records: AttendanceRecords;
  stats: ReturnType<typeof getStats>;
  styles: ReturnType<typeof createStyles>;
}) {
  const weekly = getWeeklyData(records);

  return (
    <>
      <Text style={styles.sectionHeader}>Statistics</Text>
      <View style={styles.statsGrid}>
        <StatCard label="Current Streak" value={`${stats.streak}`} styles={styles} />
        <StatCard label="Best Streak" value={`${stats.bestStreak}`} styles={styles} />
        <StatCard label="Compliance" value={`${stats.compliance}%`} styles={styles} />
        <StatCard
          label="Avg Duration"
          value={stats.avgDuration ? formatDuration(stats.avgDuration) : '--'}
          styles={styles}
        />
        <StatCard label="Days Present" value={`${stats.fullDays}/${stats.totalDays}`} styles={styles} wide />
      </View>

      <Text style={styles.sectionHeader}>Last 7 Days</Text>
      <View style={styles.card}>
        <View style={styles.chart}>
          {weekly.map((day) => {
            const height = Math.max(4, Math.min(1, day.duration / 12) * 120);
            return (
              <View key={day.date} style={styles.chartColumn}>
                <View
                  style={[
                    styles.chartBar,
                    day.duration >= 9 ? styles.chartBarGood : styles.chartBarBad,
                    { height },
                    day.duration === 0 && styles.chartBarEmpty,
                  ]}
                />
                <Text style={styles.chartLabel}>{day.label}</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.hintText}>Green is 9h or more. Red is below target.</Text>
      </View>
    </>
  );
}

function SettingsScreen({
  onExportCSV,
  onExportJSON,
  onImportJSON,
  onReset,
  onSelectTime,
  onToggleNotifications,
  onUpdateSettings,
  profile,
  settings,
  styles,
}: {
  onExportCSV: () => void;
  onExportJSON: () => void;
  onImportJSON: () => void;
  onReset: () => void;
  onSelectTime: (target: TimePickerTarget, title: string, value: string) => void;
  onToggleNotifications: (enabled: boolean) => void;
  onUpdateSettings: (settings: Settings) => void;
  profile: Profile;
  settings: Settings;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <>
      <Text style={styles.sectionHeader}>Profile</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{profile.name}</Text>
        <Text style={styles.mutedText}>{profile.roll}</Text>
      </View>

      <Text style={styles.sectionHeader}>Appearance</Text>
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>Light Mode</Text>
            <Text style={styles.settingSub}>Switch between dark and light theme</Text>
          </View>
          <Switch
            onValueChange={(value) => onUpdateSettings({ ...settings, theme: value ? 'light' : 'dark' })}
            value={settings.theme === 'light'}
          />
        </View>
      </View>

      <Text style={styles.sectionHeader}>Notifications</Text>
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View>
            <Text style={styles.settingLabel}>Daily Reminders</Text>
            <Text style={styles.settingSub}>Schedules IN and OUT reminders on this device</Text>
          </View>
          <Switch
            onValueChange={onToggleNotifications}
            value={settings.notificationsEnabled}
          />
        </View>
      </View>

      <Text style={styles.sectionHeader}>Attendance Windows</Text>
      <View style={styles.card}>
        <View style={styles.timeRangeRow}>
          <TimeField
            label="IN starts"
            onPress={() => onSelectTime('inStart', 'Choose IN start time', settings.attendanceWindows.inStart)}
            styles={styles}
            value={settings.attendanceWindows.inStart}
          />
          <TimeField
            label="IN ends"
            onPress={() => onSelectTime('inEnd', 'Choose IN end time', settings.attendanceWindows.inEnd)}
            styles={styles}
            value={settings.attendanceWindows.inEnd}
          />
        </View>
        <View style={styles.timeRangeRow}>
          <TimeField
            label="OUT starts"
            onPress={() => onSelectTime('outStart', 'Choose OUT start time', settings.attendanceWindows.outStart)}
            styles={styles}
            value={settings.attendanceWindows.outStart}
          />
          <TimeField
            label="OUT ends"
            onPress={() => onSelectTime('outEnd', 'Choose OUT end time', settings.attendanceWindows.outEnd)}
            styles={styles}
            value={settings.attendanceWindows.outEnd}
          />
        </View>
        <Text style={styles.settingSub}>Reminder times update automatically when these windows change.</Text>
      </View>

      <Text style={styles.sectionHeader}>Data Management</Text>
      <View style={styles.card}>
        <View style={styles.dataActions}>
          <Pressable onPress={onExportCSV} style={styles.secondaryActionButton}>
            <Text style={styles.secondaryButtonText}>Export CSV</Text>
          </Pressable>
          <Pressable onPress={onExportJSON} style={styles.secondaryActionButton}>
            <Text style={styles.secondaryButtonText}>Export JSON</Text>
          </Pressable>
        </View>
        <Pressable onPress={onImportJSON} style={styles.secondaryWideButton}>
          <Text style={styles.secondaryButtonText}>Import JSON Backup</Text>
        </Pressable>
        <Text style={styles.settingSub}>JSON backups are compatible with the offline-first mobile version.</Text>
      </View>

      <Text style={styles.sectionHeader}>Future Modules</Text>
      <View style={styles.card}>
        <Text style={styles.settingLabel}>Firebase and GPS are planned for later versions.</Text>
        <Text style={styles.settingSub}>
          Version 1 stays offline-first. Version 2 will validate attendance near approved buildings.
        </Text>
      </View>

      <Text style={styles.sectionHeader}>Danger Zone</Text>
      <View style={styles.card}>
        <Pressable onPress={onReset} style={styles.dangerButton}>
          <Text style={styles.primaryButtonText}>Reset All Data</Text>
        </Pressable>
      </View>
    </>
  );
}

function createStyles(colors: ReturnType<typeof getPalette>) {
  return StyleSheet.create({
    app: {
      backgroundColor: colors.bg,
      flex: 1,
    },
    centerScreen: {
      alignItems: 'center',
      backgroundColor: colors.bg,
      flex: 1,
      justifyContent: 'center',
    },
    onboardingScreen: {
      alignItems: 'center',
      backgroundColor: colors.bg,
      flex: 1,
      justifyContent: 'center',
      padding: 24,
    },
    onboardingCard: {
      backgroundColor: colors.bg2,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      maxWidth: 420,
      padding: 28,
      width: '100%',
    },
    logo: {
      color: colors.primary,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: 2,
      marginBottom: 8,
      textAlign: 'center',
    },
    h1: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '800',
      marginBottom: 6,
      textAlign: 'center',
    },
    subText: {
      color: colors.text2,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 24,
      textAlign: 'center',
    },
    formGroup: {
      marginBottom: 16,
    },
    label: {
      color: colors.text2,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.7,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    input: {
      backgroundColor: colors.glass,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    textArea: {
      minHeight: 86,
      textAlignVertical: 'top',
    },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 15,
    },
    primaryButtonSmall: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      flex: 1.4,
      padding: 14,
    },
    primaryButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '800',
    },
    secondaryButton: {
      alignItems: 'center',
      backgroundColor: colors.glass,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flex: 1,
      padding: 14,
    },
    secondaryButtonText: {
      color: colors.text,
      fontWeight: '700',
    },
    topbar: {
      alignItems: 'center',
      backgroundColor: colors.bg2,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingBottom: 14,
      paddingHorizontal: 18,
      paddingTop: 48,
    },
    topbarTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    topbarSub: {
      color: colors.text2,
      fontSize: 12,
      marginTop: 2,
    },
    iconButton: {
      alignItems: 'center',
      backgroundColor: colors.glass,
      borderColor: colors.border,
      borderRadius: 10,
      borderWidth: 1,
      minWidth: 48,
      paddingHorizontal: 10,
      paddingVertical: 9,
    },
    iconButtonText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    content: {
      gap: 12,
      padding: 16,
      paddingBottom: 96,
    },
    todayCard: {
      backgroundColor: colors.bg2,
      borderColor: 'rgba(0,212,170,0.24)',
      borderRadius: 18,
      borderWidth: 1,
      padding: 20,
    },
    dateText: {
      color: colors.text2,
      fontSize: 13,
      marginBottom: 6,
    },
    sectionTitleBig: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '900',
      marginBottom: 18,
    },
    attendanceRow: {
      flexDirection: 'row',
      gap: 10,
    },
    attBox: {
      alignItems: 'center',
      backgroundColor: colors.glass,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flex: 1,
      padding: 14,
    },
    attBoxDone: {
      backgroundColor: 'rgba(0,212,170,0.09)',
      borderColor: 'rgba(0,212,170,0.45)',
    },
    attLabel: {
      color: colors.text2,
      fontSize: 12,
      fontWeight: '800',
    },
    attTime: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
      marginVertical: 7,
    },
    attState: {
      color: colors.text2,
      fontSize: 12,
    },
    actionRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 16,
    },
    actionButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      flex: 1,
      padding: 15,
    },
    actionButtonAlt: {
      alignItems: 'center',
      backgroundColor: colors.indigo,
      borderRadius: 14,
      flex: 1,
      padding: 15,
    },
    actionButtonText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '900',
    },
    disabledButton: {
      opacity: 0.35,
    },
    durationWrap: {
      marginTop: 16,
    },
    durationLabel: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    durationBar: {
      backgroundColor: colors.bg3,
      borderRadius: 99,
      height: 9,
      overflow: 'hidden',
    },
    durationFill: {
      backgroundColor: colors.primary,
      borderRadius: 99,
      height: '100%',
    },
    durationWarn: {
      backgroundColor: colors.amber,
    },
    hintText: {
      color: colors.text2,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 12,
      textAlign: 'center',
    },
    sectionHeader: {
      color: colors.text2,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1,
      marginTop: 8,
      textTransform: 'uppercase',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    statCard: {
      alignItems: 'center',
      backgroundColor: colors.glass,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flexBasis: '48%',
      flexGrow: 1,
      padding: 16,
    },
    statCardWide: {
      flexBasis: '100%',
    },
    statValue: {
      color: colors.primary,
      fontSize: 28,
      fontWeight: '900',
    },
    statLabel: {
      color: colors.text2,
      fontSize: 12,
      marginTop: 4,
      textAlign: 'center',
    },
    card: {
      backgroundColor: colors.bg2,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: '900',
      marginBottom: 8,
    },
    mutedText: {
      color: colors.text2,
      fontSize: 13,
      lineHeight: 19,
    },
    primaryText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '900',
    },
    indigoText: {
      color: colors.indigo,
      fontSize: 14,
      fontWeight: '900',
    },
    warningText: {
      color: colors.amber,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 14,
    },
    twoColumn: {
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
    },
    bottomNav: {
      backgroundColor: colors.bg2,
      borderTopColor: colors.border,
      borderTopWidth: 1,
      bottom: 0,
      flexDirection: 'row',
      left: 0,
      paddingBottom: 24,
      paddingHorizontal: 8,
      paddingTop: 8,
      position: 'absolute',
      right: 0,
    },
    navItem: {
      alignItems: 'center',
      borderRadius: 12,
      flex: 1,
      paddingVertical: 10,
    },
    navItemActive: {
      backgroundColor: colors.glass,
    },
    navText: {
      color: colors.text3,
      fontSize: 12,
      fontWeight: '800',
    },
    navTextActive: {
      color: colors.primary,
    },
    calendarHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    calendarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayName: {
      color: colors.text3,
      fontSize: 11,
      fontWeight: '900',
      paddingBottom: 6,
      textAlign: 'center',
      width: '14.2857%',
    },
    calendarDay: {
      alignItems: 'center',
      aspectRatio: 1,
      borderColor: 'transparent',
      borderRadius: 9,
      borderWidth: 1,
      justifyContent: 'center',
      marginTop: 6,
      width: '14.2857%',
    },
    calendarDayText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    chart: {
      alignItems: 'flex-end',
      flexDirection: 'row',
      height: 160,
      justifyContent: 'space-between',
    },
    chartColumn: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'flex-end',
    },
    chartBar: {
      borderRadius: 6,
      width: 22,
    },
    chartBarGood: {
      backgroundColor: colors.primary,
    },
    chartBarBad: {
      backgroundColor: colors.red,
    },
    chartBarEmpty: {
      backgroundColor: colors.bg3,
    },
    chartLabel: {
      color: colors.text2,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 8,
    },
    settingRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 14,
      paddingVertical: 8,
    },
    settingLabel: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    settingSub: {
      color: colors.text2,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 3,
    },
    timeRangeRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    timeFieldWrap: {
      flex: 1,
      marginBottom: 12,
    },
    timeField: {
      alignItems: 'center',
      backgroundColor: colors.glass,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      minHeight: 48,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    timeFieldValue: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    timeFieldPlaceholder: {
      color: colors.text3,
      fontSize: 15,
      fontWeight: '700',
    },
    timeFieldAction: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '900',
    },
    timePickerModal: {
      backgroundColor: colors.bg2,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
    },
    timePickerDisplay: {
      color: colors.text,
      fontSize: 36,
      fontWeight: '900',
      textAlign: 'center',
    },
    timePickerSub: {
      color: colors.text2,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 18,
      marginTop: 4,
      textAlign: 'center',
    },
    timePickerGrid: {
      flexDirection: 'row',
      gap: 14,
      marginBottom: 14,
    },
    timePickerColumn: {
      alignItems: 'center',
      backgroundColor: colors.glass,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      flex: 1,
      padding: 14,
    },
    timeStepButton: {
      alignItems: 'center',
      backgroundColor: colors.bg3,
      borderRadius: 12,
      marginVertical: 10,
      minWidth: 74,
      paddingVertical: 10,
    },
    timeNumber: {
      color: colors.text,
      fontSize: 30,
      fontWeight: '900',
    },
    dataActions: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 10,
    },
    secondaryActionButton: {
      alignItems: 'center',
      backgroundColor: colors.glass,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flex: 1,
      padding: 13,
    },
    secondaryWideButton: {
      alignItems: 'center',
      backgroundColor: colors.glass,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 8,
      padding: 13,
    },
    dangerButton: {
      alignItems: 'center',
      backgroundColor: colors.red,
      borderRadius: 12,
      padding: 14,
    },
    modalBackdrop: {
      backgroundColor: 'rgba(0,0,0,0.55)',
      flex: 1,
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: colors.bg2,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
    },
    modalHandle: {
      alignSelf: 'center',
      backgroundColor: colors.border,
      borderRadius: 99,
      height: 4,
      marginBottom: 18,
      width: 42,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '900',
      marginBottom: 16,
    },
    modalActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 10,
    },
    hintBox: {
      backgroundColor: colors.glass,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.text2,
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 12,
      padding: 12,
    },
  });
}
