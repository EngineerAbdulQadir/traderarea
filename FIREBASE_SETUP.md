# Firebase setup

The app works without Firebase (browser-only mode). Cloud sync switches on as soon as the
`VITE_FIREBASE_*` values exist at build time.

## 1. Create the project

1. Go to <https://console.firebase.google.com> → **Add project** (e.g. `trader-area`).
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** → production mode → pick a region.

Everything runs on the free **Spark** plan. Cloud Storage is **not** used, so no billing
account is required.

## 2. Register the web app

1. Project settings (gear) → **Your apps** → **Web** (`</>`).
2. Name it, then copy the `firebaseConfig` values.

## 3. Local env

Copy `.env.local.example` to `.env.local` and fill in:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

`VITE_FIREBASE_STORAGE_BUCKET` is left empty on purpose — Storage is not used, screenshots live
in Firestore documents instead.

Restart `npm run dev` afterwards.

## 4. Deploy rules

`.firebaserc` currently points at a placeholder project (`trader-area`). Edit it to match yours,
then:

```bash
firebase login
firebase deploy --only firestore:rules
```

Rules shipped in this repo:

- `firestore.rules` — a user may only read/write `users/{their-uid}/**`.

## 5. Vercel

Project → **Settings → Environment Variables**, add the same six `VITE_FIREBASE_*` keys, then
redeploy. Vite inlines them at build time, so changing them requires a new deployment.

Also add your Vercel domain under **Authentication → Settings → Authorized domains**.

## Data model

```
users/{uid}                        profile + metadata
users/{uid}/accounts/{accountId}   one document per challenge/account
users/{uid}/trades/{tradeId}       one document per trade (avoids the 1 MiB doc cap)
users/{uid}/notes/{accountId}__{YYYY-MM-DD}   note text + imageIds
users/{uid}/images/{imageId}       one screenshot per document (base64 JPEG)
```

Screenshots are compressed to max 1100px at 72% quality (≤ ~900 KB) and are only downloaded
when you open that day's review, so a normal app load stays small. The free Firestore tier gives
1 GiB of storage, which is roughly 8,000–12,000 images.

## First sign-in behaviour

- If the Firebase account already has data, it is loaded and the local cache is replaced.
- If the Firebase account is empty and this browser has a workspace, a one-time
  **"Bring your journal to the cloud?"** prompt appears.
- Signing out clears the cached workspace from the browser.
- Local storage stays as an offline cache while signed in.
