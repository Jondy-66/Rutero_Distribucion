
import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/lib/firebase/admin-config';

const adminApp = initializeAdminApp();

/**
 * @fileoverview Endpoint de sincronización forzada para Cron Jobs.
 * OBJETIVO PRINCIPAL: Evitar hibernación de la API de Render (Keep-Alive).
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
    const config = configSnap.exists ? configSnap.data() : { enabled: true, active24h: true, scheduledDays: [1,2,3,4,5], refreshIntervalMinutes: 60 };

    // 3. Validaciones de Ejecución
    if (!config?.enabled) {
      return NextResponse.json({ message: 'Cron Job está desactivado globalmente.' });
    }

    const now = new Date();
    const today = now.getDay(); // 0 = Domingo, 1 = Lunes...
    const isScheduledToday = config?.scheduledDays?.includes(today);

    if (!isScheduledToday && !config?.active24h) {
      return NextResponse.json({ message: 'Hoy no es un día programado para ejecución y modo 24h está desactivado.' });
    }

    // Validación de Intervalo
    if (config.lastRun) {
        const lastRun = config.lastRun.toDate();
        const diffMinutes = Math.floor((now.getTime() - lastRun.getTime()) / 60000);
        const minInterval = config.refreshIntervalMinutes || 60;

        if (diffMinutes < minInterval) {
            return NextResponse.json({ 
                message: `Saltando ejecución. Faltan ${minInterval - diffMinutes} minutos para el próximo refresco.`,
                lastRun: lastRun,
                intervalSet: minInterval
            });
        }
    }

    const token = process.env.API_PREDICCION_TOKEN;
    if (!token) throw new Error("Token de API externa no configurado.");

    // 4. ACCIÓN KEEP-ALIVE: Ping a la API para evitar hibernación
    const baseUrl = "https://api-distribucion-rutas.onrender.com";
    let apiAwake = false;
    try {
        const pingRes = await fetch(baseUrl, { method: 'GET', cache: 'no-store' });
        apiAwake = pingRes.ok || pingRes.status === 404; // Si responde, está despierta
    } catch (e) {
        console.warn("Fallo al despertar API (Keep-Alive):", e);
    }

    // 5. Obtener ejecutivos activos para sincronización de datos
    const usersSnapshot = await db.collection('users')
      .where('role', 'in', ['Usuario', 'Telemercaderista'])
      .where('status', '==', 'active')
      .get();

    const ejecutivos = usersSnapshot.docs.map(doc => doc.data().name);
    const report = [];

    if (ejecutivos.length > 0) {
        // Ejecutar sincronización con Backoff de 1s
        for (const ejecutivo of ejecutivos) {
          const url = new URL(`${baseUrl}/predecir_ejecutivo`);
          url.searchParams.append("ejecutivo", ejecutivo);
          url.searchParams.append("dias", "7");

          try {
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
    }

    // 6. Registrar log y actualizar última ejecución
    await db.collection('system_logs').add({
      type: 'CRON_REFRESH',
      timestamp: now,
      processed: ejecutivos.length,
      keepAlive: apiAwake,
      details: report
    });

    await db.collection('system_config').doc('cron').set({
      lastRun: now
    }, { merge: true });

    return NextResponse.json({ 
        success: true, 
        apiStatus: apiAwake ? 'Awake' : 'Unknown',
        processed: ejecutivos.length,
        report 
    });

  } catch (error: any) {
    console.error("Error en Cron:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
