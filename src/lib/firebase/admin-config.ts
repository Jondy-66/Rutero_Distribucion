
// src/lib/firebase/admin-config.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';

/**
 * Inicializa la instancia administrativa de Firebase con máxima robustez.
 * Realiza una limpieza profunda de la llave privada para asegurar compatibilidad PEM.
 */
export function initializeAdminApp(): App | null {
  // Retornar instancia existente si ya fue creada
  const existingApp = getApps().find(app => app.name === 'admin');
  if (existingApp) return existingApp;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rutero-fed';
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  // Si no hay variables, no intentamos inicializar para evitar el crash del SDK
  if (!privateKey || !clientEmail || privateKey === 'undefined' || clientEmail === 'undefined') {
    console.error('Admin SDK Error: Faltan credenciales en el servidor (FIREBASE_PRIVATE_KEY o FIREBASE_CLIENT_EMAIL).');
    return null;
  }

  try {
    // --- LIMPIEZA PROFUNDA DE LLAVE PRIVADA ---
    let formattedKey = privateKey.trim();
    
    // 1. Eliminar comillas externas (dobles o simples) que algunos sistemas de despliegue añaden
    if ((formattedKey.startsWith('"') && formattedKey.endsWith('"')) || 
        (formattedKey.startsWith("'") && formattedKey.endsWith("'"))) {
      formattedKey = formattedKey.substring(1, formattedKey.length - 1);
    }
    
    // 2. Normalizar saltos de línea:
    // Algunos entornos escapan la barra invertida (\\n), otros no.
    // Reemplazamos las secuencias literales de "\n" por saltos de línea reales.
    formattedKey = formattedKey.replace(/\\n/g, '\n');
    
    // 3. Verificación final de integridad PEM
    if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
        // Si no tiene el encabezado, intentamos reconstruirlo si parece una llave base64 (caso raro)
        console.error('Admin SDK Error: El formato de la llave privada es inválido (Falta encabezado PEM).');
        return null;
    }

    return initializeApp({
      credential: cert({
        projectId,
        privateKey: formattedKey,
        clientEmail,
      }),
    }, 'admin');
    
  } catch (error: any) {
    console.error('Fallo crítico al inicializar Admin SDK:', error.message);
    return null;
  }
}
