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
      setUser((data.profile ?? { uid: nextUser.uid, name: nextUser.displayName ?? 'User', email: nextUser.email ?? '', phone: '', age: 0, dob: '', gender: '', bloodGroup: '' }) as UserProfile);
      setSchedule(readSchedule(data.schedule));
      setInventory(readInventory(data.inventory));
      setStatuses({ ...defaultStatuses, ...(data.statuses ?? {}) } as Statuses);
      setHistory((data.latestHistory ?? []) as HistoryRecord[]);
      setAlerts((data.alerts ?? []) as CaregiverAlert[]);
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
    try { await scheduleDailyReminders(saved); } catch { /* Expo Go does not support Android notifications. */ }
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
  };

  const resetTodayForTesting = async () => {
    if (!authUser) return;
    const today = new Date().toLocaleDateString();
    const todayTaken = history.filter((record) => record.date === today && record.status === 'Taken');
    const restoredInventory = { ...inventory, updatedAt: new Date().toISOString() };
    for (const record of todayTaken) {
      const stockKey = `${record.compartment}Stock` as keyof Inventory;
      const doseAmount = Math.max(1, Number(schedule[`${record.compartment}Dose`]) || 1);
      (restoredInventory as Record<string, number | string>)[stockKey] = Number(restoredInventory[stockKey]) + doseAmount;
    }
    const pendingStatuses = { morning: 'Pending', afternoon: 'Pending', night: 'Pending' } as Statuses;
    const remainingHistory = history.filter((record) => record.date !== today);
    setInventory(restoredInventory);
    setStatuses(pendingStatuses);
    setHistory(remainingHistory);
    await saveUserData(authUser.uid, { inventory: restoredInventory, statuses: pendingStatuses, history: remainingHistory });
  };

  const checkMissedDoses = async () => {
    if (!authUser) return;
    const now = new Date();
    const missedCompartments = (['morning', 'afternoon', 'night'] as Compartment[]).filter((compartment) => {
      if (statuses[compartment] !== 'Pending') return false;
      const [hour, minute] = String(schedule[`${compartment}Time`]).split(':').map(Number);
      const scheduled = new Date(now);
      scheduled.setHours(hour, minute, 0, 0);
      return now.getTime() - scheduled.getTime() >= 30 * 60 * 1000;
    });
    if (!missedCompartments.length) return;
    const nextStatuses = { ...statuses };
    const missedRecords: HistoryRecord[] = [];
    for (const compartment of missedCompartments) {
      nextStatuses[compartment] = 'Missed';
      missedRecords.push({ id: `missed-${compartment}-${now.toISOString().slice(0, 10)}`, medicine: String(schedule[`${compartment}Medicine`]), compartment, scheduledTime: String(schedule[`${compartment}Time`]), status: 'Missed', date: now.toLocaleDateString(), createdAt: now.toISOString() });
    }
    const nextHistory = [...missedRecords, ...history];
    const nextAlerts = missedRecords.map((record) => ({ id: `local-${record.id}`, message: `${record.medicine} was missed at ${record.scheduledTime}.`, resolved: false, createdAt: record.createdAt }));
    setStatuses(nextStatuses);
    setHistory(nextHistory);
    setAlerts((current) => [...nextAlerts, ...current]);
    await Promise.all([
      saveUserData(authUser.uid, { statuses: nextStatuses, history: nextHistory }),
      ...missedRecords.flatMap((record) => [saveHistoryRecord(authUser.uid, record), saveCaregiverAlert(authUser.uid, `${record.medicine} was missed at ${record.scheduledTime}.`)]),
    ]);
  };

  useEffect(() => {
    if (!authUser || loading) return;
    void checkMissedDoses();
    const timer = setInterval(() => void checkMissedDoses(), 60 * 1000);
    return () => clearInterval(timer);
  }, [authUser, loading, schedule, statuses, history]);

  const takeDose = async (compartment: Compartment) => {
    if (!authUser) return false;
    const stockKey = `${compartment}Stock` as keyof Inventory;
    const stock = Number(inventory[stockKey]);
    const doseAmount = Math.max(1, Number(schedule[`${compartment}Dose`]) || 1);
    if (stock < doseAmount) return false;
    const nextInventory = { ...inventory, [stockKey]: stock - doseAmount, updatedAt: new Date().toISOString() };
    const nextStatuses = { ...statuses, [compartment]: 'Taken' as DoseStatus };
    const record: HistoryRecord = { id: String(Date.now()), medicine: String(schedule[`${compartment}Medicine`]), compartment, scheduledTime: String(schedule[`${compartment}Time`]), takenTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), status: 'Taken', date: new Date().toLocaleDateString(), createdAt: new Date().toISOString() };
    const nextHistory = [record, ...history];
    setInventory(nextInventory);
    setStatuses(nextStatuses);
    setHistory(nextHistory);
    await Promise.all([saveUserData(authUser.uid, { inventory: nextInventory, statuses: nextStatuses, history: nextHistory }), saveHistoryRecord(authUser.uid, record)]);
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
