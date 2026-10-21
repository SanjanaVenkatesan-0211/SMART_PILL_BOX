import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '@/context/AppContext';
import { Compartment, Inventory, Schedule } from '@/lib/types';
import { testVoiceReminder } from '@/lib/notifications';

export default function ScheduleScreen() {
  const { schedule, inventory, user, updateSchedule, updateInventory } = useApp();
  const [draft, setDraft] = useState(schedule);
  const [stockDraft, setStockDraft] = useState(inventory);
  const [timePickerCompartment, setTimePickerCompartment] = useState<Compartment | null>(null);
  useEffect(() => setDraft(schedule), [schedule]);
  useEffect(() => setStockDraft(inventory), [inventory]);
  const updateScheduleDraft = (key: keyof Schedule, value: string) => setDraft({ ...draft, [key]: key.endsWith('Dose') || key === 'reminderCount' || key === 'reminderIntervalMinutes' ? Number(value) || 0 : value });
  const updateStockDraft = (key: keyof Inventory, value: string) => setStockDraft({ ...stockDraft, [key]: Number(value) || 0 });
  const save = async () => {
    if (draft.reminderCount < 1 || draft.reminderCount > 10 || draft.reminderIntervalMinutes < 1 || draft.reminderIntervalMinutes > 180) {
      Alert.alert('Check reminder settings', 'Use 1-10 reminders and an interval from 1-180 minutes.');
      return;
    }
    if (user && user.caregiverAlertAfterReminders > draft.reminderCount) {
      Alert.alert('Reminder count is too low', `Increase the reminder count to at least ${user.caregiverAlertAfterReminders}, or lower the caregiver alert threshold in Profile.`);
      return;
    }
    await updateSchedule({ ...draft, updatedAt: new Date().toISOString() });
    await updateInventory({ ...stockDraft, updatedAt: new Date().toISOString() });
    Alert.alert('Saved', 'Your schedule and inventory were saved to Firebase.');
  };
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>MEDICATION PLAN</Text>
    <Text style={styles.title}>Your schedule</Text>
    <Text style={styles.sub}>Set medication names, times, doses, and stock. Review older saved times once; the previous text field did not record AM/PM.</Text>
    <View style={styles.card}>
      <Text style={styles.part}>Reminder settings</Text>
      <View style={styles.inputs}>
        <View style={styles.reminderField}><Text style={styles.label}>NUMBER OF REMINDERS (1-10)</Text><TextInput style={styles.reminderInput} value={String(draft.reminderCount)} onChangeText={(value) => updateScheduleDraft('reminderCount', value)} keyboardType="number-pad" /></View>
        <View style={styles.reminderField}><Text style={styles.label}>INTERVAL IN MINUTES</Text><TextInput style={styles.reminderInput} value={String(draft.reminderIntervalMinutes)} onChangeText={(value) => updateScheduleDraft('reminderIntervalMinutes', value)} keyboardType="number-pad" /></View>
      </View>
      <Text style={styles.reminderNote}>The first reminder is at the selected time; later reminders follow the interval. Times show AM/PM and are stored in 24-hour format.</Text>
      {Platform.OS === 'android' && <Pressable style={styles.testVoice} onPress={() => Alert.alert('Allow accurate alarms', 'In App info, open Alarms & reminders and enable Allow setting alarms. Android may delay reminders when this access is off.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Open app settings', onPress: () => { void Linking.openSettings(); } }])}><Ionicons name="alarm-outline" size={17} color="#087F70" /><Text style={styles.testVoiceText}>Android exact-alarm settings</Text></Pressable>}
      <Pressable style={styles.testVoice} onPress={async () => { const available = await testVoiceReminder(user?.voiceLanguage || 'en-US'); if (!available) Alert.alert('Voice not installed', 'Install the selected language voice on this phone. On Android, open Settings → Text-to-speech output → Install voice data, then choose Tamil or Hindi.'); }}><Ionicons name="volume-high-outline" size={17} color="#087F70" /><Text style={styles.testVoiceText}>Test voice reminder</Text></Pressable>
    </View>
    {(['morning', 'afternoon', 'night'] as Compartment[]).map((part) => {
      const stockKey = `${part}Stock` as keyof Inventory;
      const stock = Number(stockDraft[stockKey]);
      const low = stock <= stockDraft.refillThreshold;
      return <View style={styles.card} key={part}>
        <View style={styles.cardHead}><View style={styles.icon}><Ionicons name={part === 'night' ? 'moon-outline' : part === 'morning' ? 'sunny-outline' : 'partly-sunny-outline'} size={20} color="#087F70" /></View><Text style={styles.part}>{part[0].toUpperCase() + part.slice(1)}</Text></View>
        <Text style={styles.label}>MEDICINE NAME</Text>
        <TextInput style={styles.fullInput} value={String(draft[`${part}Medicine`])} onChangeText={(value) => updateScheduleDraft(`${part}Medicine`, value)} placeholder="e.g. Vitamin D" placeholderTextColor="#9AA8A3" />
        <View style={styles.inputs}><View><Text style={styles.label}>TIME</Text><Pressable style={styles.input} onPress={() => setTimePickerCompartment(part)}><Text style={styles.timeText}>{formatClockTime(String(draft[`${part}Time`]))}</Text></Pressable>{timePickerCompartment === part && <DateTimePicker value={timeToDate(String(draft[`${part}Time`]))} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} is24Hour={false} onChange={(event, selectedDate) => { setTimePickerCompartment(null); if (event.type === 'set' && selectedDate) updateScheduleDraft(`${part}Time`, `${String(selectedDate.getHours()).padStart(2, '0')}:${String(selectedDate.getMinutes()).padStart(2, '0')}`); }} />}</View><View><Text style={styles.label}>DOSE</Text><TextInput style={styles.input} value={String(draft[`${part}Dose`])} onChangeText={(value) => updateScheduleDraft(`${part}Dose`, value)} keyboardType="number-pad" /></View><View><Text style={styles.label}>STOCK</Text><TextInput style={styles.input} value={String(stock)} onChangeText={(value) => updateStockDraft(stockKey, value)} keyboardType="number-pad" /></View></View>
        <Text style={[styles.refill, { color: low ? '#B27720' : '#087F70' }]}>{low ? 'Refill required soon' : 'Stock level is healthy'} · threshold {stockDraft.refillThreshold}</Text>
      </View>;
    })}
    <Pressable style={styles.save} onPress={save}><Text style={styles.saveText}>Save schedule and inventory</Text><Ionicons name="checkmark" size={18} color="#FFF" /></Pressable>
    <Text style={styles.note}>For accurate delivery on Android 12+, open Settings → Apps → Smart Pill Box → Alarms & reminders and allow alarms. Expo Go cannot schedule these notifications; install the rebuilt development APK.</Text>
  </ScrollView>;
}

function timeToDate(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/);
  const date = new Date();
  if (!match) { date.setHours(8, 0, 0, 0); return date; }
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  date.setHours(hour, minute, 0, 0);
  return date;
}

function formatClockTime(value: string) {
  return timeToDate(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true });
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F7FAF8' }, content: { padding: 22, paddingTop: 30, paddingBottom: 40 }, eyebrow: { color: '#70807C', letterSpacing: 1.4, fontSize: 10, fontWeight: '700' }, title: { color: '#142B28', fontSize: 28, fontWeight: '700', marginTop: 8 }, sub: { color: '#778681', marginTop: 7, marginBottom: 25 }, card: { backgroundColor: '#FFF', borderRadius: 17, marginBottom: 12, padding: 17, borderWidth: 1, borderColor: '#E9EFEC' }, cardHead: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 17 }, icon: { backgroundColor: '#DDF4EE', width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' }, part: { color: '#243D38', fontWeight: '700', fontSize: 16, marginBottom: 14 }, inputs: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' }, reminderField: { flex: 1 }, label: { color: '#879590', fontSize: 10, letterSpacing: 0.4, fontWeight: '700', marginBottom: 7 }, input: { width: 90, borderWidth: 1, borderColor: '#DCE7E2', borderRadius: 10, padding: 12, color: '#143D36', fontSize: 16, fontWeight: '600' }, timeText: { color: '#143D36', fontSize: 15, fontWeight: '600' }, reminderInput: { borderWidth: 1, borderColor: '#DCE7E2', borderRadius: 10, padding: 12, color: '#143D36', fontSize: 16, fontWeight: '600' }, reminderNote: { color: '#899590', fontSize: 11, marginTop: 10 }, testVoice: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, paddingVertical: 6 }, testVoiceText: { color: '#087F70', fontSize: 12, fontWeight: '700' }, fullInput: { borderWidth: 1, borderColor: '#DCE7E2', borderRadius: 10, padding: 12, color: '#143D36', fontSize: 15, marginBottom: 15 }, refill: { fontSize: 11, fontWeight: '700', marginTop: 12 }, save: { backgroundColor: '#087F70', borderRadius: 14, padding: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 10 }, saveText: { color: '#FFF', fontWeight: '700', fontSize: 15 }, note: { color: '#899590', textAlign: 'center', fontSize: 11, lineHeight: 17, marginTop: 15 } });
