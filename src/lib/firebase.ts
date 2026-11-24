import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import appletFirebaseConfig from '../../firebase-applet-config.json';

export function normalizeDomainHost(value?: string | null): string {
  if (!value) return '';
  const trimmed = value
    .trim()
    .replace(/^https?:\/\//i, '')
    .split('/')[0]
    .split('?')[0]
    .trim()
    .toLowerCase();

  if (!trimmed || trimmed.length > 180) return '';
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) return '';
  return trimmed;
}

export function isDefaultFirebaseAuthDomain(domain?: string | null): boolean {
  const normalized = normalizeDomainHost(domain);
  return (
    normalized.endsWith('.firebaseapp.com') || normalized.endsWith('.web.app')
  );
}

const envAuthDomain = normalizeDomainHost(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
const defaultAuthDomain = envAuthDomain || appletFirebaseConfig.authDomain;

export const firebaseRuntimeConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || appletFirebaseConfig.apiKey,
  authDomain: defaultAuthDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || appletFirebaseConfig.projectId,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || appletFirebaseConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
    appletFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || appletFirebaseConfig.appId,
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID ||
    appletFirebaseConfig.firestoreDatabaseId,
};

const app = initializeApp({
  apiKey: firebaseRuntimeConfig.apiKey,
  authDomain: firebaseRuntimeConfig.authDomain,
  projectId: firebaseRuntimeConfig.projectId,
  storageBucket: firebaseRuntimeConfig.storageBucket,
  messagingSenderId: firebaseRuntimeConfig.messagingSenderId,
  appId: firebaseRuntimeConfig.appId,
});

export const db =
  firebaseRuntimeConfig.firestoreDatabaseId &&
  firebaseRuntimeConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseRuntimeConfig.firestoreDatabaseId)
    : getFirestore(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function getEffectiveAuthDomain(): string {
  return normalizeDomainHost(auth.config.authDomain) || firebaseRuntimeConfig.authDomain;
}

/**
 * Updates Firebase Auth's active authDomain from BusinessSetting ONLY when:
 * 1. VITE_FIREBASE_AUTH_DOMAIN is not explicitly pinning an installation domain, and
 * 2. The administrator explicitly verified that DNS + Firebase Hosting + Google Cloud OAuth
 *    redirect URIs are active (`authDomainVerified === true`).
 * This prevents breaking popup/redirect Google Sign-In before DNS propagation.
 */
export function applyVerifiedCustomAuthDomain(
  configuredAuthDomain?: string | null,
  verified?: boolean
): void {
  if (envAuthDomain) {
    auth.config.authDomain = envAuthDomain;
    return;
  }

  const normalized = normalizeDomainHost(configuredAuthDomain);
  if (verified && normalized && !isDefaultFirebaseAuthDomain(normalized)) {
    auth.config.authDomain = normalized;
    return;
  }

  auth.config.authDomain = firebaseRuntimeConfig.authDomain;
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Firestore client is offline. Please verify Firebase configuration.');
    }
    return false;
  }
}
