/**
 * WARNING: This API route uses the Firebase Admin SDK and is designed to be deployed
 * in a trusted server-side environment.
 */
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdminApp } from '@/lib/firebase/admin-config';

export async function POST(request: Request) {
  // Inicializar dinámicamente para mayor robustez
  const adminApp = initializeAdminApp();

  if (!adminApp) {
    return NextResponse.json({ 
        message: 'Error de configuración del servidor: No se pudo establecer conexión administrativa con Firebase. Verifica las variables de entorno FIREBASE_PRIVATE_KEY y FIREBASE_CLIENT_EMAIL.',
        details: 'Admin SDK Initialization failed (Check service account)'
    }, { status: 500 });
  }

  try {
    const { uid, password } = await request.json();

    if (!uid || !password) {
      return NextResponse.json({ message: 'UID y contraseña son requeridos.' }, { status: 400 });
    }

    // Actualizar la contraseña vía Admin SDK
    await getAuth(adminApp).updateUser(uid, {
      password: password,
    });

    return NextResponse.json({ message: 'Contraseña actualizada correctamente en el sistema.' });

  } catch (error: any) {
    console.error("Error updating password with Admin SDK:", error);
    
    let errorMessage = 'Ocurrió un error en el servidor al cambiar la contraseña.';
    if (error.code) {
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'El usuario no fue encontrado en la base de datos de autenticación.';
                break;
            case 'auth/invalid-password':
                errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
                break;
            default:
                errorMessage = `Error de Firebase: ${error.message}`;
        }
    }

    return NextResponse.json({ message: errorMessage, details: error.code }, { status: 500 });
  }
}
