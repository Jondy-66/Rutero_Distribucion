
'use client';

import { APIProvider, Map, AdvancedMarker, useMap, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import type { Client } from '@/lib/types';
import { Card } from './ui/card';
import { useState, useEffect } from 'react';
import { isFinite } from 'lodash';
import { Button } from './ui/button';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';

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
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

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
          defaultZoom={markerPosition ? 15 : validClients.length > 0 ? 8 : 7}
          mapId="e9a3b4c1a2b3c4d5"
          gestureHandling={'greedy'}
          disableDefaultUI={true}
        >
          {validClients.map((client, index) => (
            <AdvancedMarker
              key={client.id}
              position={{ lat: client.latitud, lng: client.longitud }}
              title={client.nombre_comercial}
              onClick={() => setSelectedClient(client)}
            >
                <Pin background={selectedClient?.id === client.id ? '#011688' : '#81af11'} borderColor={'#fff'} glyphColor={'#fff'}>
                    <span className="font-black text-white text-[10px]">{index + 1}</span>
                </Pin>
            </AdvancedMarker>
          ))}
          {markerPosition && (
              <AdvancedMarker position={markerPosition} />
          )}
          {showDirections && validClients.length > 1 && (
            <DirectionsRenderer clients={validClients} />
          )}

          {selectedClient && (
              <InfoWindow
                position={{ lat: selectedClient.latitud, lng: selectedClient.longitud }}
                onCloseClick={() => setSelectedClient(null)}
              >
                  <div className="p-3 flex flex-col gap-2 min-w-[220px] max-w-[280px]">
                      <div className="space-y-0.5">
                        <h3 className="font-black text-xs uppercase text-primary leading-tight">{selectedClient.nombre_comercial}</h3>
                        <p className="text-[10px] font-bold text-slate-600 uppercase leading-tight">{selectedClient.nombre_cliente}</p>
                        <p className="text-[9px] font-mono text-slate-400 font-bold uppercase mt-1">RUC: {selectedClient.ruc}</p>
                      </div>
                      
                      <div className="flex items-start gap-1.5 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <MapPin className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                        <p className="text-[10px] text-slate-600 font-black uppercase leading-tight">{selectedClient.direccion || 'Sin dirección registrada'}</p>
                      </div>

                      <Button 
                        size="sm" 
                        className="mt-2 h-10 font-black uppercase text-[10px] w-full rounded-xl shadow-lg flex items-center justify-center gap-2"
                        onClick={() => {
                          const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedClient.latitud},${selectedClient.longitud}`;
                          window.open(url, '_blank');
                        }}
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        Iniciar Navegación
                        <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                      </Button>
                  </div>
              </InfoWindow>
          )}
        </Map>
      </div>
    </APIProvider>
  );
}
