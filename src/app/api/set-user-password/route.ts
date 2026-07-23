
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
        message: 'ERROR DE SERVIDOR: El sistema administrativo no está configurado.',
        details: 'Verifica FIREBASE_PRIVATE_KEY y FIREBASE_CLIENT_EMAIL.'
    }, { status: 500 });
  }

  try {
    const { uid, password } = await request.json();

    if (!uid || !password) {
      return NextResponse.json({ message: 'UID y contraseña son requeridos.' }, { status: 400 });
    }

    // 2. Ejecutar la actualización en Firebase Auth
    const authAdmin = getAuth(adminApp);
    await authAdmin.updateUser(uid, {
      password: password,
    });

    return NextResponse.json({ 
      success: true,
      message: 'Contraseña actualizada correctamente.' 
    });

  } catch (error: any) {
    console.error("Error en operación Admin Auth:", error);
    
    let friendlyMessage = 'Error al procesar el cambio de contraseña.';
    
    // Mapeo de errores para diagnóstico preciso
    if (error.code) {
        switch (error.code) {
            case 'auth/user-not-found':
                friendlyMessage = 'El usuario ya no existe en los servidores de Google.';
                break;
            case 'auth/invalid-password':
                friendlyMessage = 'La contraseña no cumple con los requisitos mínimos de seguridad.';
                break;
            case 'app/invalid-credential':
                friendlyMessage = 'ERROR DE TOKEN: Las llaves de acceso del servidor son incorrectas o han expirado. Contacta a soporte técnico.';
                break;
            default:
                friendlyMessage = `Fallo administrativo: ${error.message}`;
        }
    }

    return NextResponse.json({ 
      message: friendlyMessage, 
      details: error.code || 'UNKNOWN_AUTH_ERROR'
    }, { status: 500 });
  }
}
