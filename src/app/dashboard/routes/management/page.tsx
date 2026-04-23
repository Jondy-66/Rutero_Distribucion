
'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, MapPin, LoaderCircle, LogIn, LogOut, Phone, CirclePlus, AlertTriangle, ThumbsUp, Users as UsersIcon } from 'lucide-react';
import { updateRoute } from '@/lib/firebase/firestore';
import type { Client, ClientInRoute, RoutePlan } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Timestamp, GeoPoint } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const ensureDate = (d: any): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (d && typeof d.toDate === 'function') return d.toDate();
  const date = new Date(d);
  return isNaN(date.getTime()) ? new Date() : date;
};

const sanitizeClients = (clients: ClientInRoute[]): any[] => {
    return clients.map(c => {
        const cleaned: any = { 
            ruc: c.ruc || '',
            nombre_comercial: c.nombre_comercial || 'Sin Nombre',
            visitStatus: c.visitStatus || 'Pendiente',
            status: c.status || 'Activo',
            visitType: c.visitType || null,
            isReadded: !!c.isReadded,
            reAdditionObservation: c.reAdditionObservation || '',
            visitObservation: c.visitObservation || '',
            callObservation: c.callObservation || '',
            checkInTime: c.checkInTime || null,
            checkOutTime: c.checkOutTime || null
        };
        cleaned.date = Timestamp.fromDate(ensureDate(c.date));
        const parseV = (v: any) => {
            const strValue = String(v || 0).replace(',', '.');
            const num = parseFloat(strValue);
            return isNaN(num) ? 0 : Math.round(num * 100) / 100;
        };
        cleaned.valorVenta = parseV(c.valorVenta);
        cleaned.valorCobro = parseV(c.valorCobro);
        cleaned.devoluciones = parseV(c.devoluciones);
        cleaned.promociones = parseV(c.promociones);
        cleaned.medicacionFrecuente = parseV(c.medicacionFrecuente);
        
        if (c.checkInLocation && (c.checkInLocation as any).latitude) {
            cleaned.checkInLocation = new GeoPoint((c.checkInLocation as any).latitude, (c.checkInLocation as any).longitude);
        }
        if (c.checkOutLocation && (c.checkOutLocation as any).latitude) {
            cleaned.checkOutLocation = new GeoPoint((c.checkOutLocation as any).latitude, (c.checkOutLocation as any).longitude);
        }
        return cleaned;
    });
};

function RouteManagementContent() {
  const { user, clients: availableClients, routes: allRoutes, users: allUsers, loading: authLoading, dataLoading, refetchData } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>(searchParams.get('routeId') || undefined);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [isRouteStarted, setIsRouteStarted] = useState(false);
  const [currentRouteClientsFull, setCurrentRouteClientsFull] = useState<ClientInRoute[]>([]);
  const [activeOriginalIndex, setActiveOriginalIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [addClientSearchTerm, setAddClientSearchTerm] = useState('');
  const [multiSelectedClients, setMultiSelectedClients] = useState<Client[]>([]);
  const [reAdditionObservation, setReAdditionObservation] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  const isAdmin = user?.role === 'Administrador';
  const isManager = isAdmin || user?.role === 'Supervisor';

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
    // Restauramos visibilidad completa: Rutas propias o gestionadas que no estén finalizadas
    return allRoutes.filter(r => {
        const isOwn = r.createdBy === user.id;
        const isManaged = managedUsers.some(u => u.id === r.createdBy);
        
        if (!isOwn && !isManaged && !isAdmin) return false;
        
        const isValidStatus = ['Planificada', 'En Progreso', 'Pendiente de Aprobación'].includes(r.status);
        if (!isValidStatus) return false;
        
        if (isManager && selectedAgentId !== 'all' && r.createdBy !== selectedAgentId) return false;
        
        return true; 
    });
  }, [allRoutes, user, isAdmin, isManager, selectedAgentId, managedUsers]);

  const selectedRoute = useMemo(() => {
    const rid = selectedRouteId || searchParams.get('routeId');
    return allRoutes.find(r => r.id === rid);
  }, [selectedRouteId, allRoutes, searchParams]);

  useEffect(() => {
    if (!selectedRoute) return;
    setCurrentRouteClientsFull(selectedRoute.clients || []);
    setIsRouteStarted(selectedRoute.status === 'En Progreso' || isManager);
    setActiveOriginalIndex(null); 
  }, [selectedRoute, isManager]);

  const todaysClients = useMemo(() => {
    return currentRouteClientsFull
        .map((c, index) => {
            const d = availableClients.find(ac => String(ac.ruc).trim() === String(c.ruc).trim());
            return { ...c, originalIndex: index, direccion: d?.direccion || 'SIN DIRECCIÓN' };
        })
        .filter(c => c.status !== 'Eliminado');
  }, [currentRouteClientsFull, availableClients]);

  const isTodayFinished = useMemo(() => todaysClients.length > 0 && todaysClients.every(c => c.visitStatus === 'Completado'), [todaysClients]);
  const activeClient = activeOriginalIndex !== null && currentRouteClientsFull[activeOriginalIndex] ? currentRouteClientsFull[activeOriginalIndex] : null;
  const isEditingDisabled = (activeClient?.visitStatus === 'Completado' || isExpired) && !isAdmin;

  const handleFieldChange = (field: keyof ClientInRoute, value: any) => {
    if (activeOriginalIndex === null || isEditingDisabled || isSaving) return;
    const next = [...currentRouteClientsFull];
    next[activeOriginalIndex] = { ...next[activeOriginalIndex], [field]: value };
    setCurrentRouteClientsFull(next);
  };

  const handleCheckIn = async () => {
    if (!selectedRoute || activeOriginalIndex === null || isSaving || isEditingDisabled) return;
    setIsSaving(true);
    const loc = await new Promise<any>(r => navigator.geolocation.getCurrentPosition(p => r({latitude: p.coords.latitude, longitude: p.coords.longitude}), () => r(null), {timeout: 3000}));
    const next = [...currentRouteClientsFull];
    next[activeOriginalIndex] = { ...next[activeOriginalIndex], checkInTime: format(new Date(), 'HH:mm:ss'), checkInLocation: loc };
    setCurrentRouteClientsFull(next);
    
    const sanitized = sanitizeClients(next);
    updateRoute(selectedRoute.id, { clients: sanitized })
        .catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ 
                path: `routes/${selectedRoute.id}`, 
                operation: 'update', 
                requestResourceData: { clients: sanitized } 
            }));
        })
        .finally(() => setIsSaving(false));
  };

  const handleCheckOut = async () => {
    if (!selectedRoute || activeOriginalIndex === null || isSaving || isEditingDisabled) return;
    if (activeClient?.visitType === 'telefonica' && !activeClient.callObservation?.trim()) {
        toast({title: "Observación requerida", variant: "destructive"});
        return;
    }
    setIsSaving(true);
    const loc = await new Promise<any>(r => navigator.geolocation.getCurrentPosition(p => r({latitude: p.coords.latitude, longitude: p.coords.longitude}), () => r(null), {timeout: 3000}));
    const next = [...currentRouteClientsFull];
    next[activeOriginalIndex] = { ...next[activeOriginalIndex], checkOutTime: format(new Date(), 'HH:mm:ss'), checkOutLocation: loc, visitStatus: 'Completado' };
    setCurrentRouteClientsFull(next);
    
    const allDone = next.filter(c => c.status !== 'Eliminado').every(c => c.visitStatus === 'Completado');
    const sanitized = sanitizeClients(next);
    
    updateRoute(selectedRoute.id, { 
        clients: sanitized, 
        status: allDone ? 'Completada' : 'En Progreso' 
    })
    .then(() => {
        if (!isAdmin && !isManager) setActiveOriginalIndex(null);
        refetchData('routes');
        toast({ title: "Gestión Cerrada", description: "La visita se ha registrado exitosamente." });
    })
    .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ 
            path: `routes/${selectedRoute.id}`, 
            operation: 'update', 
            requestResourceData: { clients: sanitized } 
        }));
    })
    .finally(() => setIsSaving(false));
  };

  const handleAddClients = async () => {
    if (!selectedRoute || multiSelectedClients.length === 0 || isSaving) return;
    setIsSaving(true);
    const newVisits: ClientInRoute[] = multiSelectedClients.map(c => ({
        ruc: c.ruc, 
        nombre_comercial: c.nombre_comercial, 
        date: new Date(), 
        visitStatus: 'Pendiente', 
        status: 'Active', 
        isReadded: true, 
        reAdditionObservation: reAdditionObservation || ''
    } as any));
    const next = [...currentRouteClientsFull, ...newVisits];
    setCurrentRouteClientsFull(next);
    
    const sanitized = sanitizeClients(next);
    updateRoute(selectedRoute.id, { clients: sanitized })
        .then(() => {
            setIsAddClientDialogOpen(false); 
            setMultiSelectedClients([]); 
            setReAdditionObservation('');
            toast({ title: "Clientes añadidos", description: "Se han agregado nuevas paradas a la ruta activa." });
        })
        .catch(async () => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({ 
                path: `routes/${selectedRoute.id}`, 
                operation: 'update', 
                requestResourceData: { clients: sanitized } 
            }));
        })
        .finally(() => setIsSaving(false));
  };

  if (authLoading || (dataLoading && allRoutes.length === 0)) {
    return (
        <div className="p-20 text-center flex flex-col items-center gap-4">
            <LoaderCircle className="animate-spin h-12 w-12 text-primary" />
            <p className="font-black text-slate-950 uppercase text-xs">Cargando Módulo de Gestión...</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
        <PageHeader title="Gestión de Ruta" description="Control diario de visitas y registros de gestión." />
        
        {isExpired && !isAdmin && (
            <Alert variant="destructive" className="mb-6 border-red-600 bg-red-50">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <AlertTitle className="text-red-800 font-black uppercase text-xs">Jornada Bloqueada (19:00)</AlertTitle>
                <AlertDescription className="text-red-700 font-bold uppercase text-[10px]">EL REGISTRO HA SIDO CERRADO POR POLÍTICA DE SEGURIDAD. SOLO ADMINISTRADORES PUEDEN EDITAR.</AlertDescription>
            </Alert>
        )}

        {!isRouteStarted ? (
            <Card className="max-w-md mx-auto shadow-2xl border-t-4 border-t-primary rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b"><CardTitle className="text-slate-950 font-black uppercase text-center text-lg">Activar Jornada</CardTitle></CardHeader>
                <CardContent className="space-y-6 p-8">
                    {isManager && (
                        <div className="space-y-2">
                            <Label className="font-black uppercase text-[10px] text-slate-500">Filtrar por Agente</Label>
                            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                                <SelectTrigger className="h-12 border-2 font-black text-slate-950"><UsersIcon className="mr-2 h-4 w-4 text-primary" /><SelectValue placeholder="Agente..." /></SelectTrigger>
                                <SelectContent><SelectItem value="all" className="font-black">Todos</SelectItem>{managedUsers.map(u => <SelectItem key={u.id} value={u.id} className="font-black uppercase">{u.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label className="font-black uppercase text-[10px] text-slate-500">Seleccionar Plan</Label>
                        <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                            <SelectTrigger className="h-12 border-2 font-black text-slate-950"><Route className="mr-2 h-4 w-4 text-primary" /><SelectValue placeholder="Busca tu ruta..." /></SelectTrigger>
                            <SelectContent>
                                {selectableRoutes.length > 0 ? (
                                    selectableRoutes.map(r => <SelectItem key={r.id} value={r.id} className="font-black text-slate-950 uppercase text-[10px]">{r.routeName} [{r.status}]</SelectItem>)
                                ) : (
                                    <SelectItem value="none" disabled>No hay planes vigentes disponibles</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    {selectedRoute && (
                        <Button 
                            className="w-full font-black h-14 rounded-2xl text-lg shadow-xl uppercase" 
                            onClick={() => updateRoute(selectedRoute.id, { status: 'En Progreso' }).then(() => {
                                setIsRouteStarted(true);
                                refetchData('routes');
                            })} 
                            disabled={isExpired && !isAdmin}
                        >
                            INICIAR GESTIÓN
                        </Button>
                    )}
                </CardContent>
            </Card>
        ) : (
            <div className="grid lg:grid-cols-3 gap-8">
                <Card className="lg:col-span-1 shadow-2xl border-t-4 border-t-primary h-[82vh] rounded-[2.5rem] overflow-hidden flex flex-col">
                    <CardHeader className="bg-muted/10 px-8 py-6 border-b">
                        <h2 className="text-xl font-black text-primary uppercase truncate" title={selectedRoute?.routeName}>{selectedRoute?.routeName || "Plan Activo"}</h2>
                        <p className="text-[10px] font-black text-slate-950 uppercase">HOY: {format(new Date(), 'EEEE dd MMMM', { locale: es })}</p>
                    </CardHeader>
                    <CardContent className="p-6 flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
                        <Button variant="outline" className="w-full h-12 border-dashed border-2 font-black text-xs rounded-xl flex items-center justify-center gap-2" onClick={() => setIsAddClientDialogOpen(true)} disabled={isExpired && !isAdmin}><CirclePlus className="h-4 w-4 text-primary" /> AGREGAR EXTRA</Button>
                        <ScrollArea className="flex-1">
                            <div className="space-y-3">
                                {todaysClients.map((c) => (
                                    <div key={`${c.ruc}-${c.originalIndex}`} onClick={() => setActiveOriginalIndex(c.originalIndex)} className={cn("p-4 border-2 rounded-2xl cursor-pointer transition-all bg-white", activeOriginalIndex === c.originalIndex ? "border-primary bg-primary/5 shadow-md scale-[1.02]" : "border-slate-100 hover:border-slate-300")}>
                                        <p className={cn("font-black text-xs truncate uppercase text-slate-950", activeOriginalIndex === c.originalIndex && "text-primary")}>{c.nombre_comercial}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-[9px] font-black text-slate-400 uppercase font-mono">{c.ruc}</p>
                                            {c.visitStatus === 'Completado' && <Badge variant="success" className="font-black text-[8px] uppercase bg-green-500 text-white h-4">OK</Badge>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
                
                <Card className="lg:col-span-2 shadow-2xl border-t-4 border-t-primary h-[82vh] rounded-[2.5rem] overflow-hidden flex flex-col">
                    <CardHeader className="bg-muted/10 h-32 flex flex-col justify-center px-10 border-b">
                        {activeClient ? (
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-primary uppercase leading-tight tracking-tighter">{activeClient.nombre_comercial}</h3>
                                <p className="text-[10px] font-black text-slate-950 uppercase opacity-70 truncate">{activeClient.direccion}</p>
                            </div>
                        ) : isTodayFinished ? (
                            <div className="text-center text-green-600 uppercase font-black text-lg">OBJETIVOS CUMPLIDOS</div>
                        ) : (
                            <div className="text-center text-slate-950 font-black uppercase text-lg opacity-20">Selecciona un punto</div>
                        )}
                    </CardHeader>
                    <CardContent className="p-10 space-y-8 flex-1 overflow-y-auto">
                        {!activeClient && isTodayFinished ? (
                            <div className="flex flex-col items-center justify-center p-10 h-full">
                                <ThumbsUp className="h-24 w-24 text-green-600 mb-6" />
                                <h2 className="text-4xl font-black text-slate-950 uppercase text-center">¡MISIÓN CUMPLIDA!</h2>
                            </div>
                        ) : activeClient ? (
                            <>
                                <div className={cn("p-6 rounded-[1.5rem] border-2 flex items-center justify-between", activeClient.checkInTime ? "bg-green-50 border-green-200" : "bg-slate-50 border-dashed")}>
                                    <div className="flex items-center gap-4">
                                        <LogIn className={cn("h-8 w-8", activeClient.checkInTime ? "text-green-600" : "text-slate-950")} />
                                        <div>
                                            <h4 className="font-black text-xs uppercase text-slate-950">Entrada (GPS)</h4>
                                            <p className="text-[10px] font-black text-slate-950 uppercase opacity-60">{activeClient.checkInTime || 'Esperando...'}</p>
                                        </div>
                                    </div>
                                    {!activeClient.checkInTime && <Button onClick={handleCheckIn} className="font-black h-12 px-8 uppercase" disabled={isExpired && !isAdmin}>MARCAR LLEGADA</Button>}
                                </div>
                                <div className={cn("space-y-8 transition-all", !activeClient.checkInTime && !isManager && "opacity-20 pointer-events-none")}>
                                    <div className="space-y-4">
                                        <Label className="text-xs font-black uppercase text-slate-950">Tipo de Gestión</Label>
                                        <RadioGroup onValueChange={v => handleFieldChange('visitType', v)} value={activeClient.visitType} className="grid grid-cols-2 gap-6" disabled={isEditingDisabled}>
                                            <Label className={cn("flex flex-col items-center gap-3 border-2 p-6 rounded-[2rem] cursor-pointer", activeClient.visitType === 'presencial' ? "border-primary bg-primary/5" : "bg-slate-50")}>
                                                <RadioGroupItem value="presencial" className="sr-only" /><MapPin className="h-8 w-8" /><span className="text-xs font-black uppercase">Presencial</span>
                                            </Label>
                                            <Label className={cn("flex flex-col items-center gap-3 border-2 p-6 rounded-[2rem] cursor-pointer", activeClient.visitType === 'telefonica' ? "border-primary bg-primary/5" : "bg-slate-50")}>
                                                <RadioGroupItem value="telefonica" className="sr-only" /><Phone className="h-8 w-8" /><span className="text-xs font-black uppercase">Telefónica</span>
                                            </Label>
                                        </RadioGroup>
                                    </div>
                                    {activeClient.visitType === 'telefonica' && (
                                        <div className="space-y-3">
                                            <Label className="text-xs font-black uppercase text-primary">Observación Llamada (Obligatorio)</Label>
                                            <Textarea className="font-black text-sm border-2 rounded-2xl text-slate-950" value={activeClient.callObservation || ''} onChange={e => handleFieldChange('callObservation', e.target.value)} disabled={isEditingDisabled} />
                                        </div>
                                    )}
                                    <div className="grid grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-slate-950">VENTA ($)</Label>
                                            <Input type="text" className="h-14 text-xl font-black text-primary border-2 rounded-2xl text-center text-slate-950" value={activeClient.valorVenta ?? ''} onChange={e => handleFieldChange('valorVenta', e.target.value)} disabled={isEditingDisabled} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-slate-950">COBRO ($)</Label>
                                            <Input type="text" className="h-14 text-xl font-black text-primary border-2 rounded-2xl text-center text-slate-950" value={activeClient.valorCobro ?? ''} onChange={e => handleFieldChange('valorCobro', e.target.value)} disabled={isEditingDisabled} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-slate-950">DEVOL ($)</Label>
                                            <Input type="text" className="h-14 text-xl font-black text-primary border-2 rounded-2xl text-center text-slate-950" value={activeClient.devoluciones ?? ''} onChange={e => handleFieldChange('devoluciones', e.target.value)} disabled={isEditingDisabled} />
                                        </div>
                                    </div>
                                    <Button onClick={handleCheckOut} className="w-full h-18 text-xl font-black rounded-3xl shadow-2xl uppercase" disabled={isSaving || isEditingDisabled || !activeClient.visitType || (activeClient.visitType === 'telefonica' && !activeClient.callObservation?.trim())}>
                                        {isSaving ? <LoaderCircle className="animate-spin" /> : <><LogOut className="mr-3 h-6 w-6" /> CERRAR VISITA</>}
                                    </Button>
                                </div>
                            </>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        )}
        
        <Dialog open={isAddClientDialogOpen} onOpenChange={setIsAddClientDialogOpen}>
            <DialogContent className="max-w-2xl rounded-[2.5rem] flex flex-col h-[85vh] bg-white">
                <DialogHeader className="p-8 pb-6">
                    <DialogTitle className="text-2xl font-black uppercase text-primary">Adición Manual</DialogTitle>
                </DialogHeader>
                <div className="px-8 py-4 border-b">
                    <Input placeholder="Buscar por RUC o Nombre..." value={addClientSearchTerm} onChange={e => setAddClientSearchTerm(e.target.value)} className="h-12 font-black rounded-2xl border-2 text-slate-950" />
                </div>
                <ScrollArea className="flex-1 px-8 py-4">
                    <div className="space-y-3">
                        {availableClients.filter(c => (isAdmin || c.ejecutivo === user?.name) && (String(c.nombre_cliente).toLowerCase().includes(addClientSearchTerm.toLowerCase()) || String(c.ruc).includes(addClientSearchTerm))).map(c => (
                            <div key={c.id} onClick={() => setMultiSelectedClients(p => p.some(s => s.ruc === c.ruc) ? p.filter(s => s.ruc !== c.ruc) : [...p, c])} className={cn("p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border-2", multiSelectedClients.some(s => s.ruc === c.ruc) ? "bg-primary/10 border-primary" : "bg-white border-slate-100")}>
                                <Checkbox checked={multiSelectedClients.some(s => s.ruc === c.ruc)} className="h-5 w-5 border-primary" />
                                <div className="flex-1">
                                    <p className="text-sm font-black uppercase text-slate-950">{c.nombre_comercial}</p>
                                    <p className="text-[9px] font-black text-slate-400 font-mono">{c.ruc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <div className="p-8 border-t space-y-4">
                    <Textarea className="h-20 font-black border-2 rounded-2xl text-slate-950" placeholder="Motivo de re-adición..." value={reAdditionObservation} onChange={e => setReAdditionObservation(e.target.value)} />
                    <Button onClick={handleAddClients} disabled={multiSelectedClients.length === 0 || isSaving} className="w-full h-14 font-black rounded-2xl text-lg">AÑADIR {multiSelectedClients.length} CLIENTES</Button>
                </div>
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
