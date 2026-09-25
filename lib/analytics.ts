import { HistoryRecord, Compartment, DoseStatus } from './types';

export function getAdherence(records: HistoryRecord[]) {
  const completed = records.filter((record) => record.status === 'Taken' || record.status === 'Missed');
  const taken = completed.filter((record) => record.status === 'Taken').length;
  return completed.length ? Math.round((taken / completed.length) * 100) : 100;
}

export function getAdaptiveReminder(records: HistoryRecord[], compartment: Compartment) {
  const taken = records.filter((record) => record.compartment === compartment && record.status === 'Taken' && record.takenTime).slice(0, 7);
  const delays = taken.map((record) => {
    const [scheduledHour, scheduledMinute] = record.scheduledTime.split(':').map(Number);
    const takenMinutes = parseTimeToMinutes(record.takenTime ?? '');
    return takenMinutes - (scheduledHour * 60 + scheduledMinute);
  }).filter((delay) => delay >= 0);
  const averageDelay = delays.length ? Math.round(delays.reduce((sum, delay) => sum + delay, 0) / delays.length) : 0;
  return { averageDelay, recordsAnalyzed: delays.length, suggestedAdvance: Math.min(30, averageDelay) };
}

export function shouldMarkMissed(status: DoseStatus, scheduledAt: Date, now = new Date()) {
  return status === 'Pending' && now.getTime() - scheduledAt.getTime() >= 30 * 60 * 1000;
}

function parseTimeToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/);
  if (!match) return -1;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  return hour * 60 + minute;
}