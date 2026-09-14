
// src/lib/firebase/admin-config.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';

/**
 * Inicializa la instancia administrativa de Firebase con máxima robustez.
 * Las credenciales se leen de las variables de entorno FIREBASE_PRIVATE_KEY y FIREBASE_CLIENT_EMAIL.
 */
export function initializeAdminApp(): App | null {
  // Retornar instancia existente si ya fue creada
  const existingApp = getApps().find(app => app.name === 'admin');
  if (existingApp) return existingApp;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rutero-fed';
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  // Validación silenciosa: No disparamos error hasta que se intente usar una función que lo requiera
  if (!privateKey || !clientEmail || privateKey === 'undefined' || clientEmail === 'undefined') {
    return null;
  }

  try {
    let formattedKey = privateKey.trim();
    
    // Limpieza de comillas y formato JSON si es necesario
    formattedKey = formattedKey.replace(/^['"]|['"]$/g, '');
    if (formattedKey.startsWith('{')) {
        try {
            const parsed = JSON.parse(formattedKey);
            if (parsed.private_key) formattedKey = parsed.private_key;
        } catch (e) {}
    }

    // Normalización crítica de saltos de línea para entornos Cloud
    formattedKey = formattedKey.replace(/\\n/g, '\n');

    if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
        console.error('Admin SDK Error: Formato de llave privada inválido.');
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
    console.error('Error al inicializar Admin SDK:', error.message);
    return null;
  }
}
