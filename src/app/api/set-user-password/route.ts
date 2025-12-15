/**
 * WARNING: This API route uses the Firebase Admin SDK and is designed to be deployed
 * in a trusted server-side environment (like Next.js API Routes, Vercel Functions, or Firebase Functions).
 * It requires service account credentials to be configured in your deployment environment.
 *
 * DO NOT ATTEMPT TO USE THE ADMIN SDK IN CLIENT-SIDE CODE.
 */
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdminApp } from '@/lib/firebase/admin-config';

// Initialize the Firebase Admin App
initializeAdminApp();

export async function POST(request: Request) {
  try {
    const { uid, password } = await request.json();

    if (!uid || !password) {
      return NextResponse.json({ message: 'UID y contraseña son requeridos.' }, { status: 400 });
    }

    // Use the Firebase Admin SDK to update the user's password
    await getAuth().updateUser(uid, {
      password: password,
    });

    return NextResponse.json({ message: 'Contraseña actualizada correctamente.' });

  } catch (error: any) {
    console.error("Error updating password with Admin SDK:", error);
    
    let errorMessage = 'Ocurrió un error en el servidor al cambiar la contraseña.';
    if (error.code) {
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'El usuario no fue encontrado.';
                break;
            case 'auth/invalid-password':
                errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
                break;
            default:
                errorMessage = error.message;
        }
    }

    return NextResponse.json({ message: errorMessage, details: error.code }, { status: 500 });
  }
}
