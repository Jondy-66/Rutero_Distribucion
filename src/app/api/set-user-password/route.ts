
/**
 * API Route para gestión administrativa de contraseñas.
 * Utiliza el Admin SDK para realizar cambios que el cliente no tiene permitido por seguridad.
 */
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdminApp } from '@/lib/firebase/admin-config';

export async function POST(request: Request) {
  // 1. Validar inicialización del motor administrativo
  const adminApp = initializeAdminApp();

  if (!adminApp) {
    return NextResponse.json({ 
        message: 'ERROR DE SERVIDOR: El sistema administrativo de Firebase no está configurado correctamente.',
        details: 'Verifica que FIREBASE_PRIVATE_KEY y FIREBASE_CLIENT_EMAIL estén definidas en el entorno de producción.'
    }, { status: 500 });
  }

  try {
    const { uid, password } = await request.json();

    if (!uid || !password) {
      return NextResponse.json({ message: 'UID y contraseña son requeridos para esta operación.' }, { status: 400 });
    }

    // 2. Ejecutar la actualización en Firebase Auth
    const authAdmin = getAuth(adminApp);
    await authAdmin.updateUser(uid, {
      password: password,
    });

    return NextResponse.json({ 
      success: true,
      message: 'Contraseña actualizada correctamente en los servidores de identidad.' 
    });

  } catch (error: any) {
    console.error("Error en operación Admin Auth:", error);
    
    let friendlyMessage = 'Ocurrió un error inesperado al procesar el cambio de contraseña.';
    
    // Mapeo de errores comunes para feedback al administrador
    if (error.code) {
        switch (error.code) {
            case 'auth/user-not-found':
                friendlyMessage = 'El usuario ya no existe en el sistema de autenticación.';
                break;
            case 'auth/invalid-password':
                friendlyMessage = 'La contraseña es demasiado débil o no cumple con el formato de Firebase.';
                break;
            case 'app/invalid-credential':
                friendlyMessage = 'Las credenciales del servidor han expirado o son inválidas (Error de Token).';
                break;
            default:
                friendlyMessage = `Fallo de Firebase Admin: ${error.message}`;
        }
    }

    return NextResponse.json({ 
      message: friendlyMessage, 
      details: error.code || 'UNKNOWN_AUTH_ERROR'
    }, { status: 500 });
  }
}
