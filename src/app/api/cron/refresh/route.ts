
import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/lib/firebase/admin-config';

const adminApp = initializeAdminApp();

/**
 * @fileoverview Endpoint de sincronización forzada para Cron Jobs.
 * 
 * Este endpoint realiza un "barrido" de todos los ejecutivos activos y llama 
 * a la API de Render para asegurar que el servicio no entre en modo suspensión.
 */
export async function GET(request: Request) {
  // 1. Verificación de Seguridad
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("Intento de ejecución de CRON no autorizado.");
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (!adminApp) {
    return NextResponse.json({ error: 'Admin SDK no inicializado' }, { status: 500 });
  }

  try {
    const db = getFirestore(adminApp);
    
    // 2. Cargar configuración de Cron desde Firestore
    const configSnap = await db.collection('system_config').doc('cron').get();
    const config = configSnap.exists ? configSnap.data() : { enabled: true, active24h: true, scheduledDays: [1,2,3,4,5] };

    // 3. Validar si el Cron debe ejecutarse hoy
    if (!config?.enabled) {
      return NextResponse.json({ message: 'Cron Job está desactivado globalmente.' });
    }

    const today = new Date().getDay(); // 0 = Domingo, 1 = Lunes...
    const isScheduledToday = config?.scheduledDays?.includes(today);

    if (!isScheduledToday && !config?.active24h) {
      return NextResponse.json({ message: 'Hoy no es un día programado para ejecución y modo 24h está desactivado.' });
    }

    const token = process.env.API_PREDICCION_TOKEN;
    if (!token) throw new Error("Token de API externa no configurado.");

    // 4. Obtener ejecutivos activos
    const usersSnapshot = await db.collection('users')
      .where('role', 'in', ['Usuario', 'Telemercaderista'])
      .where('status', '==', 'active')
      .get();

    const ejecutivos = usersSnapshot.docs.map(doc => doc.data().name);
    
    if (ejecutivos.length === 0) {
      return NextResponse.json({ message: 'Sin ejecutivos para sincronizar' });
    }

    const report = [];

    // 5. Despertar API de Render y refrescar datos con Backoff para evitar Error 429
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

    // 6. Registrar log en Firestore y actualizar última ejecución
    const now = new Date();
    await db.collection('system_logs').add({
      type: 'CRON_REFRESH',
      timestamp: now,
      processed: ejecutivos.length,
      details: report
    });

    await db.collection('system_config').doc('cron').set({
      lastRun: now
    }, { merge: true });

    return NextResponse.json({ success: true, report });

  } catch (error: any) {
    console.error("Error en Cron:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
