
'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, MapPin, Activity, Signal, SignalLow, SignalHigh, Users, Clock, WifiOff, RefreshCcw, CheckCircle2, XCircle, MapPinOff, Satellite, AlertTriangle } from 'lucide-react';
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
        
        const uniqueUsersMap = new Map();
        allSystemUsers.forEach(u => {
            if (u.role !== 'Administrador' && !uniqueUsersMap.has(u.id)) {
                uniqueUsersMap.set(u.id, u);
            }
        });
        const trackableUsers = Array.from(uniqueUsersMap.values());

        const now = Date.now();
        const offlineThreshold = 12 * 60 * 1000; 

        return trackableUsers.map(u => {
            const location = activeLocations.find(l => l.userId === u.id);
            
            let lastSignalDate: Date | null = null;
            if (location?.timestamp) {
                if (location.timestamp instanceof Date) lastSignalDate = location.timestamp;
                else if ((location.timestamp as any).toDate) lastSignalDate = (location.timestamp as any).toDate();
                else if (typeof location.timestamp === 'number') lastSignalDate = new Date(location.timestamp);
                else if (location.timestamp && (location.timestamp as any).seconds) lastSignalDate = new Date((location.timestamp as any).seconds * 1000);
            }
            
            const isOnline = lastSignalDate && isValid(lastSignalDate) && (now - lastSignalDate.getTime()) < offlineThreshold;
            const isDenied = location?.isPermissionDenied === true;
            const isWeak = location?.isSignalWeak === true;
            
            return {
                user: u,
                lastSignal: lastSignalDate,
                isOnline: !!isOnline,
                isDenied,
                isWeak,
                accuracy: location?.accuracy || 0,
                lat: location?.lat,
                lng: location?.lng,
                address: location?.address_text || 'Sin dirección reportada...',
            };
        }).sort((a, b) => {
            if (a.isOnline === b.isOnline) return a.user.name.localeCompare(b.user.name);
            return a.isOnline ? -1 : 1;
        });
    }, [allSystemUsers, activeLocations]);

    if (user?.role !== 'Administrador' && user?.role !== 'Supervisor' && user?.role !== 'Auditor') {
        return <PageHeader title="Acceso Denegado" description="Módulo exclusivo para supervisión." />;
    }

    const onlineCount = gpsStatusData.filter(d => d.isOnline).length;
    const deniedCount = gpsStatusData.filter(d => d.isDenied).length;

    return (
        <div className="space-y-6 max-w-full overflow-hidden">
            <PageHeader title="Supervisión Logística" description="Monitoreo GPS, Geocercas y Disponibilidad.">
                <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                    <RefreshCcw className="h-3 w-3 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-500 uppercase">
                        ACTUALIZADO: {lastSync && isValid(lastSync) ? format(lastSync, 'HH:mm:ss') : '--:--:--'}
                    </span>
                </div>
            </PageHeader>

            <Tabs defaultValue="map" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md h-12 bg-slate-100 p-1 rounded-2xl border-2 border-slate-200">
                    <TabsTrigger value="map" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:text-primary shadow-sm">
                        <MapPin className="mr-2 h-3.5 w-3.5" /> Mapa de Monitoreo
                    </TabsTrigger>
                    <TabsTrigger value="status" className="rounded-xl font-black uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:text-primary shadow-sm">
                        <Signal className="mr-2 h-3.5 w-3.5" /> Estado de Señal GPS
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="map" className="mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <Card className="lg:col-span-1 shadow-lg border-t-4 border-t-primary order-2 lg:order-1">
                            <CardHeader><CardTitle className="text-sm font-black uppercase flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" />Resumen Activo</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 bg-green-50 rounded-2xl border-2 border-green-100 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-black uppercase text-green-800">En Línea</p>
                                        <p className="text-2xl font-black text-green-900">{onlineCount}</p>
                                    </div>
                                    <SignalHigh className="h-8 w-8 text-green-600 opacity-30" />
                                </div>
                                {deniedCount > 0 && (
                                    <div className="p-4 bg-red-50 rounded-2xl border-2 border-red-100 flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <p className="text-[10px] font-black uppercase text-red-800">GPS Bloqueados</p>
                                            <p className="text-2xl font-black text-red-900">{deniedCount}</p>
                                        </div>
                                        <MapPinOff className="h-8 w-8 text-red-600 opacity-30" />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        <Card className="lg:col-span-3 shadow-2xl overflow-hidden order-1 lg:order-2">
                             <div className="h-[60vh] lg:h-[75vh]"><SupervisorMap /></div>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="status" className="mt-6">
                    <Card className="shadow-2xl border-t-4 border-t-primary rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="bg-slate-50 border-b px-8 py-6">
                            <CardTitle className="text-xl font-black uppercase text-slate-950 flex items-center gap-2"><Signal className="h-6 w-6 text-primary" />Auditoría de Disponibilidad GPS</CardTitle>
                            <CardDescription className="text-xs font-bold uppercase text-slate-500 mt-1">Monitoreo de señales activas y estados de permiso.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-100/50">
                                    <TableRow>
                                        <TableHead className="font-black uppercase text-[10px] text-slate-950 h-14 pl-8">Vendedor</TableHead>
                                        <TableHead className="font-black uppercase text-[10px] text-slate-950">Estado Señal</TableHead>
                                        <TableHead className="font-black uppercase text-[10px] text-slate-950">Permiso Geofencing</TableHead>
                                        <TableHead className="font-black uppercase text-[10px] text-slate-950">Último Reporte</TableHead>
                                        <TableHead className="font-black uppercase text-[10px] text-slate-950 pr-8">Ubicación</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {gpsStatusData.map((data) => (
                                        <TableRow key={data.user.id} className={cn("hover:bg-slate-50/80", data.isOnline ? "bg-green-50/5" : "opacity-80")}>
                                            <TableCell className="pl-8 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center font-black text-white uppercase text-sm", data.isOnline ? "bg-primary" : "bg-slate-300")}>{data.user.name.charAt(0)}</div>
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
                                                    <div className="flex items-center gap-2 text-slate-400">
                                                        <WifiOff className="h-3.5 w-3.5" />
                                                        <span className="text-[10px] font-black uppercase">DESCONECTADO</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {data.isDenied ? (
                                                    <div className="flex items-center gap-1.5 text-red-600">
                                                        <MapPinOff className="h-3.5 w-3.5" />
                                                        <span className="text-[10px] font-black uppercase">BLOQUEADO</span>
                                                    </div>
                                                ) : data.isWeak ? (
                                                    <div className="flex items-center gap-1.5 text-orange-600">
                                                        <AlertTriangle className="h-3.5 w-3.5" />
                                                        <span className="text-[10px] font-black uppercase">SEÑAL DÉBIL</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 text-blue-600">
                                                        <Satellite className="h-3.5 w-3.5" />
                                                        <span className="text-[10px] font-black uppercase">PERMITIDO</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-[10px] font-black text-slate-600 uppercase">
                                                {data.lastSignal && isValid(data.lastSignal) ? formatDistanceToNow(data.lastSignal, { addSuffix: false, locale: es }) : 'N/A'}
                                            </TableCell>
                                            <TableCell className="pr-8"><p className="text-[10px] font-bold uppercase text-slate-500 truncate max-w-[200px]">{data.address}</p></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
