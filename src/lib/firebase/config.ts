/**
 * @fileoverview Este archivo inicializa y configura la conexión con Firebase.
 * Exporta instancias de la aplicación, la base de datos Firestore y el servicio de autenticación
 * para ser utilizadas en toda la aplicación.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

/**
 * Objeto de configuración de Firebase para esta aplicación web.
 * Estos valores se obtienen desde la consola de Firebase del proyecto.
 * Es seguro exponer estas claves en el lado del cliente, ya que la seguridad
 * se gestiona a través de las Reglas de Seguridad de Firebase.
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
 * Esto es importante en entornos de Next.js donde el código puede ejecutarse varias veces.
 */
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

/**
 * Instancia del servicio Firestore.
 * Se utiliza para interactuar con la base de datos NoSQL de la aplicación.
 */
const db = getFirestore(app);

/**
 * Instancia del servicio de autenticación de Firebase.
 * Se utiliza para gestionar el inicio de sesión, registro, cierre de sesión, etc.
 */
const auth = getAuth(app);

// Exportar las instancias para su uso en otras partes de la aplicación.
export { app, db, auth };
