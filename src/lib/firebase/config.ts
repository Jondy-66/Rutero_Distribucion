/**
 * @fileoverview Este archivo inicializa y configura la conexión con Firebase.
 * Exporta instancias de la aplicación, la base de datos Firestore y el servicio de autenticación
 * para ser utilizadas en toda la aplicación.
 */

import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
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
 */
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/**
 * Crea una instancia secundaria de la app de Firebase.
 */
export const createSecondaryApp = (appName: string) => {
    const secondaryApp = initializeApp(firebaseConfig, appName);
    return secondaryApp;
};

/**
 * Elimina una instancia secundaria de la app de Firebase.
 */
export const deleteSecondaryApp = (appInstance: any) => {
    return deleteApp(appInstance);
}

/**
 * Instancia del servicio Firestore.
 */
const db = getFirestore(app);

/**
 * Instancia del servicio de autenticación de Firebase.
 */
const auth = getAuth(app);

export { app, db, auth };
