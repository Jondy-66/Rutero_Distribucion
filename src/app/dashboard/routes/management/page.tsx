'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Search, MapPin, LoaderCircle, LogIn, LogOut, CheckCircle, Phone, Trash2, Users as UsersIcon, CirclePlus, X, AlertTriangle, Calendar as CalendarIcon, ThumbsUp } from 'lucide-react';
import { updateRoute } from '@/lib/firebase/firestore';
import type { Client, ClientInRoute, User, RoutePlan } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, startOfWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
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

        const dateObj = ensureDate(c.date);
        cleaned.date = Timestamp.fromDate(dateObj);
        
        const parseValue = (v: any) => {
            if (v === undefined || v === null || v === '') return 0;
            const normalized = String(v).replace(',', '.');
            const num = parseFloat(normalized);
            return isNaN(num) ? 0 : Math.round(num * 100) / 100;
        };

        cleaned.valorVenta = parseValue(c.valorVenta);
        cleaned.valorCobro = parseValue(c.valorCobro);
        cleaned.devoluciones = parseValue(c.devoluciones);
        cleaned.promociones = parseValue(c.promociones);
        cleaned.medicacionFrecuente = parseValue(c.medicacionFrecuente);
        
        if (c.checkInLocation && (c.checkInLocation as any).latitude) {
            cleaned.checkInLocation = new GeoPoint((c.checkInLocation as any).latitude, (c.checkInLocation as any).longitude);
        } else {
            cleaned.checkInLocation = null;
        }

        if (c.checkOutLocation && (c.checkOutLocation as any).latitude) {
            cleaned.checkOutLocation = new GeoPoint((c.checkOutLocation as any).latitude, (c.checkOutLocation as any).longitude);
        } else {
            cleaned.checkOutLocation = null;
        }

        return cleaned;
    });
};

function RouteManagementContent() {
  const { user, clients: availableClients, routes: allRoutes, users: allUsers, loading: authLoading, dataLoading, refetchData } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
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
  const isSupervisor = user?.role === 'Supervisor';
  const isManager = isAdmin || isSupervisor;

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const hours = now.getHours();
      setIsExpired(hours >= 19 && !isAdmin);
    };
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [isAdmin]);

  const managedUsersForSelector = useMemo(() => {
    if (!user) return [];
    let base: User[] = [];
    if (user.role === 'Administrador' || user.role === 'Auditor') {
      base = allUsers.filter(u => u.role !== 'Administrador');
    } else if (user.role === 'Supervisor') {
      base = allUsers.filter(u => u.supervisorId === user.id);
    }
    if (user.role === 'Supervisor' || user.role === 'Administrador') {
        const exists = base.some(u => u.id === user.id);
        if(!exists) base = [user, ...base];
    }
    return base;
  }, [allUsers, user]);

  const selectableRoutes = useMemo(() => {
    const today = new Date();
    const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 });
    startOfCurrentWeek.setHours(0, 0, 0, 0);

    const managedUserIds = new Set(managedUsersForSelector.map(u => u.id));
    
    return allRoutes.filter(r => {
        const isOwnRoute = r.createdBy === user?.id;
        const isTeamRoute = managedUserIds.has(r.createdBy);
        if (!isOwnRoute && !isTeamRoute && !isAdmin) return false;
        
        const workStates = ['Planificada', 'En Progreso', 'Pendiente de Aprobación'];
        if (!workStates.includes(r.status)) return false;

        const routeDate = r.date instanceof Timestamp ? r.date.toDate() : new Date(r.date as any);
        if (routeDate < startOfCurrentWeek && r.status !== 'En Progreso') return false;

        if (isManager && selectedAgentId !== 'all' && r.createdBy !== selectedAgentId) return false;
        
        return true; 
    });
  }, [allRoutes, user, isAdmin, isManager, selectedAgentId, managedUsersForSelector]);

  const selectedRoute = useMemo(() => {
    const routeIdFromParams = searchParams.get('routeId');
    const routeId = selectedRouteId || routeIdFromParams;
    if (!routeId) return undefined;
    return allRoutes.find(r => r.id === routeId);
  }, [selectedRouteId, allRoutes, searchParams]);

  useEffect(() => {
    if (!selectedRoute) return;
    setCurrentRouteClientsFull(selectedRoute.clients || []);
    setIsRouteStarted(selectedRoute.status === 'En Progreso' || isAdmin || isSupervisor);
    setActiveOriginalIndex(null); 
  }, [selectedRoute, isAdmin, isSupervisor]);

  const todaysClients = useMemo(() => {
    return currentRouteClientsFull
        .map((c, index) => {
            const details = availableClients.find(ac => String(ac.ruc || '').trim() === String(c.ruc || '').trim());
            return { ...c, originalIndex: index, direccion: details?.direccion || 'SIN DIRECCIÓN DEFINIDA' };
        })
        .filter(c => c.status !== 'Eliminado');
  }, [currentRouteClientsFull, availableClients]);

  const isTodayFinished = useMemo(() => {
    return todaysClients.length > 0 && todaysClients.every(c => c.visitStatus === 'Completado');
  }, [todaysClients]);

  const activeClient = useMemo(() => 
    activeOriginalIndex !== null ? currentRouteClientsFull[activeOriginalIndex] : null, 
    [currentRouteClientsFull, activeOriginalIndex]
  );

  const isManaged = activeClient?.visitStatus === 'Completado';
  const isEditingDisabled = (isManaged || isExpired) && !isAdmin;

  const handleFieldChange = (field: keyof ClientInRoute, value: any) => {
    if (activeOriginalIndex === null || isEditingDisabled || isSaving) return;
    const nextClients = [...currentRouteClientsFull];
    nextClients[activeOriginalIndex] = { ...nextClients[activeOriginalIndex], [field]: value };
    setCurrentRouteClientsFull(nextClients);
    
    if (selectedRoute) {
        updateRoute(selectedRoute.id, { clients: sanitizeClients(nextClients) })
          .catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: `routes/${selectedRoute.id}`,
              operation: 'update',
              requestResourceData: { clients: sanitizeClients(nextClients) }
            }));
          });
    }
  };

  const getGeoLocation = () => {
    return new Promise<any>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
            (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
            () => resolve(null),
            { timeout: 3000, enableHighAccuracy: true }
        );
    });
  };

  const handleCheckIn = async () => {
    if (!selectedRoute || activeOriginalIndex === null || isSaving || isEditingDisabled || isExpired) return;
    
    setIsSaving(true);
    const location = await getGeoLocation();
    const nextClients = [...currentRouteClientsFull];
    const checkInTime = format(new Date(), 'HH:mm:ss');
    
    nextClients[activeOriginalIndex] = { 
        ...nextClients[activeOriginalIndex], 
        checkInTime, 
        checkInLocation: location 
    };
    
    setCurrentRouteClientsFull(nextClients);
    
    updateRoute(selectedRoute.id, { clients: sanitizeClients(nextClients) })
        .then(() => toast({ title: "Check-in Exitoso" }))
        .catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: `routes/${selectedRoute.id}`,
                operation: 'update',
                requestResourceData: { clients: sanitizeClients(nextClients) }
            }));
        })
        .finally(() => setIsSaving(false));
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedRoute || activeOriginalIndex === null || isSaving || isEditingDisabled || isExpired) return;
    const clientToFinish = currentRouteClientsFull[activeOriginalIndex];
    
    if (clientToFinish?.visitType === 'telefonica' && !clientToFinish.callObservation?.trim()) {
        return toast({ title: "Observación de llamada requerida", variant: "destructive" });
    }

    setIsSaving(true);
    const location = await getGeoLocation();
    const nextClients = [...currentRouteClientsFull];
    
    nextClients[activeOriginalIndex] = { 
        ...nextClients[activeOriginalIndex], 
        checkOutTime: format(new Date(), 'HH:mm:ss'), 
        checkOutLocation: location, 
        visitStatus: 'Completado' 
    };

    setCurrentRouteClientsFull(nextClients);
    
    const allDone = nextClients.filter(c => c.status !== 'Eliminado').every(c => c.visitStatus === 'Completado');
    
    updateRoute(selectedRoute.id, { 
        clients: sanitizeClients(nextClients),
        status: allDone ? 'Completada' : 'En Progreso'
    })
    .then(() => {
        toast({ title: "Check-out Exitoso. Visita Finalizada." });
        if (!isAdmin && !isSupervisor) setActiveOriginalIndex(null);
        refetchData('routes');
    })
    .catch(async (error) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
            path: `routes/${selectedRoute.id}`,
            operation: 'update',
            requestResourceData: { clients: sanitizeClients(nextClients) }
        }));
    })
    .finally(() => setIsSaving(false));
  };

  const handleRemoveClient = (idx: number) => {
    if (!selectedRoute || !isAdmin) return;
    const nextClients = currentRouteClientsFull.map((c, i) => i === idx ? { ...c, status: 'Eliminado' } : c);
    setCurrentRouteClientsFull(nextClients);
    
    updateRoute(selectedRoute.id, { clients: sanitizeClients(nextClients) })
        .then(() => toast({ title: "Cliente removido de la ruta" }))
        .catch(err => console.error(err));
  };

  const handleAddClients = async () => {
    if (!selectedRoute || multiSelectedClients.length === 0 || isExpired) return;
    if (needsReadditionObservation && !reAdditionObservation.trim()) {
        toast({ title: "Motivo requerido", description: "Ingresa el motivo de re-adición para continuar.", variant: "destructive" });
        return;
    }
    
    setIsSaving(true);
    const newVisits: ClientInRoute[] = multiSelectedClients.map(c => {
        const isAlreadyInPlan = currentRouteClientsFull.some(cc => cc.ruc === c.ruc && cc.status !== 'Eliminado');
        return {
            ruc: c.ruc,
            nombre_comercial: c.nombre_comercial,
            date: new Date(),
            visitStatus: 'Pendiente',
            status: 'Activo',
            isReadded: true,
            reAdditionObservation: isAlreadyInPlan ? reAdditionObservation : '',
            valorVenta: 0,
            valorCobro: 0,
            devoluciones: 0
        } as ClientInRoute;
    });
    
    const nextClients = [...currentRouteClientsFull, ...newVisits];
    setCurrentRouteClientsFull(nextClients);
    
    updateRoute(selectedRoute.id, { clients: sanitizeClients(nextClients) })
        .then(() => {
            toast({ title: "Cartera Actualizada", description: "Se han añadido nuevos clientes a la jornada." });
            setIsAddClientDialogOpen(false);
            setMultiSelectedClients([]);
            setReAdditionObservation('');
        })
        .catch(e => {
            console.error("Error batch sync:", e);
            toast({ title: "Error de Sincronización", variant: "destructive" });
        })
        .finally(() => setIsSaving(false));
  };

  const needsReadditionObservation = useMemo(() => {
    return multiSelectedClients.some(sc => currentRouteClientsFull.some(cc => cc.ruc === sc.ruc && cc.status !== 'Eliminado'));
  }, [multiSelectedClients, currentRouteClientsFull]);

  if (authLoading || (dataLoading && allRoutes.length === 0)) {
      return (
        <div className="p-20 text-center flex flex-col items-center gap-4">
            <LoaderCircle className="animate-spin h-12 w-12 text-primary" />
            <p className="font-black uppercase text-xs text-slate-950">Sincronizando jornada operativa...</p>
        </div>
      );
  }

  return (
    <div className="flex flex-col gap-6">
        <PageHeader title="Gestión de Ruta" description="Control diario de visitas y registros de gestión operativa." />
        
        {isExpired && !isAdmin && (
            <Alert variant="destructive" className="mb-6 border-red-600 bg-red-50 shadow-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <AlertTitle className="text-red-800 font-black uppercase text-xs">Jornada Bloqueada</AlertTitle>
                <AlertDescription className="text-red-700 font-bold uppercase text-[10px] leading-tight">
                    HAS SUPERADO EL TIEMPO LÍMITE (19:00). EL REGISTRO DE GESTIÓN HA SIDO BLOQUEADO POR POLÍTICA DE SEGURIDAD. SOLO ADMINISTRADORES PUEDEN EDITAR.
                </AlertDescription>
            </Alert>
        )}

        {!isRouteStarted ? (
            <Card className="max-w-md mx-auto shadow-2xl border-t-4 border-t-primary bg-white rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50 border-b">
                    <CardTitle className="text-slate-950 font-black uppercase text-center text-lg">Activar Jornada Diaria</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 p-8">
                    {isManager && (
                        <div className="space-y-2">
                            <Label className="font-black uppercase text-[10px] text-slate-500">Agente a Supervisar</Label>
                            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                                <SelectTrigger className="h-12 border-2 border-slate-200 font-black text-slate-950 bg-white rounded-xl">
                                    <UsersIcon className="mr-2 h-4 w-4 text-primary" />
                                    <SelectValue placeholder="Filtrar por agente..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all" className="font-black text-slate-950">Todos los disponibles</SelectItem>
                                    {managedUsersForSelector.map(u => (
                                        <SelectItem key={u.id} value={u.id} className="font-black text-slate-950 uppercase">
                                            {u.name} {u.id === user?.id ? "(TÚ)" : ""}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label className="font-black uppercase text-[10px] text-slate-500">Seleccionar Plan Vigente</Label>
                        <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                            <SelectTrigger className="h-12 border-2 border-slate-200 font-black text-slate-950 bg-white rounded-xl">
                                <Route className="mr-2 h-4 w-4 text-primary" />
                                <SelectValue placeholder="Busca tu ruta planificada..." />
                            </SelectTrigger>
                            <SelectContent>
                                {selectableRoutes.length > 0 ? (
                                    selectableRoutes.map(r => (
                                        <SelectItem key={r.id} value={r.id} className="font-black text-slate-950 uppercase text-[10px]">
                                            {r.routeName} [{r.status}]
                                        </SelectItem>
                                    ))
                                ) : (
                                    <SelectItem value="none" disabled className="font-black text-slate-400">Sin rutas planificadas para hoy.</SelectItem>
                                )}
                            </SelectContent>
                        </Select>
                    </div>
                    {selectedRoute && (
                        <Button 
                            className="w-full font-black h-14 rounded-2xl text-lg shadow-xl uppercase tracking-tighter" 
                            onClick={() => {
                                if (selectedRoute.status === 'Planificada' || selectedRoute.status === 'Pendiente de Aprobación') {
                                    updateRoute(selectedRoute.id, { status: 'En Progreso' }).then(() => setIsRouteStarted(true));
                                } else {
                                    setIsRouteStarted(true);
                                }
                            }}
                            disabled={isExpired && !isAdmin}
                        >
                            {isExpired && !isAdmin ? 'JORNADA CERRADA' : 'INICIAR GESTIÓN AHORA'}
                        </Button>
                    )}
                </CardContent>
            </Card>
        ) : (
            <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                    <Card className="shadow-2xl border-t-4 border-t-primary h-[82vh] min-h-[600px] rounded-[2.5rem] overflow-hidden flex flex-col bg-white">
                        <CardHeader className="bg-muted/10 px-8 py-6 border-b shrink-0">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <h2 className="text-xl font-black text-primary uppercase leading-tight tracking-tighter truncate max-w-[200px]" title={selectedRoute?.routeName}>
                                        {selectedRoute?.routeName || "Plan Activo"}
                                    </h2>
                                    <p className="text-[10px] font-black text-slate-950 uppercase">HOY: {format(new Date(), 'EEEE dd MMMM', { locale: es })}</p>
                                </div>
                                <Badge className="bg-slate-950 text-white font-black text-[8px] px-2 py-0.5 uppercase shrink-0">{user?.role}</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
                            <Button 
                                variant="outline" 
                                className="w-full h-12 border-dashed border-2 border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shrink-0 shadow-sm" 
                                onClick={() => setIsAddClientDialogOpen(true)}
                                disabled={isExpired && !isAdmin}
                            >
                                <CirclePlus className="h-4 w-4 text-primary" /> 
                                AGREGAR CLIENTE EXTRA
                            </Button>

                            <ScrollArea className="flex-1 pr-1">
                                <div className="space-y-3 pb-6">
                                    {todaysClients.length > 0 ? (
                                        todaysClients.map((c) => (
                                            <div 
                                                key={`${c.ruc}-${c.originalIndex}`} 
                                                onClick={() => (!activeClient?.checkInTime || activeClient.checkOutTime || isManager) && setActiveOriginalIndex(c.originalIndex)} 
                                                className={cn(
                                                    "flex items-center gap-3 p-4 border-2 rounded-2xl cursor-pointer transition-all duration-200 bg-white", 
                                                    activeOriginalIndex === c.originalIndex ? "border-primary bg-primary/5 shadow-md scale-[1.02]" : "border-slate-100 hover:border-slate-300"
                                                )}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className={cn("font-black text-xs truncate uppercase tracking-tight text-slate-950", activeOriginalIndex === c.originalIndex && "text-primary")}>
                                                        {c.nombre_comercial}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-[9px] font-black text-slate-400 uppercase font-mono">{c.ruc}</p>
                                                        {c.isReadded && <Badge className="text-[7px] h-3 px-1 bg-orange-600 text-white font-black border-none uppercase">ADICIONAL</Badge>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {isAdmin && (
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleRemoveClient(c.originalIndex); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                    )}
                                                    {c.visitStatus === 'Completado' && (
                                                        <Badge variant="success" className="font-black text-[8px] uppercase border-none bg-green-500 text-white px-1.5 h-4">
                                                            <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> OK
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-12 px-4 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200">
                                            <CalendarIcon className="h-8 w-8 mx-auto text-slate-300 mb-3" />
                                            <p className="text-[9px] font-black text-slate-400 uppercase">No hay paradas registradas para hoy.</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-2">
                    <Card className="shadow-2xl border-t-4 border-t-primary min-h-[600px] h-[82vh] rounded-[2.5rem] overflow-hidden flex flex-col bg-white">
                        <CardHeader className="bg-muted/10 h-32 flex flex-col justify-center px-10 shrink-0 border-b">
                            {activeClient ? (
                                <div className="space-y-1">
                                    <h3 className="text-2xl font-black text-primary uppercase leading-tight tracking-tighter">{activeClient.nombre_comercial}</h3>
                                    <p className="text-[10px] font-black text-slate-950 uppercase opacity-70 truncate">{activeClient.direccion}</p>
                                </div>
                            ) : isTodayFinished ? (
                                <div className="text-center text-green-600 uppercase font-black tracking-widest text-lg flex items-center justify-center gap-2">
                                    <ThumbsUp className="h-6 w-6" /> OBJETIVOS CUMPLIDOS
                                </div>
                            ) : (
                                <div className="text-center text-slate-950 font-black uppercase tracking-widest text-lg opacity-20">Selecciona un punto de interés</div>
                            )}
                        </CardHeader>
                        <CardContent className="p-10 space-y-8 flex-1 overflow-y-auto flex flex-col">
                            {!activeClient && isTodayFinished ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-10 animate-in fade-in zoom-in duration-700">
                                    <div className="bg-green-600 p-10 rounded-full shadow-[0_0_60px_rgba(22,163,74,0.4)] mb-10">
                                        <ThumbsUp className="h-24 w-24 text-white" />
                                    </div>
                                    <h2 className="text-5xl font-black text-slate-950 uppercase tracking-tighter mb-4 text-center">¡MISIÓN CUMPLIDA!</h2>
                                    <p className="text-xl font-black text-slate-950 uppercase tracking-widest text-center max-w-md leading-relaxed">
                                        HAS FINALIZADO TODA TU RUTA DE HOY. 
                                        <br />
                                        <span className="text-primary">¡EXCELENTE DESEMPEÑO!</span>
                                    </p>
                                </div>
                            ) : activeClient ? (
                                <>
                                <div className={cn("p-6 rounded-[1.5rem] border-2 transition-all duration-300", activeClient.checkInTime ? "bg-green-50 border-green-200 shadow-sm" : "bg-slate-50 border-dashed border-slate-300")}>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <LogIn className={cn("h-8 w-8", activeClient.checkInTime ? "text-green-600" : "text-slate-950")} />
                                            <div>
                                                <h4 className="font-black text-xs uppercase tracking-tighter text-slate-950">Registro de Entrada (GPS)</h4>
                                                <p className="text-[10px] font-black text-slate-950 uppercase mt-1 opacity-60">
                                                    {activeClient.checkInTime ? `Sincronizado a las: ${activeClient.checkInTime}` : 'Esperando Check-in...'}
                                                </p>
                                            </div>
                                        </div>
                                        {!activeClient.checkInTime && (
                                            <Button onClick={handleCheckIn} className="font-black h-12 px-8 rounded-xl text-xs shadow-lg transition-transform hover:scale-105 uppercase text-white" disabled={(isExpired && !isAdmin) || isSaving}>
                                                {isSaving ? <LoaderCircle className="animate-spin h-5 w-5" /> : 'MARCAR LLEGADA'}
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className={cn("space-y-8 transition-all duration-500", !activeClient.checkInTime && !isManager && "opacity-10 pointer-events-none grayscale")}>
                                    <div className="space-y-4">
                                        <Label className="text-xs font-black uppercase text-slate-950 tracking-wider ml-1">Tipo de Gestión Realizada</Label>
                                        <RadioGroup onValueChange={v => handleFieldChange('visitType', v)} value={activeClient.visitType} className="grid grid-cols-2 gap-6" disabled={isEditingDisabled}>
                                            <Label className={cn("flex flex-col items-center gap-3 border-2 p-6 rounded-[2rem] cursor-pointer transition-all duration-200", activeClient.visitType === 'presencial' ? "border-primary bg-primary/5 ring-4 ring-primary/5 shadow-md" : "border-slate-100 bg-slate-50 hover:bg-slate-100")}>
                                                <RadioGroupItem value="presencial" className="sr-only" />
                                                <MapPin className={cn("h-8 w-8", activeClient.visitType === 'presencial' ? "text-primary" : "text-slate-950")} />
                                                <span className="text-xs font-black uppercase tracking-tighter text-slate-950">Presencial</span>
                                            </Label>
                                            <Label className={cn("flex flex-col items-center gap-3 border-2 p-6 rounded-[2rem] cursor-pointer transition-all duration-200", activeClient.visitType === 'telefonica' ? "border-primary bg-primary/5 ring-4 ring-primary/5 shadow-md" : "border-slate-100 bg-slate-50 hover:bg-slate-100")}>
                                                <RadioGroupItem value="telefonica" className="sr-only" />
                                                <Phone className={cn("h-8 w-8", activeClient.visitType === 'telefonica' ? "text-primary" : "text-slate-950")} />
                                                <span className="text-xs font-black uppercase tracking-tighter text-slate-950">Telefónica</span>
                                            </Label>
                                        </RadioGroup>
                                    </div>

                                    {activeClient.visitType === 'telefonica' && (
                                        <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                                            <Label className="text-xs font-black uppercase text-primary tracking-wider ml-1">Observación Obligatoria (Llamada)</Label>
                                            <Textarea placeholder="Resume los puntos clave de la conversación..." className="h-24 font-black text-sm border-2 border-slate-200 focus:border-primary rounded-2xl text-slate-950 shadow-inner bg-white" value={activeClient.callObservation || ''} onChange={e => handleFieldChange('callObservation', e.target.value)} disabled={isEditingDisabled} />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-3 gap-6">
                                        {[
                                            { key: 'valorVenta', label: 'VENTA ($)' },
                                            { key: 'valorCobro', label: 'COBRO ($)' },
                                            { key: 'devoluciones', label: 'DEVOL ($)' }
                                        ].map(f => (
                                            <div key={f.key} className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase text-slate-950 tracking-widest ml-1">{f.label}</Label>
                                                <Input type="text" className="h-14 text-xl font-black text-primary border-2 border-slate-200 focus:border-primary rounded-2xl bg-white text-center text-slate-950 shadow-md" placeholder="0.00" value={activeClient[f.key as keyof ClientInRoute] ?? ''} onChange={e => handleFieldChange(f.key as any, e.target.value)} disabled={isEditingDisabled} />
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-3">
                                        <Label className="text-xs font-black uppercase text-slate-950 tracking-wider ml-1">Notas Generales de la Visita</Label>
                                        <Textarea placeholder="Comentarios adicionales del cliente..." className="h-24 font-black text-sm border-2 border-slate-200 focus:border-primary rounded-2xl text-slate-950 shadow-inner bg-white" value={activeClient.visitObservation || ''} onChange={e => handleFieldChange('visitObservation', e.target.value)} disabled={isEditingDisabled} />
                                    </div>

                                    <Button 
                                        onClick={handleConfirmCheckOut} 
                                        className="w-full h-18 text-xl font-black rounded-3xl shadow-2xl transition-all hover:scale-[1.02] mt-4 uppercase tracking-tighter text-white" 
                                        disabled={isSaving || isEditingDisabled || !activeClient.visitType || (activeClient.visitType === 'telefonica' && !activeClient.callObservation?.trim())}
                                    >
                                        {isSaving ? <LoaderCircle className="animate-spin h-6 w-6" /> : <><LogOut className="mr-3 h-6 w-6" /> {activeClient.visitStatus === 'Completado' ? 'GESTIÓN FINALIZADA' : 'CERRAR VISITA (CHECK-OUT)'}</>}
                                    </Button>
                                </div>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-slate-950 font-black uppercase text-center text-lg tracking-widest opacity-10">
                                    SELECCIONA UN CLIENTE EN EL PANEL IZQUIERDO PARA EMPEZAR
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        )}

        <Dialog open={isAddClientDialogOpen} onOpenChange={(open) => { setIsAddClientDialogOpen(open); if(!open) { setMultiSelectedClients([]); setReAdditionObservation(''); setAddClientSearchTerm(''); } }}>
            <DialogContent className="w-[95vw] sm:max-w-2xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col h-[85vh] bg-white">
                <DialogHeader className="bg-primary/5 p-8 pb-6 shrink-0 relative">
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary pr-8">Adición Manual de Clientes</DialogTitle>
                    <DialogDescription className="text-[10px] font-black uppercase text-slate-950 mt-1">Busca clientes en tu catálogo para añadir a la ruta de hoy</DialogDescription>
                    <DialogClose className="absolute right-6 top-8"><X className="h-6 w-6 text-slate-950 hover:text-primary transition-colors" /></DialogClose>
                </DialogHeader>
                <div className="px-8 py-4 shrink-0 border-b bg-white">
                    <div className="relative">
                        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                        <Input placeholder="Buscar por RUC o Nombre Social..." value={addClientSearchTerm} onChange={e => setAddClientSearchTerm(e.target.value)} className="h-12 pl-12 font-black rounded-2xl border-2 border-slate-100 focus:border-primary text-slate-950 bg-slate-50 shadow-inner" />
                    </div>
                </div>
                <ScrollArea className="flex-1 px-8 py-4 bg-slate-50/30">
                    <div className="grid grid-cols-1 gap-3 pb-6">
                        {availableClients
                            .filter(c => {
                                if (user?.role !== 'Administrador' && user?.role !== 'Auditor' && c.ejecutivo !== user?.name) return false;
                                const search = addClientSearchTerm.toLowerCase();
                                return String(c.nombre_cliente || '').toLowerCase().includes(search) || String(c.nombre_comercial || '').toLowerCase().includes(search) || String(c.ruc).includes(search);
                            })
                            .map(c => (
                                <div key={c.id} onClick={() => setMultiSelectedClients(prev => prev.some(s => s.ruc === c.ruc) ? prev.filter(s => s.ruc !== c.ruc) : [...prev, c])} className={cn("p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border-2", multiSelectedClients.some(s => s.ruc === c.ruc) ? "bg-primary/10 border-primary shadow-md" : "bg-white border-slate-100 hover:border-slate-300 shadow-sm")}>
                                    <Checkbox checked={multiSelectedClients.some(s => s.ruc === c.ruc)} className="rounded-md h-5 w-5 border-2 border-primary" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-black uppercase truncate text-slate-950">{c.nombre_comercial || c.nombre_cliente}</p>
                                        <p className="text-[10px] font-black text-slate-400 mt-1 font-mono">{c.ruc}</p>
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </ScrollArea>
                <div className="p-8 pt-6 border-t space-y-6 shrink-0 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                    {needsReadditionObservation && multiSelectedClients.length > 0 && (
                        <div className="space-y-2 animate-in slide-in-from-bottom-2 duration-300">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-wider ml-1">Motivo de Re-adición (Obligatorio)</Label>
                            <Textarea className="h-20 text-xs font-black border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary text-slate-950 bg-slate-50 shadow-inner" placeholder="Ej: Cliente visitado fuera de ciclo por urgencia..." value={reAdditionObservation} onChange={e => setReAdditionObservation(e.target.value)} />
                        </div>
                    )}
                    <div className="flex items-center gap-4">
                        <DialogClose asChild><Button variant="ghost" className="h-14 font-black flex-1 text-slate-950 border-2 border-slate-100 rounded-2xl uppercase text-xs">Descartar</Button></DialogClose>
                        <Button onClick={handleAddClients} disabled={multiSelectedClients.length === 0 || isSaving || (needsReadditionObservation && !reAdditionObservation.trim())} className="h-14 font-black flex-[2] rounded-2xl text-lg shadow-xl uppercase tracking-tighter text-white">{isSaving ? <LoaderCircle className="animate-spin h-6 w-6" /> : `AÑADIR ${multiSelectedClients.length} CLIENTES`}</Button>
                    </div>
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
