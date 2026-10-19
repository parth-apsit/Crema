import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, getFirestore, setLogLevel } from 'firebase/firestore';

setLogLevel('silent');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Validate required public Firebase configuration to prevent silent misconfiguration
const missingFirebaseConfig: string[] = [];
if (!firebaseConfig.apiKey) missingFirebaseConfig.push('NEXT_PUBLIC_FIREBASE_API_KEY');
if (!firebaseConfig.projectId) missingFirebaseConfig.push('NEXT_PUBLIC_FIREBASE_PROJECT_ID');
if (!firebaseConfig.appId) missingFirebaseConfig.push('NEXT_PUBLIC_FIREBASE_APP_ID');

if (missingFirebaseConfig.length > 0) {
  const missingMsg = `[Firebase Config] Missing required environment variables: ${missingFirebaseConfig.join(', ')}. Please configure them in .env.local or container build arguments.`;
  if (typeof window !== 'undefined') {
    console.error(missingMsg);
  } else {
    // In server/build context, log warning to ensure actionable error reporting
    console.warn(missingMsg);
  }
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

let firestoreInstance;
try {
  firestoreInstance = getFirestore(app);
} catch {
  firestoreInstance = initializeFirestore(app, {});
}

export const db = firestoreInstance;
export default app;
