
/**
 * @fileoverview Configuración de Firebase optimizada para estabilidad y persistencia.
 */

import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBf28yfROnTCqwgLpXY-GJqIhwC7zIbQMo",
  authDomain: "rutero-fed.firebaseapp.com",
  projectId: "rutero-fed",
  storageBucket: "rutero-fed.firebasestorage.app",
  messagingSenderId: "938904325205",
  appId: "1:938904325205:web:1e8a2b471eff36f4d118dc",
  measurementId: "G-T0NYMCV1HR"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const createSecondaryApp = (appName: string) => initializeApp(firebaseConfig, appName);
export const deleteSecondaryApp = (appInstance: any) => deleteApp(appInstance);

/**
 * Inicialización avanzada de Firestore con persistencia local.
 * Esto permite el funcionamiento offline y sincronización en segundo plano.
 */
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

const auth = getAuth(app);

export { app, db, auth };
