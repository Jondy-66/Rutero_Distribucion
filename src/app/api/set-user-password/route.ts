
/**
 * API Route para gestión administrativa de contraseñas.
 * Utiliza el Admin SDK para realizar cambios que el cliente no tiene permitido por seguridad.
 */
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdminApp } from '@/lib/firebase/admin-config';

export async function POST(request: Request) {
  // Inicializamos el motor administrativo dentro del handler para mayor confiabilidad de env vars
  const adminApp = initializeAdminApp();

  if (!adminApp) {
    return NextResponse.json({ 
        message: 'ERROR DE CONFIGURACIÓN: El servidor no tiene acceso a las llaves maestras.',
        details: 'Verifica que FIREBASE_PRIVATE_KEY y FIREBASE_CLIENT_EMAIL estén configuradas como Secretos.'
    }, { status: 500 });
  }

  try {
    const { uid, password } = await request.json();

    if (!uid || !password) {
      return NextResponse.json({ message: 'UID y contraseña son requeridos.' }, { status: 400 });
    }

    if (password.length < 6) {
        return NextResponse.json({ message: 'La contraseña es demasiado corta (mínimo 6).' }, { status: 400 });
    }

    // Ejecutar la actualización en Firebase Auth usando la instancia 'admin'
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
    
    // Mapeo de errores de autenticación administrativa de Google
    if (error.code === 'app/invalid-credential' || error.message?.includes('credential')) {
        friendlyMessage = 'ERROR DE TOKEN: La llave privada configurada en el servidor es rechazada por Google. Por favor, revisa el formato de FIREBASE_PRIVATE_KEY.';
    } else if (error.code === 'auth/user-not-found') {
        friendlyMessage = 'El usuario no existe en los registros de autenticación.';
    } else {
        friendlyMessage = `Fallo administrativo: ${error.message || 'Error desconocido'}`;
    }

    return NextResponse.json({ 
      message: friendlyMessage, 
      details: error.code || 'UNKNOWN_AUTH_ERROR'
    }, { status: 500 });
  }
}
