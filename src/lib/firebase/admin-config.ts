// src/lib/firebase/admin-config.ts
import 'dotenv/config';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { credential } from 'firebase-admin';

/**
 * Inicializa la instancia administrativa de Firebase.
 * Intenta usar variables de entorno explícitas o Application Default Credentials (ADC) como respaldo.
 */
export function initializeAdminApp(): App | null {
  // Retornar instancia existente si ya fue creada
  const existingApp = getApps().find(app => app.name === 'admin');
  if (existingApp) return existingApp;

  // Parámetros de configuración (con fallback al ID de proyecto conocido)
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rutero-fed';
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  try {
    // 1. Intentar inicialización con Cuenta de Servicio explícita (Producción externa)
    if (privateKey && clientEmail) {
      return initializeApp({
        credential: credential.cert({
          projectId,
          privateKey: privateKey.replace(/\\n/g, '\n'),
          clientEmail,
        }),
      }, 'admin');
    }

    // 2. Intentar inicialización con Credenciales Predeterminadas (ADC)
    // Esto funciona automáticamente en Google Cloud, Firebase App Hosting, etc.
    return initializeApp({
      projectId,
    }, 'admin');
    
  } catch (error) {
    console.error('Error crítico al inicializar Firebase Admin SDK:', error);
    return null;
  }
}
