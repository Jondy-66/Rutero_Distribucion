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
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  if (!serviceAccount.projectId || !serviceAccount.privateKey || !serviceAccount.clientEmail) {
    throw new Error('Firebase Admin SDK service account credentials are not set in environment variables.');
  }

  adminApp = initializeApp({
    credential: credential.cert(serviceAccount),
  });

  return adminApp;
}
