
'use client';
import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Search, MapPin, LoaderCircle, LogIn, LogOut, CheckCircle, Phone, User, PlusCircle, PlayCircle, X, AlertCircle, Sparkles, History, CalendarClock, Users, MessageSquare } from 'lucide-react';
import { updateRoute } from '@/lib/firebase/firestore';
import type { Client, ClientInRoute, RoutePlan } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, isBefore, startOfDay, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Timestamp, GeoPoint } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';

const sanitizeClientsForFirestore = (clients: ClientInRoute[]): any[] => {
    return clients.map(c => {
        const cleaned: any = { ...c };
        if (c.date instanceof Date) {
            cleaned.date = Timestamp.fromDate(c.date);
        } else if (c.date && typeof (c.date as any).toDate === 'function') {
            // Already a Timestamp
        } else if (c.date) {
            cleaned.date = Timestamp.fromDate(new Date(c.date as any));
        }

        const round = (val: any) => {
            const n = parseFloat(String(val || 0).replace(',', '.'));
            return isNaN(n) ? 0 : Math.round(n * 100) / 100;
        };
        
        cleaned.valorVenta = round(c.valorVenta);
        cleaned.valorCobro = round(c.valorCobro);
        cleaned.devoluciones = round(c.devoluciones);
        cleaned.promociones = round(c.promociones);
        cleaned.medicacionFrecuente = round(c.medicacionFrecuente);

        if (c.checkInLocation && !(c.checkInLocation instanceof GeoPoint) && (c.checkInLocation as any).latitude !== undefined) {
            cleaned.checkInLocation = new GeoPoint((c.checkInLocation as any).latitude, (c.checkInLocation as any).longitude);
        }
        if (c.checkOutLocation && !(c.checkOutLocation instanceof GeoPoint) && (c.checkOutLocation as any).latitude !== undefined) {
            cleaned.checkOutLocation = new GeoPoint((c.checkOutLocation as any).latitude, (c.checkOutLocation as any).longitude);
        }

        Object.keys(cleaned).forEach(key => {
            if (cleaned[key] === undefined) cleaned[key] = null;
        });
        return cleaned;
    });
};

type RouteClient = Client & ClientInRoute;

function RouteManagementContent() {
  const { user, clients: availableClients, routes: allRoutes, users: allUsers, loading: authLoading, dataLoading, refetchData } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const routeIdFromParams = searchParams.get('routeId');
  
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [isRouteStarted, setIsRouteStarted] = useState(false);
  const [todayFormatted, setTodayFormatted] = useState('');
  
  const [currentRouteClientsFull, setCurrentRouteClientsFull] = useState<ClientInRoute[]>([]);
  const [activeRuc, setActiveRuc] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [addClientSearchTerm, setAddClientSearchTerm] = useState('');
  const [multiSelectedClients, setMultiSelectedClients] = useState<Client[]>([]);
  const [reAdditionObservation, setReAdditionObservation] = useState('');

  const isInitialRehydrationDone = useRef(false);
  const lastLocalUpdateTimestamp = useRef<number>(0);
  const SELECTION_KEY = user ? `mgmt_selected_route_v7_${user.id}` : null;

  useEffect(() => {
    setTodayFormatted(format(new Date(), "EEEE, d 'de' MMMM", { locale: es }));
  }, []);

  const isAdmin = user?.role === 'Administrador';

  const selectableRoutes = useMemo(() => {
    return allRoutes.filter(r => {
        const isOwner = r.createdBy === user?.id;
        const isManagedByAdmin = isAdmin;
        
        if (!isOwner && !isManagedByAdmin) return false;
        
        if (isAdmin && selectedAgentId !== 'all' && r.createdBy !== selectedAgentId) return false;

        const routeDate = r.date instanceof Timestamp ? r.date.toDate() : (r.date instanceof Date ? r.date : new Date(r.date));
        const expirationDate = addDays(startOfDay(routeDate), 7);
        const isExpired = isBefore(expirationDate, startOfDay(new Date()));
        
        return (r.status === 'En Progreso' || r.status === 'Planificada' || r.status === 'Completada' || r.status === 'Incompleta') && !isExpired;
    });
  }, [allRoutes, user, isAdmin, selectedAgentId]);

  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) return undefined;
    return allRoutes.find(r => r.id === selectedRouteId);
  }, [selectedRouteId, allRoutes]);
  
  useEffect(() => {
    if (authLoading || dataLoading || !selectedRoute) return;
    
    const now = Date.now();
    if (now - lastLocalUpdateTimestamp.current < 3000) return;

    if (!isSaving) {
        const clients = selectedRoute.clients || [];
        const round = (val: any) => {
            const n = parseFloat(String(val || 0).replace(',', '.'));
            return isNaN(n) ? 0 : Math.round(n * 100) / 100;
        };
        const roundedClients = clients.map(c => ({
            ...c,
            valorVenta: round(c.valorVenta),
            valorCobro: round(c.valorCobro),
            devoluciones: round(c.devoluciones),
            promociones: round(c.promociones),
            medicacionFrecuente: round(c.medicacionFrecuente),
        }));
        roundedClients.sort((a,b) => {
            const dateA = a.date instanceof Timestamp ? a.date.toDate().getTime() : (a.date instanceof Date ? a.date.getTime() : 0);
            const dateB = b.date instanceof Timestamp ? b.date.toDate().getTime() : (b.date instanceof Date ? b.date.getTime() : 0);
            return dateA - dateB;
        });
        setCurrentRouteClientsFull(roundedClients);
        setIsRouteStarted(selectedRoute.status === 'En Progreso' || isAdmin);
    }
  }, [selectedRoute, authLoading, dataLoading, isSaving, isAdmin]);

  useEffect(() => {
    if (authLoading || dataLoading || isInitialRehydrationDone.current || !SELECTION_KEY) return;

    if (routeIdFromParams) {
        setSelectedRouteId(routeIdFromParams);
        const found = allRoutes.find(r => r.id === routeIdFromParams);
        if (found) setIsRouteStarted(found.status === 'En Progreso' || isAdmin);
    } else {
        const activeRoute = allRoutes.find(r => r.status === 'En Progreso' && r.createdBy === user?.id);
        if (activeRoute) {
            setSelectedRouteId(activeRoute.id);
            setIsRouteStarted(true);
            localStorage.setItem(SELECTION_KEY, activeRoute.id);
        } else {
            const savedId = localStorage.getItem(SELECTION_KEY);
            if (savedId) {
                const found = allRoutes.find(r => r.id === savedId && r.status !== 'Completada' && r.status !== 'Incompleta');
                if (found) {
                    setSelectedRouteId(savedId);
                    setIsRouteStarted(found.status === 'En Progreso' || isAdmin);
                }
            }
        }
    }
    isInitialRehydrationDone.current = true;
  }, [authLoading, dataLoading, SELECTION_KEY, allRoutes, user, routeIdFromParams, isAdmin]);

  const routeClients = useMemo(() => {
    const routeOwnerId = selectedRoute?.createdBy;
    const routeOwner = allUsers.find(u => u.id === routeOwnerId);

    return currentRouteClientsFull
        .filter(c => {
            if (c.status === 'Eliminado' || !c.date) return false;
            const cDate = c.date instanceof Timestamp ? c.date.toDate() : new Date(c.date as any);
            return isToday(cDate);
        })
        .map(c => {
            const details = availableClients.find(ac => String(ac.ruc).trim() === String(c.ruc).trim());
            return {
                id: details?.id || c.ruc,
                nombre_cliente: details?.nombre_cliente || c.nombre_comercial,
                nombre_comercial: c.nombre_comercial,
                direccion: details?.direccion || 'Dirección no disponible',
                latitud: details?.latitud || 0,
                longitud: details?.longitud || 0,
                ejecutivo: details?.ejecutivo || routeOwner?.name || '',
                ...c,
            } as RouteClient;
        });
  }, [currentRouteClientsFull, availableClients, selectedRoute, allUsers]);

  const isTodayCompleted = useMemo(() => {
    return routeClients.length > 0 && routeClients.every(c => c.visitStatus === 'Completado');
  }, [routeClients]);

  useEffect(() => {
    if (!activeRuc && routeClients.length > 0 && !isTodayCompleted) {
        const activeVisit = routeClients.find(c => c.checkInTime && !c.checkOutTime);
        if (activeVisit) {
            setActiveRuc(activeVisit.ruc);
        } else {
            const nextPending = routeClients.find(c => c.visitStatus !== 'Completado');
            if (nextPending) setActiveRuc(nextPending.ruc);
        }
    }
  }, [routeClients, activeRuc, isTodayCompleted]);

  const activeClient = useMemo(() => {
    if (!activeRuc) return null;
    return routeClients.find(c => c.ruc === activeRuc) || null;
  }, [routeClients, activeRuc]);

  const isCurrentClientInProgress = !!(activeClient?.checkInTime && !activeClient?.checkOutTime);
  const isCurrentClientCompleted = activeClient?.visitStatus === 'Completado';

  const handleFieldChange = (field: keyof ClientInRoute, value: any) => {
    if (!activeRuc || (isCurrentClientCompleted && !isAdmin) || isSaving) return;
    
    lastLocalUpdateTimestamp.current = Date.now();
    let processedValue = value;
    const numericFields = ['valorVenta', 'valorCobro', 'devoluciones', 'promociones', 'medicacionFrecuente'];
    if (numericFields.includes(field)) {
        const num = parseFloat(String(value).replace(',', '.'));
        if (!isNaN(num)) {
            processedValue = Math.round(num * 100) / 100;
        } else if (value === "") {
            processedValue = 0;
        }
    }

    const nextClients = currentRouteClientsFull.map(c => 
        c.ruc === activeRuc ? { ...c, [field]: processedValue } : c
    );
    
    setCurrentRouteClientsFull(nextClients);
    
    // Sincronización inmediata para evitar pérdida de datos por refresco de fondo
    if (selectedRoute) {
        updateRoute(selectedRoute.id, { 
            clients: sanitizeClientsForFirestore(nextClients) 
        }).catch(e => {
            console.error("Error sincronizando campo:", e);
        });
    }
  };

  const getCurrentCoords = (): Promise<{ latitude: number, longitude: number } | null> => {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve(null);
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 6000 }
        );
    });
  };

  const handleCheckIn = async () => {
    if (!selectedRoute || !activeRuc || (isCurrentClientCompleted && !isAdmin) || isSaving) return;
    
    setIsSaving(true);
    lastLocalUpdateTimestamp.current = Date.now();
    
    const time = format(new Date(), 'HH:mm:ss');
    const location = await getCurrentCoords();

    const nextClients = currentRouteClientsFull.map(c => 
        c.ruc === activeRuc ? { ...c, checkInTime: time, checkInLocation: location } : c
    );
    
    setCurrentRouteClientsFull(nextClients);
    
    updateRoute(selectedRoute.id, { 
        clients: sanitizeClientsForFirestore(nextClients) 
    }).catch(e => {
        console.error("Error sincronizando entrada:", e);
    });

    setIsSaving(false);
    toast({ title: "Entrada Registrada" });
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedRoute || !activeRuc || (isCurrentClientCompleted && !isAdmin) || isSaving) return;

    if (activeClient?.visitType === 'telefonica' && !activeClient.callObservation?.trim()) {
        toast({ title: "Observación Requerida", description: "Debes ingresar una observación para visitas telefónicas.", variant: "destructive" });
        return;
    }

    setIsSaving(true);
    lastLocalUpdateTimestamp.current = Date.now();
    
    const time = format(new Date(), 'HH:mm:ss');
    const location = await getCurrentCoords();

    const nextClients = currentRouteClientsFull.map(c => 
        c.ruc === activeRuc ? { ...c, checkOutTime: time, checkOutLocation: location, visitStatus: 'Completado' } : c
    );

    const activeClients = nextClients.filter(c => c.status !== 'Eliminado');
    const allTotalClientsDone = activeClients.length > 0 && activeClients.every(c => c.visitStatus === 'Completado');

    const newStatus = allTotalClientsDone ? 'Completada' : (selectedRoute.status === 'Planificada' ? 'En Progreso' : selectedRoute.status);
    
    setCurrentRouteClientsFull(nextClients);
    
    const updateData: any = { 
        clients: sanitizeClientsForFirestore(nextClients), 
        status: newStatus
    };
    
    if (allTotalClientsDone) {
        updateData.statusReason = "Planificación semanal completada exitosamente.";
    }

    updateRoute(selectedRoute.id, updateData).catch(e => {
        console.error("Error sincronizando salida:", e);
    });
    
    if (!isAdmin) setActiveRuc(null);

    setIsSaving(false);
    toast({ 
        title: isCurrentClientCompleted ? "Gestión Actualizada" : "Visita Finalizada",
        variant: allTotalClientsDone ? "success" : "default"
    });
    
    if (!isAdmin) setTimeout(() => refetchData('routes'), 1500);
  };

  const myAssignedClients = useMemo(() => {
    const routeOwner = allUsers.find(u => u.id === selectedRoute?.createdBy);
    const ownerName = routeOwner?.name || user?.name;
    return availableClients.filter(c => c.ejecutivo === ownerName);
  }, [availableClients, selectedRoute, allUsers, user]);

  const filteredSearchClients = useMemo(() => {
    const term = addClientSearchTerm.toLowerCase();
    return myAssignedClients.filter(c => 
        c.nombre_cliente.toLowerCase().includes(term) || 
        c.nombre_comercial.toLowerCase().includes(term) ||
        String(c.ruc).includes(term)
    );
  }, [myAssignedClients, addClientSearchTerm]);

  const handleAddClientsToRoute = async () => {
    if (!selectedRoute || multiSelectedClients.length === 0 || isSaving) return;

    const needsObservation = multiSelectedClients.some(c => 
        currentRouteClientsFull.some(existing => {
            if (String(existing.ruc).trim() !== String(c.ruc).trim()) return false;
            const isTodayClient = isToday(existing.date instanceof Timestamp ? existing.date.toDate() : new Date(existing.date as any));
            return existing.visitStatus === 'Completado' || !isTodayClient;
        })
    );

    if (needsObservation && !reAdditionObservation.trim()) {
        toast({ title: "Observación requerida", description: "Por favor indica el motivo.", variant: "destructive" });
        return;
    }

    setIsSaving(true);
    lastLocalUpdateTimestamp.current = Date.now();

    const newClientsToAdd: ClientInRoute[] = multiSelectedClients.map(c => {
        const existing = currentRouteClientsFull.find(e => String(e.ruc).trim() === String(c.ruc).trim());
        const isAlreadyManaged = existing?.visitStatus === 'Completado';
        const isScheduledOtherDay = existing && !isToday(existing.date instanceof Timestamp ? existing.date.toDate() : new Date(existing.date as any));
        
        return {
            ruc: c.ruc,
            nombre_comercial: c.nombre_comercial,
            date: new Date(),
            visitStatus: 'Pendiente',
            status: 'Activo',
            origin: 'manual',
            isReadded: isAlreadyManaged || isScheduledOtherDay,
            reAdditionObservation: (isAlreadyManaged || isScheduledOtherDay) ? reAdditionObservation : undefined
        };
    });

    const nextFullList = [...currentRouteClientsFull, ...newClientsToAdd];
    
    try {
        await updateRoute(selectedRoute.id, { clients: sanitizeClientsForFirestore(nextFullList) });
        setCurrentRouteClientsFull(nextFullList);
        setMultiSelectedClients([]);
        setAddClientSearchTerm('');
        setReAdditionObservation('');
        setIsAddClientDialogOpen(false);
        toast({ title: "Clientes añadidos" });
        refetchData('routes');
    } catch (e) {
        toast({ title: "Error al añadir", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleSelectClient = (ruc: string) => {
      if (isSaving) return;
      if (isCurrentClientInProgress && activeRuc !== ruc && !isAdmin) {
          toast({ title: "Gestión en curso", description: "Finaliza la visita actual primero.", variant: "destructive" });
          return;
      }
      setActiveRuc(ruc);
  };

  const isFinishDisabled = useMemo(() => {
    if (!activeClient) return true;
    if (isSaving) return true;
    if (isCurrentClientCompleted && !isAdmin) return true;
    if (!activeClient.visitType) return true;
    if (activeClient.visitType === 'telefonica' && !activeClient.callObservation?.trim()) return true;
    return false;
  }, [activeClient, isSaving, isCurrentClientCompleted, isAdmin]);

  if (authLoading) return <div className="flex flex-col items-center justify-center h-[60vh] gap-4"><LoaderCircle className="animate-spin h-12 w-12 text-primary" /><p className="text-muted-foreground">Cargando gestión...</p></div>;

  return (
    <>
    <PageHeader title="Gestión de Ruta" description="Gestión diaria de visitas y ventas."/>
    
    {!isRouteStarted ? (
        <Card className="max-w-2xl mx-auto shadow-lg">
            <CardHeader>
                <CardTitle>Selecciona la Ruta a {isAdmin ? 'Supervisar' : 'Gestionar'}</CardTitle>
                <CardDescription>{isAdmin ? 'Acceso administrativo total habilitado.' : 'Solo rutas activas asignadas a ti.'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isAdmin && (
                    <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Filtrar por Agente</Label>
                        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                            <SelectTrigger className="h-10">
                                <Users className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Todos los agentes" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los agentes</SelectItem>
                                {allUsers.filter(u => u.role === 'Usuario' || u.role === 'Telemercaderista').map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase text-muted-foreground">Planificación</Label>
                    <Select onValueChange={(v) => { setSelectedRouteId(v); if(SELECTION_KEY) localStorage.setItem(SELECTION_KEY, v); }} value={selectedRouteId}>
                        <SelectTrigger className="h-12"><Route className="mr-2 h-5 w-5 text-primary" /><SelectValue placeholder="Elije una ruta" /></SelectTrigger>
                        <SelectContent>
                            {selectableRoutes.length > 0 ? (
                                selectableRoutes.map(r => (<SelectItem key={r.id} value={r.id}>{r.routeName} ({allUsers.find(u => u.id === r.createdBy)?.name})</SelectItem>))
                            ) : (
                                <SelectItem value="none" disabled>No hay rutas vigentes</SelectItem>
                            )}
                        </SelectContent>
                    </Select>
                </div>
                {selectedRoute && (
                    <Button onClick={() => { updateRoute(selectedRoute.id, {status: 'En Progreso'}).then(() => { setIsRouteStarted(true); refetchData('routes'); }); }} className="w-full h-12 text-lg font-bold">
                        <PlayCircle className="mr-2 h-6 w-6" /> INICIAR JORNADA
                    </Button>
                )}
            </CardContent>
        </Card>
    ) : (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-md h-fit">
            <CardHeader className="pb-3 px-4">
                <CardTitle className="text-lg truncate">{selectedRoute?.routeName}</CardTitle>
                <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-xs capitalize">{todayFormatted}</p>
                    {isAdmin && <Badge variant="outline" className="text-[9px] bg-primary/5">VISTA ADMIN</Badge>}
                </div>
            </CardHeader>
            <CardContent className="px-4">
                <div className="mb-6 space-y-3">
                    <div className="flex justify-between text-[10px] uppercase font-black">
                        <span>Progreso Hoy</span>
                        <span className="text-primary">{routeClients.filter(c => c.visitStatus === 'Completado').length} / {routeClients.length}</span>
                    </div>
                    <Progress value={(routeClients.filter(c => c.visitStatus === 'Completado').length / (routeClients.length || 1)) * 100} className="h-2" />
                    <Button variant="outline" className="w-full h-10 border-dashed border-2 font-bold" disabled={isCurrentClientInProgress && !isAdmin} onClick={() => setIsAddClientDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Añadir Cliente
                    </Button>
                </div>

                <div className="space-y-2">
                    {routeClients.map((c, i) => (
                        <div key={c.ruc} onClick={() => handleSelectClient(c.ruc)} className={cn(
                            "flex items-center justify-between p-3 bg-card border rounded-lg transition-all shadow-sm cursor-pointer", 
                            activeRuc === c.ruc ? "ring-2 ring-primary border-primary" : "hover:bg-accent/50", 
                            c.visitStatus === 'Completado' && !isAdmin && "opacity-50 grayscale bg-muted/30",
                            isCurrentClientInProgress && activeRuc !== c.ruc && !isAdmin && "opacity-30 cursor-not-allowed"
                        )}>
                            <div className="flex items-center gap-3 overflow-hidden">
                                <span className="text-[10px] font-black text-muted-foreground/40 w-4">{i + 1}</span>
                                <div className="min-w-0">
                                    <p className="font-bold text-sm truncate uppercase">{c.nombre_comercial}</p>
                                    <span className="text-[9px] text-muted-foreground truncate block uppercase font-mono">{c.ruc}</span>
                                </div>
                            </div>
                            {c.visitStatus === 'Completado' && <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

        <div className="lg:col-span-2">
            <Card className="shadow-lg border-t-4 border-t-primary min-h-[600px] flex flex-col">
                <CardHeader className="bg-muted/10 pb-6 min-h-[200px] flex flex-col justify-center">
                    {activeClient ? (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <h3 className="text-2xl font-black text-primary leading-tight uppercase">{activeClient.nombre_comercial}</h3>
                                {isCurrentClientCompleted && <Badge variant="success">COMPLETADA</Badge>}
                            </div>
                            <div className="flex items-start gap-3 p-4 bg-white/80 rounded-2xl border border-primary/10 shadow-sm">
                                <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <p className="text-sm font-semibold text-muted-foreground leading-relaxed">{activeClient.direccion}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4 text-center">
                            <User className="h-16 w-16 text-primary/30" />
                            <p className="font-black text-xl uppercase">selecciona un cliente para gestionar</p>
                        </div>
                    )}
                </CardHeader>
                
                <CardContent className="space-y-8 pt-6 flex-1">
                    {activeClient && (
                        <div className="space-y-8">
                            <div className={cn("p-5 rounded-2xl border-2 transition-all", activeClient.checkInTime ? "bg-green-50 border-green-200" : "bg-muted/20 border-dashed")}>
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <LogIn className={cn("h-8 w-8", activeClient.checkInTime ? "text-green-600" : "text-muted-foreground")} />
                                        <div>
                                            <h4 className="font-black text-sm uppercase">1. Entrada</h4>
                                            <p className="text-xs font-bold text-muted-foreground">{activeClient.checkInTime ? `REGISTRADO: ${activeClient.checkInTime}` : 'Presiona al llegar'}</p>
                                        </div>
                                    </div>
                                    {!activeClient.checkInTime && <Button size="lg" onClick={handleCheckIn} disabled={isSaving} className="font-black shadow-lg">REGISTRAR ENTRADA</Button>}
                                </div>
                            </div>

                            <div className={cn("space-y-8", !activeClient.checkInTime && !isAdmin && "opacity-20 pointer-events-none")}>
                                <div className="space-y-4">
                                    <h4 className="font-black text-sm uppercase flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> 2. Datos de Gestión</h4>
                                    <RadioGroup onValueChange={(v: any) => handleFieldChange('visitType', v)} value={activeClient.visitType} className="grid grid-cols-2 gap-4" disabled={(isCurrentClientCompleted && !isAdmin) || isSaving}>
                                        <Label className={cn("flex flex-col items-center gap-2 border-2 p-4 rounded-xl cursor-pointer transition-all", activeClient.visitType === 'presencial' ? "border-primary bg-primary/5" : "border-muted")}>
                                            <RadioGroupItem value="presencial" className="sr-only" /><MapPin className="h-6 w-6" /><span className="text-[10px] font-black uppercase">PRESENCIAL</span>
                                        </Label>
                                        <Label className={cn("flex flex-col items-center gap-2 border-2 p-4 rounded-xl cursor-pointer transition-all", activeClient.visitType === 'telefonica' ? "border-primary bg-primary/5" : "border-muted")}>
                                            <RadioGroupItem value="telefonica" className="sr-only" /><Phone className="h-6 w-6" /><span className="text-[10px] font-black uppercase">TELEFÓNICA</span>
                                        </Label>
                                    </RadioGroup>
                                </div>

                                {activeClient.visitType === 'telefonica' && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                        <Label className="text-[10px] font-black uppercase flex items-center gap-2">
                                            <MessageSquare className="h-3 w-3" /> Observación de Llamada (Obligatoria)
                                        </Label>
                                        <Textarea 
                                            placeholder="Detalla lo conversado en la llamada..." 
                                            className="h-24 font-bold text-sm border-2 focus:border-primary"
                                            value={activeClient.callObservation || ''}
                                            onChange={e => handleFieldChange('callObservation', e.target.value)}
                                            disabled={(isCurrentClientCompleted && !isAdmin) || isSaving}
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-black uppercase">Venta ($)</Label>
                                        <Input type="text" placeholder="0.00" className="h-12 text-lg font-bold" value={activeClient.valorVenta ?? ''} onChange={e => handleFieldChange('valorVenta', e.target.value)} disabled={(isCurrentClientCompleted && !isAdmin) || isSaving} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-black uppercase">Cobro ($)</Label>
                                        <Input type="text" placeholder="0.00" className="h-12 text-lg font-bold" value={activeClient.valorCobro ?? ''} onChange={e => handleFieldChange('valorCobro', e.target.value)} disabled={(isCurrentClientCompleted && !isAdmin) || isSaving} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] font-black uppercase">Devolución ($)</Label>
                                        <Input type="text" placeholder="0.00" className="h-12 text-lg font-bold" value={activeClient.devoluciones ?? ''} onChange={e => handleFieldChange('devoluciones', e.target.value)} disabled={(isCurrentClientCompleted && !isAdmin) || isSaving} />
                                    </div>
                                </div>
                                
                                <Button onClick={handleConfirmCheckOut} className="w-full h-16 text-lg font-black mt-6 rounded-2xl shadow-xl" disabled={isFinishDisabled}>
                                    {isSaving ? <LoaderCircle className="animate-spin mr-2" /> : <LogOut className="mr-2 h-6 w-6" />} 
                                    {isCurrentClientCompleted ? (isAdmin ? "ACTUALIZAR GESTIÓN" : "VISITA FINALIZADA") : "FINALIZAR VISITA"}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
    )}

    <Dialog open={isAddClientDialogOpen} onOpenChange={setIsAddClientDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>Añadir Clientes a Hoy</DialogTitle></DialogHeader>
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                <Input placeholder="Buscar por RUC o Nombre..." value={addClientSearchTerm} onChange={e => setAddClientSearchTerm(e.target.value)} />
                <ScrollArea className="flex-1 border rounded-lg p-2">
                    <div className="space-y-2">
                        {filteredSearchClients.map(c => {
                            const isSel = multiSelectedClients.some(sc => sc.ruc === c.ruc);
                            return (
                                <div key={c.ruc} className={cn("p-3 rounded-lg border flex items-center gap-3 cursor-pointer", isSel && "bg-primary/5 border-primary")} onClick={() => setMultiSelectedClients(isSel ? multiSelectedClients.filter(sc => sc.ruc !== c.ruc) : [...multiSelectedClients, c])}>
                                    <Checkbox checked={isSel} />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold uppercase">{c.nombre_comercial}</p>
                                        <p className="text-[10px] text-muted-foreground">{c.ruc}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
                <Textarea placeholder="Observación obligatoria..." value={reAdditionObservation} onChange={e => setReAdditionObservation(e.target.value)} />
            </div>
            <DialogFooter>
                <Button onClick={handleAddClientsToRoute} disabled={multiSelectedClients.length === 0 || !reAdditionObservation.trim() || isSaving}>Añadir Seleccionados</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

export default function RouteManagementPage() {
  return (
    <Suspense fallback={<div className="p-8">Cargando panel...</div>}>
      <RouteManagementContent />
    </Suspense>
  );
}
