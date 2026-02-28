
import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/lib/firebase/admin-config';

const adminApp = initializeAdminApp();

/**
 * Endpoint de seguridad para gestionar estados de usuario sin requerir sesión activa en el cliente.
 * GET: Verifica si un usuario existe y su estado.
 * POST: Registra fallos de inicio de sesión o resetea contadores.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email || !adminApp) {
    return NextResponse.json({ error: 'Email requerido o error de configuración' }, { status: 400 });
  }

  try {
    const db = getFirestore(adminApp);
    const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ exists: false });
    }

    const userData = snapshot.docs[0].data();
    return NextResponse.json({
      exists: true,
      id: snapshot.docs[0].id,
      status: userData.status || 'active',
      failedLoginAttempts: userData.failedLoginAttempts || 0
    });
  } catch (error) {
    console.error("Error en API security (GET):", error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!adminApp) return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });

  try {
    const { email, action } = await request.json();
    const db = getFirestore(adminApp);
    const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();

    if (snapshot.empty) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const userDoc = snapshot.docs[0].ref;
    const userData = snapshot.docs[0].data();

    if (action === 'fail') {
      const currentAttempts = userData.failedLoginAttempts || 0;
      const newAttempts = currentAttempts + 1;
      const updates: any = { failedLoginAttempts: newAttempts };
      
      if (newAttempts >= 5) {
        updates.status = 'inactive';
      }
      
      await userDoc.update(updates);
      return NextResponse.json({ attempts: newAttempts, blocked: newAttempts >= 5 });
    }

    if (action === 'reset') {
      await userDoc.update({ failedLoginAttempts: 0 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    console.error("Error en API security (POST):", error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
