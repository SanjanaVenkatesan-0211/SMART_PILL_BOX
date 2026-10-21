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
2. In Schedule, choose a time a few minutes ahead with the native AM/PM picker, set reminder count to `3`, and interval to `1` minute; save. The first reminder is at the selected time, followed by reminders one and two minutes later. It is not intentionally sent before the selected time.
3. On Android 12+, open **Settings → Apps → Smart Pill Box → Alarms & reminders** and allow alarms. Android can delay reminders by minutes if exact alarms are not allowed; battery optimization can also affect some phone vendors.
4. Keep the development app installed and test while it is foregrounded, backgrounded, and after restarting the phone.
5. Tap a notification. It should open the app and speak that compartment's reminder in the selected installed language.
6. Restore your normal schedule and reminder interval after testing.

## Free TextBee caregiver SMS (no Firebase Functions)

This path sends caregiver SMS through a Cloudflare Worker and TextBee's Android SMS gateway. It does not deploy Firebase Cloud Functions or require Firebase Blaze. TextBee currently lists a free tier of one active Android gateway, 50 messages per day, and 300 per month. The Android gateway phone needs an SMS-capable SIM, internet, power, Send SMS permission, and unrestricted background battery access. Your mobile carrier may still charge for SMS messages.

### 1. Set up the TextBee gateway phone

1. Create and verify an account at [TextBee](https://textbee.dev/).
2. On a spare/always-on Android phone with an active SMS plan, download and install the APK from TextBee's site.
3. In the TextBee dashboard, use its QR code to register the phone. Grant **Send SMS** permission; on Android 15+, allow restricted settings if Android blocks SMS permission.
4. Set TextBee battery use to **Unrestricted** and keep its foreground notification enabled. The phone must remain online to send queued texts.
5. In the dashboard, create an API key. Keep it private; do not paste it into app `.env`, source files, screenshots, or chat.

### 2. Deploy the Cloudflare Worker

Install Wrangler and authenticate with your Cloudflare account:

```powershell
npm install -g wrangler
npx wrangler login
```

From `D:\SPB`, add the TextBee key and Firebase Web API key as Worker secrets. Wrangler will prompt for each value; enter them directly there.

```powershell
wrangler secret put TEXTBEE_API_KEY --config textbee-worker/wrangler.toml
wrangler secret put FIREBASE_API_KEY --config textbee-worker/wrangler.toml
wrangler deploy --config textbee-worker/wrangler.toml
```

Use the `workers.dev` URL printed after deployment as the Worker base URL, for example `https://smart-pill-box-textbee-sms.<your-subdomain>.workers.dev`.

### 3. Configure the app

Put the Worker URL in local `D:\SPB\.env`:

```env
EXPO_PUBLIC_TEXTBEE_WORKER_URL=https://smart-pill-box-textbee-sms.<your-subdomain>.workers.dev
```

Set the same variable for EAS development builds (the installed APK gets environment variables at build time):

```powershell
eas env:set development --name EXPO_PUBLIC_TEXTBEE_WORKER_URL --value "https://smart-pill-box-textbee-sms.<your-subdomain>.workers.dev" --visibility plaintext
```

Rebuild and reinstall the development APK, then start Metro:

```powershell
eas build --profile development --platform android
npx expo start --dev-client --clear
```

### 4. Test one SMS

1. In the app Profile, set a caregiver number in E.164 format, for example `+15551234567`, and save.
2. In Schedule, set one compartment to a time at least six minutes ago. Keep the app open; its missed-dose check runs every minute and marks a pending dose Missed after five minutes.
3. Confirm the app creates `users/{uid}/alerts/missed-{compartment}-{YYYY-MM-DD}` in Firestore and calls the Worker.
4. Check that the alert has `smsStatus: "textbee-queued"` and a `textbeeBatchId`. This means TextBee accepted it into its queue, not that the carrier delivered it.
5. Confirm final status in TextBee Dashboard → Messaging → History and on the gateway phone. If TextBee is on its trial/free setup, verify the caregiver destination if requested.
6. Restore the normal schedule after testing. TextBee's free plan currently allows up to 300 messages per month/50 per day; monitor its usage page.

The Worker validates the Firebase sign-in token, verifies the dose is marked Missed for today, and reads the caregiver number from that user's Firestore profile. The TextBee API key never goes into the mobile app.

**Important background limitation:** this no-Blaze version sends the SMS when the patient's app detects the missed dose while running, or when it is reopened and performs the check. Local reminders can still notify while the app is closed, but a Cloudflare Worker cannot independently inspect Firestore under the current setup. Fully automatic missed-dose SMS while the patient app is closed would require adding a scheduled backend that can securely read all users' Firestore data.

## Twilio caregiver SMS (optional paid fallback)

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