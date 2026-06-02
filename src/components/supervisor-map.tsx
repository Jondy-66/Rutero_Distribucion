'use client';

import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { ActiveLocation, Zone, Breadcrumb } from '@/lib/types';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';
import { getRecentHistory, saveZone } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/button';
import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

// Solo importar Geoman si estamos en el cliente
if (typeof window !== 'undefined') {
    require('@geoman-io/leaflet-geoman-free');
}

// Iconos de alta visibilidad para supervisión
const blueIcon = typeof window !== 'undefined' ? new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
}) : null;

const redIcon = typeof window !== 'undefined' ? new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
}) : null;

function MapViewController({ center }: { center: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (center && isFinite(center[0]) && isFinite(center[1])) {
            map.flyTo(center, 13, { animate: true, duration: 1.5 });
        }
    }, [center, map]);
    return null;
}

function GeomanControl({ onZoneCreated }: { onZoneCreated: (json: any) => void }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !(map as any).pm) return;
    const m = map as any;
    m.pm.addControls({
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
        if (m.pm) {
            m.pm.removeControls();
            map.off('pm:create');
        }
    };
  }, [map, onZoneCreated]);
  return null;
}

function SmoothMarker({ location }: { location: ActiveLocation }) {
    if (!isFinite(location.lat) || !isFinite(location.lng)) return null;
    return (
        <Marker position={[location.lat, location.lng]} icon={(location.is_out_of_route ? redIcon : blueIcon) || undefined}>
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
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);

    const unsubLocs = onSnapshot(collection(db, 'active_locations'), (snap) => {
        const locs = snap.docs.map(d => ({
            ...d.data(),
            userId: d.id
        } as ActiveLocation)).filter(l => isFinite(l.lat) && isFinite(l.lng));
        setActiveLocations(locs);
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
        setHistory(data.filter(p => isFinite(p.lat) && isFinite(p.lng)));
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
          if (loc && isFinite(loc.lat) && isFinite(loc.lng)) return [loc.lat, loc.lng] as [number, number];
      }
      return null;
  }, [selectedUserId, activeLocations]);

  if (!isMounted) {
    return (
        <div className="h-full w-full bg-slate-50 flex items-center justify-center rounded-[2.5rem] border-4 border-slate-100">
            <LoaderCircle className="animate-spin text-primary h-10 w-10" />
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
        <div className="flex gap-2 shrink-0 overflow-x-auto pb-2 scrollbar-hide">
            {activeLocations.length > 0 ? (
                activeLocations.map(loc => (
                    <Button 
                        key={loc.userId} 
                        variant={selectedUserId === loc.userId ? "default" : "outline"}
                        className={cn(
                            "font-black uppercase text-[9px] h-9 border-2 shrink-0 rounded-xl text-slate-950 px-4",
                            selectedUserId === loc.userId ? "bg-primary text-white" : "bg-white"
                        )}
                        onClick={() => fetchUserHistory(loc.userId)}
                    >
                        {loc.userName || 'Usuario'}
                        {isHistoryLoading && selectedUserId === loc.userId && <LoaderCircle className="ml-2 h-3 w-3 animate-spin" />}
                    </Button>
                ))
            ) : (
                <div className="text-[10px] font-black uppercase text-slate-400 p-2 italic">Esperando señales...</div>
            )}
        </div>

        <div className="flex-1 rounded-[1.5rem] lg:rounded-[2.5rem] overflow-hidden border-2 lg:border-4 border-slate-100 shadow-2xl relative bg-slate-50">
            <MapContainer 
                center={[-1.8312, -78.1834]} 
                zoom={7} 
                scrollWheelZoom={true}
                className="h-full w-full"
                style={{ height: '100%', width: '100%' }}
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
                    <Polyline positions={historyPath} pathOptions={{ color: '#011688', weight: 4, opacity: 0.8 }} />
                )}

                <GeomanControl onZoneCreated={handleZoneCreated} />
            </MapContainer>
        </div>
    </div>
  );
}
