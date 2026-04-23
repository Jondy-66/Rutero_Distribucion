'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import type { ActiveLocation, Zone, Breadcrumb } from '@/lib/types';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';
import { getRecentHistory, saveZone } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/button';
import { LoaderCircle } from 'lucide-react';

// Iconos personalizados de alta visibilidad
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
 * Componente interno para controlar la vista del mapa sin reinicializar el contenedor.
 * Esto evita el error "Map container is already initialized".
 */
function MapViewController({ center }: { center: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (center) {
            map.flyTo(center, 13, { duration: 1.5 });
        }
    }, [center, map]);
    return null;
}

/**
 * Activa las herramientas de dibujo Geoman.
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
        if (map.pm) {
            map.pm.removeControls();
            map.off('pm:create');
        }
    };
  }, [map, onZoneCreated]);
  return null;
}

/**
 * Maneja el movimiento suave de los marcadores.
 */
function SmoothMarker({ location }: { location: ActiveLocation }) {
    const [pos, setPos] = useState<[number, number]>([location.lat, location.lng]);
    const target = useRef<[number, number]>([location.lat, location.lng]);
    const animationFrame = useRef<number>(undefined);

    useEffect(() => {
        target.current = [location.lat, location.lng];
        const animate = () => {
            setPos(prev => {
                const nextLat = prev[0] + (target.current[0] - prev[0]) * 0.1;
                const nextLng = prev[1] + (target.current[1] - prev[1]) * 0.1;
                return [nextLat, nextLng];
            });
            animationFrame.current = requestAnimationFrame(animate);
        };
        animationFrame.current = requestAnimationFrame(animate);
        return () => { if(animationFrame.current) cancelAnimationFrame(animationFrame.current); };
    }, [location.lat, location.lng]);

    return (
        <Marker position={pos} icon={location.is_out_of_route ? redIcon : blueIcon}>
            <Popup>
                <div className="font-black uppercase text-[10px] text-slate-950">
                    <p className="font-black text-xs text-primary">{location.userName}</p>
                    {location.is_out_of_route && <p className="text-red-600 mt-1 font-black">ALERTA: FUERA DE RUTA</p>}
                    <p className="text-slate-500 mt-0.5">Precisión: {location.accuracy?.toFixed(1)}m</p>
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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const unsubLocs = onSnapshot(collection(db, 'active_locations'), (snap) => {
        setActiveLocations(snap.docs.map(d => d.data() as ActiveLocation));
    });
    const unsubZones = onSnapshot(collection(db, 'zones'), (snap) => {
        setZones(snap.docs.map(d => ({ id: d.id, ...d.data() } as Zone)));
    });
    return () => { unsubLocs(); unsubZones(); };
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

  if (!isMounted) return <div className="h-[75vh] bg-slate-50 rounded-[2.5rem] animate-pulse" />;

  return (
    <div className="flex flex-col h-[75vh] gap-4">
        <div className="flex gap-2 shrink-0 overflow-x-auto pb-2">
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
                <div className="text-[10px] font-black uppercase text-slate-400 p-2 italic">Esperando señal GPS...</div>
            )}
        </div>

        <div className="flex-1 rounded-[2.5rem] overflow-hidden border-4 border-slate-100 shadow-2xl relative bg-slate-50">
            <MapContainer 
                center={[-1.8312, -78.1834]} 
                zoom={7} 
                scrollWheelZoom={true}
                className="h-full w-full"
            >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapViewController center={mapCenter} />
                {activeLocations.map(loc => <SmoothMarker key={loc.userId} location={loc} />)}
                {zones.map(zone => {
                    try {
                        const positions = zone.geoJson.geometry.coordinates[0].map((c: any) => [c[1], c[0]]);
                        return <Polygon key={zone.id} positions={positions} pathOptions={{ color: 'purple', fillOpacity: 0.2, weight: 2 }} />;
                    } catch(e) { return null; }
                })}
                {historyPath.length > 1 && <Polyline positions={historyPath} pathOptions={{ color: 'blue', weight: 4, dashArray: '8, 12', opacity: 0.7 }} />}
                <GeomanControl onZoneCreated={handleZoneCreated} />
            </MapContainer>
        </div>
    </div>
  );
}
