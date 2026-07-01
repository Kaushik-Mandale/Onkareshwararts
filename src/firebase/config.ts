import { initializeApp, getApp, getApps } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import type { FirebaseStorage } from 'firebase/storage';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

// Load config from environment or localStorage
export function getStoredFirebaseConfig(): FirebaseConfig | null {
  const envConfig: FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
  };

  // If environment variables are complete, use them
  if (envConfig.apiKey && envConfig.projectId) {
    return envConfig;
  }

  // Otherwise check local storage
  const localConfigStr = localStorage.getItem('GANPATI_FIREBASE_CONFIG');
  if (localConfigStr) {
    try {
      const parsed = JSON.parse(localConfigStr) as FirebaseConfig;
      if (parsed.apiKey && parsed.projectId) {
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved Firebase config:', e);
    }
  }

  return null;
}

export function saveFirebaseConfig(config: FirebaseConfig): boolean {
  try {
    localStorage.setItem('GANPATI_FIREBASE_CONFIG', JSON.stringify(config));
    return true;
  } catch (e) {
    console.error('Failed to save Firebase config:', e);
    return false;
  }
}

export function clearFirebaseConfig(): void {
  localStorage.removeItem('GANPATI_FIREBASE_CONFIG');
}

export function initializeFirebaseServices(config: FirebaseConfig): {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  storage: FirebaseStorage;
} {
  if (getApps().length > 0) {
    app = getApp();
  } else {
    app = initializeApp(config);
  }

  auth = getAuth(app);
  
  // Enable offline persistence in Firestore
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch (err) {
    console.warn('Firestore persistence initialization failed. Falling back to default:', err);
    db = getFirestore(app);
  }

  storage = getStorage(app);

  return { app, auth, db, storage };
}

// Auto-initialize if config is available
const initialConfig = getStoredFirebaseConfig();
if (initialConfig) {
  try {
    initializeFirebaseServices(initialConfig);
  } catch (e) {
    console.error('Firebase auto-initialization failed:', e);
  }
}

export { app, auth, db, storage };

// Check if Firebase is fully initialized and operational
export function isFirebaseConfigured(): boolean {
  return app !== null && auth !== null && db !== null && storage !== null;
}
