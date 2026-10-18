import * as Speech from 'expo-speech';
import Constants from 'expo-constants';
import { Compartment, Schedule } from './types';

const copy: Record<string, Record<Compartment, { title: string; body: string; speech: string }>> = {
  'en-US': {
    morning: { title: 'Good morning', body: 'Time to take your medicine.', speech: 'Good morning. It is time to take your medicine.' },
    afternoon: { title: 'Good afternoon', body: 'Please take your medicine.', speech: 'Good afternoon. Please take your medicine.' },
    night: { title: 'Good evening', body: 'Please take your medicine.', speech: 'Good evening. Please take your medicine.' },
  },
  'hi-IN': {
    morning: { title: 'सुप्रभात', body: 'दवा लेने का समय है।', speech: 'सुप्रभात। दवा लेने का समय है।' },
    afternoon: { title: 'नमस्कार', body: 'कृपया अपनी दवा लें।', speech: 'नमस्कार। कृपया अपनी दवा लें।' },
    night: { title: 'शुभ संध्या', body: 'कृपया अपनी दवा लें।', speech: 'शुभ संध्या। कृपया अपनी दवा लें।' },
  },
  'ta-IN': {
    morning: { title: 'காலை வணக்கம்', body: 'மருந்து எடுத்துக்கொள்ளும் நேரம்.', speech: 'காலை வணக்கம். மருந்து எடுத்துக்கொள்ளும் நேரம்.' },
    afternoon: { title: 'வணக்கம்', body: 'தயவுசெய்து மருந்து எடுத்துக்கொள்ளுங்கள்.', speech: 'வணக்கம். தயவுசெய்து மருந்து எடுத்துக்கொள்ளுங்கள்.' },
    night: { title: 'மாலை வணக்கம்', body: 'தயவுசெய்து மருந்து எடுத்துக்கொள்ளுங்கள்.', speech: 'மாலை வணக்கம். தயவுசெய்து மருந்து எடுத்துக்கொள்ளுங்கள்.' },
  },
  'te-IN': {
    morning: { title: 'శుభోదయం', body: 'మందు తీసుకునే సమయం.', speech: 'శుభోదయం. మందు తీసుకునే సమయం.' },
    afternoon: { title: 'నమస్కారం', body: 'దయచేసి మీ మందు తీసుకోండి.', speech: 'నమస్కారం. దయచేసి మీ మందు తీసుకోండి.' },
    night: { title: 'శుభ సాయంత్రం', body: 'దయచేసి మీ మందు తీసుకోండి.', speech: 'శుభ సాయంత్రం. దయచేసి మీ మందు తీసుకోండి.' },
  },
  'kn-IN': {
    morning: { title: 'ಶುಭೋದಯ', body: 'ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳುವ ಸಮಯ.', speech: 'ಶುಭೋದಯ. ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳುವ ಸಮಯ.' },
    afternoon: { title: 'ನಮಸ್ಕಾರ', body: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳಿ.', speech: 'ನಮಸ್ಕಾರ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳಿ.' },
    night: { title: 'ಶುಭ ಸಂಜೆ', body: 'ದಯವಿಟ್ಟು ನಿಮ್ಮ ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳಿ.', speech: 'ಶುಭ ಸಂಜೆ. ದಯವಿಟ್ಟು ನಿಮ್ಮ ಔಷಧಿ ತೆಗೆದುಕೊಳ್ಳಿ.' },
  },
  'ml-IN': {
    morning: { title: 'സുപ്രഭാതം', body: 'മരുന്ന് കഴിക്കാനുള്ള സമയമായി.', speech: 'സുപ്രഭാതം. മരുന്ന് കഴിക്കാനുള്ള സമയമായി.' },
    afternoon: { title: 'നമസ്കാരം', body: 'ദയവായി മരുന്ന് കഴിക്കുക.', speech: 'നമസ്കാരം. ദയവായി മരുന്ന് കഴിക്കുക.' },
    night: { title: 'ശുഭ സായാഹ്നം', body: 'ദയവായി മരുന്ന് കഴിക്കുക.', speech: 'ശുഭ സായാഹ്നം. ദയവായി മരുന്ന് കഴിക്കുക.' },
  },
};

export async function scheduleDailyReminders(schedule: Schedule, language = 'en-US') {
  if (Constants.appOwnership === 'expo') return false;
  const Notifications = await import('expo-notifications');
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    const requested = await Notifications.requestPermissionsAsync();
    if (!requested.granted) return false;
  }
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(existing.map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  const selectedCopy = copy[language] ?? copy['en-US'];
  const reminderCount = Math.min(10, Math.max(1, Math.floor(Number(schedule.reminderCount) || 1)));
  const interval = Math.min(180, Math.max(1, Math.floor(Number(schedule.reminderIntervalMinutes) || 10)));
  for (const compartment of ['morning', 'afternoon', 'night'] as Compartment[]) {
    const [baseHour, baseMinute] = String(schedule[`${compartment}Time`]).split(':').map(Number);
    for (let reminderIndex = 0; reminderIndex < reminderCount; reminderIndex += 1) {
      const totalMinutes = (baseHour * 60) + baseMinute + (reminderIndex * interval);
      const hour = Math.floor(totalMinutes / 60) % 24;
      const minute = totalMinutes % 60;
      await Notifications.scheduleNotificationAsync({
        content: { title: selectedCopy[compartment].title, body: selectedCopy[compartment].body, data: { compartment, language, reminderIndex } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
      });
    }
  }
  return true;
}

export async function configureNotifications() {
  if (Constants.appOwnership === 'expo') return;
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({ handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }) });
}

async function findInstalledVoice(language: string) {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const requestedLocale = language.toLowerCase();
    const requestedLanguage = requestedLocale.split('-')[0];
    return voices.find((voice) => voice.language.toLowerCase() === requestedLocale)
      ?? voices.find((voice) => voice.language.toLowerCase().split('-')[0] === requestedLanguage)
      ?? null;
  } catch {
    return null;
  }
}

export async function speakReminder(compartment: Compartment, language = 'en-US') {
  const voice = await findInstalledVoice(language);
  if (!voice) return false;
  const message = (copy[language] ?? copy['en-US'])[compartment].speech;
  await Speech.stop();
  Speech.speak(message, { language: voice.language, voice: voice.identifier });
  return true;
}

export async function testVoiceReminder(language = 'en-US') {
  return speakReminder('morning', language);
}
