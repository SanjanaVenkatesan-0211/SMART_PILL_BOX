import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, addDoc, collection, getDocs, runTransaction } from 'firebase/firestore';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from './types';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
const app = getApps().length ? getApps()[0] : initializeApp(configured ? firebaseConfig : {
  apiKey: 'demo', authDomain: 'demo', projectId: 'demo', appId: 'demo',
});

export const auth = Platform.OS === 'web' ? getAuth(app) : (() => {
  try {
    const getReactNativePersistence = (FirebaseAuth as unknown as { getReactNativePersistence: (storage: typeof AsyncStorage) => any }).getReactNativePersistence;
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    return getAuth(app);
  }
})();
export const db = getFirestore(app);
export { configured };

export async function loadUserData(uid: string) {
  const [profileSnapshot, scheduleSnapshot, inventorySnapshot, statusSnapshot, historySnapshot, historyCollectionSnapshot, alertsSnapshot] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDoc(doc(db, 'schedules', uid)),
    getDoc(doc(db, 'inventory', uid)),
    getDoc(doc(db, 'status', uid)),
    getDoc(doc(db, 'users', uid, 'history', 'latest')),
    getDocs(collection(db, 'users', uid, 'history')),
    getDocs(collection(db, 'users', uid, 'alerts')),
  ]);
  const fullHistory = historyCollectionSnapshot.docs
    .filter((snapshot) => snapshot.id !== 'latest')
    .map((snapshot) => {
      const data = snapshot.data();
      const createdAt = data.createdAt?.toDate?.() ?? data.createdAt;
      return { id: snapshot.id, ...data, createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt };
    })
    .sort((first, second) => String(second.createdAt ?? '').localeCompare(String(first.createdAt ?? '')));
  return {
    profile: profileSnapshot.exists() ? profileSnapshot.data() : null,
    schedule: scheduleSnapshot.exists() ? scheduleSnapshot.data() : null,
    inventory: inventorySnapshot.exists() ? inventorySnapshot.data() : null,
    statuses: statusSnapshot.exists() ? statusSnapshot.data() : null,
    latestHistory: fullHistory.length ? fullHistory : historySnapshot.exists() ? historySnapshot.data().records : null,
    alerts: alertsSnapshot.docs.map((snapshot) => {
      const data = snapshot.data();
      const createdAt = data.createdAt?.toDate?.() ?? data.createdAt;
      return { id: snapshot.id, ...data, createdAt: createdAt instanceof Date ? createdAt.toISOString() : createdAt };
    }),
  };
}

export async function saveUserData(uid: string, data: { schedule?: unknown; inventory?: unknown; statuses?: unknown; history?: unknown[] }) {
  const writes: Promise<void>[] = [];
  if (data.schedule) writes.push(setDoc(doc(db, 'schedules', uid), data.schedule, { merge: true }));
  if (data.inventory) writes.push(setDoc(doc(db, 'inventory', uid), data.inventory, { merge: true }));
  if (data.statuses) writes.push(setDoc(doc(db, 'status', uid), data.statuses, { merge: true }));
  if (data.history) writes.push(setDoc(doc(db, 'users', uid, 'history', 'latest'), { records: data.history, updatedAt: serverTimestamp() }, { merge: true }));
  await Promise.all(writes);
}

export async function saveHistoryRecord(uid: string, record: unknown, documentId?: string) {
  const payload = { ...record as object, createdAt: serverTimestamp() };
  if (documentId) {
    await setDoc(doc(db, 'users', uid, 'history', documentId), payload, { merge: true });
    return;
  }
  await addDoc(collection(db, 'users', uid, 'history'), payload);
}

export async function saveCaregiverAlert(uid: string, message: string, caregiver?: Pick<UserProfile, 'name' | 'caregiverName' | 'caregiverPhone' | 'caregiverEmail'>, documentId?: string) {
  const payload = { message, patientName: caregiver?.name ?? '', caregiverName: caregiver?.caregiverName ?? '', caregiverPhone: caregiver?.caregiverPhone ?? '', caregiverEmail: caregiver?.caregiverEmail ?? '', resolved: false, smsStatus: caregiver?.caregiverPhone ? 'queued' : 'no-phone', createdAt: serverTimestamp() };
  if (documentId) {
    const alertRef = doc(db, 'users', uid, 'alerts', documentId);
    await runTransaction(db, async (transaction) => {
      const existing = await transaction.get(alertRef);
      if (!existing.exists()) transaction.set(alertRef, payload);
    });
    return;
  }
  await addDoc(collection(db, 'users', uid, 'alerts'), payload);
}

export async function updateUserProfile(uid: string, profile: Partial<UserProfile>) {
  await setDoc(doc(db, 'users', uid), { ...profile, uid, updatedAt: serverTimestamp() }, { merge: true });
}

export async function registerUser(input: { name: string; email: string; password: string; phone: string; age: number; dob: string; gender: string; bloodGroup: string; voiceLanguage: string; caregiverName: string; caregiverPhone: string; caregiverEmail: string; caregiverAlertAfterReminders: number; timezone: string; }) {
  const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);
  await updateProfile(credential.user, { displayName: input.name });
  const profile = { uid: credential.user.uid, name: input.name, email: input.email, phone: input.phone, age: input.age, dob: input.dob, gender: input.gender, bloodGroup: input.bloodGroup, voiceLanguage: input.voiceLanguage, caregiverName: input.caregiverName, caregiverPhone: input.caregiverPhone, caregiverEmail: input.caregiverEmail, caregiverAlertAfterReminders: input.caregiverAlertAfterReminders, timezone: input.timezone, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
  await Promise.all([
    setDoc(doc(db, 'users', credential.user.uid), profile),
    setDoc(doc(db, 'schedules', credential.user.uid), { morningMedicine: 'Morning medicine', afternoonMedicine: 'Afternoon medicine', nightMedicine: 'Night medicine', morningTime: '08:00', afternoonTime: '13:00', nightTime: '20:00', morningDose: 1, afternoonDose: 1, nightDose: 1, reminderCount: Math.max(3, input.caregiverAlertAfterReminders), reminderIntervalMinutes: 10, updatedAt: serverTimestamp() }),
    setDoc(doc(db, 'inventory', credential.user.uid), { morningStock: 30, afternoonStock: 30, nightStock: 30, refillThreshold: 15, updatedAt: serverTimestamp() }),
    setDoc(doc(db, 'status', credential.user.uid), { morning: 'Pending', afternoon: 'Pending', night: 'Pending', updatedAt: serverTimestamp() }),
  ]);
  return credential.user;
}

export const loginUser = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);
export const resetPassword = (email: string) => sendPasswordResetEmail(auth, email);
export const logoutUser = () => signOut(auth);
