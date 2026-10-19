import React, { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, loadUserData, saveCaregiverAlert, saveHistoryRecord, saveUserData, updateUserProfile } from '@/lib/firebase';
import { defaultInventory, defaultSchedule, defaultStatuses } from '@/lib/seed';
import { CaregiverAlert, Compartment, Dose, DoseStatus, HistoryRecord, Inventory, Schedule, UserProfile } from '@/lib/types';
import { scheduleDailyReminders } from '@/lib/notifications';

type Statuses = typeof defaultStatuses;
type AppContextValue = {
  user: UserProfile | null;
  authUser: User | null;
  loading: boolean;
  schedule: Schedule;
  inventory: Inventory;
  history: HistoryRecord[];
  alerts: CaregiverAlert[];
  statuses: Statuses;
  doses: Dose[];
  takeDose: (compartment: Compartment) => Promise<boolean>;
  updateSchedule: (schedule: Schedule) => Promise<void>;
  updateInventory: (inventory: Inventory) => Promise<void>;
  updateProfile: (profile: UserProfile) => Promise<void>;
  resetTodayForTesting: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);
const labels: Record<Compartment, string> = { morning: 'Morning', afternoon: 'Afternoon', night: 'Night' };

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getMissedGraceMinutes(schedule: Schedule) {
  const interval = Math.max(1, Number(schedule.reminderIntervalMinutes) || 10);
  return Math.max(5, Math.min(15, interval));
}

function isRecordFromDate(record: HistoryRecord, date: Date) {
  return record.date === localDateKey(date) || record.date === date.toLocaleDateString();
}

function readSchedule(value: Record<string, unknown> | null): Schedule {
  return { ...defaultSchedule, ...(value ?? {}), updatedAt: String(value?.updatedAt ?? new Date().toISOString()) } as Schedule;
}

function readInventory(value: Record<string, unknown> | null): Inventory {
  return { ...defaultInventory, ...(value ?? {}), updatedAt: String(value?.updatedAt ?? new Date().toISOString()) } as Inventory;
}

export function AppProvider({ children }: PropsWithChildren) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState(defaultSchedule);
  const [inventory, setInventory] = useState(defaultInventory);
  const [statuses, setStatuses] = useState<Statuses>(defaultStatuses);
  const [statusDate, setStatusDate] = useState('');
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [alerts, setAlerts] = useState<CaregiverAlert[]>([]);

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setAuthUser(nextUser);
    if (!nextUser) {
      setUser(null);
      setHistory([]);
      setLoading(false);
      return;
    }
    try {
      const data = await loadUserData(nextUser.uid);
      const loadedProfile = { uid: nextUser.uid, name: nextUser.displayName ?? 'User', email: nextUser.email ?? '', phone: '', age: 0, dob: '', gender: '', bloodGroup: '', voiceLanguage: 'en-US', caregiverName: '', caregiverPhone: '', caregiverEmail: '', caregiverAlertAfterReminders: 3, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', ...(data.profile ?? {}) } as UserProfile;
      const loadedSchedule = readSchedule(data.schedule);
      setUser(loadedProfile);
      setSchedule(loadedSchedule);
      setInventory(readInventory(data.inventory));
      const today = localDateKey();
      const storedStatusDate = String(data.statuses?.statusDate ?? '');
      const rawStatuses = storedStatusDate === today
        ? { ...defaultStatuses, morning: data.statuses?.morning, afternoon: data.statuses?.afternoon, night: data.statuses?.night } as Statuses
        : defaultStatuses;
      const todayHistory = ((data.latestHistory ?? []) as HistoryRecord[]).filter((record) => isRecordFromDate(record, new Date()));
      const loadedStatuses = { ...rawStatuses };
      for (const compartment of ['morning', 'afternoon', 'night'] as Compartment[]) {
        if (loadedStatuses[compartment] === 'Taken' || loadedStatuses[compartment] === 'Missed') {
          const hasMatchingTodayRecord = todayHistory.some((record) => record.compartment === compartment && record.status === loadedStatuses[compartment]);
          if (!hasMatchingTodayRecord) loadedStatuses[compartment] = 'Pending';
        }
      }
      setStatuses(loadedStatuses);
      setStatusDate(today);
      const statusNeedsRepair = storedStatusDate !== today || (['morning', 'afternoon', 'night'] as Compartment[]).some((compartment) => rawStatuses[compartment] !== loadedStatuses[compartment]);
      if (statusNeedsRepair) {
        await saveUserData(nextUser.uid, { statuses: { ...loadedStatuses, statusDate: today, updatedAt: new Date().toISOString() } });
      }
      setHistory((data.latestHistory ?? []) as HistoryRecord[]);
      setAlerts((data.alerts ?? []) as CaregiverAlert[]);
      try { await scheduleDailyReminders(loadedSchedule, loadedProfile.voiceLanguage || 'en-US'); } catch { /* Expo Go does not support Android scheduled notifications. */ }
    } catch (error) {
      console.error('Unable to load Firebase user data', error);
    } finally {
      setLoading(false);
    }
  }), []);

  const updateSchedule = async (next: Schedule) => {
    if (!authUser) return;
    const saved = { ...next, updatedAt: new Date().toISOString() };
    setSchedule(saved);
    await saveUserData(authUser.uid, { schedule: saved });
    try { await scheduleDailyReminders(saved, user?.voiceLanguage || 'en-US'); } catch { /* Expo Go does not support Android notifications. */ }
  };

  const updateInventory = async (next: Inventory) => {
    if (!authUser) return;
    const saved = { ...next, updatedAt: new Date().toISOString() };
    setInventory(saved);
    await saveUserData(authUser.uid, { inventory: saved });
  };

  const updateProfile = async (next: UserProfile) => {
    if (!authUser) return;
    await updateUserProfile(authUser.uid, next);
    setUser(next);
    try { await scheduleDailyReminders(schedule, next.voiceLanguage || 'en-US'); } catch { /* Notifications require a development build on Android. */ }
  };

  const resetTodayForTesting = async () => {
    if (!authUser) return;
    const today = new Date();
    const todayTaken = history.filter((record) => isRecordFromDate(record, today) && record.status === 'Taken');
    const restoredInventory = { ...inventory, updatedAt: new Date().toISOString() };
    for (const record of todayTaken) {
      const stockKey = `${record.compartment}Stock` as keyof Inventory;
      const doseAmount = Math.max(1, Number(schedule[`${record.compartment}Dose`]) || 1);
      (restoredInventory as Record<string, number | string>)[stockKey] = Number(restoredInventory[stockKey]) + doseAmount;
    }
    const pendingStatuses = { morning: 'Pending', afternoon: 'Pending', night: 'Pending' } as Statuses;
    const remainingHistory = history;
    setInventory(restoredInventory);
    setStatuses(pendingStatuses);
    setStatusDate(localDateKey(today));
    await saveUserData(authUser.uid, { inventory: restoredInventory, statuses: { ...pendingStatuses, statusDate: localDateKey(today), updatedAt: new Date().toISOString() } });
  };

  const checkMissedDoses = async () => {
    if (!authUser) return;
    const now = new Date();
    const today = localDateKey(now);
    if (statusDate !== today) {
      setStatuses(defaultStatuses);
      setStatusDate(today);
      await saveUserData(authUser.uid, { statuses: { ...defaultStatuses, statusDate: today, updatedAt: now.toISOString() } });
      return;
    }
    const missedCompartments = (['morning', 'afternoon', 'night'] as Compartment[]).filter((compartment) => {
      if (statuses[compartment] !== 'Pending') return false;
      const [hour, minute] = String(schedule[`${compartment}Time`]).split(':').map(Number);
      if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
      const scheduled = new Date(now);
      scheduled.setHours(hour, minute, 0, 0);
      const elapsedMinutes = (now.getTime() - scheduled.getTime()) / (60 * 1000);
      return elapsedMinutes >= 0 && elapsedMinutes >= getMissedGraceMinutes(schedule);
    });
    if (!missedCompartments.length) return;
    const nextStatuses = { ...statuses };
    const missedRecords: HistoryRecord[] = [];
    for (const compartment of missedCompartments) {
      nextStatuses[compartment] = 'Missed';
      missedRecords.push({ id: `missed-${compartment}-${today}`, medicine: String(schedule[`${compartment}Medicine`]), compartment, scheduledTime: String(schedule[`${compartment}Time`]), status: 'Missed', date: today, createdAt: now.toISOString() });
    }
    const nextHistory = [...missedRecords, ...history];
    const nextAlerts = missedRecords.map((record) => ({ id: record.id, message: `${record.medicine} was missed at ${record.scheduledTime}.`, resolved: false, smsStatus: user?.caregiverPhone ? 'queued' : 'no-phone', createdAt: record.createdAt }));
    setStatuses(nextStatuses);
    setHistory(nextHistory);
    setAlerts((current) => [...nextAlerts, ...current]);
    await Promise.all([
      saveUserData(authUser.uid, { statuses: { ...nextStatuses, statusDate: today, updatedAt: now.toISOString() }, history: nextHistory }),
      ...missedRecords.flatMap((record) => [saveHistoryRecord(authUser.uid, record, record.id), saveCaregiverAlert(authUser.uid, `${record.medicine} was missed at ${record.scheduledTime}.`, user ?? undefined, record.id)]),
    ]);
  };

  useEffect(() => {
    if (!authUser || loading) return;
    void checkMissedDoses();
    const timer = setInterval(() => void checkMissedDoses(), 60 * 1000);
    return () => clearInterval(timer);
  }, [authUser, loading, schedule, statuses, history, statusDate, user]);

  const takeDose = async (compartment: Compartment) => {
    if (!authUser) return false;
    const stockKey = `${compartment}Stock` as keyof Inventory;
    const stock = Number(inventory[stockKey]);
    const doseAmount = Math.max(1, Number(schedule[`${compartment}Dose`]) || 1);
    if (stock < doseAmount) return false;
    const nextInventory = { ...inventory, [stockKey]: stock - doseAmount, updatedAt: new Date().toISOString() };
    const nextStatuses = { ...statuses, [compartment]: 'Taken' as DoseStatus };
    const now = new Date();
    const today = localDateKey(now);
    const record: HistoryRecord = { id: String(Date.now()), medicine: String(schedule[`${compartment}Medicine`]), compartment, scheduledTime: String(schedule[`${compartment}Time`]), takenTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'Taken', date: today, createdAt: now.toISOString() };
    const nextHistory = [record, ...history];
    setInventory(nextInventory);
    setStatuses(nextStatuses);
    setHistory(nextHistory);
    setStatusDate(today);
    await Promise.all([saveUserData(authUser.uid, { inventory: nextInventory, statuses: { ...nextStatuses, statusDate: today, updatedAt: now.toISOString() }, history: nextHistory }), saveHistoryRecord(authUser.uid, record)]);
    return true;
  };

  const doses = (['morning', 'afternoon', 'night'] as Compartment[]).map((compartment) => ({ compartment, label: labels[compartment], medicine: String(schedule[`${compartment}Medicine`]), time: String(schedule[`${compartment}Time`]), dose: Number(schedule[`${compartment}Dose`]), stock: inventory[`${compartment}Stock`], status: statuses[compartment] }));
  return <AppContext.Provider value={{ user, authUser, loading, schedule, inventory, history, alerts, statuses, doses, takeDose, updateSchedule, updateInventory, updateProfile, resetTodayForTesting }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
