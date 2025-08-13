/**
 * @fileoverview Esta es una ruta de API de Next.js que actúa como un proxy
 * para el servicio de predicciones externo.
 * Soluciona problemas de CORS al hacer la llamada a la API desde el servidor en lugar del cliente.
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha_inicio = searchParams.get('fecha_inicio');
    const dias = searchParams.get('dias');

    const externalApiUrl = new URL("https://api-distribucion-rutas.onrender.com/predecir");
    if (fecha_inicio) externalApiUrl.searchParams.append("fecha_inicio", fecha_inicio);
    if (dias) externalApiUrl.searchParams.append("dias", String(dias));

    const response = await fetch(externalApiUrl.toString(), {
      headers: {
        'Accept': 'application/json',
      },
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
