import { Inventory, Schedule, UserProfile, DoseStatus, HistoryRecord } from './types';

export const defaultSchedule: Schedule = {
  morningMedicine: 'Morning medicine', afternoonMedicine: 'Afternoon medicine', nightMedicine: 'Night medicine',
  morningTime: '08:00', afternoonTime: '13:00', nightTime: '20:00',
  morningDose: 1, afternoonDose: 1, nightDose: 2, reminderCount: 3, reminderIntervalMinutes: 10, updatedAt: new Date().toISOString(),
};

export const defaultInventory: Inventory = {
  morningStock: 24, afternoonStock: 12, nightStock: 28, refillThreshold: 15, updatedAt: new Date().toISOString(),
};

export const defaultStatuses: Record<'morning' | 'afternoon' | 'night', DoseStatus> = {
  morning: 'Pending', afternoon: 'Pending', night: 'Pending',
};

export const demoUser: UserProfile = {
  uid: 'demo-user', name: 'Maya Thompson', email: 'maya@example.com', phone: '+1 555 018 4420', age: 64,
  dob: '1962-04-18', gender: 'Female', bloodGroup: 'O+',
  voiceLanguage: 'en-US', caregiverName: '', caregiverPhone: '', caregiverEmail: '', caregiverAlertAfterReminders: 3, timezone: 'UTC',
};

export const demoHistory: HistoryRecord[] = [
  { id: '1', medicine: 'Morning medicine', compartment: 'morning', scheduledTime: '08:00', takenTime: '08:12', status: 'Taken', date: 'Today', createdAt: new Date().toISOString() },
  { id: '2', medicine: 'Afternoon medicine', compartment: 'afternoon', scheduledTime: '13:00', status: 'Pending', date: 'Today', createdAt: new Date().toISOString() },
  { id: '3', medicine: 'Morning medicine', compartment: 'morning', scheduledTime: '08:00', takenTime: '08:06', status: 'Taken', date: 'Yesterday', createdAt: new Date().toISOString() },
  { id: '4', medicine: 'Night medicine', compartment: 'night', scheduledTime: '20:00', takenTime: '20:23', status: 'Taken', date: 'Yesterday', createdAt: new Date().toISOString() },
  { id: '5', medicine: 'Afternoon medicine', compartment: 'afternoon', scheduledTime: '13:00', status: 'Missed', date: 'Mon, Sep 21', createdAt: new Date().toISOString() },
];
