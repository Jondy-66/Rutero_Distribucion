/**
 * @fileoverview Este archivo inicializa y configura la conexión con Firebase.
 * Exporta instancias de la aplicación, la base de datos Firestore y el servicio de autenticación
 * para ser utilizadas en toda la aplicación.
 */

import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

/**
 * Objeto de configuración de Firebase para esta aplicación web.
 */
const firebaseConfig = {
  apiKey: "AIzaSyBf28yfROnTCqwgLpXY-GJqIhwC7zIbQMo",
  authDomain: "rutero-fed.firebaseapp.com",
  projectId: "rutero-fed",
  storageBucket: "rutero-fed.firebasestorage.app",
  messagingSenderId: "938904325205",
  appId: "1:938904325205:web:1e8a2b471eff36f4d118dc",
  measurementId: "G-T0NYMCV1HR"
};


/**
 * Inicializa Firebase.
 * Comprueba si ya existe una aplicación de Firebase para evitar la reinicialización.
 */
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/**
 * Crea una instancia secundaria de la app de Firebase.
 * Útil para tareas administrativas sin afectar la sesión principal.
 */
export const createSecondaryApp = (appName: string) => {
    return initializeApp(firebaseConfig, appName);
};

/**
 * Elimina una instancia secundaria de la app de Firebase.
 */
export const deleteSecondaryApp = (appInstance: any) => {
    return deleteApp(appInstance);
}

/**
 * Instancia del servicio Firestore con PERSISTENCIA OFFLINE habilitada.
 * Se utiliza un patrón de inicialización único para evitar errores de lease en múltiples pestañas.
 */
let db;
if (typeof window !== 'undefined') {
    const apps = getApps();
    try {
        // Intentamos inicializar con cache persistente y soporte multi-pestaña
        db = initializeFirestore(app, {
            localCache: persistentLocalCache({ 
                tabManager: persistentMultipleTabManager() 
            })
        });
    } catch (e) {
        // Si ya está inicializado, obtenemos la instancia existente
        db = getFirestore(app);
    }
} else {
    db = getFirestore(app);
}

/**
 * Instancia del servicio de autenticación de Firebase.
 */
const auth = getAuth(app);

export { app, db, auth };
