
import { NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeAdminApp } from '@/lib/firebase/admin-config';

const adminApp = initializeAdminApp();

/**
 * @fileoverview Endpoint optimizado para ser invocado por servicios de tareas programadas (Cron).
 * 
 * Propósito: 
 * 1. Evitar el "Cold Start" de la API en Render (mantener el servicio activo).
 * 2. Refrescar los cálculos de predicción para todos los ejecutivos activos de forma masiva.
 * 3. Registrar una bitácora de sincronización en Firestore para monitoreo.
 * 
 * Seguridad: El endpoint espera un header 'Authorization: Bearer <TU_SECRETO_CRON>'.
 */
export async function GET(request: Request) {
  // 1. Verificación de Seguridad mediante Token Secreto
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Si se ha definido un secreto en las variables de entorno, validar que coincida
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("Intento de ejecución de CRON no autorizado.");
    return NextResponse.json({ error: 'Acceso Denegado: Cabecera de autorización inválida o ausente.' }, { status: 401 });
  }

  if (!adminApp) {
    return NextResponse.json({ error: 'Configuración del servidor incompleta (Admin SDK).' }, { status: 500 });
  }

  try {
    const db = getFirestore(adminApp);
    const token = process.env.API_PREDICCION_TOKEN;

    if (!token) {
      throw new Error("La variable de entorno API_PREDICCION_TOKEN no está configurada.");
    }

    // 2. Obtener lista de todos los ejecutivos (Vendedores y Telemercaderistas) activos
    const usersSnapshot = await db.collection('users')
      .where('role', 'in', ['Usuario', 'Telemercaderista'])
      .where('status', '==', 'active')
      .get();

    const ejecutivos = usersSnapshot.docs.map(doc => doc.data().name);
    
    if (ejecutivos.length === 0) {
      return NextResponse.json({ message: 'No hay ejecutivos activos para sincronizar.' });
    }

    const syncReport = [];

    // 3. Ejecutar el refresco de la API externa para cada ejecutivo
    // Se utiliza 'cache: no-store' para forzar a Render a procesar la solicitud.
    for (const ejecutivo of ejecutivos) {
      const externalApiUrl = new URL("https://api-distribucion-rutas.onrender.com/predecir_ejecutivo");
      externalApiUrl.searchParams.append("ejecutivo", ejecutivo);
      externalApiUrl.searchParams.append("dias", "7"); // Refresco preventivo para la semana

      try {
        const response = await fetch(externalApiUrl.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'X-API-Key': token
          },
          cache: 'no-store' 
        });

        syncReport.push({
          ejecutivo,
          httpStatus: response.status,
          success: response.ok
        });
      } catch (err: any) {
        syncReport.push({ ejecutivo, error: err.message });
      }
    }

    // 4. Guardar registro de la tarea en la colección de logs del sistema
    await db.collection('system_logs').add({
      type: 'CRON_SYNC_PREDICTIONS',
      executedAt: new Date(),
      total_processed: ejecutivos.length,
      results: syncReport,
      invokedBy: authHeader ? 'Remote Cron Job' : 'Direct Call'
    });

    return NextResponse.json({ 
      success: true, 
      processed: ejecutivos.length,
      report: syncReport 
    });

  } catch (error: any) {
    console.error("Error crítico en Cron Job:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
