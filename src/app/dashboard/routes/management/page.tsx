'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Search, GripVertical, MapPin, LoaderCircle, LogIn, LogOut, CheckCircle, AlertTriangle, Phone, User, PlusCircle, Download } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { updateRoute } from '@/lib/firebase/firestore';
import type { Client, RoutePlan, ClientInRoute } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { MapView } from '@/components/map-view';
import { isFinite } from 'lodash';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import * as XLSX from 'xlsx';
import { Timestamp, GeoPoint } from 'firebase/firestore';
import { cn } from '@/lib/utils';

type RouteClient = Client & ClientInRoute;

export default function RouteManagementPage() {
  const { user, clients: availableClients, routes: allRoutes, loading: authLoading, refetchData } = useAuth();
  
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [isRouteStarted, setIsRouteStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isRouteExpired, setIsRouteExpired] = useState(false);
  const [remainingTime, setRemainingTime] = useState({ hours: 0, minutes: 0, seconds: 0, expired: false });
  const [todayFormatted, setTodayFormatted] = useState('');
  
  const [currentRouteClientsFull, setCurrentRouteClientsFull] = useState<ClientInRoute[]>([]);
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number} | null>(null);
  const { toast } = useToast();
  
  const [activeClient, setActiveClient] = useState<RouteClient | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [visitType, setVisitType] = useState<'presencial' | 'telefonica' | undefined>();
  const [callObservation, setCallObservation] = useState('');

  // Estados para añadir cliente nuevo
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [addClientSearchTerm, setAddClientSearchTerm] = useState('');

  // Claves de persistencia
  const SELECTION_KEY = user ? `mgmt_selected_route_${user.id}` : null;
  const DRAFT_KEY = (rid: string, ruc: string) => user ? `mgmt_draft_${user.id}_${rid}_${ruc}` : null;

  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) return undefined;
    return allRoutes.find(r => r.id === selectedRouteId);
  }, [selectedRouteId, allRoutes]);
  
  useEffect(() => {
    setTodayFormatted(format(new Date(), "EEEE, d 'de' MMMM", { locale: es }));
  }, []);

  useEffect(() => {
    if (!authLoading && SELECTION_KEY) {
      const savedId = localStorage.getItem(SELECTION_KEY);
      if (savedId && allRoutes.some(r => r.id === savedId)) {
        handleRouteSelect(savedId);
      }
    }
  }, [authLoading, SELECTION_KEY, allRoutes]);

  useEffect(() => {
    if (selectedRoute) {
        setCurrentRouteClientsFull(selectedRoute.clients);
        if (['En Progreso', 'Incompleta'].includes(selectedRoute.status)) {
          setIsRouteStarted(true);
        } else {
          setIsRouteStarted(false);
        }
    } else {
        setCurrentRouteClientsFull([]);
        setIsRouteStarted(false);
    }
  }, [selectedRoute]);
  
  const routeClients = useMemo(() => {
    return currentRouteClientsFull
        .filter(c => {
            if (c.status === 'Eliminado') return false;
            let cDate: Date | null = null;
            if (c.date instanceof Timestamp) cDate = c.date.toDate();
            else if (c.date instanceof Date) cDate = c.date;
            else if (c.date) cDate = new Date(c.date as any);
            return cDate ? isToday(cDate) : false;
        })
        .map(c => {
            const details = availableClients.find(ac => ac.ruc === c.ruc);
            return {
                ...(details || {}),
                ...c,
                valorVenta: String(c.valorVenta ?? ''),
                valorCobro: String(c.valorCobro ?? ''),
                devoluciones: String(c.devoluciones ?? ''),
                promociones: String(c.promociones ?? ''),
                medicacionFrecuente: String(c.medicacionFrecuente ?? ''),
            } as RouteClient;
        }).filter(c => c.id);
  }, [currentRouteClientsFull, availableClients]);

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
                            setActiveClient(prev => prev ? { 
                                ...prev, 
                                valorVenta: draft.valorVenta || prev.valorVenta,
                                valorCobro: draft.valorCobro || prev.valorCobro,
                                devoluciones: draft.devoluciones || prev.devoluciones,
                                promociones: draft.promociones || prev.promociones,
                                medicacionFrecuente: draft.medicacionFrecuente || prev.medicacionFrecuente
                            } : null);
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
                visitType, callObservation,
                valorVenta: activeClient.valorVenta,
                valorCobro: activeClient.valorCobro,
                devoluciones: activeClient.devoluciones,
                promociones: activeClient.promociones,
                medicacionFrecuente: activeClient.medicacionFrecuente,
            }));
        }
    }
  }, [activeClient, visitType, callObservation, selectedRouteId]);

  const handleRouteSelect = (routeId: string) => {
      setSelectedRouteId(routeId);
      if (SELECTION_KEY) localStorage.setItem(SELECTION_KEY, routeId);
  }

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
    const location = markerPosition ? new GeoPoint(markerPosition.lat, markerPosition.lng) : null;
    setIsSaving(true);
    try {
        const updated = currentRouteClientsFull.map(c => 
            c.ruc === activeClient.ruc ? { ...c, checkInTime: time, checkInLocation: location } : c
        );
        await updateRoute(selectedRoute.id, { clients: updated });
        await refetchData('routes');
        toast({ title: "Entrada Registrada", description: `Hora: ${time}` });
    } catch (error) { 
        console.error(error); 
        toast({ title: "Error", description: "No se pudo registrar la entrada.", variant: "destructive" });
    } finally { 
        setIsSaving(false); 
    }
  };

  const handleClientValueChange = (ruc: string, field: string, value: string) => {
    setActiveClient(prev => {
        if (!prev || prev.ruc !== ruc) return prev;
        return { ...prev, [field]: value };
    });
  };

  const parseSafeFloat = (val: any) => {
    if (!val) return 0;
    const parsed = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
    return isFinite(parsed) ? parsed : 0;
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedRoute || !activeClient || !visitType) {
        toast({ title: "Atención", description: "Debes seleccionar el tipo de visita.", variant: "destructive" });
        return;
    }
    setIsSaving(true);
    try {
        const time = format(new Date(), 'HH:mm:ss');
        const location = markerPosition ? new GeoPoint(markerPosition.lat, markerPosition.lng) : null;
        
        const updated = currentRouteClientsFull.map(c => {
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
                    promociones: parseSafeFloat(activeClient.promociones),
                    medicacionFrecuente: parseSafeFloat(activeClient.medicacionFrecuente),
                    callObservation: visitType === 'telefonica' ? (callObservation || null) : null
                };
            }
            return c;
        });
        
        const allDone = updated.filter(c => c.status !== 'Eliminado').every(c => c.visitStatus === 'Completado');
        const todaysDone = updated.filter(c => {
            if (c.status === 'Eliminado') return false;
            let d: Date | null = null;
            if (c.date instanceof Timestamp) d = c.date.toDate();
            else if (c.date instanceof Date) d = c.date;
            else if (c.date) d = new Date(c.date as any);
            return d ? isToday(d) : false;
        }).every(c => c.visitStatus === 'Completado');

        let newStatus = selectedRoute.status;
        if (allDone) {
            newStatus = 'Completada';
        } else if (todaysDone) {
            newStatus = 'En Progreso';
        }

        await updateRoute(selectedRoute.id, { clients: updated, status: newStatus });
        await refetchData('routes');
        
        const key = DRAFT_KEY(selectedRoute.id, activeClient.ruc);
        if (key) localStorage.removeItem(key);
        
        toast({ title: "Visita Finalizada", description: `Cliente: ${activeClient.nombre_comercial}` });
        setVisitType(undefined);
        setCallObservation('');
    } catch(error) { 
        console.error("Error al guardar visita:", error); 
        toast({ title: "Error", description: "No se pudo guardar la visita. Revisa los datos ingresados.", variant: "destructive" });
    } finally { 
        setIsSaving(false); 
    }
  }

  const onDragEnd = async (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || !selectedRoute) return;
    
    const items = Array.from(routeClients);
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);
    
    const updatedFull = currentRouteClientsFull.map(c => {
        const match = items.find(i => i.ruc === c.ruc);
        return match ? { ...c, ...match } : c;
    });

    setIsSaving(true);
    try {
        await updateRoute(selectedRoute.id, { clients: updatedFull });
        await refetchData('routes');
    } catch (e) {
        console.error(e);
    } finally {
        setIsSaving(false);
    }
  };

  const handleAddClientToRoute = async (client: Client) => {
    if (!selectedRoute) return;
    
    const isAlreadyInToday = currentRouteClientsFull.some(c => 
        c.ruc === client.ruc && 
        c.status !== 'Eliminado' && 
        c.date && 
        isToday(c.date instanceof Timestamp ? c.date.toDate() : (c.date instanceof Date ? c.date : new Date(c.date)))
    );

    if (isAlreadyInToday) {
        toast({ title: "Cliente ya en ruta", description: "Este cliente ya está programado para el día de hoy.", variant: "destructive" });
        return;
    }

    setIsSaving(true);
    try {
        const newClientInRoute: ClientInRoute = {
            ruc: client.ruc,
            nombre_comercial: client.nombre_comercial,
            date: Timestamp.fromDate(new Date()),
            origin: 'manual',
            status: 'Activo',
            visitStatus: 'Pendiente'
        };

        const updatedClients = [...currentRouteClientsFull, newClientInRoute];
        await updateRoute(selectedRoute.id, { clients: updatedClients });
        await refetchData('routes');
        toast({ title: "Cliente Añadido", description: `${client.nombre_comercial} ha sido añadido a tu ruta de hoy.` });
        setIsAddClientDialogOpen(false);
    } catch (error) {
        console.error(error);
        toast({ title: "Error", description: "No se pudo añadir el cliente a la ruta.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const filteredAvailableClients = useMemo(() => {
    let userClients = availableClients;
    if (user?.role === 'Usuario' || user?.role === 'Telemercaderista') {
      userClients = availableClients.filter(c => c.ejecutivo === user.name);
    }
    
    return userClients.filter(c => 
        String(c.nombre_cliente).toLowerCase().includes(addClientSearchTerm.toLowerCase()) ||
        String(c.nombre_comercial).toLowerCase().includes(addClientSearchTerm.toLowerCase()) ||
        String(c.ruc).includes(addClientSearchTerm)
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
    <PageHeader title="Gestión de Ruta" description="Selecciona, inicia y gestiona tus rutas diarias."/>
    {!isRouteStarted ? (
        <Card className="max-w-2xl mx-auto shadow-lg border-primary/20">
            <CardHeader>
                <CardTitle>Selecciona una Ruta para Hoy</CardTitle>
                <CardDescription>Elije la ruta que vas a gestionar en esta jornada.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Select onValueChange={handleRouteSelect} value={selectedRouteId}>
                    <SelectTrigger className="h-12">
                        <Route className="mr-2 h-5 w-5 text-primary" />
                        <SelectValue placeholder="Elije una ruta planificada para hoy" />
                    </SelectTrigger>
                    <SelectContent>
                        {allRoutes.filter(r => r.createdBy === user?.id && ['Planificada', 'En Progreso', 'Incompleta', 'Rechazada'].includes(r.status))
                            .map(r => {
                                let d = new Date();
                                if (r.date instanceof Timestamp) d = r.date.toDate();
                                else if (r.date instanceof Date) d = r.date;
                                return (
                                    <SelectItem key={r.id} value={r.id}>
                                        {r.routeName} - {format(d, 'dd/MM/yyyy')} ({r.status})
                                    </SelectItem>
                                );
                            })
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
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Ruta actualmente en progreso</p>
                    <p className="text-primary font-bold text-lg capitalize">{todayFormatted}</p>
                </div>
            </CardHeader>
            <CardContent>
                <div className="mb-4">
                    <div className="flex justify-between text-xs mb-1">
                        <span>Progreso del día</span>
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
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Añadir Cliente a la Ruta de Hoy</DialogTitle>
                            <DialogDescription>Selecciona un cliente de tu cartera para añadirlo a tu gestión del día.</DialogDescription>
                        </DialogHeader>
                        <div className="relative mb-4">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar por nombre, RUC..." 
                                className="pl-8" 
                                value={addClientSearchTerm}
                                onChange={(e) => setAddClientSearchTerm(e.target.value)}
                            />
                        </div>
                        <ScrollArea className="h-72">
                            <div className="space-y-2 p-1">
                                {filteredAvailableClients.map(client => (
                                    <div key={client.id} className="flex items-center justify-between p-3 rounded-md hover:bg-muted border border-transparent hover:border-border transition-all">
                                        <div className="flex flex-col overflow-hidden mr-4">
                                            <span className="font-medium truncate">{client.nombre_comercial}</span>
                                            <span className="text-xs text-muted-foreground uppercase">{client.ruc} - {client.direccion}</span>
                                        </div>
                                        <Button size="sm" variant="secondary" onClick={() => handleAddClientToRoute(client)} disabled={isSaving}>
                                            Añadir
                                        </Button>
                                    </div>
                                ))}
                                {filteredAvailableClients.length === 0 && (
                                    <p className="text-center text-muted-foreground py-8">No se encontraron clientes disponibles.</p>
                                )}
                            </div>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>

                <Separator className="my-4" />
                <p className="text-xs font-semibold text-muted-foreground mb-2">ORDEN DE VISITA (Arrastra para reordenar)</p>
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
                                                className={cn(
                                                    "flex items-center justify-between p-3 bg-card border rounded-lg transition-all shadow-sm",
                                                    activeClient?.ruc === c.ruc ? "ring-2 ring-primary border-transparent" : "hover:border-primary/30",
                                                    c.visitStatus === 'Completado' && "bg-green-50/50 border-green-200"
                                                )}
                                            >
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <GripVertical className={cn("h-4 w-4 text-muted-foreground shrink-0", c.visitStatus === 'Completado' && "opacity-0")}/>
                                                    <div className="flex flex-col overflow-hidden">
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn("font-medium truncate", c.visitStatus === 'Completado' && "text-green-700")}>{c.nombre_comercial}</span>
                                                            {c.origin === 'manual' && <Badge variant="secondary" className="text-[8px] h-4 bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">Nuevo</Badge>}
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground uppercase">{c.ruc}</span>
                                                    </div>
                                                </div>
                                                {c.visitStatus === 'Completado' ? (
                                                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                                                ) : (
                                                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">#{i + 1}</span>
                                                )}
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                                {routeClients.length === 0 && (
                                    <p className="text-center text-sm text-muted-foreground py-8">No hay clientes programados para hoy.</p>
                                )}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-lg border-primary/10 overflow-hidden">
                <div className="h-2 bg-primary" />
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl">{activeClient ? activeClient.nombre_comercial : 'Jornada Finalizada'}</CardTitle>
                            {activeClient && <CardDescription>{activeClient.nombre_cliente} • {activeClient.direccion}</CardDescription>}
                        </div>
                        {activeClient && (
                            <Badge variant="outline" className="text-primary border-primary">
                                <User className="h-3 w-3 mr-1" /> {activeClient.ejecutivo}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-8">
                    {activeClient ? (
                        <div className="space-y-8">
                            <div className={cn(
                                "p-5 rounded-xl border-2 transition-all",
                                activeClient.checkInTime ? "bg-green-50 border-green-200" : "bg-muted/30 border-dashed border-muted-foreground/30"
                            )}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={cn("p-3 rounded-full", activeClient.checkInTime ? "bg-green-500 text-white" : "bg-muted text-muted-foreground")}>
                                            <LogIn className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg">1. Registro de Entrada</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {activeClient.checkInTime ? `Marcado a las ${activeClient.checkInTime}` : 'Pendiente de registrar entrada'}
                                            </p>
                                        </div>
                                    </div>
                                    {!activeClient.checkInTime && (
                                        <Button onClick={handleCheckIn} disabled={isSaving} size="lg" className="shadow-md">
                                            {isSaving ? <LoaderCircle className="animate-spin" /> : "Marcar Entrada"}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <div className={cn("space-y-8 transition-all duration-500", !activeClient.checkInTime && "opacity-40 grayscale pointer-events-none")}>
                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg flex items-center gap-2">
                                        <Phone className="h-5 w-5 text-primary" /> 2. Tipo de Visita
                                    </h4>
                                    <RadioGroup onValueChange={(v: any) => setVisitType(v)} value={visitType} className="grid grid-cols-2 gap-4">
                                        <Label className={cn(
                                            "flex flex-col items-center justify-center gap-2 border-2 p-4 rounded-xl cursor-pointer hover:bg-accent/50 transition-all",
                                            visitType === 'presencial' && "border-primary bg-primary/5"
                                        )}>
                                            <RadioGroupItem value="presencial" className="sr-only" />
                                            <MapPin className={cn("h-6 w-6", visitType === 'presencial' ? "text-primary" : "text-muted-foreground")} />
                                            <span className="font-semibold">Presencial</span>
                                        </Label>
                                        <Label className={cn(
                                            "flex flex-col items-center justify-center gap-2 border-2 p-4 rounded-xl cursor-pointer hover:bg-accent/50 transition-all",
                                            visitType === 'telefonica' && "border-primary bg-primary/5"
                                        )}>
                                            <RadioGroupItem value="telefonica" className="sr-only" />
                                            <Phone className={cn("h-6 w-6", visitType === 'telefonica' ? "text-primary" : "text-muted-foreground")} />
                                            <span className="font-semibold">Telefónica</span>
                                        </Label>
                                    </RadioGroup>
                                    {visitType === 'telefonica' && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                            <Label htmlFor="obs">Observación de la llamada</Label>
                                            <Textarea 
                                                id="obs"
                                                placeholder="Describe el resultado de la llamada..." 
                                                value={callObservation} 
                                                onChange={e => setCallObservation(e.target.value)}
                                                className="min-h-[100px]"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <h4 className="font-bold text-lg flex items-center gap-2">
                                        <Download className="h-5 w-5 text-primary" /> 3. Datos de la Gestión
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <Label htmlFor="venta">Valor de Venta ($)</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-3 text-muted-foreground">$</span>
                                                <Input 
                                                    id="venta"
                                                    type="number" 
                                                    placeholder="0.00"
                                                    className="pl-7 h-12 text-lg"
                                                    value={activeClient.valorVenta} 
                                                    onChange={e => handleClientValueChange(activeClient.ruc, 'valorVenta', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="cobro">Valor Cobrado ($)</Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-3 text-muted-foreground">$</span>
                                                <Input 
                                                    id="cobro"
                                                    type="number" 
                                                    placeholder="0.00"
                                                    className="pl-7 h-12 text-lg"
                                                    value={activeClient.valorCobro} 
                                                    onChange={e => handleClientValueChange(activeClient.ruc, 'valorCobro', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-4">
                                        <Button 
                                            onClick={handleConfirmCheckOut} 
                                            className="w-full h-14 text-xl font-bold shadow-lg" 
                                            disabled={isSaving || !visitType}
                                        >
                                            {isSaving ? <LoaderCircle className="animate-spin mr-2" /> : <LogOut className="mr-2 h-6 w-6" />}
                                            Guardar y Finalizar Visita
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-16 animate-in zoom-in-95">
                            <div className="inline-block p-6 rounded-full bg-green-100 text-green-600 mb-6">
                                <CheckCircle className="h-16 w-12" />
                            </div>
                            <h3 className="text-3xl font-bold mb-2">¡Todo listo por hoy!</h3>
                            <p className="text-muted-foreground text-lg mb-8">Has completado todas las visitas programadas para el día de hoy.</p>
                            <Button variant="outline" size="lg" onClick={() => router.push('/dashboard')}>
                                Volver al Panel
                            </Button>
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

function PlayCircle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="10 8 16 12 10 16 10 8" />
    </svg>
  )
}
