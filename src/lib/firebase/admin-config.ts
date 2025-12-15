// src/lib/firebase/admin-config.ts
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { credential } from 'firebase-admin';

// IMPORTANT: Set these environment variables in your hosting environment (e.g., Vercel, Netlify).
// Do not hardcode them here.
const serviceAccount = {
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
};

let adminApp: App;

export function initializeAdminApp() {
  // Check if the app is already initialized
  if (getApps().some(app => app.name === 'admin')) {
    return getApps().find(app => app.name === 'admin');
  }

  if (!serviceAccount.projectId || !serviceAccount.privateKey || !serviceAccount.clientEmail) {
    console.error('Firebase Admin SDK service account credentials are not set in environment variables.');
    // No lanzar un error aquí para evitar que el servidor falle al construir si las variables no están presentes.
    // La ruta de la API que lo usa manejará el error si la app no está inicializada.
    return null;
  }

  adminApp = initializeApp({
    credential: credential.cert(serviceAccount),
  }, 'admin');

  return adminApp;
}
