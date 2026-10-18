export type Compartment = 'morning' | 'afternoon' | 'night';
export type DoseStatus = 'Pending' | 'Taken' | 'Missed';

export type Schedule = Record<`${Compartment}Time` | `${Compartment}Dose`, string | number> & {
  morningMedicine: string;
  afternoonMedicine: string;
  nightMedicine: string;
  reminderCount: number;
  reminderIntervalMinutes: number;
  updatedAt: string;
};

export type Inventory = Record<`${Compartment}Stock`, number> & {
  refillThreshold: number;
  updatedAt: string;
};

export type Dose = {
  compartment: Compartment;
  label: string;
  medicine: string;
  time: string;
  dose: number;
  stock: number;
  status: DoseStatus;
};

export type HistoryRecord = {
  id: string;
  medicine: string;
  compartment: Compartment;
  scheduledTime: string;
  takenTime?: string;
  status: DoseStatus;
  date: string;
  createdAt: string;
};

export type CaregiverAlert = {
  id: string;
  message: string;
  resolved: boolean;
  smsStatus?: string;
  createdAt?: string;
};

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  age: number;
  dob: string;
  gender: string;
  bloodGroup: string;
  voiceLanguage: string;
  caregiverName: string;
  caregiverPhone: string;
  caregiverEmail: string;
  caregiverAlertAfterReminders: number;
  timezone: string;
};
