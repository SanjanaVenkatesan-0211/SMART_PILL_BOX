import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '@/context/AppContext';
import { useEffect } from 'react';
import Constants from 'expo-constants';
import { configureNotifications, speakReminder } from '@/lib/notifications';

export default function RootLayout() {
  useEffect(() => {
    if (Constants.appOwnership === 'expo') return;
    let subscription: { remove: () => void } | undefined;
    import('expo-notifications').then(async (Notifications) => {
      await configureNotifications();
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const compartment = response.notification.request.content.data?.compartment;
        if (compartment === 'morning' || compartment === 'afternoon' || compartment === 'night') speakReminder(compartment);
      });
    }).catch(() => undefined);
    return () => subscription?.remove();
  }, []);
  return <AppProvider><StatusBar style="dark" /><Stack screenOptions={{ headerShown: false }} /></AppProvider>;
}
