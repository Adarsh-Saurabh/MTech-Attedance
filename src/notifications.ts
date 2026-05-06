import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'attendance-reminders';

const reminders = [
  {
    hour: 7,
    minute: 15,
    title: 'IN Attendance Reminder',
    body: 'IN window opens in 15 min at 7:30 AM.',
  },
  {
    hour: 9,
    minute: 0,
    title: 'IN Window Closing Soon',
    body: 'Only 30 min left. IN window closes at 9:30 AM.',
  },
  {
    hour: 16,
    minute: 45,
    title: 'OUT Attendance Reminder',
    body: 'OUT window opens in 15 min at 5:00 PM.',
  },
  {
    hour: 21,
    minute: 30,
    title: 'OUT Window Closing Soon',
    body: 'Only 30 min left. OUT window closes at 10:00 PM.',
  },
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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

export async function scheduleAttendanceReminders() {
  await configureNotificationChannel();

  const granted = await requestNotificationPermission();
  if (!granted) return false;

  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const reminder of reminders) {
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
