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
        handleRouteSelect(savedId);
      }
      isInitialMount.current = false;
    }
  }, [authLoading, SELECTION_KEY, allRoutes]);

  // Sincronización Inteligente: Protege el estado local de "Marcar Entrada"
  useEffect(() => {
    if (selectedRoute) {
        if (selectedRoute.id !== lastSyncedRouteId.current) {
            setCurrentRouteClientsFull(selectedRoute.clients || []);
            setIsRouteStarted(['En Progreso', 'Incompleta'].includes(selectedRoute.status));
            lastSyncedRouteId.current = selectedRoute.id;
        } else if (!isSaving) {
            setCurrentRouteClientsFull(prev => {
                const serverClients = selectedRoute.clients || [];
                return serverClients.map(sc => {
                    const localClient = prev.find(pc => pc.ruc === sc.ruc);
                    if (localClient) {
                        // Mantenemos los datos locales de check-in si el servidor aún no los tiene
                        const isLocallyCheckedIn = !!localClient.checkInTime;
                        const isServerNoCheckIn = !sc.checkInTime;
                        const isLocallyCompleted = localClient.visitStatus === 'Completado';
                        const isServerPending = sc.visitStatus !== 'Completado';

                        if ((isLocallyCheckedIn && isServerNoCheckIn) || (isLocallyCompleted && isServerPending)) {
                            return { ...sc, ...localClient };
                        }
                    }
                    return sc;
                });
            });
            setIsRouteStarted(['En Progreso', 'Incompleta'].includes(selectedRoute.status));
        }
    } else {
        setCurrentRouteClientsFull([]);
        setIsRouteStarted(false);
        lastSyncedRouteId.current = undefined;
    }
  }, [selectedRoute, isSaving]);
  
  const routeClients = useMemo(() => {
    return currentRouteClientsFull
        .filter(c => {
            if (c.status === 'Eliminado') return false;
            // Filtro por hoy: Las fechas en el estado son Date objects gracias al transform de AuthContext
            return c.date ? isToday(c.date) : false;
        })
        .map(c => {
            const details = availableClients.find(ac => ac.ruc === c.ruc);
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
                promociones: String(c.promociones ?? ''),
                medicacionFrecuente: String(c.medicacionFrecuente ?? ''),
            } as RouteClient;
        });
  }, [currentRouteClientsFull, availableClients, user]);

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
        }
    } else {
        setActiveClient(null);
    }
  }, [routeClients, selectedRouteId, activeClient?.visitStatus]);

  useEffect(() => {
    if (activeClient && selectedRouteId && !activeClient.visitStatus) {
        const key = DRAFT_KEY(selectedRouteId, activeClient.ruc);
        if (key) {
            localStorage.setItem(key, JSON.stringify({
                visitType, 
                callObservation,
                valorVenta: activeClient.valorVenta,
                valorCobro: activeClient.valorCobro,
                devoluciones: activeClient.devoluciones,
            }));
        }
    }
  }, [activeClient, visitType, callObservation, selectedRouteId]);

  const handleRouteSelect = (routeId: string) => {
      setSelectedRouteId(routeId);
      if (SELECTION_KEY) localStorage.setItem(SELECTION_KEY, routeId);
  }

  const getCurrentLocation = (): Promise<{lat: number, lng: number} | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast({ title: "Error", description: "GPS no soportado.", variant: "destructive" });
        return resolve(null);
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => {
          toast({ title: "Aviso", description: "No se obtuvo ubicación exacta." });
          resolve(null);
        },
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
    
    // Actualización optimista: Bloquea el estado en la UI de inmediato
    const optimisticUpdated = currentRouteClientsFull.map(c => 
        c.ruc === activeClient.ruc ? { ...c, checkInTime: time } : c
    );
    setCurrentRouteClientsFull(optimisticUpdated);
    
    setIsLocating(true);
    setIsSaving(true);
    try {
        const coords = await getCurrentLocation();
        const location = coords ? new GeoPoint(coords.lat, coords.lng) : null;
        
        const finalUpdated = currentRouteClientsFull.map(c => 
            c.ruc === activeClient.ruc ? { ...c, checkInTime: time, checkInLocation: location } : c
        );
        
        await updateRoute(selectedRoute.id, { clients: finalUpdated });
        await refetchData('routes');
        toast({ title: "Entrada Registrada" });
    } catch (e) { 
        setCurrentRouteClientsFull(prev => prev.map(c => c.ruc === activeClient.ruc ? { ...c, checkInTime: null } : c));
        console.error(e); 
        toast({ title: "Error", description: "No se pudo registrar la entrada.", variant: "destructive" });
    } finally { 
        setIsSaving(false); 
        setIsLocating(false);
    }
  };

  const handleClientValueChange = (ruc: string, field: string, value: string) => {
    setActiveClient(prev => prev && prev.ruc === ruc ? { ...prev, [field]: value } : prev);
  };

  const parseSafeFloat = (val: any) => {
    if (!val) return 0;
    const p = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
    return isFinite(p) ? p : 0;
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedRoute || !activeClient || !visitType) {
        toast({ title: "Atención", description: "Selecciona el tipo de visita.", variant: "destructive" });
        return;
    }

    setIsLocating(true);
    const time = format(new Date(), 'HH:mm:ss');
    
    // Actualización optimista de finalización
    const optimisticUpdated = currentRouteClientsFull.map(c => {
        if (c.ruc === activeClient.ruc) {
            return { 
                ...c, 
                checkOutTime: time, 
                visitStatus: 'Completado' as const, 
                visitType,
                valorVenta: parseSafeFloat(activeClient.valorVenta),
                valorCobro: parseSafeFloat(activeClient.valorCobro),
                devoluciones: parseSafeFloat(activeClient.devoluciones),
            };
        }
        return c;
    });
    setCurrentRouteClientsFull(optimisticUpdated);

    setIsSaving(true);
    try {
        const coords = await getCurrentLocation();
        const location = coords ? new GeoPoint(coords.lat, coords.lng) : null;
        
        const finalUpdated = currentRouteClientsFull.map(c => {
            if (c.ruc === activeClient.ruc) {
                return { 
                    ...c, 
                    checkOutTime: time, 
                    checkOutLocation: location,
                    visitStatus: 'Completado' as const, 
                    visitType,
                    valorVenta: parseSafeFloat(activeClient.valorVenta),
                    valorCobro: parseSafeFloat(activeClient.valorCobro),
                    devoluciones: parseSafeFloat(activeClient.devoluciones),
                    callObservation: visitType === 'telefonica' ? (callObservation || null) : null
                };
            }
            return c;
        });
        
        const activeClients = finalUpdated.filter(c => c.status !== 'Eliminado');
        const allDone = activeClients.every(c => c.visitStatus === 'Completado');
        let newStatus = selectedRoute.status;
        if (allDone) newStatus = 'Completada';

        await updateRoute(selectedRoute.id, { clients: finalUpdated, status: newStatus });
        await refetchData('routes');
        
        const key = DRAFT_KEY(selectedRoute.id, activeClient.ruc);
        if (key) localStorage.removeItem(key);
        
        toast({ title: "Visita Finalizada" });
        setVisitType(undefined);
        setCallObservation('');
    } catch(e) { 
        console.error(e); 
        toast({ title: "Error", description: "No se pudo guardar la visita.", variant: "destructive" });
    } finally { 
        setIsSaving(false); 
        setIsLocating(false);
    }
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
    } catch (e) { 
        console.error(e); 
        toast({ title: "Error", description: "No se pudo cambiar el orden.", variant: "destructive" });
    } finally { setIsSaving(false); }
  };

  const toggleClientSelection = (client: Client) => {
    setMultiSelectedClients(prev => 
        prev.some(c => c.ruc === client.ruc) ? prev.filter(c => c.ruc !== client.ruc) : [...prev, client]
    );
  };

  const handleConfirmMultiAdd = async () => {
    if (!selectedRoute || multiSelectedClients.length === 0) return;
    
    // Identificamos RUCs existentes para evitar duplicados en la ruta maestra
    const existingRucs = new Set(currentRouteClientsFull.map(c => c.ruc));
    
    const newClientsToAdd: ClientInRoute[] = multiSelectedClients
        .filter(c => !existingRucs.has(c.ruc)) // Solo los que no están en la ruta
        .map(c => ({
            ruc: c.ruc,
            nombre_comercial: c.nombre_comercial,
            date: new Date(), // Asignamos fecha de hoy para que pase el filtro isToday
            origin: 'manual', // Esto activa el badge "Nuevo"
            status: 'Activo',
            visitStatus: 'Pendiente'
        }));
    
    if (newClientsToAdd.length > 0) {
        const updatedFull = [...currentRouteClientsFull, ...newClientsToAdd];
        setCurrentRouteClientsFull(updatedFull); // Actualización optimista
        
        setIsSaving(true);
        try {
            await updateRoute(selectedRoute.id, { clients: updatedFull });
            await refetchData('routes');
            toast({ title: "Clientes Añadidos", description: `Se añadieron ${newClientsToAdd.length} clientes nuevos.` });
        } catch (e) { 
            console.error(e); 
            toast({ title: "Error", description: "No se pudieron añadir clientes.", variant: "destructive" });
        } finally { setIsSaving(false); }
    } else {
        toast({ title: "Sin cambios", description: "Los clientes seleccionados ya están en tu ruta." });
    }
    
    setIsAddClientDialogOpen(false);
    setMultiSelectedClients([]);
  };

  const filteredAvailableClients = useMemo(() => {
    let list = availableClients;
    if (user?.role === 'Usuario' || user?.role === 'Telemercaderista') {
      list = availableClients.filter(c => c.ejecutivo === user.name);
    }
    const term = addClientSearchTerm.toLowerCase();
    return list.filter(c => 
        String(c.nombre_cliente).toLowerCase().includes(term) ||
        String(c.nombre_comercial).toLowerCase().includes(term) ||
        String(c.ruc).includes(term)
    );
  }, [availableClients, addClientSearchTerm, user]);

  if (authLoading) {
      return (
          <div className="flex flex-col items-center justify-center h-64">
              <LoaderCircle className="animate-spin h-8 w-8 text-primary mb-2" />
              <p className="text-muted-foreground text-sm">Cargando gestiones...</p>
          </div>
      );
  }

  return (
    <>
    <PageHeader title="Gestión de Ruta" description="Gestiona tus visitas de forma eficiente."/>
    {!isRouteStarted ? (
        <Card className="max-w-2xl mx-auto shadow-lg border-primary/20">
            <CardHeader>
                <CardTitle>Selecciona una Ruta</CardTitle>
                <CardDescription>Elije la ruta que vas a gestionar.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Select onValueChange={handleRouteSelect} value={selectedRouteId}>
                    <SelectTrigger className="h-12">
                        <Route className="mr-2 h-5 w-5 text-primary" />
                        <SelectValue placeholder="Elije una ruta planificada" />
                    </SelectTrigger>
                    <SelectContent>
                        {allRoutes.filter(r => r.createdBy === user?.id && ['Planificada', 'En Progreso', 'Incompleta', 'Rechazada'].includes(r.status))
                            .map(r => (
                                <SelectItem key={r.id} value={r.id}>
                                    {r.routeName} ({r.status})
                                </SelectItem>
                            ))
                        }
                    </SelectContent>
                </Select>
                {selectedRoute && (
                    <Button onClick={handleStartRoute} disabled={isStarting} className="w-full h-12 text-lg font-semibold">
                        {isStarting ? <LoaderCircle className="animate-spin mr-2" /> : <PlayCircle className="mr-2 h-5 w-5" />}
                        {selectedRoute.status === 'En Progreso' ? 'Continuar Gestión' : 'Iniciar Gestión'}
                    </Button>
                )}
            </CardContent>
        </Card>
    ) : (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-md">
            <CardHeader className="pb-3">
                <CardTitle className="text-xl">{selectedRoute?.routeName}</CardTitle>
                <div className="mt-1">
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Gestión del día</p>
                    <p className="text-primary font-bold text-lg capitalize">{todayFormatted}</p>
                </div>
            </CardHeader>
            <CardContent>
                <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                        <span>Progreso de Hoy</span>
                        <span className="font-bold">{routeClients.filter(c => c.visitStatus === 'Completado').length} / {routeClients.length}</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-primary transition-all duration-500" 
                            style={{ width: `${(routeClients.filter(c => c.visitStatus === 'Completado').length / (routeClients.length || 1)) * 100}%` }}
                        />
                    </div>
                </div>

                <Dialog open={isAddClientDialogOpen} onOpenChange={setIsAddClientDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="w-full mb-4 border-dashed border-primary text-primary hover:bg-primary/5">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Añadir Cliente a la Ruta
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-2xl rounded-xl p-4 flex flex-col h-[80vh]">
                        <DialogHeader className="mb-4">
                            <DialogTitle>Añadir Clientes</DialogTitle>
                            <DialogDescription>Selecciona los clientes adicionales para gestionar hoy.</DialogDescription>
                        </DialogHeader>
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar por nombre o RUC..." className="pl-9 h-10" value={addClientSearchTerm} onChange={e => setAddClientSearchTerm(e.target.value)}/>
                        </div>
                        <ScrollArea className="flex-1 min-h-0">
                            <div className="space-y-2 pr-2">
                                {filteredAvailableClients.map(client => (
                                    <div key={client.id} className={cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer", multiSelectedClients.some(c => c.ruc === client.ruc) ? "bg-primary/5 border-primary" : "bg-card hover:bg-accent")} onClick={() => toggleClientSelection(client)}>
                                        <Checkbox checked={multiSelectedClients.some(c => c.ruc === client.ruc)} onCheckedChange={() => toggleClientSelection(client)}/>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm truncate">{client.nombre_comercial}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase">{client.ruc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                        <DialogFooter className="mt-6 flex flex-row items-center justify-between border-t pt-4">
                            <span className="text-xs text-muted-foreground font-medium">{multiSelectedClients.length} seleccionados</span>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setIsAddClientDialogOpen(false)}>Cancelar</Button>
                                <Button size="sm" onClick={handleConfirmMultiAdd} disabled={isSaving || multiSelectedClients.length === 0}>
                                    {isSaving ? <LoaderCircle className="animate-spin" /> : "Añadir a Hoy"}
                                </Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Separator className="my-4" />
                <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Orden de Visita (Hoy)</p>
                {dndEnabled && (
                    <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="clients">
                            {(provided) => (
                                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                    {routeClients.map((c, i) => (
                                        <Draggable key={c.ruc} draggableId={c.ruc} index={i} isDragDisabled={c.visitStatus === 'Completado' || isSaving}>
                                            {(p) => (
                                                <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className={cn("flex items-center justify-between p-3 bg-card border rounded-lg transition-all shadow-sm", activeClient?.ruc === c.ruc ? "ring-2 ring-primary border-transparent" : "hover:border-primary/30", c.visitStatus === 'Completado' && "bg-green-50/50 border-green-200")}>
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <GripVertical className={cn("h-4 w-4 text-muted-foreground shrink-0", (c.visitStatus === 'Completado' || isSaving) && "opacity-0")}/>
                                                        <div className="flex flex-col overflow-hidden">
                                                            <div className="flex items-center gap-2">
                                                                <span className={cn("font-medium truncate max-w-[150px]", c.visitStatus === 'Completado' && "text-green-700")}>{c.nombre_comercial}</span>
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
                        <div className="flex-1 min-w-0 pr-2">
                            <CardTitle className="text-xl sm:text-2xl truncate">{activeClient ? activeClient.nombre_comercial : 'Ruta Finalizada'}</CardTitle>
                            {activeClient && <CardDescription className="line-clamp-2">{activeClient.nombre_cliente} • {activeClient.direccion}</CardDescription>}
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
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-base sm:text-lg">1. Registro de Entrada</h4>
                                            <p className="text-xs sm:text-sm text-muted-foreground truncate">{activeClient.checkInTime ? `Marcado a las ${activeClient.checkInTime}` : 'Pendiente'}</p>
                                        </div>
                                    </div>
                                    {!activeClient.checkInTime && (
                                        <Button onClick={handleCheckIn} disabled={isSaving || isLocating} size="sm" className="shadow-md shrink-0">
                                            {isLocating ? <LoaderCircle className="animate-spin mr-2" /> : null}
                                            {isSaving ? <LoaderCircle className="animate-spin" /> : "Marcar Entrada"}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className={cn("space-y-8 transition-all duration-500", !activeClient.checkInTime && "opacity-40 grayscale pointer-events-none")}>
                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg flex items-center gap-2"><Phone className="h-5 w-5 text-primary" /> 2. Tipo de Visita</h4>
                                    <RadioGroup onValueChange={(v: any) => setVisitType(v)} value={visitType} className="grid grid-cols-2 gap-4">
                                        <Label className={cn("flex flex-col items-center justify-center gap-2 border-2 p-4 rounded-xl cursor-pointer hover:bg-accent/50", visitType === 'presencial' && "border-primary bg-primary/5")}>
                                            <RadioGroupItem value="presencial" className="sr-only" />
                                            <MapPin className={cn("h-6 w-6", visitType === 'presencial' ? "text-primary" : "text-muted-foreground")} />
                                            <span className="font-semibold text-sm">Presencial</span>
                                        </Label>
                                        <Label className={cn("flex flex-col items-center justify-center gap-2 border-2 p-4 rounded-xl cursor-pointer hover:bg-accent/50", visitType === 'telefonica' && "border-primary bg-primary/5")}>
                                            <RadioGroupItem value="telefonica" className="sr-only" />
                                            <Phone className={cn("h-6 w-6", visitType === 'telefonica' ? "text-primary" : "text-muted-foreground")} />
                                            <span className="font-semibold text-sm">Telefónica</span>
                                        </Label>
                                    </RadioGroup>
                                    {visitType === 'telefonica' && (
                                        <Textarea placeholder="Describe el resultado de la llamada..." value={callObservation} onChange={e => setCallObservation(e.target.value)} className="min-h-[80px]"/>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg flex items-center gap-2"><LogIn className="h-5 w-5 text-primary" /> 3. Datos de la Gestión</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="space-y-2">
                                            <Label>Venta ($)</Label>
                                            <Input type="number" placeholder="0.00" value={activeClient.valorVenta} onChange={e => handleClientValueChange(activeClient.ruc, 'valorVenta', e.target.value)}/>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Cobro ($)</Label>
                                            <Input type="number" placeholder="0.00" value={activeClient.valorCobro} onChange={e => handleClientValueChange(activeClient.ruc, 'valorCobro', e.target.value)}/>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Devoluciones ($)</Label>
                                            <Input type="number" placeholder="0.00" value={activeClient.devoluciones} onChange={e => handleClientValueChange(activeClient.ruc, 'devoluciones', e.target.value)}/>
                                        </div>
                                    </div>
                                    <Button onClick={handleConfirmCheckOut} className="w-full h-14 text-xl font-bold mt-4 shadow-lg" disabled={isSaving || !visitType || isLocating}>
                                        {isLocating ? <LoaderCircle className="animate-spin mr-2" /> : null}
                                        {isSaving ? <LoaderCircle className="animate-spin mr-2" /> : <LogOut className="mr-2 h-6 w-6" />}
                                        Guardar y Finalizar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-16 animate-in zoom-in-95">
                            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-6" />
                            <h3 className="text-3xl font-bold mb-2">¡Ruta Completada!</h3>
                            <p className="text-muted-foreground text-lg mb-8">Has gestionado todos los clientes asignados para hoy.</p>
                            <Button variant="outline" size="lg" onClick={() => window.location.href='/dashboard'}>Volver al Panel</Button>
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
