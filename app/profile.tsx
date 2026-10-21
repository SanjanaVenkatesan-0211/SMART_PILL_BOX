import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { logoutUser } from '@/lib/firebase';
import { UserProfile } from '@/lib/types';

const languages = [
  { label: 'English', value: 'en-US' }, { label: 'Hindi', value: 'hi-IN' },
  { label: 'Tamil', value: 'ta-IN' }, { label: 'Telugu', value: 'te-IN' },
  { label: 'Kannada', value: 'kn-IN' }, { label: 'Malayalam', value: 'ml-IN' },
];

export default function Profile() {
  const { user, schedule, updateProfile, resetTodayForTesting } = useApp();
  const [draft, setDraft] = useState<UserProfile | null>(user);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(user), [user]);
  if (!user || !draft) return <Redirect href="/auth" />;
  const update = (key: keyof UserProfile, value: string) => setDraft({ ...draft, [key]: key === 'age' || key === 'caregiverAlertAfterReminders' ? Number(value) || 0 : value });
  const save = async () => {
    setSaving(true);
    try {
      if (draft.caregiverPhone && !/^\+[1-9]\d{7,14}$/.test(draft.caregiverPhone.trim())) throw new Error('Enter the caregiver phone in international format, such as +15551234567.');
      if (draft.caregiverAlertAfterReminders < 1 || draft.caregiverAlertAfterReminders > 10) throw new Error('Caregiver alert threshold must be between 1 and 10 reminders.');
      if (draft.caregiverAlertAfterReminders > schedule.reminderCount) throw new Error(`Set the caregiver alert threshold to ${schedule.reminderCount} or fewer, or increase the scheduled reminder count first.`);
      await updateProfile(draft);
      Alert.alert('Profile saved', 'Your profile was updated in Firebase.');
    } catch (error) {
      Alert.alert('Could not save profile', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const resetTesting = () => Alert.alert('Reset today?', 'This will set all doses to Pending, remove today\'s dashboard entries, and restore tablets used today.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: async () => { try { await resetTodayForTesting(); Alert.alert('Testing reset complete', 'Today\'s doses are Pending again.'); } catch (error) { Alert.alert('Could not reset testing data', error instanceof Error ? error.message : 'Please try again.'); } } }]);
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#143D36" /></Pressable>
    <View style={styles.avatar}><Text style={styles.initials}>{initials(draft.name)}</Text></View>
    <Text style={styles.name}>{draft.name}</Text>
    <Text style={styles.email}>{draft.email}</Text>
    <View style={styles.form}>
      <Field label="Name" value={draft.name} onChangeText={(value) => update('name', value)} />
      <Field label="Phone" value={draft.phone} onChangeText={(value) => update('phone', value)} keyboardType="phone-pad" />
      <Field label="Age" value={String(draft.age)} onChangeText={(value) => update('age', value)} keyboardType="number-pad" />
      <Field label="Date of birth" value={draft.dob} onChangeText={(value) => update('dob', value)} />
      <Field label="Gender" value={draft.gender} onChangeText={(value) => update('gender', value)} />
      <Field label="Blood group" value={draft.bloodGroup} onChangeText={(value) => update('bloodGroup', value)} />
      <Text style={styles.label}>VOICE REMINDER LANGUAGE</Text>
      <View style={styles.languageGrid}>{languages.map((language) => <Pressable key={language.value} onPress={() => update('voiceLanguage', language.value)} style={[styles.languageOption, (draft.voiceLanguage || 'en-US') === language.value && styles.languageSelected]}><Text style={[styles.languageText, (draft.voiceLanguage || 'en-US') === language.value && styles.languageSelectedText]}>{language.label}</Text></Pressable>)}</View>
      <Text style={styles.section}>Caregiver contact</Text>
      <Field label="CAREGIVER NAME" value={draft.caregiverName || ''} onChangeText={(value) => update('caregiverName', value)} />
      <Field label="CAREGIVER PHONE (INTERNATIONAL FORMAT)" value={draft.caregiverPhone || ''} onChangeText={(value) => update('caregiverPhone', value)} keyboardType="phone-pad" />
      <Field label="CAREGIVER EMAIL" value={draft.caregiverEmail || ''} onChangeText={(value) => update('caregiverEmail', value)} keyboardType="email-address" />
      <Field label="CAREGIVER PUSH TOKEN (OPTIONAL FREE ALERT)" value={draft.caregiverPushToken || ''} onChangeText={(value) => update('caregiverPushToken', value)} autoCapitalize="none" />
      {__DEV__ && <View style={styles.field}><Text style={styles.label}>FCM TOKEN (DEV ONLY)</Text><TextInput style={[styles.input, styles.tokenBox]} value={draft.caregiverPushToken || 'Not registered yet'} editable={false} multiline /></View>}
      <Field label="REMINDERS BEFORE CAREGIVER ALERT" value={String(draft.caregiverAlertAfterReminders || 3)} onChangeText={(value) => update('caregiverAlertAfterReminders', value)} keyboardType="number-pad" />
    </View>
    <Pressable style={styles.save} onPress={save} disabled={saving}><Text style={styles.saveText}>{saving ? 'Saving...' : 'Save profile'}</Text></Pressable>
    <Pressable style={styles.reset} onPress={resetTesting}><Text style={styles.resetText}>Reset today for testing</Text></Pressable>
    <Pressable style={styles.logout} onPress={async () => { await logoutUser().catch(() => undefined); router.replace('/auth'); }}><Text style={styles.logoutText}>Log out</Text></Pressable>
  </ScrollView>;
}

function Field({ label, value, onChangeText, keyboardType, autoCapitalize }: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'default' | 'number-pad' | 'phone-pad' | 'email-address'; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={onChangeText} keyboardType={keyboardType} autoCapitalize={autoCapitalize} /></View>;
}

function initials(name: string) { return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F7FAF8' }, content: { padding: 24, paddingTop: 30, paddingBottom: 40 }, avatar: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#143D36', alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginTop: 30 }, initials: { color: '#FFF', fontSize: 25, fontWeight: '700' }, name: { textAlign: 'center', color: '#143D36', fontSize: 24, fontWeight: '700', marginTop: 15 }, email: { textAlign: 'center', color: '#778681', marginTop: 5 }, form: { marginTop: 28, backgroundColor: '#FFF', borderRadius: 17, padding: 18 }, field: { marginBottom: 13 }, label: { color: '#879590', fontSize: 11, marginBottom: 7, marginTop: 4 }, input: { borderWidth: 1, borderColor: '#DCE7E2', borderRadius: 10, padding: 12, color: '#243D38', fontSize: 15 }, tokenBox: { minHeight: 80, textAlignVertical: 'top' }, languageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }, languageOption: { borderWidth: 1, borderColor: '#DCE7E2', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9 }, languageSelected: { borderColor: '#087F70', backgroundColor: '#DDF4EE' }, languageText: { color: '#53635E', fontSize: 12, fontWeight: '600' }, languageSelectedText: { color: '#087F70' }, section: { color: '#243D38', fontWeight: '700', fontSize: 15, marginTop: 12, marginBottom: 10 }, save: { backgroundColor: '#087F70', padding: 15, borderRadius: 13, alignItems: 'center', marginTop: 18 }, saveText: { color: '#FFF', fontWeight: '700' }, reset: { borderWidth: 1, borderColor: '#B27720', padding: 14, borderRadius: 13, marginTop: 12, alignItems: 'center' }, resetText: { color: '#B27720', fontWeight: '700' }, logout: { borderWidth: 1, borderColor: '#C05252', padding: 14, borderRadius: 13, marginTop: 12, alignItems: 'center' }, logoutText: { color: '#C05252', fontWeight: '700' } });
