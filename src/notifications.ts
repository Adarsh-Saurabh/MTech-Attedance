import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Settings } from './types';
import { formatTime, timeToMinutes } from './attendance';

const CHANNEL_ID = 'attendance-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function minutesToParts(total: number) {
  const normalized = ((total % 1440) + 1440) % 1440;
  return {
    hour: Math.floor(normalized / 60),
    minute: normalized % 60,
  };
}

function reminderSchedule(settings: Settings) {
  const { inStart, inEnd, outStart, outEnd } = settings.attendanceWindows;
  return [
    {
      ...minutesToParts(timeToMinutes(inStart) - 15),
      title: 'IN Attendance Reminder',
      body: `IN window opens in 15 min at ${formatTime(inStart)}.`,
    },
    {
      ...minutesToParts(timeToMinutes(inEnd) - 30),
      title: 'IN Window Closing Soon',
      body: `Only 30 min left. IN window closes at ${formatTime(inEnd)}.`,
    },
    {
      ...minutesToParts(timeToMinutes(outStart) - 15),
      title: 'OUT Attendance Reminder',
      body: `OUT window opens in 15 min at ${formatTime(outStart)}.`,
    },
    {
      ...minutesToParts(timeToMinutes(outEnd) - 30),
      title: 'OUT Window Closing Soon',
      body: `Only 30 min left. OUT window closes at ${formatTime(outEnd)}.`,
    },
  ];
}

export async function configureNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Attendance reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#00d4aa',
    });
  }
}

export async function notificationsGranted() {
  const status = await Notifications.getPermissionsAsync();
  return status.granted;
}

export async function requestNotificationPermission() {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function scheduleAttendanceReminders(settings: Settings) {
  await configureNotificationChannel();

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const reminder of reminderSchedule(settings)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.body,
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: CHANNEL_ID,
        hour: reminder.hour,
        minute: reminder.minute,
      },
    });
  }

  return true;
}

export async function cancelAttendanceReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
