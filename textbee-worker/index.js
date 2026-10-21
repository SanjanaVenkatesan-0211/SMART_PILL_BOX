const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Content-Type': 'application/json',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function fieldString(fields, key) {
  return fields?.[key]?.stringValue ?? '';
}

async function verifyFirebaseToken(idToken, apiKey) {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!response.ok) return null;
  const result = await response.json();
  return result.users?.[0] ?? null;
}

function firestoreUrl(projectId, documentPath) {
  const path = documentPath.split('/').map(encodeURIComponent).join('/');
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${path}`;
}

async function readFirestoreDocument(projectId, path, idToken) {
  const response = await fetch(firestoreUrl(projectId, path), {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Firestore read failed (${response.status})`);
  return response.json();
}

async function updateAlert(projectId, path, idToken, fields) {
  const params = new URLSearchParams();
  for (const key of Object.keys(fields)) params.append('updateMask.fieldPaths', key);
  const response = await fetch(`${firestoreUrl(projectId, path)}?${params}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, { stringValue: String(value) }])) }),
  });
  if (!response.ok) throw new Error(`Firestore alert update failed (${response.status})`);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/send-missed-dose') return json({ error: 'Not found' }, 404);

    const authorization = request.headers.get('Authorization') ?? '';
    const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!idToken) return json({ error: 'Sign-in required' }, 401);
    if (!env.TEXTBEE_API_KEY || !env.FIREBASE_API_KEY || !env.FIREBASE_PROJECT_ID) return json({ error: 'Worker configuration is incomplete' }, 503);

    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'Invalid JSON body' }, 400); }
    const compartment = body?.compartment;
    const date = body?.date;
    const allowedCompartments = ['morning', 'afternoon', 'night'];
    if (!allowedCompartments.includes(compartment) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date ?? ''))) {
      return json({ error: 'Invalid compartment or date' }, 400);
    }

    try {
      const firebaseUser = await verifyFirebaseToken(idToken, env.FIREBASE_API_KEY);
      if (!firebaseUser?.localId) return json({ error: 'Invalid Firebase session' }, 401);
      const uid = firebaseUser.localId;
      const alertId = `missed-${compartment}-${date}`;
      const basePath = `users/${uid}`;
      const [profileDoc, statusDoc, alertDoc] = await Promise.all([
        readFirestoreDocument(env.FIREBASE_PROJECT_ID, basePath, idToken),
        readFirestoreDocument(env.FIREBASE_PROJECT_ID, `status/${uid}`, idToken),
        readFirestoreDocument(env.FIREBASE_PROJECT_ID, `${basePath}/alerts/${alertId}`, idToken),
      ]);
      if (!profileDoc || !statusDoc || !alertDoc) return json({ error: 'Missed-dose alert was not found' }, 404);
      if (fieldString(statusDoc.fields, compartment) !== 'Missed' || fieldString(statusDoc.fields, 'statusDate') !== date) {
        return json({ error: 'Dose is not marked missed for this date' }, 409);
      }
      const existingSmsStatus = fieldString(alertDoc.fields, 'smsStatus');
      if (existingSmsStatus === 'textbee-queued' || existingSmsStatus === 'textbee-sent') return json({ status: 'already-queued' });

      const phone = fieldString(profileDoc.fields, 'caregiverPhone').trim();
      if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
        await updateAlert(env.FIREBASE_PROJECT_ID, `${basePath}/alerts/${alertId}`, idToken, { smsStatus: phone ? 'invalid-phone' : 'no-phone' });
        return json({ status: phone ? 'invalid-phone' : 'no-phone' }, 400);
      }
      const patientName = fieldString(profileDoc.fields, 'name') || 'Your family member';
      const caregiverName = fieldString(profileDoc.fields, 'caregiverName');
      const alertMessage = fieldString(alertDoc.fields, 'message') || `${compartment} medicine was missed.`;
      const message = `${caregiverName ? `Hi ${caregiverName}. ` : ''}${patientName}: ${alertMessage}`;

      const textbeeResponse = await fetch('https://api.textbee.dev/api/v1/gateway/send-sms', {
        method: 'POST',
        headers: { 'x-api-key': env.TEXTBEE_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: [phone], message }),
      });
      const result = await textbeeResponse.json().catch(() => ({}));
      if (!textbeeResponse.ok) {
        await updateAlert(env.FIREBASE_PROJECT_ID, `${basePath}/alerts/${alertId}`, idToken, { smsStatus: 'textbee-failed' });
        return json({ error: result.message ?? result.error ?? 'TextBee rejected the SMS', providerStatus: textbeeResponse.status }, 502);
      }

      const batchId = result.data?.smsBatchId ?? '';
      await updateAlert(env.FIREBASE_PROJECT_ID, `${basePath}/alerts/${alertId}`, idToken, { smsStatus: 'textbee-queued', textbeeBatchId: batchId });
      return json({ status: 'queued', smsBatchId: batchId });
    } catch (error) {
      console.error('TextBee SMS request failed', error);
      return json({ error: 'Unable to send caregiver SMS' }, 500);
    }
  },
};
