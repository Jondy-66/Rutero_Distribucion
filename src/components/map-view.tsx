
'use client';

import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import type { Client } from '@/lib/types';
import { Card } from './ui/card';
import { useState, useEffect } from 'react';

type MapViewProps = {
    clients?: Client[];
    center?: { lat: number; lng: number };
    markerPosition?: { lat: number; lng: number } | null;
    containerClassName?: string;
};


export function MapView({ 
    clients, 
    center, 
    markerPosition,
    containerClassName
}: MapViewProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const defaultPosition = { lat: -1.8312, lng: -78.1834 }; // Centered on Ecuador
  const [currentCenter, setCurrentCenter] = useState(center || defaultPosition);

  useEffect(() => {
    if (center) {
      setCurrentCenter(center);
    }
  }, [center]);

  if (!apiKey) {
    return (
      <Card className="h-full w-full flex items-center justify-center bg-muted">
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
      <div className={containerClassName || "h-[600px] w-full"}>
        <Map
          key={JSON.stringify(currentCenter)} // Force re-render when center changes
          defaultCenter={currentCenter}
          defaultZoom={markerPosition ? 15 : 7}
          mapId="e9a3b4c1a2b3c4d5"
          gestureHandling={'greedy'}
          disableDefaultUI={true}
        >
          {clients && clients.map((client) => (
            <AdvancedMarker
              key={client.id}
              position={{ lat: client.latitud, lng: client.longitud }}
              title={client.nombre_comercial}
            />
          ))}
          {markerPosition && (
              <AdvancedMarker position={markerPosition} />
          )}
        </Map>
      </div>
    </APIProvider>
  );
}
