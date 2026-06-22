'use client';

import { useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, MapPin, LoaderCircle, LogIn, LogOut, Phone, CirclePlus, AlertTriangle, ThumbsUp, Users as UsersIcon, CalendarDays, Sparkles, MessageSquare, Trash2, ArrowLeft } from 'lucide-react';
import { updateRoute } from '@/lib/firebase/firestore';
import type { Client, ClientInRoute, RoutePlan } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Timestamp, GeoPoint, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Convierte un string a número de forma robusta, manejando comas decimales y caracteres extra.
 */
const parseMoney = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val || typeof val !== 'string') return 0;
    // Reemplazar coma por punto y quitar todo lo que no sea número o punto
    const clean = val.replace(',', '.').replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

const ensureDate = (d: any): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (d instanceof Timestamp) return d.toDate();
  if (d && typeof d.toDate === 'function') return d.toDate();
  if (d && typeof d.seconds === 'number') return new Date(d.seconds * 1000);
  const date = new Date(d);
  return isNaN(date.getTime()) ? new Date() : date;
};

/**
 * Sanitiza el array de clientes protegiendo los datos registrados.
 * CRÍTICO: Asegura que los valores numéricos se graben correctamente como Number.
 */
const sanitizeClients = (clients: ClientInRoute[]): any[] => {
    if (!clients) return [];
    return clients.map(c => {
        if (!c) return null;
        
        const isActuallyFinished = !!c.checkOutTime;

        const cleaned: any = { 
            ruc: String(c.ruc || ''),
            nombre_comercial: String(c.nombre_comercial || 'Sin Nombre'),
            visitStatus: isActuallyFinished ? 'Completado' : 'Pendiente',
            status: (c.status === 'Eliminado') ? 'Eliminado' : 'Activo',
            visitType: c.visitType || null,
            isReadded: !!c.isReadded,
            reAdditionObservation: String(c.reAdditionObservation || ''),
            visitObservation: String(c.visitObservation || ''),
            callObservation: String(c.callObservation || ''),
            removalObservation: String(c.removalObservation || ''),
            checkInTime: c.checkInTime || null,
            checkOutTime: c.checkOutTime || null,
            valorVenta: parseMoney(c.valorVenta),
            valorCobro: parseMoney(c.valorCobro),
            devoluciones: parseMoney(c.devoluciones),
            promociones: parseMoney(c.promociones),
            medicacionFrecuente: parseMoney(c.medicacionFrecuente)
        };
        
        const d = ensureDate(c.date);
        cleaned.date = Timestamp.fromDate(d);
        
        if (c.checkInLocation) {
            const loc = c.checkInLocation as any;
            const lat = loc.latitude ?? loc.lat ?? loc._lat ?? (typeof loc.lat === 'function' ? loc.lat() : undefined);
            const lng = loc.longitude ?? loc.lng ?? loc._long ?? (typeof loc.lng === 'function' ? loc.lng() : undefined);
            if (typeof lat === 'number' && typeof lng === 'number') cleaned.checkInLocation = new GeoPoint(lat, lng);
            else cleaned.checkInLocation = loc;
        }
        if (c.checkOutLocation) {
            const loc = c.checkOutLocation as any;
            const lat = loc.latitude ?? loc.lat ?? loc._lat ?? (typeof loc.lat === 'function' ? loc.lat() : undefined);
            const lng = loc.longitude ?? loc.lng ?? loc._long ?? (typeof loc.lng === 'function' ? loc.lng() : undefined);
            if (typeof lat === 'number' && typeof lng === 'number') cleaned.checkOutLocation = new GeoPoint(lat, lng);
            else cleaned.checkOutLocation = loc;
        }
        
        return cleaned;
    }).filter(Boolean);
};

function RouteManagementContent() {
  const { user, clients: availableClients, routes: allRoutes, users: allUsers, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>(searchParams.get('routeId') || undefined);
  const [routeOverride, setRouteOverride] = useState<RoutePlan | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [activeOriginalIndex, setActiveOriginalIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [addClientSearchTerm, setAddClientSearchTerm] = useState('');
  const [multiSelectedClients, setMultiSelectedClients] = useState<Client[]>([]);
  const [reAdditionObservation, setReAdditionObservation] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  const [localVisitObs, setLocalVisitObs] = useState('');
  const [localCallObs, setLocalCallObs] = useState('');
  const [localVenta, setLocalVenta] = useState('');
  const [localCobro, setLocalCobro] = useState('');
  const [localDevol, setLocalDevol] = useState('');

  const isAdmin = user?.role === 'Administrador';
  const isManager = isAdmin || user?.role === 'Supervisor';

  useEffect(() => {
    const rid = selectedRouteId || searchParams.get('routeId');
    if (!rid) {
      setRouteOverride(null);
      return;
    }

    const unsub = onSnapshot(doc(db, 'routes', rid), 
      (snap) => {
        if (snap.exists()) {
          setRouteOverride({ id: snap.id, ...snap.data() } as any);
        }
      }
    );
    return () => unsub();
  }, [selectedRouteId, searchParams]);

  useEffect(() => {
    const check = () => setIsExpired(new Date().getHours() >= 19 && !isAdmin);
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [isAdmin]);

  const managedUsers = useMemo(() => {
    if (!user) return [];
    if (user.role === 'Administrador' || user.role === 'Auditor') return allUsers.filter(u => u.role !== 'Administrador');
    if (user.role === 'Supervisor') return allUsers.filter(u => u.supervisorId === user.id || u.id === user.id);
    return [];
  }, [allUsers, user]);

  const selectableRoutes = useMemo(() => {
    if (!user) return [];
    return allRoutes.filter(r => {
        const isOwn = r.createdBy === user.id;
        const isManaged = managedUsers.some(u => u.id === r.createdBy);
        const isValidStatus = ['Planificada', 'En Progreso'].includes(r.status);
        if (!isValidStatus) return false;
        if (!isOwn && !isManaged && !isAdmin) return false;
        if (isManager && selectedAgentId !== 'all' && r.createdBy !== selectedAgentId) return false;
        return true; 
    });
  }, [allRoutes, user, isAdmin, isManager, selectedAgentId, managedUsers]);

  const selectedRoute = useMemo(() => {
    if (routeOverride) return routeOverride;
    const rid = selectedRouteId || searchParams.get('routeId');
    return allRoutes.find(r => r.id === rid);
  }, [routeOverride, selectedRouteId, allRoutes, searchParams]);

  const activeClient = useMemo(() => {
    return activeOriginalIndex !== null && selectedRoute?.clients[activeOriginalIndex] 
        ? selectedRoute.clients[activeOriginalIndex] 
        : null;
  }, [activeOriginalIndex, selectedRoute]);

  useEffect(() => {
      if (activeClient) {
          setLocalVisitObs(activeClient.visitObservation || '');
          setLocalCallObs(activeClient.callObservation || '');
          setLocalVenta(activeClient.valorVenta !== undefined && Number(activeClient.valorVenta) !== 0 ? String(activeClient.valorVenta) : '');
          setLocalCobro(activeClient.valorCobro !== undefined && Number(activeClient.valorCobro) !== 0 ? String(activeClient.valorCobro) : '');
          setLocalDevol(activeClient.devoluciones !== undefined && Number(activeClient.devoluciones) !== 0 ? String(activeClient.devoluciones) : '');
      }
  }, [activeOriginalIndex, activeClient?.ruc]);

  const clientsLookupMap = useMemo(() => {
    const map = new Map<string, Client>();
    availableClients.forEach(c => map.set(String(c.ruc).trim(), c));
    return map;
  }, [availableClients]);

  const todaysClients = useMemo(() => {
    if (!selectedRoute) return [];
    const today = startOfDay(new Date());
    return (selectedRoute.clients || [])
        .map((c, index) => ({ ...c, originalIndex: index, direccion: clientsLookupMap.get(String(c.ruc).trim())?.direccion || 'SIN DIRECCIÓN' }))
        .filter(c => {
            if (c.status === 'Eliminado') return false;
            if (!c.date) return false;
            return isSameDay(startOfDay(ensureDate(c.date)), today);
        });
  }, [selectedRoute, clientsLookupMap]);

  const rucCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    todaysClients.forEach(c => { counts[String(c.ruc).trim()] = (counts[String(c.ruc).trim()] || 0) + 1; });
    return counts;
  }, [todaysClients]);

  const isTodayFinished = useMemo(() => todaysClients.length > 0 && todaysClients.every(c => c.visitStatus === 'Completado'), [todaysClients]);
  const isJornadaBloqueada = isExpired && !isAdmin;
  const isEditingActiveClientDisabled = (activeClient?.visitStatus === 'Completado' || isJornadaBloqueada) && !isAdmin;

  const handleRemoveClient = (originalIndex: number) => {
    if (!selectedRoute || isSaving) return;
    const clientToRemove = selectedRoute.clients[originalIndex];
    const canDelete = isAdmin || ((rucCounts[String(clientToRemove.ruc).trim()] || 0) > 1 && clientToRemove?.visitStatus !== 'Completado');
    if (!canDelete) return;

    setIsSaving(true);
    try {
        const nextClients = JSON.parse(JSON.stringify(selectedRoute.clients));
        nextClients[originalIndex] = { ...nextClients[originalIndex], status: 'Eliminado' };
        const sanitized = sanitizeClients(nextClients);
        updateRoute(selectedRoute.id, { clients: sanitized })
            .catch(async () => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `routes/${selectedRoute.id}`, operation: 'update', requestResourceData: { clients: sanitized } })))
            .finally(() => { 
                if (activeOriginalIndex === originalIndex) setActiveOriginalIndex(null); 
                setIsSaving(false); 
            });
    } catch (e) { setIsSaving(false); }
  };

  const handleCheckIn = () => {
    if (!selectedRoute || activeOriginalIndex === null || isSaving || isEditingActiveClientDisabled) return;
    
    setIsSaving(true);
    const timeStr = format(new Date(), 'HH:mm:ss');

    const proceedWithSave = (coords?: {lat: number, lng: number}) => {
        if (!selectedRoute) return;
        const nextClients = [...selectedRoute.clients];
        nextClients[activeOriginalIndex] = { 
            ...nextClients[activeOriginalIndex], 
            checkInTime: timeStr,
            checkInLocation: coords ? new GeoPoint(coords.lat, coords.lng) : (nextClients[activeOriginalIndex].checkInLocation || null)
        };
        
        const sanitized = sanitizeClients(nextClients);
        updateRoute(selectedRoute.id, { clients: sanitized, status: 'En Progreso' })
            .catch(async () => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ 
                    path: `routes/${selectedRoute.id}`, 
                    operation: 'update', 
                    requestResourceData: { clients: sanitized } 
                }));
            })
            .finally(() => { 
                setIsSaving(false); 
                toast({ title: "Entrada registrada" }); 
            });
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            p => proceedWithSave({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => proceedWithSave(),
            { timeout: 4000, enableHighAccuracy: true }
        );
    } else {
        proceedWithSave();
    }
  };

  const handleCheckOut = () => {
    if (!selectedRoute || activeOriginalIndex === null || isSaving || isEditingActiveClientDisabled) return;
    if (activeClient?.visitType === 'telefonica' && !localCallObs.trim()) { 
        toast({title: "Resumen de llamada requerido", variant: "destructive"}); 
        return; 
    }
    
    setIsSaving(true);
    const timeStr = format(new Date(), 'HH:mm:ss');

    const proceedWithSave = (coords?: {lat: number, lng: number}) => {
        if (!selectedRoute) return;
        const nextClients = [...selectedRoute.clients];
        
        // Asignación explícita de valores parseados para asegurar el guardado
        nextClients[activeOriginalIndex] = { 
            ...nextClients[activeOriginalIndex], 
            visitObservation: localVisitObs,
            callObservation: localCallObs,
            valorVenta: parseMoney(localVenta),
            valorCobro: parseMoney(localCobro),
            devoluciones: parseMoney(localDevol),
            checkOutTime: timeStr, 
            visitStatus: 'Completado',
            checkOutLocation: coords ? new GeoPoint(coords.lat, coords.lng) : (nextClients[activeOriginalIndex].checkOutLocation || null)
        };
        
        const sanitized = sanitizeClients(nextClients);
        const allDone = sanitized.filter(c => c.status !== 'Eliminado').every(c => c.visitStatus === 'Completado');
        const nextStatus = (selectedRoute.status === 'Completada' || allDone) ? 'Completada' : 'En Progreso';

        updateRoute(selectedRoute.id, { 
            clients: sanitized, 
            status: nextStatus 
        })
        .catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ 
                path: `routes/${selectedRoute.id}`, 
                operation: 'update', 
                requestResourceData: { clients: sanitized } 
            }));
        })
        .finally(() => { 
            if (!isManager) setActiveOriginalIndex(null); 
            setIsSaving(false); 
            toast({ title: "Gestión Finalizada" }); 
        });
    };

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            p => proceedWithSave({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => proceedWithSave(),
            { timeout: 4000, enableHighAccuracy: true }
        );
    } else {
        proceedWithSave();
    }
  };

  const handleAddClients = () => {
    if (!selectedRoute || multiSelectedClients.length === 0 || isSaving || !reAdditionObservation.trim()) return;
    setIsSaving(true);
    try {
        const newVisits: ClientInRoute[] = multiSelectedClients.map(c => ({
            ruc: c.ruc, nombre_comercial: c.nombre_comercial, date: new Date(), visitStatus: 'Pendiente', status: 'Activo', isReadded: true, reAdditionObservation
        } as any));
        const sanitized = sanitizeClients([...selectedRoute.clients, ...newVisits]);
        
        updateRoute(selectedRoute.id, { clients: sanitized, status: 'En Progreso' })
            .catch(async () => errorEmitter.emit('permission-error', new FirestorePermissionError({ path: `routes/${selectedRoute.id}`, operation: 'update', requestResourceData: { clients: sanitized } })))
            .finally(() => { 
                setIsSaving(false); 
                setIsAddClientDialogOpen(false); 
                setMultiSelectedClients([]); 
                setReAdditionObservation(''); 
                setActiveOriginalIndex(null); 
            });
    } catch (e) { setIsSaving(false); }
  };

  if (authLoading) return <div className="p-20 text-center"><LoaderCircle className="animate-spin h-12 w-12 text-primary mx-auto" /></div>;

  return (
    <div className="flex flex-col gap-6 max-w-full overflow-hidden">
        <PageHeader title="Gestión de Jornada" description="Registro de visitas y ventas en tiempo real." />
        {isExpired && !isAdmin && (
            <Alert variant="destructive" className="mb-6 border-red-600 bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <AlertTitle className="text-red-800 font-black uppercase text-xs">Jornada Bloqueada (19:00)</AlertTitle>
                <AlertDescription className="text-red-700 font-bold uppercase text-[10px]">POR SEGURIDAD, EL REGISTRO DIARIO SE CIERRA A LAS 19:00. CONTACTA AL ADMINISTRADOR.</AlertDescription>
            </Alert>
        )}
        {!selectedRoute || (selectedRoute.status !== 'En Progreso' && !isManager) ? (
            <Card className="max-w-md mx-auto shadow-2xl border-t-4 border-t-primary rounded-3xl overflow-hidden mt-4 lg:mt-10 w-full">
                <CardHeader className="bg-slate-50 border-b"><CardTitle className="text-slate-950 font-black uppercase text-center text-lg">Activar mi Jornada</CardTitle></CardHeader>
                <CardContent className="space-y-6 p-6 lg:p-8">
                    {isManager && (
                        <div className="space-y-2">
                            <Label className="font-black uppercase text-[10px] text-slate-500">Supervisar Agente</Label>
                            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                                <SelectTrigger className="h-12 border-2 font-black text-slate-950"><UsersIcon className="mr-2 h-4 w-4 text-primary" /><SelectValue placeholder="Seleccionar ejecutivo..." /></SelectTrigger>
                                <SelectContent><SelectItem value="all" className="font-black">Todos</SelectItem>{managedUsers.map(u => <SelectItem key={u.id} value={u.id} className="font-black uppercase">{u.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label className="font-black uppercase text-[10px] text-slate-500">Seleccionar Plan de Ruta</Label>
                        <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                            <SelectTrigger className="h-12 border-2 font-black text-slate-950"><Route className="mr-2 h-4 w-4 text-primary" /><SelectValue placeholder="Buscar plan activo..." /></SelectTrigger>
                            <SelectContent>{selectableRoutes.map(r => <SelectItem key={r.id} value={r.id} className="font-black text-slate-950 uppercase text-[10px]">{r.routeName} [{r.status}]</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    {selectedRoute && (
                        <Button className="w-full font-black h-14 rounded-2xl text-lg shadow-xl uppercase" onClick={() => updateRoute(selectedRoute.id, { status: 'En Progreso' })} disabled={isJornadaBloqueada || isSaving}>INICIAR RUTA DIARIA</Button>
                    )}
                </CardContent>
            </Card>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                <Card className={cn("shadow-2xl border-t-4 border-t-primary rounded-[2.5rem] overflow-hidden flex flex-col h-[80vh] lg:h-[88vh] bg-white", activeOriginalIndex !== null ? "hidden lg:flex" : "flex")}>
                    <CardHeader className="bg-muted/5 px-6 py-6 border-b">
                        <h2 className="text-xl font-black text-primary uppercase truncate" title={selectedRoute?.routeName}>{selectedRoute?.routeName || "Ruta Activa"}</h2>
                        <p className="text-[10px] font-black text-slate-950 uppercase">FECHA: {format(new Date(), 'EEEE dd MMMM', { locale: es })}</p>
                    </CardHeader>
                    <CardContent className="p-4 lg:p-6 flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
                        <Button variant="outline" className="w-full h-12 border-dashed border-2 font-black text-xs rounded-xl flex items-center justify-center gap-2" onClick={() => setIsAddClientDialogOpen(true)} disabled={isJornadaBloqueada || (isTodayFinished && !isAdmin) || isSaving}>
                            <CirclePlus className="h-4 w-4 text-primary" /> AGREGAR CLIENTE EXTRA
                        </Button>
                        <ScrollArea className="flex-1">
                            <div className="space-y-3 pr-2">
                                {todaysClients.map((c) => (
                                    <div key={`${c.ruc}-${c.originalIndex}`} className={cn("p-4 border-2 rounded-2xl cursor-pointer transition-all bg-white relative group", activeOriginalIndex === c.originalIndex ? "border-primary bg-primary/5 shadow-md scale-[1.02]" : "border-slate-100 hover:border-slate-300")} onClick={() => setActiveOriginalIndex(c.originalIndex)}>
                                        <div className="flex-1 min-w-0 pr-6">
                                            <p className={cn("font-black text-xs truncate uppercase text-slate-950", activeOriginalIndex === c.originalIndex && "text-primary")}>{c.nombre_comercial}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-[9px] font-black text-slate-400 uppercase font-mono">{c.ruc}</p>
                                                {c.visitStatus === 'Completado' && <Badge variant="success" className="font-black text-[8px] uppercase bg-green-500 text-white h-4">OK</Badge>}
                                                {c.isReadded && <Badge variant="outline" className="font-black text-[8px] uppercase border-primary text-primary h-4 bg-primary/5">EXTRA</Badge>}
                                            </div>
                                        </div>
                                        {(isAdmin || (rucCounts[String(c.ruc).trim()] > 1 && c.visitStatus !== 'Completado')) && (
                                            <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); handleRemoveClient(c.originalIndex); }} disabled={isSaving}><Trash2 className="h-4 w-4" /></Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
                
                <Card className={cn("lg:col-span-2 shadow-2xl border-t-4 border-t-primary rounded-[2.5rem] overflow-hidden flex flex-col h-auto min-h-[70vh] lg:h-[88vh] bg-white", activeOriginalIndex === null && !isTodayFinished ? "hidden lg:flex" : "flex")}>
                    <CardHeader className="bg-muted/5 min-h-[8rem] flex flex-col justify-center px-6 lg:px-10 border-b">
                        <div className="flex items-center gap-4">
                            {activeClient && <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setActiveOriginalIndex(null)}><ArrowLeft className="h-6 w-6" /></Button>}
                            <div className="flex-1 min-w-0">
                                {activeClient ? (
                                    <div className="space-y-1">
                                        <h3 className="text-xl lg:text-2xl font-black text-primary uppercase leading-tight tracking-tighter truncate">{activeClient.nombre_comercial}</h3>
                                        <p className="text-[10px] font-black text-slate-950 uppercase opacity-70 truncate">{todaysClients.find(tc => tc.originalIndex === activeOriginalIndex)?.direccion || "DIRECCIÓN NO DISPONIBLE"}</p>
                                    </div>
                                ) : isTodayFinished && todaysClients.length > 0 ? (
                                    <div className="flex items-center justify-center gap-3"><ThumbsUp className="h-6 w-6 text-green-600" /><div className="text-lg lg:text-xl text-green-600 uppercase font-black">RUTA COMPLETADA EXITOSAMENTE</div></div>
                                ) : (
                                    <div className="text-center text-slate-950 font-black uppercase text-lg opacity-20">Selecciona un cliente para gestionar</div>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 lg:p-10 space-y-6 lg:space-y-8 flex-1 overflow-y-auto">
                        {!activeClient && isTodayFinished ? (
                            <div className="flex flex-col items-center justify-center p-4 h-full space-y-6"><div className="bg-green-100 p-6 rounded-full"><ThumbsUp className="h-16 lg:h-24 text-green-600" /></div><h2 className="text-3xl lg:text-5xl font-black text-slate-950 uppercase text-center tracking-tighter">¡BUEN TRABAJO!</h2><p className="text-slate-500 font-bold uppercase text-xs lg:text-sm text-center">Has finalizado todas las visitas programadas para hoy.</p></div>
                        ) : activeClient ? (
                            <div className="space-y-6">
                                {activeClient.isReadded && (
                                    <Alert className="bg-primary/5 border-primary/20 rounded-[1.5rem]"><Sparkles className="h-5 w-5 text-primary" /><AlertTitle className="text-primary font-black uppercase text-[10px]">Cliente Adicionado Manualmente</AlertTitle><AlertDescription className="text-slate-600 font-bold text-[9px] mt-1 italic"><MessageSquare className="inline h-3 w-3 mr-1" />"{activeClient.reAdditionObservation || 'Sin comentarios.'}"</AlertDescription></Alert>
                                )}
                                <div className={cn("p-6 rounded-[2rem] border-2 flex flex-col sm:flex-row items-center justify-between gap-4", activeClient.checkInTime ? "bg-green-50 border-green-200" : "bg-slate-50 border-dashed")}>
                                    <div className="flex items-center gap-4 lg:gap-6"><div className={cn("p-3 rounded-full bg-white shadow-sm", activeClient.checkInTime ? "text-green-600" : "text-slate-950")}><LogIn className="h-6 w-6" /></div><div><h4 className="font-black text-[10px] uppercase text-slate-950 tracking-widest">Hora de Llegada</h4><p className="text-base font-black text-slate-950 uppercase opacity-60">{activeClient.checkInTime || 'Pendiente de marcar...'}</p></div></div>
                                    {!activeClient.checkInTime && <Button onClick={handleCheckIn} className="w-full sm:auto font-black h-12 px-8 uppercase rounded-2xl shadow-lg" disabled={isJornadaBloqueada || isSaving}>
                                        {isSaving ? <LoaderCircle className="animate-spin mr-2 h-5 w-5" /> : null}
                                        MARCAR ENTRADA (GPS)
                                    </Button>}
                                </div>
                                <div className={cn("space-y-6 transition-all duration-500", !activeClient.checkInTime && !isManager && "opacity-20 pointer-events-none blur-[2px]")}>
                                    <div className="space-y-4"><Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Tipo de Gestión Realizada</Label><RadioGroup onValueChange={v => { if (selectedRoute && activeOriginalIndex !== null) { const next = [...selectedRoute.clients]; next[activeOriginalIndex] = { ...next[activeOriginalIndex], visitType: v as any }; updateRoute(selectedRoute.id, { clients: sanitizeClients(next) }); } }} value={activeClient.visitType || undefined} className="grid grid-cols-2 gap-4" disabled={isEditingActiveClientDisabled || isSaving}><Label className={cn("flex flex-col items-center gap-3 border-2 p-4 rounded-[2rem] cursor-pointer transition-all", activeClient.visitType === 'presencial' ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "bg-slate-50 hover:bg-slate-100")}><RadioGroupItem value="presencial" className="sr-only" /><MapPin className="h-8 w-8 text-primary" /><span className="text-[10px] font-black uppercase">Presencial</span></Label><Label className={cn("flex flex-col items-center gap-3 border-2 p-4 rounded-[2rem] cursor-pointer transition-all", activeClient.visitType === 'telefonica' ? "border-primary bg-primary/5 ring-4 ring-primary/10" : "bg-slate-50 hover:bg-slate-100")}><RadioGroupItem value="telefonica" className="sr-only" /><Phone className="h-8 w-8 text-primary" /><span className="text-[10px] font-black uppercase">Telefónica</span></Label></RadioGroup></div>
                                    <div className="space-y-6"><div className="space-y-2"><Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Observaciones Generales</Label><Textarea className="font-black text-sm border-2 rounded-2xl text-slate-950 h-24" value={localVisitObs} onChange={e => setLocalVisitObs(e.target.value)} disabled={isEditingActiveClientDisabled || isSaving} placeholder="Escribe aquí los detalles de la visita..." /></div>{activeClient.visitType === 'telefonica' && (<div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary tracking-widest">Resumen de Llamada (Obligatorio)</Label><Textarea className="font-black text-sm border-2 rounded-2xl text-slate-950 h-20" value={localCallObs} onChange={e => setLocalCallObs(e.target.value)} disabled={isEditingActiveClientDisabled || isSaving} placeholder="Registra lo acordado en la llamada..." /></div>)}</div>
                                    <div className="grid grid-cols-3 gap-4"><div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-500 tracking-widest text-center block">VENTA ($)</Label><Input type="text" className="h-12 text-lg font-black text-primary border-2 rounded-xl text-center text-slate-950 bg-slate-50/50" value={localVenta} onChange={e => setLocalVenta(e.target.value)} disabled={isEditingActiveClientDisabled || isSaving} placeholder="0.00" /></div><div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-500 tracking-widest text-center block">COBRO ($)</Label><Input type="text" className="h-12 text-lg font-black text-primary border-2 rounded-xl text-center text-slate-950 bg-slate-50/50" value={localCobro} onChange={e => setLocalCobro(e.target.value)} disabled={isEditingActiveClientDisabled || isSaving} placeholder="0.00" /></div><div className="space-y-1"><Label className="text-[8px] font-black uppercase text-slate-500 tracking-widest text-center block">DEVOL ($)</Label><Input type="text" className="h-12 text-lg font-black text-primary border-2 rounded-xl text-center text-slate-950 bg-slate-50/50" value={localDevol} onChange={e => setLocalDevol(e.target.value)} disabled={isEditingActiveClientDisabled || isSaving} placeholder="0.00" /></div></div>
                                    <Button onClick={handleCheckOut} className="w-full h-16 text-xl font-black rounded-2xl shadow-2xl uppercase transition-transform hover:scale-[1.01]" disabled={isSaving || isEditingActiveClientDisabled || !activeClient.visitType || (activeClient.visitType === 'telefonica' && !localCallObs.trim())}>{isSaving ? <LoaderCircle className="animate-spin h-6 w-6" /> : <><LogOut className="mr-2 h-6 w-6" /> FINALIZAR GESTIÓN</>}</Button>
                                </div>
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        )}
        <Dialog open={isAddClientDialogOpen} onOpenChange={setIsAddClientDialogOpen}>
            <DialogContent className="w-[95vw] max-w-2xl rounded-[2rem] flex flex-col h-[85vh] bg-white border-none shadow-2xl p-0">
                <DialogHeader className="p-6 lg:p-8 pb-4"><DialogTitle className="text-xl lg:text-2xl font-black uppercase text-primary">Buscador de Clientes Extras</DialogTitle></DialogHeader>
                <div className="px-6 lg:px-8 py-4 border-b"><Input placeholder="Buscar por RUC o Nombre del Cliente..." value={addClientSearchTerm} onChange={e => setAddClientSearchTerm(e.target.value)} className="h-12 font-black rounded-2xl border-2 text-slate-950" /></div>
                <ScrollArea className="flex-1 px-6 lg:px-8 py-4">
                    <div className="space-y-3">
                        {availableClients.filter(c => {
                            const term = addClientSearchTerm.trim().toLowerCase();
                            const match = String(c.nombre_cliente).toLowerCase().includes(term) || String(c.ruc).includes(term) || String(c.nombre_comercial).toLowerCase().includes(term);
                            const mine = isAdmin || (c.ejecutivo?.trim().toLowerCase() === user?.name?.trim().toLowerCase());
                            return match && mine;
                        }).map(c => (
                            <div key={c.id} onClick={() => setMultiSelectedClients(p => p.some(s => s.ruc === c.ruc) ? p.filter(s => s.ruc !== c.ruc) : [...p, c])} className={cn("p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border-2", multiSelectedClients.some(s => s.ruc === c.ruc) ? "bg-primary/10 border-primary" : "bg-white border-slate-100")}>
                                <Checkbox checked={multiSelectedClients.some(s => s.ruc === c.ruc)} className="h-5 w-5 border-primary" />
                                <div className="flex-1"><p className="text-sm font-black uppercase text-slate-950 truncate">{c.nombre_comercial}</p><p className="text-[9px] font-black text-slate-400 font-mono">{c.ruc}</p></div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <div className="p-6 lg:p-8 border-t space-y-4 bg-slate-50 rounded-b-[2rem]"><Textarea className="h-20 font-black border-2 rounded-2xl text-slate-950 text-xs" placeholder="Indica el motivo de la visita extra..." value={reAdditionObservation} onChange={e => setReAdditionObservation(e.target.value)} /><Button onClick={handleAddClients} disabled={multiSelectedClients.length === 0 || isSaving || !reAdditionObservation.trim()} className="w-full h-14 font-black rounded-2xl text-lg shadow-lg">{isSaving ? <LoaderCircle className="animate-spin" /> : `AÑADIR ${multiSelectedClients.length} PUNTOS A LA RUTA`}</Button></div>
            </DialogContent>
        </Dialog>
    </div>
  );
}

export default function RouteManagementPage() { 
  return (
    <Suspense fallback={<div className="p-20 text-center"><LoaderCircle className="animate-spin mx-auto h-12 w-12 text-primary" /></div>}>
      <RouteManagementContent />
    </Suspense>
  ); 
}