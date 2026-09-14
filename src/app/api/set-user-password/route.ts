
/**
 * API Route para gestión administrativa de contraseñas.
 * Requiere FIREBASE_PRIVATE_KEY y FIREBASE_CLIENT_EMAIL configurados.
 */
import { NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeAdminApp } from '@/lib/firebase/admin-config';

export async function POST(request: Request) {
  const adminApp = initializeAdminApp();

  if (!adminApp) {
    return NextResponse.json({ 
        message: 'ERROR DE CONFIGURACIÓN: Faltan llaves maestras en el servidor.',
        details: 'Configura FIREBASE_PRIVATE_KEY y FIREBASE_CLIENT_EMAIL como secretos de entorno.'
    }, { status: 500 });
  }

  try {
    const { uid, password } = await request.json();

    if (!uid || !password || password.length < 6) {
      return NextResponse.json({ message: 'UID y contraseña (min 6) son requeridos.' }, { status: 400 });
    }

    const authAdmin = getAuth(adminApp);
    await authAdmin.updateUser(uid, { password });

    return NextResponse.json({ 
      success: true,
      message: 'Contraseña actualizada correctamente.' 
    });

  } catch (error: any) {
    console.error("Error en operación Admin Auth:", error);
    return NextResponse.json({ 
      message: 'Fallo administrativo: ' + (error.message || 'Error desconocido'),
      details: error.code || 'AUTH_ERROR'
    }, { status: 500 });
  }
}
