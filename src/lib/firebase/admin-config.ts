
// src/lib/firebase/admin-config.ts
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';

/**
 * Inicializa la instancia administrativa de Firebase con máxima robustez.
 * Realiza una limpieza exhaustiva de la llave privada para asegurar compatibilidad PEM
 * y maneja múltiples formatos de escape comunes en variables de entorno.
 */
export function initializeAdminApp(): App | null {
  // Retornar instancia existente si ya fue creada para evitar errores de duplicidad
  const existingApp = getApps().find(app => app.name === 'admin');
  if (existingApp) return existingApp;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'rutero-fed';
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  // Validación de presencia de credenciales
  if (!privateKey || !clientEmail || privateKey === 'undefined' || clientEmail === 'undefined') {
    console.error('Admin SDK Error: Faltan credenciales críticas (FIREBASE_PRIVATE_KEY o FIREBASE_CLIENT_EMAIL).');
    return null;
  }

  try {
    // --- PROCESAMIENTO ROBUSTO DE LA LLAVE PRIVADA ---
    let formattedKey = privateKey.trim();
    
    // 1. Si la llave viene envuelta en comillas por el parser de env, las quitamos
    formattedKey = formattedKey.replace(/^['"]|['"]$/g, '');

    // 2. Si el usuario pegó el JSON entero por error, intentamos extraer la llave
    if (formattedKey.startsWith('{')) {
        try {
            const parsed = JSON.parse(formattedKey);
            if (parsed.private_key) formattedKey = parsed.private_key;
        } catch (e) { /* No es JSON, seguimos */ }
    }

    // 3. Normalización de saltos de línea (Fix crítico para Vercel/App Hosting)
    // Reemplaza '\\n' (texto literal) por '\n' (salto de línea real)
    formattedKey = formattedKey.replace(/\\n/g, '\n');

    // 4. Verificación de integridad PEM
    if (!formattedKey.includes('-----BEGIN PRIVATE KEY-----')) {
        console.error('Admin SDK Error: La llave no tiene formato PEM válido.');
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
    console.error('Error fatal al inicializar Admin SDK:', error.message);
    return null;
  }
}
