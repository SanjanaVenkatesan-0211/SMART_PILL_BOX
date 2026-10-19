const admin = require('firebase-admin');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const twilio = require('twilio');

admin.initializeApp();

const accountSid = defineSecret('TWILIO_ACCOUNT_SID');
const authToken = defineSecret('TWILIO_AUTH_TOKEN');
const fromNumber = defineSecret('TWILIO_FROM_NUMBER');

function getLocalDateAndMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

exports.detectMissedDoses = onSchedule('every 5 minutes', async () => {
  const schedules = await admin.firestore().collection('schedules').get();
  const now = new Date();
  await Promise.all(schedules.docs.map(async (scheduleSnapshot) => {
    const uid = scheduleSnapshot.id;
    const schedule = scheduleSnapshot.data();
    const [profileSnapshot, statusSnapshot] = await Promise.all([
      admin.firestore().doc(`users/${uid}`).get(),
      admin.firestore().doc(`status/${uid}`).get(),
    ]);
    const profile = profileSnapshot.data() ?? {};
    const timeZone = profile.timezone || 'UTC';
    let local;
    try { local = getLocalDateAndMinutes(now, timeZone); }
    catch { local = getLocalDateAndMinutes(now, 'UTC'); }

    const statusRef = admin.firestore().doc(`status/${uid}`);
    await admin.firestore().runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(statusRef);
      const current = currentSnapshot.data() ?? {};
      if (current.statusDate !== local.dateKey) {
        transaction.set(statusRef, {
          morning: 'Pending', afternoon: 'Pending', night: 'Pending',
          statusDate: local.dateKey,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return;
      }

      const nextStatuses = {};
      let changed = false;
      const interval = Math.max(1, Number(schedule.reminderIntervalMinutes) || 10);
      const missedAfterMinutes = Math.max(5, Math.min(15, interval));
      for (const compartment of ['morning', 'afternoon', 'night']) {
        if (current[compartment] !== 'Pending') continue;
        const [hour, minute] = String(schedule[`${compartment}Time`] || '').split(':').map(Number);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) continue;
        const delay = local.minutes - (hour * 60 + minute);
        if (delay < missedAfterMinutes) continue;

        const medicine = String(schedule[`${compartment}Medicine`] || `${compartment} medicine`);
        const scheduledTime = String(schedule[`${compartment}Time`]);
        const recordId = `missed-${compartment}-${local.dateKey}`;
        const eventRecord = {
          id: recordId,
          medicine,
          compartment,
          scheduledTime,
          status: 'Missed',
          date: local.dateKey,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        const eventMessage = `${medicine} was missed at ${scheduledTime}.`;
        transaction.set(admin.firestore().doc(`users/${uid}/history/${recordId}`), eventRecord, { merge: true });
        transaction.set(admin.firestore().doc(`users/${uid}/alerts/${recordId}`), {
          message: eventMessage,
          patientName: profile.name || '',
          caregiverName: profile.caregiverName || '',
          caregiverPhone: profile.caregiverPhone || '',
          caregiverEmail: profile.caregiverEmail || '',
          resolved: false,
          smsStatus: profile.caregiverPhone ? 'queued' : 'no-phone',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        nextStatuses[compartment] = 'Missed';
        changed = true;
      }

      if (changed) {
        transaction.set(statusRef, { ...nextStatuses, statusDate: local.dateKey, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      }
    });
  }));
});

exports.sendCaregiverMissedDoseSms = onDocumentCreated({
  document: 'users/{uid}/alerts/{alertId}',
  secrets: [accountSid, authToken, fromNumber],
}, async (event) => {
  const alert = event.data?.data();
  if (!alert) return;

  const alertRef = event.data.ref;
  const phone = String(alert.caregiverPhone ?? '').trim();
  if (!phone) {
    await alertRef.update({ smsStatus: 'no-phone' });
    return;
  }
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    await alertRef.update({ smsStatus: 'invalid-phone' });
    return;
  }

  try {
    const client = twilio(accountSid.value(), authToken.value());
    const patient = String(alert.patientName ?? 'Your family member').trim();
    const caregiver = String(alert.caregiverName ?? '').trim();
    const greeting = caregiver ? `Hi ${caregiver}. ` : '';
    const result = await client.messages.create({
      to: phone,
      from: fromNumber.value(),
      body: `${greeting}${patient}: ${alert.message}`,
    });
    await alertRef.update({ smsStatus: 'sent', smsSid: result.sid, smsSentAt: admin.firestore.FieldValue.serverTimestamp() });
  } catch (error) {
    console.error('Caregiver SMS failed', error);
    await alertRef.update({ smsStatus: 'failed' });
    throw error;
  }
});