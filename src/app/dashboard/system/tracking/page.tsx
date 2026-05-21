'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, MapPin, Activity, Signal, SignalLow, SignalHigh, Users, Clock, WifiOff } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '@/lib/firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';
import type { ActiveLocation, User } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const SupervisorMap = dynamic(() => import('@/components/supervisor-map').then(m => m.SupervisorMap), {
    ssr: false,
    loading: () => <Skeleton className="h-[50vh] lg:h-[70vh] w-full rounded-2xl" />
});

export default function TrackingPage() {
    const { user, users: allSystemUsers } = useAuth();
    const [activeLocations, setActiveLocations] = useState<ActiveLocation[]>([]);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'active_locations'), (snap) => {
            const locs = snap.docs.map(d => ({
                ...d.data(),
                userId: d.id
            } as ActiveLocation));
            setActiveLocations(locs);
        });
        return () => unsub();
    }, []);

    const gpsStatusData = useMemo(() => {
        // Obtenemos a todos los usuarios menos Administradores para la auditoría
        const trackableUsers = allSystemUsers.filter(u => u.role !== 'Administrador');

        const now = Date.now();
        // Umbral de 8 minutos para considerar Offline (damos margen al heartbeat de 3 min)
        const offlineThreshold = 8 * 60 * 1000; 

        return trackableUsers.map(u => {
            const location = activeLocations.find(l => l.userId === u.id);
            const lastSignalDate = location?.timestamp ? 
                (location.timestamp instanceof Date ? location.timestamp : (location.timestamp as any).toDate()) : 
                null;
            
            const isOnline = lastSignalDate && (now - lastSignalDate.getTime()) < offlineThreshold;
            
            return {
                user: u,
                lastSignal: lastSignalDate,
                isOnline: !!isOnline,
                accuracy: location?.accuracy || 0,
                address: location?.address_text || 'Esperando primer reporte...',
                isOutOfRoute: location?.is_out_of_route || false
            };
        }).sort((a, b) => {
            if (a.isOnline === b.isOnline) return 0;
            return a.isOnline ? -1 : 1;
        });
    }, [allSystemUsers, activeLocations]);

    if (user?.role !== 'Administrador' && user?.role !== 'Supervisor' && user?.role !== 'Auditor') {
        return <PageHeader title="Acceso Denegado" description="Módulo exclusivo para supervisión." />;
    }

    const onlineCount = gpsStatusData.filter(d => d.isOnline).length;

    return (
        <div className="space-y-6 max-w-full overflow-hidden">
            <PageHeader 
                title="Supervisión Logística" 
                description="Monitoreo GPS, Geocercas y Disponibilidad de Equipo."
            />

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
                                <div className="p-3 bg-blue-50 rounded-xl border-2 border-blue-100">
                                    <div className="flex items-center gap-2">
                                        <Activity className="h-3 w-3 text-blue-600" />
                                        <span className="text-[10px] font-black uppercase text-blue-800">Heartbeat Activo</span>
                                    </div>
                                    <p className="text-[9px] text-blue-600 font-bold uppercase mt-1 leading-tight italic">
                                        EL SISTEMA REFRESCA LA POSICIÓN CADA 3 MINUTOS AUNQUE EL EJECUTIVO NO SE MUEVA.
                                    </p>
                                </div>
                                <div className="pt-2 text-[9px] font-black text-slate-400 uppercase leading-relaxed px-1">
                                    MARCADORES EN ROJO INDICAN QUE EL USUARIO HA SALIDO DE SU GEOCERCA ASIGNADA.
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-3 shadow-2xl overflow-hidden order-1 lg:order-2">
                            <CardHeader className="bg-slate-50 border-b p-4 flex flex-row items-center justify-between">
                                <CardTitle className="text-xs font-black uppercase flex items-center gap-2 text-slate-950">
                                    <MapPin className="h-4 w-4 text-primary" />
                                    Mapa de Operaciones Nacional
                                </CardTitle>
                                <Badge variant="secondary" className="font-black text-[9px] uppercase px-3">{activeLocations.length} SEÑALES TOTALES</Badge>
                            </CardHeader>
                            <CardContent className="p-2 lg:p-4 bg-white">
                                <div className="h-[60vh] lg:h-[75vh]">
                                    <SupervisorMap />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="status" className="mt-6 animate-in fade-in zoom-in-95 duration-300">
                    <Card className="shadow-2xl border-t-4 border-t-primary rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="bg-slate-50 border-b px-8 py-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-xl font-black uppercase text-slate-950 flex items-center gap-2">
                                        <Signal className="h-6 w-6 text-primary" />
                                        Auditoría de Disponibilidad GPS
                                    </CardTitle>
                                    <CardDescription className="text-xs font-bold uppercase text-slate-500 mt-1">Verificación de conectividad en tiempo real de toda la fuerza operativa.</CardDescription>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex flex-col items-center px-4 py-2 bg-white rounded-2xl border-2 border-slate-100 shadow-sm">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">En Línea</span>
                                        <span className="text-lg font-black text-green-600">{onlineCount}</span>
                                    </div>
                                    <div className="flex flex-col items-center px-4 py-2 bg-white rounded-2xl border-2 border-slate-100 shadow-sm">
                                        <span className="text-[10px] font-black text-slate-400 uppercase">Sin Señal</span>
                                        <span className="text-lg font-black text-slate-300">{gpsStatusData.length - onlineCount}</span>
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader className="bg-slate-100/50">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="font-black uppercase text-[10px] text-slate-950 h-14 pl-8">Vendedor / Ejecutivo</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] text-slate-950">Rol</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] text-slate-950">Estado de Señal</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] text-slate-950">Último Reporte</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] text-slate-950">Precisión (M)</TableHead>
                                            <TableHead className="font-black uppercase text-[10px] text-slate-950 pr-8">Ubicación Actual</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {gpsStatusData.map((data, idx) => (
                                            <TableRow key={data.user.id} className={cn(
                                                "hover:bg-slate-50/50 transition-colors",
                                                data.isOnline ? "bg-green-50/10" : ""
                                            )}>
                                                <TableCell className="pl-8 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "h-10 w-10 rounded-full flex items-center justify-center font-black text-white uppercase text-sm shadow-md",
                                                            data.isOnline ? "bg-primary" : "bg-slate-200"
                                                        )}>
                                                            {data.user.name.charAt(0)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-xs uppercase text-slate-950">{data.user.name}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase truncate max-w-[150px]">{data.user.email}</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="font-black text-[9px] uppercase border-slate-200">{data.user.role}</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {data.isOnline ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                                                            <span className="text-[10px] font-black text-green-700 uppercase tracking-tighter">Conectado (GPS ON)</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2">
                                                            <WifiOff className="h-3 w-3 text-slate-300" />
                                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Sin Señal / App Cerrada</span>
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5">
                                                        <Clock className="h-3 w-3 text-slate-400" />
                                                        <span className="text-[10px] font-black text-slate-600 uppercase">
                                                            {data.lastSignal ? formatDistanceToNow(data.lastSignal, { addSuffix: true, locale: es }) : 'NUNCA REPORTADO'}
                                                        </span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {data.isOnline ? (
                                                        <Badge className={cn(
                                                            "font-black text-[9px] uppercase shadow-sm",
                                                            data.accuracy < 15 ? "bg-green-100 text-green-700 hover:bg-green-100 border-none" : "bg-amber-100 text-amber-700 hover:bg-amber-100 border-none"
                                                        )}>
                                                            {data.accuracy.toFixed(1)}m {data.accuracy < 15 ? '(Excelente)' : '(Regular)'}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-300">--</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="pr-8">
                                                    <p className="text-[10px] font-bold text-slate-500 uppercase leading-tight italic line-clamp-2">
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
