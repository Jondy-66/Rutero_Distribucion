'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Search, GripVertical, MapPin, LoaderCircle, LogIn, LogOut, CheckCircle, Phone, User, PlusCircle, PlayCircle, Lock } from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';

const sanitizeClientsForFirestore = (clients: ClientInRoute[]): any[] => {
    return clients.map(c => {
        const cleaned: any = { ...c };
        if (c.date instanceof Date) {
            cleaned.date = Timestamp.fromDate(c.date);
        } else if (c.date && typeof (c.date as any).toDate === 'function') {
            // Ya es un Timestamp
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
  const { user, clients: availableClients, routes: allRoutes, loading: authLoading, refetchData } = useAuth();
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

  useEffect(() => {
    setTodayFormatted(format(new Date(), "EEEE, d 'de' MMMM", { locale: es }));
    const animation = requestAnimationFrame(() => setDndEnabled(true));
    return () => {
      cancelAnimationFrame(animation);
      setDndEnabled(false);
    };
  }, []);

  const SELECTION_KEY = user ? `mgmt_selected_route_${user.id}` : null;

  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) return undefined;
    return allRoutes.find(r => r.id === selectedRouteId);
  }, [selectedRouteId, allRoutes]);
  
  // Rehidratación básica de sesión
  useEffect(() => {
    if (!authLoading && !isInitialRehydrationDone.current && SELECTION_KEY && allRoutes.length > 0) {
      const savedId = localStorage.getItem(SELECTION_KEY);
      if (savedId) {
        const found = allRoutes.find(r => r.id === savedId);
        if (found) {
            setSelectedRouteId(savedId);
            setIsRouteStarted(['En Progreso', 'Incompleta', 'Completada'].includes(found.status));
        }
      }
      isInitialRehydrationDone.current = true;
    }
  }, [authLoading, SELECTION_KEY, allRoutes]);

  useEffect(() => {
    if (!selectedRoute) return;
    setCurrentRouteClientsFull(selectedRoute.clients || []);
    setIsRouteStarted(['En Progreso', 'Incompleta', 'Completada'].includes(selectedRoute.status));
  }, [selectedRoute]);

  const routeClients = useMemo(() => {
    return currentRouteClientsFull
        .filter(c => {
            if (c.status === 'Eliminado' || !c.date) return false;
            const cDate = c.date instanceof Timestamp ? c.date.toDate() : (c.date instanceof Date ? c.date : new Date(c.date));
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

  const getCurrentLocation = (): Promise<{lat: number, lng: number} | null> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 6000 }
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
    if (!selectedRoute || !activeClient) return;
    const time = format(new Date(), 'HH:mm:ss');
    setIsLocating(true);
    setIsSaving(true);
    try {
        const coords = await getCurrentLocation();
        const location = coords ? new GeoPoint(coords.lat, coords.lng) : null;
        let nextClients: ClientInRoute[] = [];
        setCurrentRouteClientsFull(prev => {
            nextClients = prev.map(c => 
                c.ruc === activeClient.ruc ? { ...c, checkInTime: time, checkInLocation: location } : c
            );
            return nextClients;
        });
        const sanitized = sanitizeClientsForFirestore(nextClients);
        await updateRoute(selectedRoute.id, { clients: sanitized });
        await refetchData('routes');
        toast({ title: "Entrada Registrada" });
    } catch (e) { 
        toast({ title: "Error al registrar entrada", variant: "destructive" });
    } finally { 
        setIsSaving(false); 
        setIsLocating(false);
    }
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedRoute || !activeClient || !activeClient.visitType) {
        toast({ title: "Atención", description: "Selecciona el tipo de visita.", variant: "destructive" });
        return;
    }
    const time = format(new Date(), 'HH:mm:ss');
    setIsLocating(true);
    setIsSaving(true);
    try {
        const coords = await getCurrentLocation();
        const location = coords ? new GeoPoint(coords.lat, coords.lng) : null;
        let nextClients: ClientInRoute[] = [];
        setCurrentRouteClientsFull(prev => {
            nextClients = prev.map(c => {
                if (c.ruc === activeClient.ruc) {
                    return { 
                        ...c, 
                        checkOutTime: time, 
                        checkOutLocation: location,
                        visitStatus: 'Completado' as const,
                    };
                }
                return c;
            });
            return nextClients;
        });
        const allDoneToday = nextClients.filter(c => {
            if (c.status === 'Eliminado' || !c.date) return false;
            const cDate = c.date instanceof Timestamp ? c.date.toDate() : (c.date instanceof Date ? c.date : new Date(c.date));
            return isToday(cDate);
        }).every(c => c.visitStatus === 'Completado');
        const newStatus = allDoneToday ? 'Completada' : selectedRoute.status;
        const sanitized = sanitizeClientsForFirestore(nextClients);
        await updateRoute(selectedRoute.id, { clients: sanitized, status: newStatus });
        await refetchData('routes');
        toast({ title: "Visita Finalizada" });
        setActiveRuc(null);
    } catch(e) { 
        toast({ title: "Error al finalizar visita", variant: "destructive" });
    } finally { 
        setIsSaving(false); 
        setIsLocating(false);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || !selectedRoute || source.index === destination.index) return;
    const displayed = Array.from(routeClients);
    const [moved] = displayed.splice(source.index, 1);
    displayed.splice(destination.index, 0, moved);
    if (destination.index === 0 && moved.visitStatus !== 'Completado') {
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
    setIsSaving(true);
    try {
        const sanitized = sanitizeClientsForFirestore(finalFull);
        await updateRoute(selectedRoute.id, { clients: sanitized });
        await refetchData('routes');
        toast({ title: "Orden actualizado" });
    } catch (e) { 
        toast({ title: "Error al reordenar lista", variant: "destructive" });
    } finally { setIsSaving(false); }
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
    setIsSaving(true);
    try {
        const sanitized = sanitizeClientsForFirestore(updatedFullList);
        await updateRoute(selectedRoute.id, { clients: sanitized });
        await refetchData('routes');
        toast({ title: "Clientes Añadidos" });
    } catch (e) { 
        toast({ title: "Error al añadir clientes", variant: "destructive" });
    } finally { setIsSaving(false); }
    setIsAddClientDialogOpen(false);
    setMultiSelectedClients([]);
  };

  if (authLoading) return <div className="flex items-center justify-center h-64"><LoaderCircle className="animate-spin h-8 w-8 text-primary" /></div>;

  const selectableRoutes = allRoutes.filter(r => r.createdBy === user?.id && ['Planificada', 'En Progreso', 'Incompleta', 'Rechazada'].includes(r.status));

  return (
    <>
    <PageHeader title="Gestión de Ruta" description="Gestión diaria de visitas."/>
    {!isRouteStarted ? (
        <Card className="max-w-2xl mx-auto shadow-lg">
            <CardHeader><CardTitle>Selecciona una Ruta</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <Select onValueChange={handleRouteSelect} value={selectedRouteId}>
                    <SelectTrigger className="h-12"><Route className="mr-2 h-5 w-5 text-primary" /><SelectValue placeholder="Elije una ruta para hoy" /></SelectTrigger>
                    <SelectContent>
                        {selectableRoutes.length > 0 ? (
                            selectableRoutes.map(r => (<SelectItem key={r.id} value={r.id}>{r.routeName} ({r.status})</SelectItem>))
                        ) : (
                            <SelectItem value="no-routes" disabled>No tienes rutas pendientes</SelectItem>
                        )}
                    </SelectContent>
                </Select>
                {selectedRoute && (
                    <Button onClick={handleStartRoute} disabled={isStarting} className="w-full h-12">
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
                <p className="text-muted-foreground text-sm capitalize">{todayFormatted}</p>
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
                        <Button variant="outline" className="w-full mb-4">
                            <PlusCircle className="mr-2 h-4 w-4" /> Añadir Cliente
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
                        <DialogHeader><DialogTitle>Añadir Clientes</DialogTitle></DialogHeader>
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar clientes..." className="pl-9" value={addClientSearchTerm} onChange={e => setAddClientSearchTerm(e.target.value)}/>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="space-y-2">
                                {availableClients.filter(c => c.nombre_comercial.toLowerCase().includes(addClientSearchTerm.toLowerCase())).map(client => (
                                    <div key={client.id} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent" onClick={() => {
                                        setMultiSelectedClients(prev => prev.some(c => c.ruc === client.ruc) ? prev.filter(c => c.ruc !== client.ruc) : [...prev, client]);
                                    }}>
                                        <Checkbox checked={multiSelectedClients.some(c => c.ruc === client.ruc)} />
                                        <div className="min-w-0">
                                            <p className="font-bold text-sm truncate">{client.nombre_comercial}</p>
                                            <p className="text-xs text-muted-foreground">{client.ruc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                        <DialogFooter className="pt-4">
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
                                                <div 
                                                    ref={p.innerRef} 
                                                    {...p.draggableProps} 
                                                    {...p.dragHandleProps} 
                                                    onClick={() => setActiveRuc(c.ruc)}
                                                    className={cn("flex items-center justify-between p-3 bg-card border rounded-lg transition-all shadow-sm cursor-pointer", activeRuc === c.ruc ? "ring-2 ring-primary" : "hover:bg-accent", c.visitStatus === 'Completado' && "opacity-60")}
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0"/>
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-sm truncate">{c.nombre_comercial}</p>
                                                            <span className="text-[10px] text-muted-foreground">{c.ruc}</span>
                                                        </div>
                                                    </div>
                                                    {c.visitStatus === 'Completado' ? <CheckCircle className="h-5 w-5 text-green-500" /> : <span className="text-[10px] font-bold text-muted-foreground">#{i + 1}</span>}
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
            <Card className="shadow-lg">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <CardTitle className="text-2xl font-bold">{activeClient ? activeClient.nombre_comercial : 'Selecciona un cliente'}</CardTitle>
                            {activeClient && <p className="text-sm text-muted-foreground">{activeClient.direccion}</p>}
                        </div>
                        {activeClient && <Badge variant="outline" className="w-fit">{activeClient.ejecutivo}</Badge>}
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                    {activeClient ? (
                        <div className="space-y-8">
                            <div className={cn("p-4 rounded-xl border-2 transition-all", activeClient.checkInTime ? "bg-green-50 border-green-200" : "bg-muted/30 border-dashed")}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2 rounded-lg", activeClient.checkInTime ? "bg-green-500 text-white" : "bg-muted text-muted-foreground")}>
                                            <LogIn className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold">1. Registro de Entrada</h4>
                                            <p className="text-xs text-muted-foreground">{activeClient.checkInTime ? `Registrado a las ${activeClient.checkInTime}` : 'Pendiente'}</p>
                                        </div>
                                    </div>
                                    {!activeClient.checkInTime && (
                                        <Button onClick={handleCheckIn} disabled={isSaving || isLocating}>
                                            {isLocating ? <LoaderCircle className="animate-spin mr-2" /> : "Marcar Entrada"}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className={cn("space-y-8 transition-all", !activeClient.checkInTime && "opacity-40 pointer-events-none")}>
                                <div className="space-y-4">
                                    <h4 className="font-bold flex items-center gap-2"><Phone className="h-4 w-4" /> 2. Tipo de Visita</h4>
                                    <RadioGroup onValueChange={(v: any) => handleFieldChange('visitType', v)} value={activeClient.visitType} className="grid grid-cols-2 gap-4">
                                        <Label className={cn("flex flex-col items-center gap-2 border-2 p-4 rounded-xl cursor-pointer hover:bg-accent", activeClient.visitType === 'presencial' && "border-primary bg-primary/5")}>
                                            <RadioGroupItem value="presencial" className="sr-only" />
                                            <MapPin className="h-6 w-6" />
                                            <span className="font-bold text-xs uppercase">Presencial</span>
                                        </Label>
                                        <Label className={cn("flex flex-col items-center gap-2 border-2 p-4 rounded-xl cursor-pointer hover:bg-accent", activeClient.visitType === 'telefonica' && "border-primary bg-primary/5")}>
                                            <RadioGroupItem value="telefonica" className="sr-only" />
                                            <Phone className="h-6 w-6" />
                                            <span className="font-bold text-xs uppercase">Telefónica</span>
                                        </Label>
                                    </RadioGroup>
                                    {activeClient.visitType === 'telefonica' && (
                                        <Textarea placeholder="Observación de la llamada..." value={activeClient.callObservation || ''} onChange={e => handleFieldChange('callObservation', e.target.value)} />
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold flex items-center gap-2"><LogIn className="h-4 w-4" /> 3. Datos de Gestión</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase">Venta ($)</Label>
                                            <Input type="number" placeholder="0.00" value={activeClient.valorVenta ?? ''} onChange={e => handleFieldChange('valorVenta', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase">Cobro ($)</Label>
                                            <Input type="number" placeholder="0.00" value={activeClient.valorCobro ?? ''} onChange={e => handleFieldChange('valorCobro', e.target.value)} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase">Devoluciones ($)</Label>
                                            <Input type="number" placeholder="0.00" value={activeClient.devoluciones ?? ''} onChange={e => handleFieldChange('devoluciones', e.target.value)} />
                                        </div>
                                    </div>
                                    <Button onClick={handleConfirmCheckOut} className="w-full h-12 font-bold mt-4" disabled={isSaving || !activeClient.visitType || isLocating}>
                                        {isSaving ? <LoaderCircle className="animate-spin mr-2" /> : <LogOut className="mr-2 h-5 w-5" />}
                                        FINALIZAR VISITA
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <CheckCircle className="h-16 w-16 text-muted mx-auto mb-4" />
                            <h3 className="text-lg font-bold">Sin cliente seleccionado</h3>
                            <p className="text-sm text-muted-foreground">Elige un cliente de la lista para empezar.</p>
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