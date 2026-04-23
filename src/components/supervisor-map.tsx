'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import type { ActiveLocation, Zone, Breadcrumb } from '@/lib/types';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';
import { getRecentHistory, saveZone } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/button';
import { LoaderCircle } from 'lucide-react';

// Iconos de alta visibilidad para supervisión
const blueIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

/**
 * Controla el movimiento de la cámara de forma segura mediante el hook useMap.
 */
function MapViewController({ center }: { center: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 13, { animate: true, duration: 1.5 });
        }
    }, [center, map]);
    return null;
}

/**
 * Capa de herramientas de dibujo Geoman.
 */
function GeomanControl({ onZoneCreated }: { onZoneCreated: (json: any) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !map.pm) return;
    map.pm.addControls({
      position: 'topleft',
      drawCircle: false,
      drawMarker: false,
      drawPolyline: false,
      drawRectangle: true,
      drawPolygon: true,
      editMode: true,
      dragMode: true,
      removalMode: true,
    });
    map.on('pm:create', (e: any) => {
      const json = e.layer.toGeoJSON();
      onZoneCreated(json);
    });
    return () => { 
        if (map?.pm) {
            map.pm.removeControls();
            map.off('pm:create');
        }
    };
  }, [map, onZoneCreated]);
  return null;
}

/**
 * Marcador con interpolación de movimiento para suavidad.
 */
function SmoothMarker({ location }: { location: ActiveLocation }) {
    const [pos, setPos] = useState<[number, number]>([location.lat, location.lng]);
    
    useEffect(() => {
        setPos([location.lat, location.lng]);
    }, [location.lat, location.lng]);

    return (
        <Marker position={pos} icon={location.is_out_of_route ? redIcon : blueIcon}>
            <Popup>
                <div className="font-black uppercase text-[10px] text-slate-950">
                    <p className="font-black text-xs text-primary">{location.userName}</p>
                    {location.is_out_of_route && <p className="text-red-600 mt-1 font-black">ALERTA: FUERA DE RUTA</p>}
                    <p className="text-slate-500 mt-0.5 font-bold">Precisión: {location.accuracy?.toFixed(1)}m</p>
                </div>
            </Popup>
        </Marker>
    );
}

export function SupervisorMap() {
  const [activeLocations, setActiveLocations] = useState<ActiveLocation[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [history, setHistory] = useState<Breadcrumb[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  
  // SOLUCIÓN DEFINITIVA: Generar la clave de instancia solo una vez por montaje
  const instanceKey = useRef(`map-${Math.random().toString(36).substr(2, 9)}`);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    const unsubLocs = onSnapshot(collection(db, 'active_locations'), (snap) => {
        setActiveLocations(snap.docs.map(d => d.data() as ActiveLocation));
    });
    const unsubZones = onSnapshot(collection(db, 'zones'), (snap) => {
        setZones(snap.docs.map(d => ({ id: d.id, ...d.data() } as Zone)));
    });
    
    return () => { 
        unsubLocs(); 
        unsubZones();
    };
  }, []);

  const fetchUserHistory = async (userId: string) => {
    setSelectedUserId(userId);
    setIsHistoryLoading(true);
    try {
        const data = await getRecentHistory(userId);
        setHistory(data);
    } catch (e) {
        console.error(e);
    } finally {
        setIsHistoryLoading(false);
    }
  };

  const handleZoneCreated = async (geoJson: any) => {
      if (!selectedUserId) return;
      await saveZone({
          userId: selectedUserId,
          name: `Zona Segura - ${selectedUserId}`,
          geoJson
      });
  };

  const historyPath = useMemo(() => history.map(p => [p.lat, p.lng] as [number, number]), [history]);
  const mapCenter = useMemo(() => {
      if (selectedUserId) {
          const loc = activeLocations.find(l => l.userId === selectedUserId);
          if (loc) return [loc.lat, loc.lng] as [number, number];
      }
      return null;
  }, [selectedUserId, activeLocations]);

  if (!ready) return <div className="h-[78vh] w-full bg-slate-50 flex items-center justify-center rounded-[2.5rem] border-4 border-slate-100 shadow-inner"><LoaderCircle className="animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col h-[78vh] gap-4">
        <div className="flex gap-2 shrink-0 overflow-x-auto pb-2 scrollbar-hide">
            {activeLocations.length > 0 ? (
                activeLocations.map(loc => (
                    <Button 
                        key={loc.userId} 
                        variant={selectedUserId === loc.userId ? "default" : "outline"}
                        className="font-black uppercase text-[10px] h-10 border-2 shrink-0 rounded-xl text-slate-950"
                        onClick={() => fetchUserHistory(loc.userId)}
                    >
                        {loc.userName}
                        {isHistoryLoading && selectedUserId === loc.userId && <LoaderCircle className="ml-2 h-3 w-3 animate-spin" />}
                    </Button>
                ))
            ) : (
                <div className="text-[10px] font-black uppercase text-slate-400 p-2 italic">Esperando señal GPS activa...</div>
            )}
        </div>

        <div className="flex-1 rounded-[2.5rem] overflow-hidden border-4 border-slate-100 shadow-2xl relative bg-slate-50">
            <MapContainer 
                key={instanceKey.current}
                center={[-1.8312, -78.1834]} 
                zoom={7} 
                scrollWheelZoom={true}
                className="h-full w-full"
            >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapViewController center={mapCenter} />
                
                {activeLocations.map(loc => (
                    <SmoothMarker key={loc.userId} location={loc} />
                ))}

                {zones.map(zone => {
                    try {
                        const positions = zone.geoJson.geometry.coordinates[0].map((c: any) => [c[1], c[0]]);
                        return <Polygon key={zone.id} positions={positions} pathOptions={{ color: 'purple', fillOpacity: 0.1, weight: 2, dashArray: '5, 5' }} />;
                    } catch(e) { return null; }
                })}

                {historyPath.length > 1 && (
                    <Polyline positions={historyPath} pathOptions={{ color: '#011688', weight: 4, dashArray: '1, 10', lineCap: 'round', opacity: 0.8 }} />
                )}

                <GeomanControl onZoneCreated={handleZoneCreated} />
            </MapContainer>
        </div>
    </div>
  );
}