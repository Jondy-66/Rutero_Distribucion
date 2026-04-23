/**
 * @fileoverview Configuración de Firebase con soporte multi-pestaña y persistencia resiliente.
 */

import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';
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

let db: any;
if (typeof window !== 'undefined') {
    try {
        // Configuramos Firestore para manejar el arrendamiento de caché en múltiples pestañas
        // Si ya está inicializado por otra instancia o falla el lease, capturamos y usamos fallback
        db = initializeFirestore(app, {
            localCache: persistentLocalCache({ 
                tabManager: persistentMultipleTabManager() 
            })
        });
    } catch (e) {
        // Fallback si la inicialización avanzada falla (ej. ambiente no compatible o ya inicializado)
        db = getFirestore(app);
    }
} else {
    db = getFirestore(app);
}

const auth = getAuth(app);
export { app, db, auth };
