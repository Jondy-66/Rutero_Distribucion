
/**
 * @fileoverview Proxy para la API de ruta óptima.
 * Pasa las solicitudes del cliente al servicio externo para evitar problemas de CORS.
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const origen = searchParams.get('origen');
    const api_key = searchParams.get('api_key');
    const waypoints = searchParams.getAll('waypoints');

    const externalApiUrl = new URL("https://api-distribucion-rutas.onrender.com/ruta_optima");
    if (origen) externalApiUrl.searchParams.append("origen", origen);
    if (api_key) externalApiUrl.searchParams.append("api_key", api_key);
    if (waypoints && waypoints.length > 0) {
        waypoints.forEach(wp => externalApiUrl.searchParams.append("waypoints", wp));
    }

    const response = await fetch(externalApiUrl.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.text();
      return NextResponse.json(
        { message: `Error from external API: ${response.statusText}`, details: errorData },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Proxy API route error:", error);
    return NextResponse.json(
        { message: 'Error fetching data from external API', error: error.message }, 
        { status: 500 }
    );
  }
}

