
import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/lib/firebase/admin-config';

/**
 * Endpoint de seguridad: Verifica estados de cuenta.
 * Si el Admin SDK no está configurado, permite el paso por defecto para no bloquear el login.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawEmail = searchParams.get('email');
  const adminApp = initializeAdminApp();

  if (!rawEmail) {
    return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
  }

  // Si no hay Admin SDK, devolvemos que el usuario existe/está activo por defecto
  // para permitir que el login de Firebase Client maneje la autenticación.
  if (!adminApp) {
    return NextResponse.json({ exists: true, status: 'active', failedLoginAttempts: 0, adminConfigured: false });
  }

  const email = rawEmail.trim().toLowerCase();

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
      failedLoginAttempts: userData.failedLoginAttempts || 0,
      adminConfigured: true
    });
  } catch (error) {
    console.error("Error en API security (GET):", error);
    return NextResponse.json({ exists: true, status: 'active' }); // Fallback seguro
  }
}

export async function POST(request: Request) {
  const adminApp = initializeAdminApp();
  if (!adminApp) return NextResponse.json({ error: 'Funciones administrativas no configuradas' }, { status: 200 });

  try {
    const { email: rawEmail, action } = await request.json();
    if (!rawEmail) return NextResponse.json({ error: 'Email requerido' }, { status: 400 });
    
    const email = rawEmail.trim().toLowerCase();
    const db = getFirestore(adminApp);
    const snapshot = await db.collection('users').where('email', '==', email).limit(1).get();

    if (snapshot.empty) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

    const userDoc = snapshot.docs[0].ref;
    const userData = snapshot.docs[0].data();

    if (action === 'fail') {
      const newAttempts = (userData.failedLoginAttempts || 0) + 1;
      const updates: any = { failedLoginAttempts: newAttempts };
      if (newAttempts >= 5) updates.status = 'inactive';
      await userDoc.update(updates);
      return NextResponse.json({ attempts: newAttempts, blocked: newAttempts >= 5 });
    }

    if (action === 'reset') {
      await userDoc.update({ failedLoginAttempts: 0 });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Error procesando seguridad' }, { status: 500 });
  }
}
