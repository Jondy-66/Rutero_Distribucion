'use client';

import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { ActiveLocation, Zone, Breadcrumb } from '@/lib/types';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';
import { getRecentHistory, saveZone } from '@/lib/firebase/firestore';
import { Button } from '@/components/ui/button';
import { LoaderCircle, Navigation, ExternalLink, Satellite, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

// Solo importar Geoman si estamos en el cliente
if (typeof window !== 'undefined') {
    require('@geoman-io/leaflet-geoman-free');
}

// Estilos CSS para marcadores animados
const markerStyles = `
  .user-marker-container {
    position: relative;
    width: 30px;
    height: 30px;
  }
  .user-marker-icon {
    width: 30px;
    height: 30px;
    border-radius: 50% 50% 50% 0;
    background: #011688;
    position: absolute;
    transform: rotate(-45deg);
    left: 50%;
    top: 50%;
    margin: -15px 0 0 -15px;
    border: 3px solid #fff;
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .user-marker-icon::after {
    content: '';
    width: 12px;
    height: 12px;
    background: #fff;
    border-radius: 50%;
  }
  .user-marker-pulse {
    position: absolute;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(129, 175, 17, 0.4);
    left: 50%;
    top: 50%;
    margin: -20px 0 0 -20px;
    animation: marker-pulse 2s infinite;
    z-index: 1;
  }
  .user-marker-pulse.out-of-route {
    background: rgba(225, 29, 72, 0.4);
  }
  .user-marker-icon.out-of-route {
    background: #e11d48;
  }
  @keyframes marker-pulse {
    0% { transform: scale(0.5); opacity: 1; }
    100% { transform: scale(1.5); opacity: 0; }
  }
`;

/**
 * Crea un icono de Leaflet personalizado y estético para los usuarios.
 */
const createUserIcon = (isOutOfRoute: boolean) => {
    return L.divIcon({
        className: 'custom-div-icon',
        html: `
            <div class="user-marker-container">
                <div class="user-marker-pulse ${isOutOfRoute ? 'out-of-route' : ''}"></div>
                <div class="user-marker-icon ${isOutOfRoute ? 'out-of-route' : ''}"></div>
            </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -35]
    });
};

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
    
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;

    return (
        <Marker position={[location.lat, location.lng]} icon={createUserIcon(!!location.is_out_of_route)}>
            <Popup className="custom-popup">
                <div className="p-3 flex flex-col gap-3 min-w-[220px]">
                    <div className="space-y-1">
                        <div className="flex justify-between items-start gap-2">
                            <h3 className="font-black text-sm uppercase text-slate-950 leading-tight truncate">{location.userName}</h3>
                            {location.is_out_of_route && (
                                <span className="bg-red-100 text-red-600 text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse">FUERA RUTA</span>
                            )}
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                            <Satellite className="h-2.5 w-2.5" />
                            Precisión: {location.accuracy?.toFixed(1) || '0'}m
                        </p>
                    </div>
                    
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1.5">
                        <p className="text-[9px] font-black uppercase text-slate-500">Ubicación Actual</p>
                        <p className="text-[10px] font-bold text-slate-600 leading-tight line-clamp-2 italic">
                            {location.address_text || 'Dirección no reportada...'}
                        </p>
                    </div>

                    <Button 
                        size="sm" 
                        className="h-10 w-full bg-slate-950 hover:bg-slate-900 text-white font-black uppercase text-[10px] rounded-xl shadow-xl flex items-center justify-center gap-2 group transition-all active:scale-95"
                        onClick={() => window.open(googleMapsUrl, '_blank')}
                    >
                        <Navigation className="h-3.5 w-3.5" />
                        Iniciar Navegación
                        <ExternalLink className="h-3 w-3 ml-auto opacity-50 group-hover:opacity-100" />
                    </Button>
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
        <style dangerouslySetInnerHTML={{ __html: markerStyles }} />
        
        <div className="flex gap-2 shrink-0 overflow-x-auto pb-2 scrollbar-hide">
            {activeLocations.length > 0 ? (
                activeLocations.map(loc => (
                    <Button 
                        key={loc.userId} 
                        variant={selectedUserId === loc.userId ? "default" : "outline"}
                        className={cn(
                            "font-black uppercase text-[9px] h-9 border-2 shrink-0 rounded-xl px-4 transition-all",
                            selectedUserId === loc.userId ? "bg-primary text-white border-primary shadow-lg" : "bg-white text-slate-950 border-slate-100"
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