'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Client } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import { Button } from './ui/button';
import { MapPin, Navigation, ExternalLink, LoaderCircle } from 'lucide-react';

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (center && isFinite(center[0]) && isFinite(center[1])) {
      map.flyTo(center, zoom, { animate: true, duration: 1.5 });
    }
  }, [center, zoom, map]);
  return null;
}

export function OpenMapView({ clients }: { clients: Client[] }) {
  const [isMounted, setIsMounted] = useState(false);
  const defaultCenter: [number, number] = [-1.8312, -78.1834]; // Ecuador
  const [viewState, setViewState] = useState({ center: defaultCenter, zoom: 7 });

  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);

  useEffect(() => {
    if (clients && clients.length > 0) {
      const validClient = clients.find(c => isFinite(c.latitud) && isFinite(c.longitud));
      if (validClient) {
        setViewState({ center: [validClient.latitud, validClient.longitud], zoom: 13 });
      }
    }
  }, [clients]);

  const pharmacyIcon = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return L.divIcon({
      className: 'custom-pharmacy-icon',
      html: `<div style="background-color: #011688; border: 2px solid white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 8px rgba(0,0,0,0.4);">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  }, []);

  if (!isMounted || typeof window === 'undefined') {
    return (
      <div className="h-full w-full bg-slate-50 flex items-center justify-center rounded-[2rem]">
        <LoaderCircle className="animate-spin text-primary h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="h-full w-full relative z-0">
      <MapContainer 
        key="open-map-view-stable-container"
        center={viewState.center} 
        zoom={viewState.zoom} 
        style={{ height: '100%', width: '100%' }} 
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController center={viewState.center} zoom={viewState.zoom} />
        {clients.map((client) => (
          isFinite(client.latitud) && isFinite(client.longitud) && (
            <Marker key={client.id} position={[client.latitud, client.longitud]} icon={pharmacyIcon || undefined}>
              <Popup className="custom-leaflet-popup">
                <div className="p-2 flex flex-col gap-3 min-w-[220px]">
                  <div className="space-y-1">
                    <h3 className="font-black text-xs uppercase text-primary leading-tight m-0">{client.nombre_comercial}</h3>
                    <p className="text-[10px] font-bold text-slate-600 uppercase leading-tight m-0">{client.nombre_cliente}</p>
                    <p className="text-[9px] font-mono text-slate-400 font-bold uppercase mt-1 m-0">RUC: {client.ruc}</p>
                  </div>
                  
                  <div className="flex items-start gap-1.5 mt-1 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-slate-600 font-black uppercase leading-tight m-0 line-clamp-2">{client.direccion || 'Sin dirección'}</p>
                  </div>

                  <Button 
                    size="sm" 
                    className="mt-1 h-9 font-black uppercase text-[10px] w-full rounded-xl shadow-lg flex items-center justify-center gap-2 bg-primary text-white"
                    onClick={() => {
                      const url = `https://www.google.com/maps/dir/?api=1&destination=${client.latitud},${client.longitud}`;
                      window.open(url, '_blank');
                    }}
                  >
                    <Navigation className="h-3.5 w-3.5" />
                    Iniciar Ruta
                    <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                  </Button>
                </div>
              </Popup>
            </Marker>
          )
        ))}
      </MapContainer>
    </div>
  );
}