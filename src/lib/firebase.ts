import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

/**
 * The app stays fully usable without Firebase configured: it falls back to the
 * original browser-local storage. Fill in `.env.local` to switch on cloud sync.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
)

let app: FirebaseApp | null = null
let firestore: Firestore | null = null
let firebaseAuth: Auth | null = null

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  firebaseAuth = getAuth(app)
  try {
    firestore = initializeFirestore(app, {
      // Optional fields (stopLoss, images, …) must not throw when absent.
      ignoreUndefinedProperties: true,
      // Offline cache keeps trades readable and writes instant on flaky networks.
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch {
    firestore = initializeFirestore(app, { ignoreUndefinedProperties: true })
  }
}

export const auth = firebaseAuth
export const db = firestore
