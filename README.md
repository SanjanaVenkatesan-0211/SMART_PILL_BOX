# Smart Pill Box

Expo Router + TypeScript mobile foundation for medication scheduling, adherence, inventory, caregiver analytics, notifications, voice reminders, and future ESP32 events.

## Run

```bash
npm install
npm start
```

Copy `.env.example` to `.env` and fill in Firebase credentials to enable Authentication and Firestore. The UI runs in local demo mode without credentials so the interaction model can be reviewed immediately.

When `.env` is configured, the app uses Firebase Authentication and Firestore for the signed-in user. The root route sends signed-out users to `/auth`; registration creates the user's profile, schedule, inventory, and status documents. Dose actions and schedule changes are written back to Firestore.

## Verify Firebase

1. In Firebase Console, enable Authentication with Email/Password and create a Firestore database.
2. Deploy the rules with `firebase deploy --only firestore:rules --project smart-pillbox-2`.
3. Start the app with `npx expo start --clear` and open it on a device.
4. Register a new account from `/auth`.
5. In Firestore, verify `users/{uid}`, `schedules/{uid}`, `inventory/{uid}`, and `status/{uid}`.
6. Tap `Take now` and verify that inventory, status, and `users/{uid}/history` update.
7. Log out and log in again to verify Firebase Auth persistence.

## Data boundaries

- `lib/firebase.ts` owns Firebase initialization, registration bootstrap documents, and auth helpers.
- `lib/notifications.ts` owns daily reminder cancellation/rescheduling and voice feedback.
- `lib/analytics.ts` contains adherence, missed-dose, and adaptive reminder calculations.
- `firestore.rules` restricts every document and nested collection to the authenticated UID.
- `deviceEvents` is covered by the nested user rule for future ESP32 writes.