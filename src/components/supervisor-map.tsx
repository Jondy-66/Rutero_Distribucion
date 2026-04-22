
'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';
import type { ActiveLocation, Zone, Breadcrumb, User } from '@/lib/types';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { getRecentHistory, saveZone, deleteZone } from '@/lib/firebase/firestore';

// Iconos personalizados
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
 * Componente para activar Geoman en el mapa.
 */
function GeomanControl({ onZoneCreated }: { onZoneCreated: (json: any) => void }) {
  const map = useMap();

  useEffect(() => {
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

    map.on('pm:create', (e) => {
      const json = e.layer.toGeoJSON();
      onZoneCreated(json);
    });

    return () => { map.pm.removeControls(); };
  }, [map, onZoneCreated]);

  return null;
}

/**
 * Componente que maneja la Interpolación Suave (LERP) para un marcador.
 */
function SmoothMarker({ location }: { location: ActiveLocation }) {
    const [pos, setPos] = useState<[number, number]>([location.lat, location.lng]);
    const target = useRef<[number, number]>([location.lat, location.lng]);
    const animationFrame = useRef<number>();

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
                <div className="font-black uppercase text-xs">
                    {location.userName}
                    {location.is_out_of_route && <p className="text-red-600 mt-1">¡FUERA DE RUTA!</p>}
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

  useEffect(() => {
    // Escuchar posiciones en vivo
    const unsubscribeLocations = onSnapshot(collection(db, 'active_locations'), (snap) => {
        setActiveLocations(snap.docs.map(d => d.data() as ActiveLocation));
    });

    // Escuchar zonas
    const unsubscribeZones = onSnapshot(collection(db, 'zones'), (snap) => {
        setZones(snap.docs.map(d => ({ id: d.id, ...d.data() } as Zone)));
    });

    return () => {
        unsubscribeLocations();
        unsubscribeZones();
    };
  }, []);

  const fetchUserHistory = async (userId: string) => {
    setSelectedUserId(userId);
    const data = await getRecentHistory(userId);
    setHistory(data);
  };

  const handleZoneCreated = async (geoJson: any) => {
      if (!selectedUserId) return alert("Selecciona un usuario primero");
      await saveZone({
          userId: selectedUserId,
          name: `Zona para ${selectedUserId}`,
          geoJson
      });
  };

  const historyPath = useMemo(() => history.map(p => [p.lat, p.lng] as [number, number]), [history]);

  return (
    <div className="flex flex-col h-[70vh] gap-4">
        <div className="flex gap-2 shrink-0 overflow-x-auto pb-2">
            {activeLocations.map(loc => (
                <Button 
                    key={loc.userId} 
                    variant={selectedUserId === loc.userId ? "default" : "outline"}
                    className="font-black uppercase text-[10px]"
                    onClick={() => fetchUserHistory(loc.userId)}
                >
                    {loc.userName}
                </Button>
            ))}
        </div>

        <div className="flex-1 rounded-2xl overflow-hidden border-4 border-slate-100 shadow-2xl">
            <MapContainer center={[-1.8312, -78.1834]} zoom={7} scrollWheelZoom={true}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                
                {activeLocations.map(loc => (
                    <SmoothMarker key={loc.userId} location={loc} />
                ))}

                {zones.map(zone => (
                    <Polygon 
                        key={zone.id} 
                        positions={zone.geoJson.geometry.coordinates[0].map((c: any) => [c[1], c[0]])} 
                        pathOptions={{ color: 'purple', fillOpacity: 0.2 }}
                    />
                ))}

                {historyPath.length > 1 && (
                    <Polyline positions={historyPath} pathOptions={{ color: 'blue', weight: 3, dashArray: '5, 10' }} />
                )}

                <GeomanControl onZoneCreated={handleZoneCreated} />
            </MapContainer>
        </div>
    </div>
  );
}
