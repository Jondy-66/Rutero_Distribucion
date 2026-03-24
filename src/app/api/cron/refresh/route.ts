
import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/lib/firebase/admin-config';

const adminApp = initializeAdminApp();

/**
 * @fileoverview Endpoint de sincronización forzada para Cron Jobs.
 * 
 * Este endpoint realiza un "barrido" de todos los ejecutivos activos y llama 
 * a la API de Render para asegurar que el servicio no entre en modo suspensión
 * y las predicciones estén siempre frescas.
 */
export async function GET(request: Request) {
  // 1. Verificación de Seguridad
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Si se ha definido un secreto, validar que el cron envíe 'Bearer <secreto>'
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("Intento de ejecución de CRON no autorizado.");
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!adminApp) {
    return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
  }

  try {
    const db = getFirestore(adminApp);
    const token = process.env.API_PREDICCION_TOKEN;

    if (!token) {
      throw new Error("Token de API externa no configurado.");
    }

    // 2. Obtener ejecutivos activos
    const usersSnapshot = await db.collection('users')
      .where('role', 'in', ['Usuario', 'Telemercaderista'])
      .where('status', '==', 'active')
      .get();

    const ejecutivos = usersSnapshot.docs.map(doc => doc.data().name);
    
    if (ejecutivos.length === 0) {
      return NextResponse.json({ message: 'Sin ejecutivos para sincronizar' });
    }

    const report = [];

    // 3. Despertar API de Render y refrescar datos con Backoff
    for (const ejecutivo of ejecutivos) {
      const url = new URL("https://api-distribucion-rutas.onrender.com/predecir_ejecutivo");
      url.searchParams.append("ejecutivo", ejecutivo);
      url.searchParams.append("dias", "7");

      try {
        // Pausa de seguridad de 1 segundo para evitar Error 429
        await new Promise(resolve => setTimeout(resolve, 1000));

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-API-Key': token
          },
          cache: 'no-store' 
        });

        report.push({
          ejecutivo,
          success: response.ok,
          status: response.status
        });
      } catch (err: any) {
        report.push({ ejecutivo, error: err.message });
      }
    }

    // 4. Registrar log en Firestore
    await db.collection('system_logs').add({
      type: 'CRON_REFRESH',
      timestamp: new Date(),
      processed: ejecutivos.length,
      details: report
    });

    return NextResponse.json({ success: true, report });

  } catch (error: any) {
    console.error("Error en Cron:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
