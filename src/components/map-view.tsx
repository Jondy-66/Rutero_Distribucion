
'use client';

import { APIProvider, Map, AdvancedMarker, useMap } from '@vis.gl/react-google-maps';
import type { Client } from '@/lib/types';
import { Card } from './ui/card';
import { useState, useEffect } from 'react';
import { isFinite } from 'lodash';

type MapViewProps = {
    clients?: Client[];
    center?: { lat: number; lng: number };
    markerPosition?: { lat: number; lng: number } | null;
    containerClassName?: string;
    showDirections?: boolean;
};


function DirectionsRenderer({ clients }: { clients: Client[] }) {
    const map = useMap();

    useEffect(() => {
        if (!map || !clients || clients.length < 2) return;
        const directionsService = new google.maps.DirectionsService();
        const directionsRenderer = new google.maps.DirectionsRenderer({
            map,
            suppressMarkers: true // We use AdvancedMarker instead
        });
        
        const origin = { lat: clients[0].latitud, lng: clients[0].longitud };
        const destination = { lat: clients[clients.length - 1].latitud, lng: clients[clients.length - 1].longitud };
        const waypoints = clients.slice(1, -1).map(client => ({
            location: { lat: client.latitud, lng: client.longitud },
            stopover: true
        }));

        directionsService.route({
            origin,
            destination,
            waypoints,
            travelMode: google.maps.TravelMode.DRIVING
        }, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                directionsRenderer.setDirections(result);
            } else {
                console.error(`error fetching directions ${result}`);
            }
        });

        return () => {
            directionsRenderer.setMap(null);
        };
    }, [map, clients]);

    return null;
}


export function MapView({ 
    clients, 
    center, 
    markerPosition,
    containerClassName,
    showDirections = false
}: MapViewProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const defaultPosition = { lat: -1.8312, lng: -78.1834 }; // Centered on Ecuador
  const [currentCenter, setCurrentCenter] = useState(center || defaultPosition);

  useEffect(() => {
    if (center) {
      setCurrentCenter(center);
    } else if (clients && clients.length > 0) {
      const firstValidClient = clients.find(c => 
        isFinite(c.latitud) && isFinite(c.longitud)
      );
      if (firstValidClient) {
        setCurrentCenter({ lat: firstValidClient.latitud, lng: firstValidClient.longitud });
      } else {
        setCurrentCenter(defaultPosition);
      }
    }
  }, [center, clients]);

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

  const validClients = clients?.filter(c => isFinite(c.latitud) && isFinite(c.longitud)) || [];

  return (
    <APIProvider apiKey={apiKey}>
      <div className={containerClassName || "h-[600px] w-full"}>
        <Map
          key={JSON.stringify(currentCenter)} // Force re-render when center changes
          defaultCenter={currentCenter}
          defaultZoom={markerPosition ? 15 : validClients.length > 0 ? 7 : 7}
          mapId="e9a3b4c1a2b3c4d5"
          gestureHandling={'greedy'}
          disableDefaultUI={true}
        >
          {validClients.map((client) => (
            <AdvancedMarker
              key={client.id}
              position={{ lat: client.latitud, lng: client.longitud }}
              title={client.nombre_comercial}
            />
          ))}
          {markerPosition && (
              <AdvancedMarker position={markerPosition} />
          )}
          {showDirections && validClients.length > 1 && (
            <DirectionsRenderer clients={validClients} />
          )}
        </Map>
      </div>
    </APIProvider>
  );
}
