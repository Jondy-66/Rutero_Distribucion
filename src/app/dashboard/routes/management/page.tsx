'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Search, GripVertical, MapPin, LoaderCircle, LogIn, LogOut, CheckCircle, Phone, User, PlusCircle, PlayCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { updateRoute } from '@/lib/firebase/firestore';
import type { Client, RoutePlan, ClientInRoute } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Timestamp, GeoPoint } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

type RouteClient = Client & ClientInRoute;

export default function RouteManagementPage() {
  const { user, clients: availableClients, routes: allRoutes, loading: authLoading, refetchData } = useAuth();
  const { toast } = useToast();
  
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [isRouteStarted, setIsRouteStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [todayFormatted, setTodayFormatted] = useState('');
  
  const [currentRouteClientsFull, setCurrentRouteClientsFull] = useState<ClientInRoute[]>([]);
  const [activeClient, setActiveClient] = useState<RouteClient | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [visitType, setVisitType] = useState<'presencial' | 'telefonica' | undefined>();
  const [callObservation, setCallObservation] = useState('');

  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [addClientSearchTerm, setAddClientSearchTerm] = useState('');
  const [multiSelectedClients, setMultiSelectedClients] = useState<Client[]>([]);

  const [dndEnabled, setDndEnabled] = useState(false);
  const isInitialMount = useRef(true);
  const lastSyncedRouteId = useRef<string | undefined>(undefined);

  useEffect(() => {
    setTodayFormatted(format(new Date(), "EEEE, d 'de' MMMM", { locale: es }));
    const animation = requestAnimationFrame(() => setDndEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setDndEnabled(false);
    };
  }, []);

  const SELECTION_KEY = user ? `mgmt_selected_route_${user.id}` : null;
  const DRAFT_KEY = (rid: string, ruc: string) => user ? `mgmt_draft_${user.id}_${rid}_${ruc}` : null;

  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) return undefined;
    return allRoutes.find(r => r.id === selectedRouteId);
  }, [selectedRouteId, allRoutes]);
  
  useEffect(() => {
    if (!authLoading && isInitialMount.current && SELECTION_KEY) {
      const savedId = localStorage.getItem(SELECTION_KEY);
      if (savedId && allRoutes.some(r => r.id === savedId)) {
        setSelectedRouteId(savedId);
      }
      isInitialMount.current = false;
    }
  }, [authLoading, SELECTION_KEY, allRoutes]);

  // Sincronización Blindada: Fusión de datos mejorada para dar prioridad a acciones locales (Check-In)
  useEffect(() => {
    if (selectedRoute) {
        if (selectedRoute.id !== lastSyncedRouteId.current) {
            setCurrentRouteClientsFull(selectedRoute.clients || []);
            setIsRouteStarted(['En Progreso', 'Incompleta'].includes(selectedRoute.status));
            lastSyncedRouteId.current = selectedRoute.id;
        } else if (!isSaving) {
            setCurrentRouteClientsFull(prev => {
                const serverClients = selectedRoute.clients || [];
                const merged = serverClients.map(sc => {
                    const local = prev.find(pc => pc.ruc === sc.ruc);
                    if (local) {
                        // REGLA DE ORO: Si localmente ya tiene entrada o está completado, NO sobrescribir con datos viejos del servidor
                        const hasLocalCheckIn = !!local.checkInTime;
                        const hasServerCheckIn = !!sc.checkInTime;
                        const isLocallyCompleted = local.visitStatus === 'Completado';
                        const isServerCompleted = sc.visitStatus === 'Completado';

                        if ((hasLocalCheckIn && !hasServerCheckIn) || (isLocallyCompleted && !isServerCompleted)) {
                            return { ...sc, ...local }; // Mantener versión local más avanzada
                        }
                        
                        // Si localmente está activo para hoy, mantenerlo así
                        const isLocallyActiveToday = local.status === 'Activo' && local.date && isToday(local.date);
                        if (isLocallyActiveToday && sc.status === 'Eliminado') {
                            return { ...sc, ...local };
                        }
                    }
                    return sc;
                });
                // Añadir clientes que aún no llegan al servidor (optimistas)
                const optimisticAdds = prev.filter(pc => !serverClients.some(sc => sc.ruc === pc.ruc));
                return [...merged, ...optimisticAdds];
            });
            setIsRouteStarted(['En Progreso', 'Incompleta'].includes(selectedRoute.status));
        }
    } else {
        setCurrentRouteClientsFull([]);
        setIsRouteStarted(false);
        lastSyncedRouteId.current = undefined;
    }
  }, [selectedRoute, isSaving]);

  const clientsMap = useMemo(() => {
    const map = new Map<string, Client>();
    availableClients.forEach(c => map.set(c.ruc, c));
    return map;
  }, [availableClients]);
  
  const routeClients = useMemo(() => {
    return currentRouteClientsFull
        .filter(c => c.status !== 'Eliminado' && (c.date ? isToday(c.date) : false))
        .map(c => {
            const details = clientsMap.get(c.ruc);
            return {
                id: details?.id || c.ruc,
                ejecutivo: details?.ejecutivo || user?.name || '',
                nombre_cliente: details?.nombre_cliente || c.nombre_comercial,
                nombre_comercial: c.nombre_comercial,
                direccion: details?.direccion || 'Dirección no disponible',
                provincia: details?.provincia || '',
                canton: details?.canton || '',
                latitud: details?.latitud || 0,
                longitud: details?.longitud || 0,
                status: details?.status || 'active',
                ...c,
                valorVenta: String(c.valorVenta ?? ''),
                valorCobro: String(c.valorCobro ?? ''),
                devoluciones: String(c.devoluciones ?? ''),
            } as RouteClient;
        });
  }, [currentRouteClientsFull, clientsMap, user]);

   useEffect(() => {
    const nextPending = routeClients.find(c => c.visitStatus !== 'Completado');
    if (nextPending) {
        if (!activeClient || activeClient.visitStatus === 'Completado' || activeClient.ruc !== nextPending.ruc) {
            setActiveClient(nextPending);
            if (selectedRouteId) {
                const key = DRAFT_KEY(selectedRouteId, nextPending.ruc);
                if (key) {
                    const saved = localStorage.getItem(key);
                    if (saved) {
                        try {
                            const draft = JSON.parse(saved);
                            setVisitType(draft.visitType);
                            setCallObservation(draft.callObservation || '');
                        } catch (e) { console.error(e); }
                    } else {
                        setVisitType(undefined);
                        setCallObservation('');
                    }
                }
            }
        } else {
            // Sincronizar cambios en el cliente activo (como el checkInTime recién marcado)
            const updatedActive = routeClients.find(c => c.ruc === activeClient.ruc);
            if (updatedActive && (updatedActive.checkInTime !== activeClient.checkInTime || updatedActive.visitStatus !== activeClient.visitStatus)) {
                setActiveClient(updatedActive);
            }
        }
    } else {
        setActiveClient(null);
    }
  }, [routeClients, selectedRouteId, activeClient?.ruc, activeClient?.visitStatus, activeClient?.checkInTime]);

  const handleRouteSelect = (routeId: string) => {
      setSelectedRouteId(routeId);
      if (SELECTION_KEY) localStorage.setItem(SELECTION_KEY, routeId);
  }

  const getCurrentLocation = (): Promise<{lat: number, lng: number} | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const handleStartRoute = async () => {
      if (!selectedRoute) return;
      setIsStarting(true);
      try {
          await updateRoute(selectedRoute.id, { status: 'En Progreso' });
          await refetchData('routes');
          setIsRouteStarted(true);
          toast({ title: "Ruta Iniciada" });
      } catch (error) { console.error(error); } finally { setIsStarting(false); }
  }

  const handleCheckIn = async () => {
    if (!selectedRoute || !activeClient) return;
    const time = format(new Date(), 'HH:mm:ss');
    
    // UI INSTANTÁNEA (FUNCIONAL): Actualizamos el estado local antes de llamar a la base de datos
    setCurrentRouteClientsFull(prev => {
        const updated = prev.map(c => c.ruc === activeClient.ruc ? { ...c, checkInTime: time } : c);
        
        // Llamada asíncrona pero sin bloquear la UI
        (async () => {
            setIsLocating(true);
            setIsSaving(true);
            try {
                const coords = await getCurrentLocation();
                const location = coords ? new GeoPoint(coords.lat, coords.lng) : null;
                const finalUpdate = updated.map(c => c.ruc === activeClient.ruc ? { ...c, checkInLocation: location } : c);
                await updateRoute(selectedRoute.id, { clients: finalUpdate });
                await refetchData('routes');
                toast({ title: "Entrada Registrada" });
            } catch (e) { 
                console.error(e); 
            } finally { 
                setIsSaving(false); 
                setIsLocating(false);
            }
        })();

        return updated;
    });
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedRoute || !activeClient || !visitType) {
        toast({ title: "Atención", description: "Selecciona el tipo de visita.", variant: "destructive" });
        return;
    }

    const time = format(new Date(), 'HH:mm:ss');
    setIsLocating(true);
    setIsSaving(true);

    // UI Instantánea
    setCurrentRouteClientsFull(prev => {
        const updated = prev.map(c => {
            if (c.ruc === activeClient.ruc) {
                return { 
                    ...c, 
                    checkOutTime: time, 
                    visitStatus: 'Completado' as const, 
                    visitType,
                    valorVenta: parseFloat(activeClient.valorVenta) || 0,
                    valorCobro: parseFloat(activeClient.valorCobro) || 0,
                    devoluciones: parseFloat(activeClient.devoluciones) || 0,
                };
            }
            return c;
        });

        // Proceso de guardado
        (async () => {
            try {
                const coords = await getCurrentLocation();
                const location = coords ? new GeoPoint(coords.lat, coords.lng) : null;
                const finalWithLocation = updated.map(c => {
                    if (c.ruc === activeClient.ruc) {
                        return { ...c, checkOutLocation: location, callObservation: visitType === 'telefonica' ? callObservation : null };
                    }
                    return c;
                });
                
                const allDone = finalWithLocation.filter(c => c.status !== 'Eliminado' && (c.date ? isToday(c.date) : false)).every(c => c.visitStatus === 'Completado');
                const newStatus = allDone ? 'Completada' : selectedRoute.status;

                await updateRoute(selectedRoute.id, { clients: finalWithLocation, status: newStatus });
                await refetchData('routes');
                
                const key = DRAFT_KEY(selectedRoute.id, activeClient.ruc);
                if (key) localStorage.removeItem(key);
                
                toast({ title: "Visita Finalizada" });
                setVisitType(undefined);
                setCallObservation('');
            } catch(e) { 
                console.error(e); 
            } finally { 
                setIsSaving(false); 
                setIsLocating(false);
            }
        })();

        return updated;
    });
  }

  const onDragEnd = async (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || !selectedRoute || source.index === destination.index) return;
    
    const displayed = Array.from(routeClients);
    const [moved] = displayed.splice(source.index, 1);
    displayed.splice(destination.index, 0, moved);
    
    const newOrderRucs = displayed.map(c => c.ruc);
    const activeRucsSet = new Set(routeClients.map(c => c.ruc));
    
    let activePtr = 0;
    const finalFull = currentRouteClientsFull.map(c => {
        if (activeRucsSet.has(c.ruc)) {
            const nextRuc = newOrderRucs[activePtr++];
            return currentRouteClientsFull.find(oc => oc.ruc === nextRuc)!;
        }
        return c;
    });

    setCurrentRouteClientsFull(finalFull);
    setIsSaving(true);
    try {
        await updateRoute(selectedRoute.id, { clients: finalFull });
        await refetchData('routes');
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleConfirmMultiAdd = async () => {
    if (!selectedRoute || multiSelectedClients.length === 0) return;
    const todayDate = new Date();
    const activeRucsToday = new Set(routeClients.map(c => c.ruc));
    const updatedFullList = [...currentRouteClientsFull];
    let added = 0;

    for (const selected of multiSelectedClients) {
        if (activeRucsToday.has(selected.ruc)) continue;
        const idx = updatedFullList.findIndex(c => c.ruc === selected.ruc);
        if (idx !== -1) {
            updatedFullList[idx] = { ...updatedFullList[idx], date: todayDate, status: 'Activo', origin: 'manual', visitStatus: 'Pendiente', checkInTime: null, checkOutTime: null };
        } else {
            updatedFullList.push({ ruc: selected.ruc, nombre_comercial: selected.nombre_comercial, date: todayDate, origin: 'manual', status: 'Activo', visitStatus: 'Pendiente' });
        }
        added++;
    }
    
    if (added > 0) {
        setCurrentRouteClientsFull(updatedFullList);
        setIsSaving(true);
        try {
            await updateRoute(selectedRoute.id, { clients: updatedFullList });
            await refetchData('routes');
            toast({ title: "Clientes Añadidos", description: `Se añadieron ${added} clientes a tu jornada.` });
        } catch (e) { console.error(e); } finally { setIsSaving(false); }
    }
    setIsAddClientDialogOpen(false);
    setMultiSelectedClients([]);
  };

  if (authLoading) return <div className="flex items-center justify-center h-64"><LoaderCircle className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <>
    <PageHeader title="Gestión de Ruta" description="Gestión optimizada de visitas diarias."/>
    {!isRouteStarted ? (
        <Card className="max-w-2xl mx-auto shadow-lg border-primary/20">
            <CardHeader><CardTitle>Selecciona una Ruta</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <Select onValueChange={handleRouteSelect} value={selectedRouteId}>
                    <SelectTrigger className="h-12"><Route className="mr-2 h-5 w-5 text-primary" /><SelectValue placeholder="Elije una ruta planificada" /></SelectTrigger>
                    <SelectContent>
                        {allRoutes.filter(r => r.createdBy === user?.id && ['Planificada', 'En Progreso', 'Incompleta', 'Rechazada', 'Pendiente de Aprobación'].includes(r.status))
                            .map(r => (<SelectItem key={r.id} value={r.id}>{r.routeName} ({r.status})</SelectItem>))
                        }
                    </SelectContent>
                </Select>
                {selectedRoute && (
                    <Button onClick={handleStartRoute} disabled={isStarting || selectedRoute.status === 'Pendiente de Aprobación'} className="w-full h-12 text-lg font-semibold">
                        {isStarting ? <LoaderCircle className="animate-spin mr-2" /> : <PlayCircle className="mr-2 h-5 w-5" />}
                        {selectedRoute.status === 'Pendiente de Aprobación' ? 'Esperando Aprobación' : (selectedRoute.status === 'En Progreso' ? 'Continuar Gestión' : 'Iniciar Gestión')}
                    </Button>
                )}
            </CardContent>
        </Card>
    ) : (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-md">
            <CardHeader className="pb-3">
                <CardTitle className="text-xl">{selectedRoute?.routeName}</CardTitle>
                <p className="text-primary font-bold text-lg capitalize">{todayFormatted}</p>
            </CardHeader>
            <CardContent>
                <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                        <span>Progreso de Hoy</span>
                        <span className="font-bold">{routeClients.filter(c => c.visitStatus === 'Completado').length} / {routeClients.length}</span>
                    </div>
                    <Progress value={(routeClients.filter(c => c.visitStatus === 'Completado').length / (routeClients.length || 1)) * 100} />
                </div>

                <Dialog open={isAddClientDialogOpen} onOpenChange={setIsAddClientDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full mb-4 border-dashed border-primary text-primary hover:bg-primary/5">
                            <PlusCircle className="mr-2 h-4 w-4" /> Añadir Cliente a la Ruta
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
                        <DialogHeader><DialogTitle>Añadir Clientes</DialogTitle></DialogHeader>
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar por nombre o RUC..." className="pl-9" value={addClientSearchTerm} onChange={e => setAddClientSearchTerm(e.target.value)}/>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="space-y-2 pr-2">
                                {availableClients.filter(c => {
                                    const term = addClientSearchTerm.toLowerCase();
                                    return (user?.role === 'Administrador' || c.ejecutivo === user?.name) && 
                                           (c.nombre_cliente.toLowerCase().includes(term) || c.ruc.includes(term));
                                }).map(client => (
                                    <div key={client.id} className={cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer", multiSelectedClients.some(c => c.ruc === client.ruc) ? "bg-primary/5 border-primary" : "hover:bg-accent")} onClick={() => {
                                        setMultiSelectedClients(prev => prev.some(c => c.ruc === client.ruc) ? prev.filter(c => c.ruc !== client.ruc) : [...prev, client]);
                                    }}>
                                        <Checkbox checked={multiSelectedClients.some(c => c.ruc === client.ruc)} />
                                        <div className="min-w-0"><p className="font-bold text-sm">{client.nombre_comercial}</p><p className="text-[10px] text-muted-foreground uppercase">{client.ruc}</p></div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                        <DialogFooter className="border-t pt-4">
                            <span className="text-xs text-muted-foreground mr-auto">{multiSelectedClients.length} seleccionados</span>
                            <Button size="sm" onClick={handleConfirmMultiAdd} disabled={isSaving || multiSelectedClients.length === 0}>Añadir a Hoy</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Separator className="my-4" />
                {dndEnabled && (
                    <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="clients">
                            {(provided) => (
                                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                    {routeClients.map((c, i) => (
                                        <Draggable key={c.ruc} draggableId={c.ruc} index={i} isDragDisabled={c.visitStatus === 'Completado' || isSaving}>
                                            {(p) => (
                                                <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className={cn("flex items-center justify-between p-3 bg-card border rounded-lg transition-all shadow-sm", activeClient?.ruc === c.ruc ? "ring-2 ring-primary" : "hover:border-primary/30", c.visitStatus === 'Completado' && "bg-green-50/50 border-green-200")}>
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <GripVertical className={cn("h-4 w-4 text-muted-foreground shrink-0", (c.visitStatus === 'Completado' || isSaving) && "opacity-0")}/>
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={cn("font-medium break-words", c.visitStatus === 'Completado' && "text-green-700")}>{c.nombre_comercial}</span>
                                                                {c.origin === 'manual' && <Badge variant="secondary" className="text-[8px] h-4 bg-blue-100 text-blue-700">Nuevo</Badge>}
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground">{c.ruc}</span>
                                                        </div>
                                                    </div>
                                                    {c.visitStatus === 'Completado' ? <CheckCircle className="h-5 w-5 text-green-500" /> : <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">#{i + 1}</span>}
                                                </div>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </div>
                            )}
                        </Droppable>
                    </DragDropContext>
                )}
            </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-lg border-primary/10 overflow-hidden">
                <div className="h-2 bg-primary" />
                <CardHeader>
                    <div className="flex justify-between items-start gap-4">
                        <div className="flex-1 min-w-0">
                            <CardTitle className="text-xl sm:text-2xl">{activeClient ? activeClient.nombre_comercial : 'Jornada Finalizada'}</CardTitle>
                            {activeClient && <CardDescription className="whitespace-normal break-words">{activeClient.nombre_cliente} • {activeClient.direccion}</CardDescription>}
                        </div>
                        {activeClient && (
                            <div className="flex items-center gap-2 border border-primary text-primary rounded-full px-4 py-1.5 bg-white shadow-sm shrink-0">
                                <User className="h-4 w-4" />
                                <span className="text-[11px] font-bold uppercase tracking-tight">{activeClient.ejecutivo}</span>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                    {activeClient ? (
                        <div className="space-y-8">
                            <div className={cn("p-5 rounded-xl border-2 transition-all", activeClient.checkInTime ? "bg-green-50 border-green-200" : "bg-muted/30 border-dashed border-muted-foreground/30")}>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className={cn("p-3 rounded-full shrink-0", activeClient.checkInTime ? "bg-green-500 text-white" : "bg-muted text-muted-foreground")}>
                                            <LogIn className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-base sm:text-lg">1. Registro de Entrada</h4>
                                            <p className="text-xs text-muted-foreground">{activeClient.checkInTime ? `Marcado: ${activeClient.checkInTime}` : 'Pendiente'}</p>
                                        </div>
                                    </div>
                                    {!activeClient.checkInTime && (
                                        <Button onClick={handleCheckIn} disabled={isSaving || isLocating} className="shadow-md">
                                            {isLocating ? <LoaderCircle className="animate-spin mr-2" /> : "Marcar Entrada"}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className={cn("space-y-8 transition-all duration-500", !activeClient.checkInTime && "opacity-40 pointer-events-none")}>
                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg flex items-center gap-2"><Phone className="h-5 w-5 text-primary" /> 2. Tipo de Visita</h4>
                                    <RadioGroup onValueChange={(v: any) => setVisitType(v)} value={visitType} className="grid grid-cols-2 gap-4">
                                        <Label className={cn("flex flex-col items-center justify-center gap-2 border-2 p-4 rounded-xl cursor-pointer", visitType === 'presencial' && "border-primary bg-primary/5")}>
                                            <RadioGroupItem value="presencial" className="sr-only" />
                                            <MapPin className={cn("h-6 w-6", visitType === 'presencial' ? "text-primary" : "text-muted-foreground")} />
                                            <span className="font-semibold text-sm">Presencial</span>
                                        </Label>
                                        <Label className={cn("flex flex-col items-center justify-center gap-2 border-2 p-4 rounded-xl cursor-pointer", visitType === 'telefonica' && "border-primary bg-primary/5")}>
                                            <RadioGroupItem value="telefonica" className="sr-only" />
                                            <Phone className={cn("h-6 w-6", visitType === 'telefonica' ? "text-primary" : "text-muted-foreground")} />
                                            <span className="font-semibold text-sm">Telefónica</span>
                                        </Label>
                                    </RadioGroup>
                                    {visitType === 'telefonica' && (
                                        <Textarea placeholder="Resultado de la llamada..." value={callObservation} onChange={e => setCallObservation(e.target.value)}/>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg flex items-center gap-2"><LogIn className="h-5 w-5 text-primary" /> 3. Datos de la Gestión</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                        <div className="space-y-2"><Label>Venta ($)</Label><Input type="number" placeholder="0.00" value={activeClient.valorVenta} onChange={e => setActiveClient(prev => prev ? {...prev, valorVenta: e.target.value} : null)}/></div>
                                        <div className="space-y-2"><Label>Cobro ($)</Label><Input type="number" placeholder="0.00" value={activeClient.valorCobro} onChange={e => setActiveClient(prev => prev ? {...prev, valorCobro: e.target.value} : null)}/></div>
                                        <div className="space-y-2"><Label>Devoluciones ($)</Label><Input type="number" placeholder="0.00" value={activeClient.devoluciones} onChange={e => setActiveClient(prev => prev ? {...prev, devoluciones: e.target.value} : null)}/></div>
                                    </div>
                                    <Button onClick={handleConfirmCheckOut} className="w-full h-14 text-xl font-bold mt-4 shadow-lg" disabled={isSaving || !visitType || isLocating}>
                                        {isSaving ? <LoaderCircle className="animate-spin mr-2" /> : <LogOut className="mr-2 h-6 w-6" />}
                                        Finalizar Visita
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-16">
                            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
                            <h3 className="text-3xl font-bold mb-2">¡Ruta Completada!</h3>
                            <Button variant="outline" className="mt-8" onClick={() => window.location.href='/dashboard'}>Volver al Panel</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
    )}
    </>
  );
}
