'use client';

import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import type { Client } from '@/lib/types';
import { Card } from './ui/card';

export function MapView({ clients }: { clients: Client[] }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const position = { lat: -1.8312, lng: -78.1834 }; // Centered on Ecuador

  if (!apiKey) {
    return (
      <Card className="h-[600px] w-full flex items-center justify-center bg-muted">
        <div className="text-center">
          <p className="font-semibold">Falta la clave de API de Google Maps.</p>
          <p className="text-sm text-muted-foreground">
            Por favor, añade NEXT_PUBLIC_GOOGLE_MAPS_API_KEY a tu archivo .env.local.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div style={{ height: '600px', width: '100%' }} className="rounded-lg overflow-hidden border shadow-sm">
        <Map
          defaultCenter={position}
          defaultZoom={7}
          mapId="e9a3b4c1a2b3c4d5"
          gestureHandling={'greedy'}
          disableDefaultUI={true}
        >
          {clients.map((client) => (
            <AdvancedMarker
              key={client.id}
              position={{ lat: client.latitud, lng: client.longitud }}
              title={client.nombre_comercial}
            />
          ))}
        </Map>
      </div>
    </APIProvider>
  );
}
