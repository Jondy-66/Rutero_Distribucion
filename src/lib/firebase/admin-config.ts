
// src/lib/firebase/admin-config.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';

/**
 * Inicializa la instancia administrativa de Firebase con máxima robustez.
 * Prioriza el uso de variables de entorno para la cuenta de servicio.
 */
export function initializeAdminApp(): App | null {
  // Retornar instancia existente si ya fue creada para evitar errores de duplicidad
  const existingApp = getApps().find(app => app.name === 'admin');
  if (existingApp) return existingApp;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rutero-fed';
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  try {
    // Caso A: Tenemos credenciales explícitas (Cuenta de Servicio)
    if (privateKey && clientEmail && privateKey !== 'undefined' && clientEmail !== 'undefined') {
      // 1. Limpieza profunda de la llave privada
      let formattedKey = privateKey.replace(/\\n/g, '\n').trim();
      
      // 2. Eliminar comillas dobles si vienen incluidas en el string de la variable de entorno
      if (formattedKey.startsWith('"') && formattedKey.endsWith('"')) {
        formattedKey = formattedKey.substring(1, formattedKey.length - 1);
      }
      
      return initializeApp({
        credential: cert({
          projectId,
          privateKey: formattedKey,
          clientEmail,
        }),
      }, 'admin');
    }

    // Caso B: Fallback a Credenciales Predeterminadas (ADC)
    // Esto funciona en Google Cloud Shell, App Hosting o si se configuró GOOGLE_APPLICATION_CREDENTIALS
    console.warn('Admin SDK: Iniciando sin llaves explícitas. Se requiere entorno con identidad de Google.');
    return initializeApp({
      projectId,
    }, 'admin');
    
  } catch (error: any) {
    console.error('ERROR CRÍTICO: Fallo al inicializar Firebase Admin SDK:', error.message);
    return null;
  }
}
