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

## Voice and repeat reminders

- Choose the spoken reminder language during registration or edit it in Profile.
- English, Hindi, and Tamil are supported in the reminder text and speech; Telugu, Kannada, and Malayalam are also included.
- Schedule supports 1-10 daily reminders per compartment, at 1-180 minute intervals.
- Use **Schedule → Test voice reminder** to test speech in Expo Go. The app checks that the selected language voice is installed and tells you if it is missing.
- On Android, install Hindi/Tamil text-to-speech data in **Settings → Text-to-speech output → Install voice data** (the exact menu name can vary by phone). Select the Google speech engine and install the selected language, then retry the test.
- Expo Speech uses the phone's installed TTS voices; it cannot download language data itself. The test reports unavailable voices rather than pretending the English voice spoke Tamil/Hindi.

## Test voice in Expo Go

1. In the app, open Profile and select Tamil or Hindi under voice reminder language. Save.
2. Open Schedule and tap **Test voice reminder**.
3. If the app says the voice is not installed, install the matching language data in Android Text-to-speech settings, then test again.
4. If the language does not appear as available after installing it, update Google Speech Services/your phone's TTS engine and restart the app.

Expo Go is suitable for this speech test. This app deliberately does not import `expo-notifications` while running inside Expo Go because the installed Expo Go client is missing the native notification module reported as `ExpoTopicSubscriptionModule`. Scheduled notifications should be tested in a development build instead.

## Android notification development build

1. Install EAS CLI with `npm install -g eas-cli` and sign in using `eas login`.
2. Configure the EAS project with `eas build:configure` if it has not already been configured.
3. Add the `EXPO_PUBLIC_FIREBASE_*` values as EAS environment variables for the development environment.
4. Build with `eas build --profile development --platform android` and install the generated APK.
5. Start Metro with `npx expo start --dev-client` and open the project in the installed development build.

### Test scheduled notifications

1. Install/open the development APK (not Expo Go) and grant notification permission.
2. In Schedule, set a compartment time a few minutes ahead, set reminder count to `3`, and interval to `1` minute; save.
3. Keep the development app installed; notifications should arrive at the scheduled minute and the next two minute intervals, including with the app in the background.
4. Tap a notification. It should open the app and speak that compartment's reminder in the selected installed language.
5. Restore your normal schedule and reminder interval after testing.

## Caregiver SMS setup

Caregiver phone numbers must use E.164 format, for example `+15551234567`. A five-minute scheduled Cloud Function checks due doses even when the app is closed, updates daily status/history, and creates caregiver alerts after the configured number of reminder intervals. A Firestore-triggered function sends SMS through Twilio. The Insights screen displays SMS delivery status.

1. Enable Firebase Functions billing (Blaze plan) for the Firebase project.
2. Create/configure a Twilio account and an SMS-capable Twilio phone number.
3. Set secrets without putting them in app `.env`:

```powershell
firebase functions:secrets:set TWILIO_ACCOUNT_SID --project smart-pillbox-2
firebase functions:secrets:set TWILIO_AUTH_TOKEN --project smart-pillbox-2
firebase functions:secrets:set TWILIO_FROM_NUMBER --project smart-pillbox-2
```

Enter each value directly at the CLI prompt. Then deploy:

```powershell
firebase deploy --only functions --project smart-pillbox-2
```

### Test caregiver SMS

1. On a Twilio trial account, verify the caregiver's destination phone in Twilio first. A paid Twilio account can message permitted destinations according to its configuration.
2. Register/update a test user with the caregiver number in international `+countrycode...` format, and set caregiver alert threshold to `1`.
3. In Schedule, set one compartment time to at least 35 minutes ago, set reminder interval to `1` minute, and ensure reminder count is at least `1`.
4. Save and wait for the scheduled function's next five-minute run. It should mark the dose Missed, create the history/alert documents, and the SMS trigger should send the message.
5. In Firebase Console → Firestore → `users/{uid}/alerts/{alertId}`, inspect `smsStatus`: `sent`, `failed`, `invalid-phone`, or `no-phone`.
6. Restore the user's real schedule after the test. Do not repeatedly test with a paid SMS number unless you intend to incur Twilio charges.

The app stores the caregiver email for contact/profile purposes; automatic delivery currently uses SMS only. Email delivery would need a separate email provider integration.

## Data boundaries

- `lib/firebase.ts` owns Firebase initialization, registration bootstrap documents, and auth helpers.
- `lib/notifications.ts` owns daily reminder cancellation/rescheduling and voice feedback.
- `lib/analytics.ts` contains adherence, missed-dose, and adaptive reminder calculations.
- `firestore.rules` restricts every document and nested collection to the authenticated UID.
- `deviceEvents` is covered by the nested user rule for future ESP32 writes.