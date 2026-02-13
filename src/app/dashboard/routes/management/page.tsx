
'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Search, GripVertical, MapPin, LoaderCircle, LogIn, LogOut, CheckCircle, Phone, User, PlusCircle, PlayCircle, Clock } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { updateRoute, getRoute } from '@/lib/firebase/firestore';
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
        cleaned.valorVenta = parseFloat(String(c.valorVenta || 0)) || 0;
        cleaned.valorCobro = parseFloat(String(c.valorCobro || 0)) || 0;
        cleaned.devoluciones = parseFloat(String(c.devoluciones || 0)) || 0;
        cleaned.promociones = parseFloat(String(c.promociones || 0)) || 0;
        cleaned.medicacionFrecuente = parseFloat(String(c.medicacionFrecuente || 0)) || 0;
        Object.keys(cleaned).forEach(key => {
            if (cleaned[key] === undefined) cleaned[key] = null;
        });
        return cleaned;
    });
};

type RouteClient = Client & ClientInRoute;

export default function RouteManagementPage() {
  const { user, clients: availableClients, routes: allRoutes, loading: authLoading, dataLoading, refetchData } = useAuth();
  const { toast } = useToast();
  
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [isRouteStarted, setIsRouteStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [todayFormatted, setTodayFormatted] = useState('');
  
  const [currentRouteClientsFull, setCurrentRouteClientsFull] = useState<ClientInRoute[]>([]);
  const [activeRuc, setActiveRuc] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [addClientSearchTerm, setAddClientSearchTerm] = useState('');
  const [multiSelectedClients, setMultiSelectedClients] = useState<Client[]>([]);

  const [dndEnabled, setDndEnabled] = useState(false);
  const isInitialRehydrationDone = useRef(false);
  const lastKnownRouteId = useRef<string | null>(null);

  useEffect(() => {
    setTodayFormatted(format(new Date(), "EEEE, d 'de' MMMM", { locale: es }));
    const animation = requestAnimationFrame(() => setDndEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setDndEnabled(false);
    };
  }, []);

  const SELECTION_KEY = user ? `mgmt_selected_route_v3_${user.id}` : null;

  const selectableRoutes = useMemo(() => {
    return allRoutes.filter(r => {
        const isOwner = r.createdBy === user?.id;
        if (!isOwner) return false;
        
        // ONLY show active routes for management
        // We filter out 'Completada', 'Incompleta' or 'Rechazada' unless it's the one currently being viewed
        if (r.id === selectedRouteId) return true;
        if (['Completada', 'Incompleta', 'Rechazada'].includes(r.status)) return false;

        // Show routes that are En Progreso or Planificada
        if (r.status === 'En Progreso' || r.status === 'Planificada') return true;

        return false;
    });
  }, [allRoutes, user, selectedRouteId]);

  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) return undefined;
    return allRoutes.find(r => r.id === selectedRouteId);
  }, [selectedRouteId, allRoutes]);
  
  useEffect(() => {
    if (authLoading || dataLoading) return;
    if (isInitialRehydrationDone.current || !SELECTION_KEY) return;

    const savedId = localStorage.getItem(SELECTION_KEY);
    
    if (savedId && allRoutes.length > 0) {
        const found = allRoutes.find(r => r.id === savedId);
        if (found) {
            setSelectedRouteId(savedId);
            setIsRouteStarted(['En Progreso', 'Incompleta', 'Completada'].includes(found.status));
            isInitialRehydrationDone.current = true;
            return;
        }
    }

    const activeRoute = allRoutes.find(r => r.status === 'En Progreso' && r.createdBy === user?.id);
    if (activeRoute) {
        setSelectedRouteId(activeRoute.id);
        setIsRouteStarted(true);
        localStorage.setItem(SELECTION_KEY, activeRoute.id);
        isInitialRehydrationDone.current = true;
        return;
    }

    if (allRoutes.length > 0 || !dataLoading) {
        isInitialRehydrationDone.current = true;
    }
  }, [authLoading, dataLoading, SELECTION_KEY, allRoutes, user]);

  useEffect(() => {
    if (!selectedRoute) return;
    
    if (lastKnownRouteId.current !== selectedRoute.id || currentRouteClientsFull.length === 0) {
        const clients = selectedRoute.clients || [];
        if (clients.length > 0) {
            setCurrentRouteClientsFull(clients);
            lastKnownRouteId.current = selectedRoute.id;
        }
    }
    
    const hasPendingToday = (selectedRoute.clients || []).some(c => {
        if (c.status === 'Eliminado' || !c.date) return false;
        const cDate = c.date instanceof Date ? c.date : new Date(c.date as any);
        return isToday(cDate) && c.visitStatus !== 'Completado';
    });

    if (selectedRoute.status === 'Completada' && hasPendingToday) {
        updateRoute(selectedRoute.id, { status: 'En Progreso' });
        setIsRouteStarted(true);
    } else {
        setIsRouteStarted(['En Progreso', 'Incompleta'].includes(selectedRoute.status) || (selectedRoute.status === 'Completada' && !hasPendingToday));
    }
  }, [selectedRoute, currentRouteClientsFull.length]);

  const routeClients = useMemo(() => {
    return currentRouteClientsFull
        .filter(c => {
            if (c.status === 'Eliminado' || !c.date) return false;
            const cDate = c.date instanceof Date ? c.date : new Date(c.date as any);
            return isToday(cDate);
        })
        .map(c => {
            const details = availableClients.find(ac => ac.ruc === c.ruc);
            return {
                id: details?.id || c.ruc,
                ejecutivo: details?.ejecutivo || user?.name || '',
                nombre_cliente: details?.nombre_cliente || c.nombre_comercial,
                nombre_comercial: c.nombre_comercial,
                direccion: details?.direccion || 'Dirección no disponible',
                latitud: details?.latitud || 0,
                longitud: details?.longitud || 0,
                ...c,
            } as RouteClient;
        });
  }, [currentRouteClientsFull, availableClients, user]);

  const filteredAvailableClients = useMemo(() => {
    if (!isAddClientDialogOpen) return [];
    const search = addClientSearchTerm.toLowerCase().trim();
    
    return availableClients
        .filter(c => c.ejecutivo?.trim().toLowerCase() === user?.name?.trim().toLowerCase())
        .filter(c => {
            if (!search) return true;
            return (
                c.nombre_comercial.toLowerCase().includes(search) ||
                c.nombre_cliente.toLowerCase().includes(search) ||
                c.ruc.includes(search)
            );
        });
  }, [availableClients, addClientSearchTerm, user, isAddClientDialogOpen]);

  useEffect(() => {
    if (!activeRuc && routeClients.length > 0) {
        const nextPending = routeClients.find(c => c.visitStatus !== 'Completado');
        if (nextPending) setActiveRuc(nextPending.ruc);
    }
  }, [routeClients, activeRuc]);

  const activeClient = useMemo(() => {
    return routeClients.find(c => c.ruc === activeRuc) || null;
  }, [routeClients, activeRuc]);

  const handleRouteSelect = (routeId: string) => {
      setSelectedRouteId(routeId);
      if (SELECTION_KEY) localStorage.setItem(SELECTION_KEY, routeId);
  };

  const handleFieldChange = (field: keyof ClientInRoute, value: any) => {
    if (!activeRuc) return;
    setCurrentRouteClientsFull(prev => prev.map(c => 
        c.ruc === activeRuc ? { ...c, [field]: value } : c
    ));
  };

  const getCurrentLocation = (timeout = 5000): Promise<{lat: number, lng: number} | null> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout }
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
      } catch (error) { 
          toast({ title: "Error al iniciar ruta", variant: "destructive" });
      } finally { setIsStarting(false); }
  }

  const handleCheckIn = async () => {
    if (!selectedRoute || !activeClient || currentRouteClientsFull.length === 0) {
        toast({ title: "Atención", description: "Los datos aún se están sincronizando. Reintenta en unos segundos.", variant: "destructive" });
        return;
    }
    const time = format(new Date(), 'HH:mm:ss');
    
    handleFieldChange('checkInTime', time);
    setIsLocating(true);
    
    getCurrentLocation(4000).then(async (coords) => {
        const location = coords ? new GeoPoint(coords.lat, coords.lng) : null;
        let nextClients: ClientInRoute[] = [];
        
        setCurrentRouteClientsFull(prev => {
            if (prev.length === 0) return prev; // ANTI-WIPE GUARD
            nextClients = prev.map(c => 
                c.ruc === activeClient.ruc ? { ...c, checkInTime: time, checkInLocation: location } : c
            );
            return nextClients;
        });

        if (nextClients.length === 0) {
            setIsLocating(false);
            return;
        }

        const sanitized = sanitizeClientsForFirestore(nextClients);
        await updateRoute(selectedRoute.id, { clients: sanitized });
        setIsLocating(false);
        toast({ title: "Entrada Registrada" });
    });
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedRoute || !activeClient || !activeClient.visitType || currentRouteClientsFull.length === 0) {
        toast({ title: "Atención", description: "La lista de clientes está vacía o en sincronización. Refresca la página.", variant: "destructive" });
        return;
    }
    const time = format(new Date(), 'HH:mm:ss');
    const currentRucToFinalize = activeRuc;
    setActiveRuc(null); 
    setIsSaving(true);
    setIsLocating(true);

    getCurrentLocation(4000).then(async (coords) => {
        const location = coords ? new GeoPoint(coords.lat, coords.lng) : null;
        const updatedClients = currentRouteClientsFull.map(c => {
            if (c.ruc === currentRucToFinalize) {
                return { 
                    ...c, 
                    checkOutTime: time, 
                    checkOutLocation: location,
                    visitStatus: 'Completado' as const,
                };
            }
            return c;
        });

        // SAFETY: Never save if the list is empty to prevent wiping the DB route
        if (updatedClients.length === 0) {
            setIsSaving(false);
            setIsLocating(false);
            return;
        }

        const allClientsDone = updatedClients
            .filter(c => c.status !== 'Eliminado')
            .every(c => c.visitStatus === 'Completado');

        const newStatus = allClientsDone ? 'Completada' : 'En Progreso';
        const sanitized = sanitizeClientsForFirestore(updatedClients);
        
        await updateRoute(selectedRoute.id, { clients: sanitized, status: newStatus });
        await refetchData('routes');
        setCurrentRouteClientsFull(updatedClients);
        setIsSaving(false);
        setIsLocating(false);
        toast({ title: "Visita Finalizada" });
    });
  };

  const onDragEnd = async (result: DropResult) => {
    if (!result.destination || !selectedRoute || result.source.index === result.destination.index) return;
    const displayed = Array.from(routeClients);
    const [moved] = displayed.splice(result.source.index, 1);
    displayed.splice(result.destination.index, 0, moved);
    
    if (result.destination.index === 0 && moved.visitStatus !== 'Completado') {
        setActiveRuc(moved.ruc);
    }
    
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
    const sanitized = sanitizeClientsForFirestore(finalFull);
    await updateRoute(selectedRoute.id, { clients: sanitized });
    toast({ title: "Orden actualizado" });
  };

  const handleConfirmMultiAdd = async () => {
    if (!selectedRoute || multiSelectedClients.length === 0) return;
    const todayDate = new Date();
    const updatedFullList = [...currentRouteClientsFull];
    for (const selected of multiSelectedClients) {
        const idx = updatedFullList.findIndex(c => c.ruc === selected.ruc);
        if (idx !== -1) {
            updatedFullList[idx] = { 
                ...updatedFullList[idx], 
                date: todayDate, 
                status: 'Activo', 
                origin: 'manual', 
                visitStatus: 'Pendiente', 
                checkInTime: null, 
                checkOutTime: null 
            };
        } else {
            updatedFullList.push({ 
                ruc: selected.ruc, 
                nombre_comercial: selected.nombre_comercial, 
                date: todayDate, 
                origin: 'manual', 
                status: 'Activo', 
                visitStatus: 'Pendiente' 
            });
        }
    }
    setCurrentRouteClientsFull(updatedFullList);
    const sanitized = sanitizeClientsForFirestore(updatedFullList);
    await updateRoute(selectedRoute.id, { clients: sanitized });
    await refetchData('routes');
    toast({ title: "Clientes Añadidos" });
    setIsAddClientDialogOpen(false);
    setMultiSelectedClients([]);
  };

  if (authLoading || (isInitialRehydrationDone.current === false && SELECTION_KEY)) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <LoaderCircle className="animate-spin h-12 w-12 text-primary" />
            <p className="text-muted-foreground animate-pulse">Sincronizando gestión diaria...</p>
        </div>
      );
  }

  return (
    <>
    <PageHeader title="Gestión de Ruta" description="Gestión diaria de visitas."/>
    {!isRouteStarted ? (
        <Card className="max-w-2xl mx-auto shadow-lg">
            <CardHeader><CardTitle>Selecciona una Ruta</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <Select onValueChange={handleRouteSelect} value={selectedRouteId}>
                    <SelectTrigger className="h-12"><Route className="mr-2 h-5 w-5 text-primary" /><SelectValue placeholder="Elije una ruta activa" /></SelectTrigger>
                    <SelectContent>
                        {selectableRoutes.length > 0 ? (
                            selectableRoutes.map(r => (<SelectItem key={r.id} value={r.id}>{r.routeName} ({r.status})</SelectItem>))
                        ) : (
                            <SelectItem value="no-routes" disabled>No tienes rutas pendientes para hoy</SelectItem>
                        )}
                    </SelectContent>
                </Select>
                {selectedRoute && (
                    <Button onClick={handleStartRoute} disabled={isStarting} className="w-full h-12 text-lg font-bold">
                        {isStarting ? <LoaderCircle className="animate-spin mr-2" /> : <PlayCircle className="mr-2 h-6 w-6" />}
                        {selectedRoute.status === 'En Progreso' ? 'CONTINUAR GESTIÓN' : 'INICIAR GESTIÓN'}
                    </Button>
                )}
            </CardContent>
        </Card>
    ) : (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-md h-fit">
            <CardHeader className="pb-3 px-4">
                <CardTitle className="text-lg truncate">{selectedRoute?.routeName}</CardTitle>
                <p className="text-muted-foreground text-xs capitalize">{todayFormatted}</p>
            </CardHeader>
            <CardContent className="px-4">
                <div className="mb-4">
                    <div className="flex justify-between text-[10px] uppercase font-bold mb-1">
                        <span>Progreso Hoy</span>
                        <span className="text-primary">{routeClients.filter(c => c.visitStatus === 'Completado').length} / {routeClients.length}</span>
                    </div>
                    <Progress value={(routeClients.filter(c => c.visitStatus === 'Completado').length / (routeClients.length || 1)) * 100} className="h-1.5" />
                </div>

                <Dialog open={isAddClientDialogOpen} onOpenChange={setIsAddClientDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="w-full mb-4 border-dashed border-2">
                            <PlusCircle className="mr-2 h-4 w-4" /> Añadir Cliente a mi Ruta
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
                        <DialogHeader className="p-6 pb-2">
                            <DialogTitle>Añadir Clientes</DialogTitle>
                            <DialogDescription>Buscador multicriterio por RUC, Nombre Comercial o Razón Social.</DialogDescription>
                        </DialogHeader>
                        <div className="px-6 pb-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Nombre, RUC, Comercial..." className="pl-9" value={addClientSearchTerm} onChange={e => setAddClientSearchTerm(e.target.value)}/>
                            </div>
                        </div>
                        <ScrollArea className="flex-1 px-6">
                            <div className="space-y-2 pb-4">
                                {filteredAvailableClients.map(client => (
                                    <div key={client.id} className={cn(
                                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-accent",
                                        multiSelectedClients.some(c => c.ruc === client.ruc) && "border-primary bg-primary/5"
                                    )} onClick={() => {
                                        setMultiSelectedClients(prev => prev.some(c => c.ruc === client.ruc) ? prev.filter(c => c.ruc !== client.ruc) : [...prev, client]);
                                    }}>
                                        <Checkbox checked={multiSelectedClients.some(c => c.ruc === client.ruc)} />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-sm truncate">{client.nombre_comercial}</p>
                                            <p className="text-[10px] text-muted-foreground truncate">{client.nombre_cliente}</p>
                                            <p className="text-[9px] font-mono text-muted-foreground">{client.ruc}</p>
                                        </div>
                                    </div>
                                ))}
                                {filteredAvailableClients.length === 0 && (
                                    <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
                                        <Search className="h-8 w-8 opacity-20" />
                                        <p className="text-sm">No hay clientes asignados que coincidan.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                        <DialogFooter className="p-6 pt-2 border-t bg-muted/20">
                            <div className="flex w-full items-center justify-between gap-4">
                                <span className="text-xs font-bold">{multiSelectedClients.length} seleccionados</span>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="sm" onClick={() => setIsAddClientDialogOpen(false)}>Cerrar</Button>
                                    <Button size="sm" onClick={handleConfirmMultiAdd} disabled={isSaving || multiSelectedClients.length === 0}>Añadir a Hoy</Button>
                                </div>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-muted-foreground uppercase px-1">
                    <GripVertical className="h-3 w-3" /> 
                    <span>Orden de Visita (Arrastra para reordenar)</span>
                </div>
                
                {dndEnabled && (
                    <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="clients">
                            {(provided) => (
                                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                    {routeClients.map((c, i) => (
                                        <Draggable key={c.ruc} draggableId={c.ruc} index={i} isDragDisabled={c.visitStatus === 'Completado' || isSaving}>
                                            {(p) => (
                                                <div 
                                                    ref={p.innerRef} 
                                                    {...p.draggableProps} 
                                                    {...p.dragHandleProps} 
                                                    onClick={() => setActiveRuc(c.ruc)}
                                                    className={cn(
                                                        "flex items-center justify-between p-3 bg-card border rounded-lg transition-all shadow-sm cursor-pointer", 
                                                        activeRuc === c.ruc ? "ring-2 ring-primary border-primary" : "hover:bg-accent/50", 
                                                        c.visitStatus === 'Completado' && "opacity-50 grayscale bg-muted/30"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <span className="text-[10px] font-black text-muted-foreground/40 w-4">{i + 1}</span>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-sm truncate">{c.nombre_comercial}</p>
                                                            <span className="text-[9px] text-muted-foreground uppercase truncate block">{c.ruc}</span>
                                                        </div>
                                                    </div>
                                                    {c.visitStatus === 'Completado' ? (
                                                        <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                                                    ) : activeRuc === c.ruc ? (
                                                        <div className="h-2 w-2 rounded-full bg-primary animate-ping shrink-0" />
                                                    ) : null}
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
            <Card className="shadow-lg border-t-4 border-t-primary">
                <CardHeader className="bg-muted/10 pb-6 rounded-t-lg">
                    {activeClient ? (
                        <div className="space-y-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1 flex-1 min-w-0">
                                    <h3 className="text-2xl font-black text-primary leading-tight break-words uppercase">{activeClient.nombre_comercial}</h3>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant="outline" className="font-mono text-[10px] tracking-widest">{activeClient.ruc}</Badge>
                                        <Badge variant="secondary" className="text-[9px] font-bold uppercase">{activeClient.ejecutivo}</Badge>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 bg-white/80 rounded-2xl border border-primary/10 shadow-sm">
                                <div className="bg-primary/10 p-2 rounded-full mt-0.5">
                                    <MapPin className="h-4 w-4 text-primary" />
                                </div>
                                <p className="text-sm font-semibold leading-relaxed text-muted-foreground">{activeClient.direccion}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <CardTitle className="text-muted-foreground">Selecciona un cliente para gestionar</CardTitle>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="space-y-8 pt-6">
                    {activeClient ? (
                        <div className="space-y-8">
                            <div className={cn(
                                "p-5 rounded-2xl border-2 transition-all duration-500", 
                                activeClient.checkInTime ? "bg-green-50 border-green-200" : "bg-muted/20 border-dashed border-muted-foreground/30"
                            )}>
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 w-full sm:w-auto">
                                        <div className={cn(
                                            "p-3 rounded-xl shadow-sm transition-colors", 
                                            activeClient.checkInTime ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"
                                        )}>
                                            <LogIn className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-sm uppercase tracking-tight">1. Registro de Entrada</h4>
                                            <p className="text-xs font-bold text-muted-foreground">
                                                {activeClient.checkInTime ? (
                                                    <span className="text-green-600 flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> LLEGADA: {activeClient.checkInTime}
                                                    </span>
                                                ) : 'Presiona el botón al llegar'}
                                            </p>
                                        </div>
                                    </div>
                                    {!activeClient.checkInTime && (
                                        <Button size="lg" onClick={handleCheckIn} disabled={isSaving || isLocating} className="w-full sm:w-auto h-14 px-8 font-black shadow-lg shadow-primary/20">
                                            {isLocating ? <LoaderCircle className="animate-spin mr-2" /> : "MARCAR ENTRADA"}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className={cn("space-y-8 transition-all duration-500", !activeClient.checkInTime && "opacity-20 grayscale pointer-events-none")}>
                                <div className="space-y-4">
                                    <h4 className="font-black text-sm uppercase tracking-tight flex items-center gap-2">
                                        <Phone className="h-4 w-4 text-primary" /> 2. Tipo de Gestión
                                    </h4>
                                    <RadioGroup onValueChange={(v: any) => handleFieldChange('visitType', v)} value={activeClient.visitType} className="grid grid-cols-2 gap-4">
                                        <Label className={cn(
                                            "flex flex-col items-center gap-3 border-2 p-6 rounded-2xl cursor-pointer transition-all hover:scale-[1.02]", 
                                            activeClient.visitType === 'presencial' ? "border-primary bg-primary/5 shadow-inner" : "border-muted-foreground/10"
                                        )}>
                                            <RadioGroupItem value="presencial" className="sr-only" />
                                            <MapPin className={cn("h-8 w-8", activeClient.visitType === 'presencial' ? "text-primary" : "text-muted-foreground/40")} />
                                            <span className="font-black text-[10px] uppercase">Presencial</span>
                                        </Label>
                                        <Label className={cn(
                                            "flex flex-col items-center gap-3 border-2 p-6 rounded-2xl cursor-pointer transition-all hover:scale-[1.02]", 
                                            activeClient.visitType === 'telefonica' ? "border-primary bg-primary/5 shadow-inner" : "border-muted-foreground/10"
                                        )}>
                                            <RadioGroupItem value="telefonica" className="sr-only" />
                                            <Phone className={cn("h-8 w-8", activeClient.visitType === 'telefonica' ? "text-primary" : "text-muted-foreground/40")} />
                                            <span className="font-black text-[10px] uppercase">Telefónica</span>
                                        </Label>
                                    </RadioGroup>
                                    {activeClient.visitType === 'telefonica' && (
                                        <Textarea 
                                            placeholder="Escribe aquí las observaciones de la llamada..." 
                                            className="rounded-xl border-2 focus:border-primary transition-all"
                                            value={activeClient.callObservation || ''} 
                                            onChange={e => handleFieldChange('callObservation', e.target.value)} 
                                        />
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-black text-sm uppercase tracking-tight flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-primary" /> 3. Resultados de Gestión
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Venta ($)</Label>
                                            <Input type="number" placeholder="0.00" className="h-12 text-lg font-bold rounded-xl" value={activeClient.valorVenta ?? ''} onChange={e => handleFieldChange('valorVenta', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Cobro ($)</Label>
                                            <Input type="number" placeholder="0.00" className="h-12 text-lg font-bold rounded-xl" value={activeClient.valorCobro ?? ''} onChange={e => handleFieldChange('valorCobro', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Devolución ($)</Label>
                                            <Input type="number" placeholder="0.00" className="h-12 text-lg font-bold rounded-xl" value={activeClient.devoluciones ?? ''} onChange={e => handleFieldChange('devoluciones', e.target.value)} />
                                        </div>
                                    </div>
                                    
                                    <Button 
                                        onClick={handleConfirmCheckOut} 
                                        className="w-full h-16 text-lg font-black mt-6 rounded-2xl shadow-xl shadow-primary/30 transition-all active:scale-[0.98]" 
                                        disabled={isSaving || !activeClient.visitType || isLocating}
                                    >
                                        {isLocating ? (
                                            <div className="flex items-center gap-3">
                                                <LoaderCircle className="animate-spin h-6 w-6" />
                                                <span>Sincronizando GPS...</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3">
                                                <LogOut className="h-6 w-6" />
                                                <span>FINALIZAR VISITA</span>
                                            </div>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 flex flex-col items-center gap-4 text-muted-foreground">
                            <div className="p-6 bg-muted/20 rounded-full">
                                <CheckCircle className="h-16 w-16 opacity-20" />
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-xl font-black uppercase tracking-tight">Sin cliente seleccionado</h3>
                                <p className="text-sm font-medium">Elige una parada de la lista para registrar tu gestión.</p>
                            </div>
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
