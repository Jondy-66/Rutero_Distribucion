
'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, MapPin, Activity, Signal, SignalLow, SignalHigh, Users, Clock, WifiOff, RefreshCcw, CheckCircle2, XCircle, MapPinOff, Satellite } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';
import type { ActiveLocation, User } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

const SupervisorMap = dynamic(() => import('@/components/supervisor-map').then(m => m.SupervisorMap), {
    ssr: false,
    loading: () => <Skeleton className="h-[50vh] lg:h-[70vh] w-full rounded-2xl" />
});

export default function TrackingPage() {
    const { user, users: allSystemUsers, loading: authLoading } = useAuth();
    const [activeLocations, setActiveLocations] = useState<ActiveLocation[]>([]);
    const [lastSync, setLastSync] = useState<Date | null>(null);

    useEffect(() => {
        setLastSync(new Date());
        // Listener real-time reforzado para estado real de señales
        const unsub = onSnapshot(collection(db, 'active_locations'), (snap) => {
            const locs = snap.docs.map(d => ({
                ...d.data(),
                userId: d.id
            } as ActiveLocation));
            setActiveLocations(locs);
            setLastSync(new Date());
        }, (err) => {
            console.error("Error listening to locations:", err);
        });
        return () => unsub();
    }, []);

    const gpsStatusData = useMemo(() => {
        if (!allSystemUsers) return [];
        
        const trackableUsers = allSystemUsers.filter(u => u.role !== 'Administrador');
        const now = Date.now();
        const offlineThreshold = 12 * 60 * 1000; 

        return trackableUsers.map(u => {
            const location = activeLocations.find(l => l.userId === u.id);
            
            let lastSignalDate: Date | null = null;
            if (location?.timestamp) {
                if (location.timestamp instanceof Date) {
                    lastSignalDate = location.timestamp;
                } else if ((location.timestamp as any).toDate) {
                    lastSignalDate = (location.timestamp as any).toDate();
                } else if (typeof location.timestamp === 'number') {
                    lastSignalDate = new Date(location.timestamp);
                } else if (location.timestamp && (location.timestamp as any).seconds) {
                    lastSignalDate = new Date((location.timestamp as any).seconds * 1000);
                }
            }
            
            const isOnline = lastSignalDate && isValid(lastSignalDate) && (now - lastSignalDate.getTime()) < offlineThreshold;
            const hasGpsPermission = location?.gpsEnabled !== false;
            
            return {
                user: u,
                lastSignal: lastSignalDate,
                isOnline: !!isOnline,
                hasGpsPermission,
                accuracy: location?.accuracy || 0,
                lat: location?.lat,
                lng: location?.lng,
                address: location?.address_text || 'Sin dirección reportada...',
                isOutOfRoute: location?.is_out_of_route || false
            };
        }).sort((a, b) => {
            if (a.isOnline === b.isOnline) {
                return a.user.name.localeCompare(b.user.name);
            }
            return a.isOnline ? -1 : 1;
        });
    }, [allSystemUsers, activeLocations]);

    if (user?.role !== 'Administrador' && user?.role !== 'Supervisor' && user?.role !== 'Auditor') {
        return <PageHeader title="Acceso Denegado" description="Módulo exclusivo para supervisión." />;
    }

    const onlineCount = gpsStatusData.filter(d => d.isOnline).length;
    const permissionDeniedCount = gpsStatusData.filter(d => !d.hasGpsPermission).length;

    return (
        <div className="space-y-6 max-w-full overflow-hidden">
            <PageHeader 
                title="Supervisión Logística" 
                description="Monitoreo GPS, Geocercas y Disponibilidad de Equipo."
            >
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                    <RefreshCcw className="h-3 w-3 text-slate-400 animate-spin" />
                    <span className="text-[10px] font-black text-slate-500 uppercase">
                        Sincronizado: {lastSync && isValid(lastSync) ? format(lastSync, 'HH:mm:ss') : '--:--:--'}
                    </span>
                </div>
            </PageHeader>

            <Tabs defaultValue="map" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md h-12 bg-slate-100 p-1 rounded-2xl border-2 border-slate-200">
                    <TabsTrigger value="map" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                        <MapPin className="mr-2 h-3.5 w-3.5" /> Mapa de Monitoreo
                    </TabsTrigger>
                    <TabsTrigger value="status" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                        <Signal className="mr-2 h-3.5 w-3.5" /> Estado de Señal GPS
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="map" className="mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <Card className="lg:col-span-1 shadow-lg border-t-4 border-t-primary order-2 lg:order-1">
                            <CardHeader>
                                <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                                    <ShieldCheck className="h-4 w-4 text-primary" />
                                    Resumen Activo
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 bg-green-50 rounded-2xl border-2 border-green-100 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-black uppercase text-green-800">Señales Activas</p>
                                        <p className="text-2xl font-black text-green-900">{onlineCount}</p>
                                    </div>
                                    <SignalHigh className="h-8 w-8 text-green-600 opacity-30" />
                                </div>
                                {permissionDeniedCount > 0 && (
                                    <div className="p-4 bg-orange-50 rounded-2xl border-2 border-orange-100 flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] font-black uppercase text-orange-800">GPS Bloqueados</p>
                                            <p className="text-2xl font-black text-orange-900">{permissionDeniedCount}</p>
                                        </div>
                                        <MapPinOff className="h-8 w-8 text-orange-600 opacity-30" />
                                    </div>
                                )}
                                <div className="p-3 bg-blue-50 rounded-xl border-2 border-blue-100">
                                    <div className="flex items-center gap-2">
                                        <Activity className="h-3 w-3 text-blue-600" />
                                        <span className="text-[10px] font-black uppercase text-blue-800">Heartbeat Real-Time</span>
                                    </div>
                                    <p className="text-[9px] text-blue-600 font-bold uppercase mt-1 leading-tight italic">
                                        FRECUENCIA DE REPORTE: CADA 2 MINUTOS. MONITOREO DE PERMISOS ACTIVO.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-3 shadow-2xl overflow-hidden order-1 lg:order-2">
                            <CardHeader className="bg-slate-50 border-b p-4 flex flex-row items-center justify-between">
                                <CardTitle className="text-xs font-black uppercase flex items-center gap-2 text-slate-950">
                                    <MapPin className="h-4 w-4 text-primary" />
                                    Mapa de Operaciones Nacional
                                </CardTitle>
                                <Badge variant="secondary" className="font-black text-[9px] uppercase px-3">{activeLocations.length} PUNTOS ACTIVOS</Badge>
                            </CardHeader>
                            <CardContent className="p-2 lg:p-4 bg-white">
                                <div className="h-[60vh] lg:h-[75vh]">
                                    <SupervisorMap />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="status" className="mt-6">
                    <Card className="shadow-2xl border-t-4 border-t-primary rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="bg-slate-50 border-b px-8 py-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-xl font-black uppercase text-slate-950 flex items-center gap-2">
                                        <Signal className="h-6 w-6 text-primary" />
                                        Auditoría de Disponibilidad GPS
                                    </CardTitle>
                                    <CardDescription className="text-xs font-bold uppercase text-slate-500 mt-1">Monitoreo de latidos de posición y permisos de toda la fuerza operativa.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-100/50">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="font-black uppercase text-[10px] text-slate-950 h-14 pl-8">Vendedor / Ejecutivo</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] text-slate-950">Estado GPS</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] text-slate-950">Permiso Geofencing</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] text-slate-950">Recibido hace</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] text-slate-950">Precisión</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] text-slate-950 pr-8">Última Dirección</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {gpsStatusData.map((data) => (
                                            <TableRow key={data.user.id} className={cn(
                                                "hover:bg-slate-50/80 transition-colors",
                                                data.isOnline ? "bg-green-50/5" : "opacity-70"
                                            )}>
                                                <TableCell className="pl-8 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "h-10 w-10 rounded-full flex items-center justify-center font-black text-white uppercase text-sm shadow-md",
                                                            data.isOnline ? "bg-primary" : "bg-slate-300"
                                                        )}>
                                                            {data.user.name.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-black text-xs uppercase text-slate-950 truncate">{data.user.name}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase truncate">{data.user.role}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {data.isOnline ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
                                                            <span className="text-[10px] font-black text-green-700 uppercase">EN LÍNEA</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <WifiOff className="h-3.5 w-3.5 text-slate-400" />
                                                            <span className="text-[10px] font-black text-slate-400 uppercase">DESCONECTADO</span>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {data.hasGpsPermission ? (
                                                        <div className="flex items-center gap-1.5 text-blue-600">
                                                            <Satellite className="h-3.5 w-3.5" />
                                                            <span className="text-[10px] font-black uppercase">PERMITIDO</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 text-red-600">
                                                            <MapPinOff className="h-3.5 w-3.5" />
                                                            <span className="text-[10px] font-black uppercase">BLOQUEADO</span>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-[10px] font-black text-slate-600 uppercase">
                                                        {data.lastSignal && isValid(data.lastSignal) ? formatDistanceToNow(data.lastSignal, { addSuffix: false, locale: es }) : 'N/A'}
                                                    </span>
                                                </TableCell>
                                                <TableCell>
                                                    {data.isOnline ? (
                                                        <Badge className={cn(
                                                            "font-black text-[10px] uppercase",
                                                            data.accuracy < 20 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                                                        )}>
                                                            {data.accuracy.toFixed(0)}m
                                                        </Badge>
                                                    ) : '--'}
                                                </TableCell>
                                                <TableCell className="pr-8">
                                                    <p className="text-[10px] font-bold uppercase text-slate-500 truncate max-w-[250px]">
                                                        {data.address}
                                                    </p>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
