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

/**
 * Sanitiza los datos de los clientes antes de enviarlos a Firestore para evitar errores de serialización.
 */
const sanitizeClientsForFirestore = (clients: ClientInRoute[]): any[] => {
    return clients.map(c => {
        const cleaned: any = { ...c };
        if (c.date instanceof Date) {
            cleaned.date = Timestamp.fromDate(c.date);
        }
        cleaned.valorVenta = parseFloat(String(c.valorVenta)) || 0;
        cleaned.valorCobro = parseFloat(String(c.valorCobro)) || 0;
        cleaned.devoluciones = parseFloat(String(c.devoluciones)) || 0;
        cleaned.promociones = parseFloat(String(c.promociones)) || 0;
        cleaned.medicacionFrecuente = parseFloat(String(c.medicacionFrecuente)) || 0;
        
        // Convertimos undefined a null para compatibilidad con Firestore
        Object.keys(cleaned).forEach(key => {
            if (cleaned[key] === undefined) {
                cleaned[key] = null;
            }
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

  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) return undefined;
    return allRoutes.find(r => r.id === selectedRouteId);
  }, [selectedRouteId, allRoutes]);
  
  // Rehidratación inteligente de la sesión al refrescar
  useEffect(() => {
    if (!authLoading && !isInitialRehydrationDone.current && SELECTION_KEY && allRoutes.length > 0) {
      const savedId = localStorage.getItem(SELECTION_KEY);
      if (savedId) {
        const found = allRoutes.find(r => r.id === savedId);
        if (found) {
          setSelectedRouteId(savedId);
          setIsRouteStarted(['En Progreso', 'Incompleta', 'Completada'].includes(found.status));
          isInitialRehydrationDone.current = true;
        }
      } else {
          isInitialRehydrationDone.current = true;
      }
    }
  }, [authLoading, SELECTION_KEY, allRoutes]);

  // Sincronización Blindada: El "Escudo Local" evita que el servidor borre tus cambios de hoy
  useEffect(() => {
    if (!selectedRoute) return;

    if (selectedRoute.id !== lastSyncedRouteId.current) {
        setCurrentRouteClientsFull(selectedRoute.clients || []);
        setIsRouteStarted(['En Progreso', 'Incompleta', 'Completada'].includes(selectedRoute.status));
        lastSyncedRouteId.current = selectedRoute.id;
        return;
    }

    if (!isSaving) {
        setCurrentRouteClientsFull(prev => {
            const serverClients = selectedRoute.clients || [];
            // Mapeamos el orden local actual pero actualizamos los campos desde el servidor con protección
            const updated = prev.map(local => {
                const server = serverClients.find(sc => sc.ruc === local.ruc);
                if (!server) return local; 
                
                // Prioridad Local: Si ya marcamos entrada o salida localmente, no dejamos que el servidor lo borre
                const finalCheckIn = local.checkInTime || server.checkInTime;
                const finalVisitType = local.visitType || server.visitType;
                const finalStatus = (local.visitStatus === 'Completado' || server.visitStatus === 'Completado') ? 'Completado' : 'Pendiente';
                const finalCheckOut = local.checkOutTime || server.checkOutTime;
                
                return { 
                    ...server, 
                    checkInTime: finalCheckIn,
                    checkInLocation: local.checkInLocation || server.checkInLocation,
                    checkOutTime: finalCheckOut,
                    checkOutLocation: local.checkOutLocation || server.checkOutLocation,
                    visitStatus: finalStatus as any,
                    visitType: finalVisitType,
                    callObservation: local.callObservation || server.callObservation,
                    valorVenta: local.valorVenta ?? server.valorVenta,
                    valorCobro: local.valorCobro ?? server.valorCobro,
                    devoluciones: local.devoluciones ?? server.devoluciones,
                    status: (local.status === 'Activo' || server.status === 'Activo') ? 'Activo' : server.status,
                    date: local.date || server.date,
                };
            });
            
            // Añadir clientes que existan en el servidor pero no en nuestra lista local (por si otro dispositivo añadió uno)
            serverClients.forEach(sc => {
                if (!updated.find(u => u.ruc === sc.ruc)) {
                    updated.push(sc);
                }
            });
            return updated;
        });
    }
  }, [selectedRoute, isSaving]);

  const clientsMap = useMemo(() => {
    const map = new Map<string, Client>();
    availableClients.forEach(c => map.set(c.ruc, c));
    return map;
  }, [availableClients]);
  
  // Filtro de HOY: Solo clientes programados para hoy aparecen en la lista de gestión
  const routeClients = useMemo(() => {
    return currentRouteClientsFull
        .filter(c => c.status !== 'Eliminado' && c.date && isToday(c.date))
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
            } as RouteClient;
        });
  }, [currentRouteClientsFull, clientsMap, user]);

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
    // Actualización local inmediata para eliminar el lag visual
    setCurrentRouteClientsFull(prev => prev.map(c => 
        c.ruc === activeRuc ? { ...c, [field]: value } : c
    ));
  };

  const getCurrentLocation = (): Promise<{lat: number, lng: number} | null> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (error) => {
            console.warn("Geolocation error:", error.message);
            resolve(null);
        },
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
          console.error(error);
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
        console.error("Error in handleCheckIn:", e); 
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
                        valorVenta: parseFloat(String(c.valorVenta)) || 0,
                        valorCobro: parseFloat(String(c.valorCobro)) || 0,
                        devoluciones: parseFloat(String(c.devoluciones)) || 0,
                    };
                }
                return c;
            });
            return nextClients;
        });

        const allDone = nextClients.filter(c => c.status !== 'Eliminado' && (c.date ? isToday(c.date) : false)).every(c => c.visitStatus === 'Completado');
        const newStatus = allDone ? 'Completada' : selectedRoute.status;
        
        const sanitized = sanitizeClientsForFirestore(nextClients);
        await updateRoute(selectedRoute.id, { clients: sanitized, status: newStatus });
        await refetchData('routes');
        toast({ title: "Visita Finalizada" });
        setActiveRuc(null);
    } catch(e) { 
        console.error("Error in handleConfirmCheckOut:", e); 
        toast({ title: "Error al finalizar visita", variant: "destructive" });
    } finally { 
        setIsSaving(false); 
        setIsLocating(false);
    }
  };

  // Reordenamiento Maestro: Permite cambiar el orden de visitas del día
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
        const sanitized = sanitizeClientsForFirestore(finalFull);
        await updateRoute(selectedRoute.id, { clients: sanitized });
        await refetchData('routes');
        toast({ title: "Orden actualizado" });
    } catch (e) { 
        console.error(e); 
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
            // Reactivación inteligente: si ya existía en la ruta, lo traemos a hoy y lo ponemos activo
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
        console.error(e); 
        toast({ title: "Error al añadir clientes", variant: "destructive" });
    } finally { setIsSaving(false); }
    setIsAddClientDialogOpen(false);
    setMultiSelectedClients([]);
  };

  if (authLoading) return <div className="flex items-center justify-center h-64"><LoaderCircle className="animate-spin h-8 w-8 text-primary" /></div>;

  const isClientFinalized = activeClient?.visitStatus === 'Completado';

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
        {/* Lista de Clientes con Drag and Drop */}
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
                            <PlusCircle className="mr-2 h-4 w-4" /> Añadir Cliente
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
                                        <div className="min-w-0 flex-1">
                                            <p className="font-bold text-sm whitespace-normal leading-tight">{client.nombre_comercial}</p>
                                            <p className="text-[10px] text-muted-foreground uppercase">{client.ruc} - {client.nombre_cliente}</p>
                                        </div>
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
                <p className="text-[10px] text-muted-foreground mb-2 italic">Arrastra para cambiar el orden de las visitas</p>
                
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
                                                    className={cn("flex items-center justify-between p-3 bg-card border rounded-lg transition-all shadow-sm cursor-pointer", activeRuc === c.ruc ? "ring-2 ring-primary" : "hover:border-primary/30", c.visitStatus === 'Completado' && "bg-green-50/50 border-green-200")}
                                                >
                                                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                                                        <GripVertical className={cn("h-4 w-4 text-muted-foreground shrink-0", (c.visitStatus === 'Completado' || isSaving) && "opacity-0")}/>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                                <span className={cn("font-medium break-words leading-tight whitespace-normal", c.visitStatus === 'Completado' && "text-green-700")}>{c.nombre_comercial}</span>
                                                                {c.origin === 'manual' && <Badge variant="secondary" className="text-[8px] h-4 bg-blue-100 text-blue-700">Nuevo</Badge>}
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground">{c.ruc}</span>
                                                        </div>
                                                    </div>
                                                    {c.visitStatus === 'Completado' ? <CheckCircle className="h-5 w-5 text-green-500 shrink-0 ml-2" /> : <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0 ml-2">#{i + 1}</span>}
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

        {/* Panel de Gestión Activo - Diseño de Alta Claridad para Móvil */}
        <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-2xl border-none overflow-hidden bg-white">
                <div className="h-2 bg-primary" />
                <CardHeader className="pb-4 pt-6">
                    <div className="flex flex-col space-y-4">
                        <div className="flex items-start justify-between gap-4">
                            <CardTitle className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight tracking-tight uppercase whitespace-normal break-words overflow-visible">
                                {activeClient ? activeClient.nombre_comercial : 'Jornada Finalizada'}
                            </CardTitle>
                            {activeClient && (
                                <div className="flex items-center gap-1.5 border border-primary/30 text-primary rounded-full px-3 py-1 bg-primary/5 shrink-0 self-start">
                                    <User className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-bold uppercase truncate max-w-[100px] sm:max-w-none">{activeClient.ejecutivo}</span>
                                </div>
                            )}
                        </div>
                        {activeClient && (
                            <div className="space-y-2">
                                <p className="text-sm font-medium text-slate-500 uppercase tracking-wide leading-relaxed">
                                    {activeClient.nombre_cliente}
                                </p>
                                <div className="flex items-start gap-2 text-slate-400">
                                    <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                                    <p className="text-xs sm:text-sm font-medium leading-normal uppercase">
                                        {activeClient.direccion}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-10">
                    {activeClient ? (
                        <div className="space-y-10">
                            {isClientFinalized && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center gap-4 text-emerald-800 shadow-sm animate-in fade-in zoom-in-95 duration-300">
                                    <div className="p-2 bg-emerald-500 rounded-full text-white">
                                        <CheckCircle className="h-6 w-6 shrink-0" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-extrabold text-lg">Visita Finalizada</p>
                                        <p className="text-sm opacity-90">Gestión completada a las {activeClient.checkOutTime}. No se permiten más cambios.</p>
                                    </div>
                                    <Lock className="h-5 w-5 opacity-40" />
                                </div>
                            )}

                            <div className={cn(
                                "p-6 rounded-2xl border-2 transition-all shadow-sm", 
                                (activeClient.checkInTime || isClientFinalized) 
                                    ? "bg-emerald-50 border-emerald-200" 
                                    : "bg-white border-dashed border-slate-200"
                            )}>
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className={cn(
                                            "p-3.5 rounded-2xl shrink-0 flex items-center justify-center", 
                                            (activeClient.checkInTime || isClientFinalized) ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200" : "bg-slate-100 text-slate-400"
                                        )}>
                                            <LogIn className="h-6 w-6" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-lg text-slate-800">1. Registro de Entrada</h4>
                                            <p className="text-xs font-semibold text-slate-500 uppercase">
                                                {activeClient.checkInTime ? `Marcado: ${activeClient.checkInTime}` : (isClientFinalized ? 'Completado' : 'Pendiente')}
                                            </p>
                                        </div>
                                    </div>
                                    {!activeClient.checkInTime && !isClientFinalized && (
                                        <Button onClick={handleCheckIn} disabled={isSaving || isLocating} className="h-12 px-6 font-bold shadow-md bg-primary hover:bg-primary/90">
                                            {isLocating ? <LoaderCircle className="animate-spin mr-2" /> : "Marcar Entrada"}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className={cn(
                                "space-y-10 transition-all duration-500", 
                                (!activeClient.checkInTime && !isClientFinalized) && "opacity-30 grayscale pointer-events-none",
                                isClientFinalized && "opacity-80 pointer-events-none"
                            )}>
                                <div className="space-y-5">
                                    <h4 className="font-extrabold text-xl flex items-center gap-3 text-slate-800">
                                        <Phone className="h-6 w-6 text-primary" /> 
                                        2. Tipo de Visita
                                    </h4>
                                    <RadioGroup onValueChange={(v: any) => handleFieldChange('visitType', v)} value={activeClient.visitType} className="grid grid-cols-2 gap-5">
                                        <Label className={cn(
                                            "flex flex-col items-center justify-center gap-3 border-2 p-6 rounded-2xl cursor-pointer transition-all shadow-sm", 
                                            activeClient.visitType === 'presencial' ? "border-primary bg-primary/5 ring-2 ring-primary/20 scale-95" : "bg-white hover:border-slate-300"
                                        )}>
                                            <RadioGroupItem value="presencial" className="sr-only" />
                                            <MapPin className={cn("h-8 w-8", activeClient.visitType === 'presencial' ? "text-primary" : "text-slate-300")} />
                                            <span className="font-bold text-sm uppercase">Presencial</span>
                                        </Label>
                                        <Label className={cn(
                                            "flex flex-col items-center justify-center gap-3 border-2 p-6 rounded-2xl cursor-pointer transition-all shadow-sm", 
                                            activeClient.visitType === 'telefonica' ? "border-primary bg-primary/5 ring-2 ring-primary/20 scale-95" : "bg-white hover:border-slate-300"
                                        )}>
                                            <RadioGroupItem value="telefonica" className="sr-only" />
                                            <Phone className={cn("h-8 w-8", activeClient.visitType === 'telefonica' ? "text-primary" : "text-slate-300")} />
                                            <span className="font-bold text-sm uppercase">Telefónica</span>
                                        </Label>
                                    </RadioGroup>
                                    {activeClient.visitType === 'telefonica' && (
                                        <Textarea placeholder="Resultado de la llamada..." value={activeClient.callObservation || ''} onChange={e => handleFieldChange('callObservation', e.target.value)} className="bg-slate-50 border-slate-200 rounded-xl min-h-[100px] animate-in slide-in-from-top-4 duration-300" />
                                    )}
                                </div>

                                <div className="space-y-6">
                                    <h4 className="font-extrabold text-xl flex items-center gap-3 text-slate-800">
                                        <LogIn className="h-6 w-6 text-primary" /> 
                                        3. Datos de la Gestión
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                                        <div className="space-y-3">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Venta ($)</Label>
                                            <Input type="number" placeholder="0.00" value={activeClient.valorVenta ?? ''} onChange={e => handleFieldChange('valorVenta', e.target.value)} className="h-12 bg-white text-lg font-bold border-slate-200 rounded-xl" />
                                        </div>
                                        <div className="space-y-3">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Cobro ($)</Label>
                                            <Input type="number" placeholder="0.00" value={activeClient.valorCobro ?? ''} onChange={e => handleFieldChange('valorCobro', e.target.value)} className="h-12 bg-white text-lg font-bold border-slate-200 rounded-xl" />
                                        </div>
                                        <div className="space-y-3">
                                            <Label className="text-xs font-bold text-slate-500 uppercase">Devoluciones ($)</Label>
                                            <Input type="number" placeholder="0.00" value={activeClient.devoluciones ?? ''} onChange={e => handleFieldChange('devoluciones', e.target.value)} className="h-12 bg-white text-lg font-bold border-slate-200 rounded-xl" />
                                        </div>
                                    </div>
                                    {!isClientFinalized && (
                                        <Button onClick={handleConfirmCheckOut} className="w-full h-16 text-xl font-black mt-6 shadow-xl bg-primary hover:bg-primary/90 rounded-2xl transform active:scale-95 transition-all" disabled={isSaving || !activeClient.visitType || isLocating}>
                                            {isSaving ? <LoaderCircle className="animate-spin mr-2" /> : <LogOut className="mr-3 h-7 w-7" />}
                                            FINALIZAR VISITA
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 animate-in fade-in duration-700">
                            <div className="p-6 bg-emerald-500 text-white rounded-full inline-block shadow-2xl mb-8">
                                <CheckCircle className="h-20 w-20" />
                            </div>
                            <h3 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter uppercase">¡Jornada Finalizada!</h3>
                            <p className="text-slate-500 mb-10 max-w-xs mx-auto font-medium">Has completado todas las visitas programadas para el día de hoy.</p>
                            <Button variant="outline" className="h-14 px-10 border-2 font-bold rounded-2xl" onClick={() => window.location.href='/dashboard'}>Volver al Panel</Button>
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
