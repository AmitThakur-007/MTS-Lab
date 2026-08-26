import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  collection, 
  getDocFromServer, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  query, 
  QueryConstraint,
  DocumentData,
  serverTimestamp,
  type Unsubscribe
} from 'firebase/firestore';
import {
  getDatabase,
  ref,
  set,
  update,
  push,
  remove,
  get,
  onValue,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  serverTimestamp as rtdbServerTimestamp,
  query as rtdbQuery,
  orderByChild,
  equalTo,
  limitToLast,
  type DatabaseReference,
  type Unsubscribe as RtdbUnsubscribe
} from 'firebase/database';
import { useEffect, useState, useRef } from 'react';
import defaultFirebaseConfig from '../../firebase-applet-config.json';

const getEnvVar = (key: string): string => {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key] as string;
  }
  if (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env as any)[key]) {
    return (import.meta.env as any)[key] as string;
  }
  return '';
};

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_FIREBASE_API_KEY) || defaultFirebaseConfig.apiKey || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) || defaultFirebaseConfig.authDomain || '',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_FIREBASE_DATABASE_URL) || defaultFirebaseConfig.databaseURL || 'https://mts-lab-eb8d2-default-rtdb.firebaseio.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_FIREBASE_PROJECT_ID) || defaultFirebaseConfig.projectId || 'mts-lab-eb8d2',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) || defaultFirebaseConfig.storageBucket || '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) || defaultFirebaseConfig.messagingSenderId || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || (typeof import.meta !== 'undefined' && import.meta.env?.NEXT_PUBLIC_FIREBASE_APP_ID) || defaultFirebaseConfig.appId || '',
};

function initFirebaseApp() {
  if (getApps().length > 0) {
    return getApp();
  }
  try {
    return initializeApp(firebaseConfig);
  } catch (err) {
    console.warn('[FIREBASE] initializeApp with config failed, attempting default config fallback:', err);
    return initializeApp(defaultFirebaseConfig);
  }
}

const app = initFirebaseApp();

export const db = getFirestore(app);
export const rtdb = getDatabase(app, firebaseConfig.databaseURL);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Connectivity check
async function testConnection() {
  try {
    if (typeof window !== 'undefined' && rtdb) {
      const connectedRef = ref(rtdb, '.info/connected');
      onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
          console.info('[FIREBASE] Successfully connected to Firebase Realtime Database');
        }
      }, (err) => {
        // Non-blocking connection notice
      });
    }
  } catch {
    // Non-blocking
  }
}

if (typeof window !== 'undefined') {
  testConnection();
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
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore/RTDB Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * =========================================================================
 * FIREBASE REALTIME DATABASE (RTDB) HELPERS & HOOKS
 * Target Database: https://mts-lab-eb8d2-default-rtdb.firebaseio.com/
 * =========================================================================
 */

/**
 * Write/Set data to a specific RTDB path
 */
export async function writeRtdb(path: string, data: any) {
  try {
    const dbRef = ref(rtdb, path);
    await set(dbRef, {
      ...data,
      updatedAt: data.updatedAt || rtdbServerTimestamp(),
      createdAt: data.createdAt || rtdbServerTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `rtdb://${path}`);
    throw error;
  }
}

/**
 * Sanitize repair data for Firebase Realtime Database
 */
export function sanitizeRepairForRtdb(repair: any) {
  if (!repair) return null;
  return {
    id: String(repair.id || ''),
    repairNumber: String(repair.repairNumber || ''),
    customerId: repair.customerId ? String(repair.customerId) : (repair.customer?.id ? String(repair.customer.id) : null),
    customerName: String(repair.customerName || repair.customer?.name || ''),
    customerPhone: String(repair.customerPhone || repair.customer?.phone || ''),
    customerEmail: repair.customerEmail || repair.customer?.email || null,
    customerAddress: repair.customerAddress || repair.customer?.address || null,
    deviceBrand: String(repair.deviceBrand || 'apple'),
    deviceModel: String(repair.deviceModel || ''),
    imeiNumber: repair.imeiNumber || null,
    deviceCondition: repair.deviceCondition || 'Fair',
    problemDescription: repair.problemDescription || '',
    accessoriesReceived: repair.accessoriesReceived || null,
    estimatedCost: Number(repair.estimatedCost ?? repair.totalCost ?? 0),
    advancePaid: Number(repair.advancePaid ?? 0),
    totalPaid: Number(repair.totalPaid ?? repair.advancePaid ?? 0),
    paymentStatus: repair.paymentStatus || 'UNPAID',
    technicianId: repair.technicianId || repair.technician?.id || null,
    technician: repair.technician ? {
      id: String(repair.technician.id || ''),
      name: String(repair.technician.name || ''),
      role: String(repair.technician.role || 'TECHNICIAN')
    } : null,
    status: String(repair.status || 'RECEIVED'),
    partsUsed: repair.partsUsed || null,
    remarks: repair.remarks || null,
    expectedCompletionDate: repair.expectedCompletionDate ? new Date(repair.expectedCompletionDate).toISOString() : null,
    createdAt: repair.createdAt ? new Date(repair.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastSyncTimestamp: Date.now()
  };
}

/**
 * Atomically sync a repair record to Firebase Realtime Database and touch syncTimestamp
 */
export async function syncRepairToRtdb(repair: any) {
  if (!repair || !repair.id) return;
  try {
    const sanitized = sanitizeRepairForRtdb(repair);
    const repairRef = ref(rtdb, `repairs/${repair.id}`);
    await set(repairRef, sanitized);
    
    // Also bump global syncTimestamp
    const syncRef = ref(rtdb, 'syncTimestamp');
    await set(syncRef, Date.now()).catch(() => {});
  } catch (err) {
    console.warn('[FIREBASE RTDB] Sync repair error:', err);
  }
}

/**
 * Delete a repair record from Firebase Realtime Database
 */
export async function deleteRepairFromRtdb(repairId: string) {
  if (!repairId) return;
  try {
    const repairRef = ref(rtdb, `repairs/${repairId}`);
    await remove(repairRef);
    const syncRef = ref(rtdb, 'syncTimestamp');
    await set(syncRef, Date.now()).catch(() => {});
  } catch (err) {
    console.warn('[FIREBASE RTDB] Delete repair error:', err);
  }
}

/**
 * Atomically sync any entity record to Firebase Realtime Database and touch syncTimestamp
 */
export async function syncEntityToRtdb(entityName: string, id: string, data: any) {
  if (!entityName || !id || !data) return;
  try {
    const pathName = entityName.endsWith('s') ? entityName : `${entityName}s`;
    const entityRef = ref(rtdb, `${pathName}/${id}`);
    const sanitized = {
      ...data,
      id: String(id),
      updatedAt: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date().toISOString(),
      lastSyncTimestamp: Date.now()
    };
    await set(entityRef, sanitized);
    
    // Touch global syncTimestamp
    const syncRef = ref(rtdb, 'syncTimestamp');
    await set(syncRef, Date.now()).catch(() => {});
  } catch (err) {
    console.warn(`[FIREBASE RTDB] Sync ${entityName} error:`, err);
  }
}

/**
 * Delete any entity record from Firebase Realtime Database
 */
export async function deleteEntityFromRtdb(entityName: string, id: string) {
  if (!entityName || !id) return;
  try {
    const pathName = entityName.endsWith('s') ? entityName : `${entityName}s`;
    const entityRef = ref(rtdb, `${pathName}/${id}`);
    await remove(entityRef);
    const syncRef = ref(rtdb, 'syncTimestamp');
    await set(syncRef, Date.now()).catch(() => {});
  } catch (err) {
    console.warn(`[FIREBASE RTDB] Delete ${entityName} error:`, err);
  }
}
export async function updateRtdb(path: string, updates: Record<string, any>) {
  try {
    const dbRef = ref(rtdb, path);
    await update(dbRef, {
      ...updates,
      updatedAt: rtdbServerTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `rtdb://${path}`);
    throw error;
  }
}

/**
 * Push new item to a list in RTDB
 */
export async function pushRtdb(path: string, data: any) {
  try {
    const listRef = ref(rtdb, path);
    const newRef = push(listRef);
    await set(newRef, {
      ...data,
      id: newRef.key,
      createdAt: rtdbServerTimestamp(),
      updatedAt: rtdbServerTimestamp()
    });
    return newRef.key;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `rtdb://${path}`);
    throw error;
  }
}

/**
 * Remove record from RTDB
 */
export async function removeRtdb(path: string) {
  try {
    const dbRef = ref(rtdb, path);
    await remove(dbRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `rtdb://${path}`);
    throw error;
  }
}

/**
 * Real-time RTDB Hook for single object or collection node
 */
export function useRtdbValue<T = any>(
  path: string | null,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(enabled && path));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !path) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const dbRef = ref(rtdb, path);
    const unsubscribe = onValue(
      dbRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setData(snapshot.val());
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error(`[RTDB onValue ERROR] path: ${path}`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [path, enabled]);

  return { data, loading, error };
}

/**
 * Real-time RTDB Hook for lists / collections (returns array with keys mapped to id)
 */
export function useRtdbList<T = any>(
  path: string | null,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(Boolean(enabled && path));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !path) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const dbRef = ref(rtdb, path);
    const unsubscribe = onValue(
      dbRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const val = snapshot.val();
          if (typeof val === 'object' && val !== null) {
            const list: T[] = Object.keys(val).map((k) => ({
              id: k,
              ...val[k]
            }));
            setData(list);
          } else {
            setData([]);
          }
        } else {
          setData([]);
        }
        setLoading(false);
      },
      (err) => {
        console.error(`[RTDB LIST onValue ERROR] path: ${path}`, err);
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [path, enabled]);

  return { data, loading, error };
}

/**
 * =========================================================================
 * FIRESTORE HELPERS & HOOKS
 * =========================================================================
 */

export async function createFirestoreDoc<T extends DocumentData>(collectionPath: string, data: T, customId?: string) {
  try {
    if (customId) {
      const docRef = doc(db, collectionPath, customId);
      await setDoc(docRef, {
        ...data,
        createdAt: (data as any).createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return customId;
    } else {
      const colRef = collection(db, collectionPath);
      const res = await addDoc(colRef, {
        ...data,
        createdAt: (data as any).createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return res.id;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, collectionPath);
    throw error;
  }
}

export async function updateFirestoreDoc(collectionPath: string, docId: string, data: Partial<DocumentData>) {
  const path = `${collectionPath}/${docId}`;
  try {
    const docRef = doc(db, collectionPath, docId);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export async function setFirestoreDoc(collectionPath: string, docId: string, data: DocumentData, merge: boolean = true) {
  const path = `${collectionPath}/${docId}`;
  try {
    const docRef = doc(db, collectionPath, docId);
    await setDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function deleteFirestoreDoc(collectionPath: string, docId: string) {
  const path = `${collectionPath}/${docId}`;
  try {
    const docRef = doc(db, collectionPath, docId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export function useFirestoreCollection<T = DocumentData>(
  collectionPath: string,
  constraints: QueryConstraint[] = [],
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const colRef = collection(db, collectionPath);
    const q = query(colRef, ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as unknown as T[];
        setData(items);
        setLoading(false);
      },
      (err) => {
        console.error(`[FIRESTORE SNAPSHOT ERROR] on ${collectionPath}:`, err);
        setError(err);
        setLoading(false);
        handleFirestoreError(err, OperationType.LIST, collectionPath);
      }
    );

    return () => unsubscribe();
  }, [collectionPath, JSON.stringify(constraints.map((c) => c.type)), enabled]);

  return { data, loading, error };
}

export function useFirestoreDoc<T = DocumentData>(
  collectionPath: string,
  docId: string | null | undefined,
  options: { enabled?: boolean } = {}
) {
  const { enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(enabled && docId));
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !docId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const path = `${collectionPath}/${docId}`;
    const docRef = doc(db, collectionPath, docId);

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          setData({ id: docSnap.id, ...docSnap.data() } as unknown as T);
        } else {
          setData(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error(`[FIRESTORE DOC SNAPSHOT ERROR] on ${path}:`, err);
        setError(err);
        setLoading(false);
        handleFirestoreError(err, OperationType.GET, path);
      }
    );

    return () => unsubscribe();
  }, [collectionPath, docId, enabled]);

  return { data, loading, error };
}

