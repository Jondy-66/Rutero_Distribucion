/**
 * @fileoverview Esta es una ruta de API de Next.js que actúa como un proxy
 * para el servicio de predicciones externo.
 * Soluciona problemas de CORS al hacer la llamada a la API desde el servidor en lugar del cliente.
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const ejecutivo = searchParams.get('ejecutivo');
    const fecha_inicio = searchParams.get('fecha_inicio');
    const dias = searchParams.get('dias');
    const lat_base = searchParams.get('lat_base');
    const lon_base = searchParams.get('lon_base');
    const max_km = searchParams.get('max_km');
    const token = process.env.API_PREDICCION_TOKEN; // Leer el token desde las variables de entorno del servidor

    if (!token) {
      console.error("Proxy API route error: API_PREDICCION_TOKEN is not set in .env.local");
      return NextResponse.json(
          { message: 'Error de configuración del servidor: El token de la API no está configurado.' }, 
          { status: 500 }
      );
    }

    const externalApiUrl = new URL("https://api-distribucion-rutas.onrender.com/predecir_ejecutivo");
    if (ejecutivo) externalApiUrl.searchParams.append("ejecutivo", ejecutivo);
    if (fecha_inicio) externalApiUrl.searchParams.append("fecha_inicio", fecha_inicio);
    if (dias) externalApiUrl.searchParams.append("dias", String(dias));
    if (lat_base) externalApiUrl.searchParams.append("lat_base", lat_base);
    if (lon_base) externalApiUrl.searchParams.append("lon_base", lon_base);
    if (max_km) externalApiUrl.searchParams.append("max_km", max_km);

    const headers: HeadersInit = {
        'Accept': 'application/json',
        'X-API-Key': token
    };

    const response = await fetch(externalApiUrl.toString(), {
      headers,
    });

    if (!response.ok) {
      // Si la API externa devuelve un error, lo pasamos al cliente.
      const errorData = await response.text();
      return NextResponse.json(
        { message: `Error from external API: ${response.statusText}`, details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    // Si hay un error en la propia petición (ej. de red), lo manejamos aquí.
    console.error("Proxy API route error:", error);
    return NextResponse.json(
        { message: 'Error fetching data from external API', error: error.message }, 
        { status: 500 }
    );
  }
}
