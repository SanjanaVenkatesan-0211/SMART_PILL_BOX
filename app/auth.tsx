import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { loginUser, registerUser, resetPassword } from '@/lib/firebase';

const languages = [
  { label: 'English', value: 'en-US' }, { label: 'Hindi', value: 'hi-IN' },
  { label: 'Tamil', value: 'ta-IN' }, { label: 'Telugu', value: 'te-IN' },
  { label: 'Kannada', value: 'kn-IN' }, { label: 'Malayalam', value: 'ml-IN' },
];

export default function Auth() {
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [voiceLanguage, setVoiceLanguage] = useState('en-US');
  const [caregiverName, setCaregiverName] = useState('');
  const [caregiverPhone, setCaregiverPhone] = useState('');
  const [caregiverEmail, setCaregiverEmail] = useState('');
  const [caregiverPushToken, setCaregiverPushToken] = useState('');
  const [caregiverAlertAfterReminders, setCaregiverAlertAfterReminders] = useState('3');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (registering) {
        if (!name || !email || !password) throw new Error('Name, email, and password are required.');
        if (caregiverPhone && !/^\+[1-9]\d{7,14}$/.test(caregiverPhone.trim())) throw new Error('Enter the caregiver phone in international format, such as +15551234567.');
        const escalationThreshold = Math.min(10, Math.max(1, Number(caregiverAlertAfterReminders) || 3));
        await registerUser({ name, email, password, phone, age: Number(age) || 0, dob, gender, bloodGroup, voiceLanguage, caregiverName, caregiverPhone, caregiverEmail, caregiverPushToken: caregiverPushToken.trim(), caregiverAlertAfterReminders: escalationThreshold, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
      } else {
        await loginUser(email, password);
      }
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Could not continue', error instanceof Error ? error.message : 'Please check your details and try again.');
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email) return Alert.alert('Enter your email first');
    try { await resetPassword(email); Alert.alert('Email sent', 'Check your inbox for a password reset link.'); }
    catch (error) { Alert.alert('Could not send reset email', error instanceof Error ? error.message : 'Please try again.'); }
  };

  return <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <View style={styles.brand}><View style={styles.logo}><Text style={styles.logoText}>+</Text></View><Text style={styles.brandName}>Smart Pill Box</Text><Text style={styles.tagline}>A calmer way to stay on track.</Text></View>
      <View style={styles.form}>
        <Text style={styles.title}>{registering ? 'Create your account' : 'Welcome back'}</Text>
        <Text style={styles.sub}>{registering ? 'Set up your personal care and reminder preferences.' : 'Sign in to continue your care routine.'}</Text>
        {registering && <>
          <Field label="FULL NAME" value={name} setValue={setName} placeholder="Your name" />
          <Field label="PHONE NUMBER" value={phone} setValue={setPhone} placeholder="Your phone" keyboardType="phone-pad" />
          <View style={styles.row}><Field label="AGE" value={age} setValue={setAge} placeholder="Age" keyboardType="number-pad" /><Field label="DATE OF BIRTH" value={dob} setValue={setDob} placeholder="YYYY-MM-DD" /></View>
          <View style={styles.row}><Field label="GENDER" value={gender} setValue={setGender} placeholder="Gender" /><Field label="BLOOD GROUP" value={bloodGroup} setValue={setBloodGroup} placeholder="e.g. O+" /></View>
          <Text style={styles.fieldLabel}>VOICE REMINDER LANGUAGE</Text>
          <View style={styles.languageGrid}>{languages.map((language) => <Pressable key={language.value} onPress={() => setVoiceLanguage(language.value)} style={[styles.languageOption, voiceLanguage === language.value && styles.languageSelected]}><Text style={[styles.languageText, voiceLanguage === language.value && styles.languageSelectedText]}>{language.label}</Text></Pressable>)}</View>
          <Text style={styles.section}>Caregiver contact</Text>
          <Field label="CAREGIVER NAME" value={caregiverName} setValue={setCaregiverName} placeholder="Caregiver name" />
          <Field label="CAREGIVER PHONE (INTERNATIONAL FORMAT)" value={caregiverPhone} setValue={setCaregiverPhone} placeholder="+15551234567" keyboardType="phone-pad" />
          <Field label="CAREGIVER EMAIL" value={caregiverEmail} setValue={setCaregiverEmail} placeholder="name@example.com" keyboardType="email-address" />
          <Field label="CAREGIVER PUSH TOKEN (OPTIONAL FREE ALERT)" value={caregiverPushToken} setValue={setCaregiverPushToken} placeholder="FCM or Expo token" autoCapitalize="none" />
          <Field label="REMINDERS BEFORE CAREGIVER ALERT" value={caregiverAlertAfterReminders} setValue={setCaregiverAlertAfterReminders} placeholder="3" keyboardType="number-pad" />
        </>}
        <Field label="EMAIL ADDRESS" value={email} setValue={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" />
        <Field label="PASSWORD" value={password} setValue={setPassword} placeholder="Password" secureTextEntry />
        <Pressable style={styles.primary} onPress={submit} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Please wait...' : registering ? 'Create account' : 'Sign in'}</Text></Pressable>
        {!registering && <Pressable onPress={forgot}><Text style={styles.forgot}>Forgot password?</Text></Pressable>}
        <Pressable onPress={() => setRegistering(!registering)}><Text style={styles.switch}>{registering ? 'Already have an account? Sign in' : 'New here? Create an account'}</Text></Pressable>
      </View>
    </ScrollView>
  </KeyboardAvoidingView>;
}

function Field({ label, value, setValue, placeholder, keyboardType, secureTextEntry, autoCapitalize }: { label: string; value: string; setValue: (value: string) => void; placeholder: string; keyboardType?: 'default' | 'number-pad' | 'phone-pad' | 'email-address'; secureTextEntry?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={setValue} placeholder={placeholder} placeholderTextColor="#9AA8A3" keyboardType={keyboardType} secureTextEntry={secureTextEntry} autoCapitalize={autoCapitalize} /></View>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: '#F7FAF8' }, scroll: { padding: 24, paddingTop: 42, paddingBottom: 40 }, brand: { alignItems: 'center', marginBottom: 28 }, logo: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#143D36', alignItems: 'center', justifyContent: 'center' }, logoText: { color: '#B9DED4', fontSize: 32, fontWeight: '300' }, brandName: { color: '#143D36', fontSize: 23, fontWeight: '700', marginTop: 14 }, tagline: { color: '#778681', marginTop: 5 }, form: { backgroundColor: '#FFF', borderRadius: 20, padding: 21, borderWidth: 1, borderColor: '#E9EFEC' }, title: { color: '#142B28', fontSize: 23, fontWeight: '700' }, sub: { color: '#778681', marginTop: 6, marginBottom: 21, lineHeight: 18 }, field: { flex: 1, marginBottom: 11 }, fieldLabel: { color: '#778681', fontSize: 10, fontWeight: '700', letterSpacing: 0.7, marginBottom: 6 }, input: { minHeight: 48, borderWidth: 1, borderColor: '#DCE7E2', borderRadius: 11, paddingHorizontal: 13, color: '#243D38' }, row: { flexDirection: 'row', gap: 10 }, languageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }, languageOption: { borderWidth: 1, borderColor: '#DCE7E2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }, languageSelected: { borderColor: '#087F70', backgroundColor: '#DDF4EE' }, languageText: { color: '#53635E', fontSize: 12, fontWeight: '600' }, languageSelectedText: { color: '#087F70' }, section: { color: '#243D38', fontWeight: '700', fontSize: 15, marginVertical: 8 }, primary: { backgroundColor: '#087F70', borderRadius: 12, alignItems: 'center', padding: 15, marginTop: 4 }, primaryText: { color: '#FFF', fontWeight: '700', fontSize: 15 }, forgot: { color: '#087F70', textAlign: 'center', fontSize: 12, fontWeight: '700', marginTop: 18 }, switch: { color: '#087F70', textAlign: 'center', fontSize: 13, fontWeight: '700', marginTop: 22 } });
