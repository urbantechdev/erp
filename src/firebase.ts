import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  browserPopupRedirectResolver,
  type UserCredential,
} from 'firebase/auth';
import { initializeFirestore, doc, getDoc, type Firestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db: Firestore = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export async function signInWithGooglePopup(): Promise<UserCredential> {
  if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
    document.exitFullscreen().catch(() => {});
  }
  return signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
}


export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): void {
  const errMsg = error instanceof Error ? error.message : String(error);
  if (errMsg.includes('Quota limit exceeded') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
    console.warn(`[Firestore Quota Exceeded] Operation '${operationType}' on path '${path}' fell back to local offline mode.`);
    return;
  }
  const errInfo: FirestoreErrorInfo = {
    error: errMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<void> {
  try {
    await getDoc(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('[Firestore] Operating with offline persistence enabled.');
    }
  }
}

const safeSignInWithPopup = async (authInstance = auth, provider = googleProvider) => {
  try {
    return await signInWithPopup(authInstance, provider);
  } catch (error: any) {
    const msg = String(error?.message || error || '');
    if (
      msg.includes('Pending promise was never set') ||
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/cancelled-popup-request'
    ) {
      console.warn('[Firebase Auth] Handled popup cancellation:', msg);
    }
    throw error;
  }
};

export { safeSignInWithPopup as signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword };

/**
 * Recursively strips `undefined` fields from an object or array.
 * Prevents Firestore "Function setDoc() called with invalid data. Unsupported field value: undefined" errors.
 */
export function cleanFirestoreData<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (typeof obj !== 'object') {
    if (typeof obj === 'number' && Number.isNaN(obj)) {
      return 0 as unknown as T;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((v) => v !== undefined)
      .map((v) => cleanFirestoreData(v)) as unknown as T;
  }
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (typeof value === 'number' && Number.isNaN(value)) {
        continue;
      }
      result[key] = typeof value === 'object' && value !== null ? cleanFirestoreData(value) : value;
    }
  }
  return result as T;
}
