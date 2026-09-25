import * as Speech from 'expo-speech';
import { Compartment, Schedule } from './types';

const copy: Record<Compartment, { title: string; body: string }> = {
  morning: { title: 'Good morning', body: 'Time to take your medicine.' },
  afternoon: { title: 'Good afternoon', body: 'Please take your medicine.' },
  night: { title: 'Good evening', body: 'Please take your medicine.' },
};

export async function scheduleDailyReminders(schedule: Schedule) {
  const Notifications = await import('expo-notifications');
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    const requested = await Notifications.requestPermissionsAsync();
    if (!requested.granted) return;
  }
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  for (const compartment of ['morning', 'afternoon', 'night'] as Compartment[]) {
    const [hour, minute] = String(schedule[`${compartment}Time`]).split(':').map(Number);
    await Notifications.scheduleNotificationAsync({ content: { ...copy[compartment], data: { compartment } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute } });
  }
}

export async function configureNotifications() {
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({ handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }) });
}

export function speakReminder(compartment: Compartment) {
  const greeting = compartment === 'morning' ? 'Good morning.' : compartment === 'afternoon' ? 'Good afternoon.' : 'Good evening.';
  Speech.stop();
  Speech.speak(`${greeting} Please take your medicine.`);
}
