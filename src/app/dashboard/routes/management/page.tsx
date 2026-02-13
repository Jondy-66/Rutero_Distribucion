'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Search, GripVertical, MapPin, LoaderCircle, LogIn, LogOut, CheckCircle, Phone, User, PlusCircle, PlayCircle, Clock, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { updateRoute, getRoute } from '@/lib/firebase/firestore';
import type { Client, RoutePlan, ClientInRoute } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, isFuture } from 'date-fns';
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

  const SELECTION_KEY = user ? `mgmt_selected_route_v4_${user.id}` : null;

  const selectableRoutes = useMemo(() => {
    return allRoutes.filter(r => {
        const isOwner = r.createdBy === user?.id;
        if (!isOwner) return false;
        if (r.id === selectedRouteId) return true;
        return r.status === 'En Progreso' || r.status === 'Planificada';
    });
  }, [allRoutes, user, selectedRouteId]);

  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) return undefined;
    return allRoutes.find(r => r.id === selectedRouteId);
  }, [selectedRouteId, allRoutes]);
  
  useEffect(() => {
    if (authLoading || dataLoading) return;
    if (isInitialRehydrationDone.current || !SELECTION_KEY) return;

    const activeRoute = allRoutes.find(r => r.status === 'En Progreso' && r.createdBy === user?.id);
    if (activeRoute) {
        setSelectedRouteId(activeRoute.id);
        setIsRouteStarted(true);
        localStorage.setItem(SELECTION_KEY, activeRoute.id);
        isInitialRehydrationDone.current = true;
        return;
    }

    const savedId = localStorage.getItem(SELECTION_KEY);
    if (savedId && allRoutes.length > 0) {
        const found = allRoutes.find(r => r.id === savedId);
        if (found && found.status !== 'Completada') {
            setSelectedRouteId(savedId);
            setIsRouteStarted(found.status === 'En Progreso');
            isInitialRehydrationDone.current = true;
            return;
        }
    }

    isInitialRehydrationDone.current = true;
  }, [authLoading, dataLoading, SELECTION_KEY, allRoutes, user]);

  useEffect(() => {
    if (!selectedRoute) return;
    const clients = selectedRoute.clients || [];
    if (lastKnownRouteId.current !== selectedRoute.id || currentRouteClientsFull.length !== clients.length) {
        if (clients.length > 0) {
            setCurrentRouteClientsFull(clients);
            lastKnownRouteId.current = selectedRoute.id;
        }
    }
    setIsRouteStarted(selectedRoute.status === 'En Progreso');
  }, [selectedRoute]);

  const routeClients = useMemo(() => {
    return currentRouteClientsFull
        .filter(c => {
            if (c.status === 'Eliminado' || !c.date) return false;
            const cDate = c.date instanceof Timestamp ? c.date.toDate() : new Date(c.date as any);
            return isToday(cDate);
        })
        .map(c => {
            const details = availableClients.find(ac => ac.ruc === c.ruc);
            return {
                id: details?.id || c.ruc,
                nombre_cliente: details?.nombre_cliente || c.nombre_comercial,
                nombre_comercial: c.nombre_comercial,
                direccion: details?.direccion || 'Dirección no disponible',
                latitud: details?.latitud || 0,
                longitud: details?.longitud || 0,
                ejecutivo: details?.ejecutivo || user?.name || '',
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

  const handleFieldChange = (field: keyof ClientInRoute, value: any) => {
    if (!activeRuc) return;
    setCurrentRouteClientsFull(prev => prev.map(c => 
        c.ruc === activeRuc ? { ...c, [field]: value } : c
    ));
  };

  const handleCheckIn = async () => {
    if (!selectedRoute || currentRouteClientsFull.length === 0) {
        toast({ title: "Error de Sincronización", description: "Los datos de la ruta no se han cargado.", variant: "destructive" });
        return;
    }
    const time = format(new Date(), 'HH:mm:ss');
    handleFieldChange('checkInTime', time);
    setIsLocating(true);
    
    let nextClients = currentRouteClientsFull.map(c => 
        c.ruc === activeRuc ? { ...c, checkInTime: time } : c
    );

    const sanitized = sanitizeClientsForFirestore(nextClients);
    await updateRoute(selectedRoute.id, { clients: sanitized });
    setIsLocating(false);
    toast({ title: "Entrada Registrada" });
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedRoute || currentRouteClientsFull.length === 0) {
        toast({ title: "Error de Sincronización", description: "Falla de red. Abortando guardado.", variant: "destructive" });
        return;
    }
    
    if (currentRouteClientsFull.length === 0) {
        toast({ title: "Error Crítico", description: "No hay clientes cargados en memoria. Abortando escritura para proteger datos.", variant: "destructive" });
        return;
    }

    const time = format(new Date(), 'HH:mm:ss');
    const currentRucToFinalize = activeRuc;
    setIsSaving(true);

    let nextClients = currentRouteClientsFull.map(c => {
        if (c.ruc === currentRucToFinalize) {
            return { 
                ...c, 
                checkOutTime: time, 
                visitStatus: 'Completado' as const,
            };
        }
        return c;
    });

    const allClientsDone = nextClients
        .filter(c => c.status !== 'Eliminado')
        .every(c => c.visitStatus === 'Completado');

    const newStatus = allClientsDone ? 'Completada' : 'En Progreso';
    const sanitized = sanitizeClientsForFirestore(nextClients);
    
    await updateRoute(selectedRoute.id, { clients: sanitized, status: newStatus });
    await refetchData('routes');
    setActiveRuc(null);
    setIsSaving(false);
    toast({ title: "Visita Finalizada" });
  };

  if (authLoading || (dataLoading && !isRouteStarted)) {
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
                <Select onValueChange={(v) => setSelectedRouteId(v)} value={selectedRouteId}>
                    <SelectTrigger className="h-12"><Route className="mr-2 h-5 w-5 text-primary" /><SelectValue placeholder="Elije una ruta activa" /></SelectTrigger>
                    <SelectContent>
                        {selectableRoutes.map(r => (<SelectItem key={r.id} value={r.id}>{r.routeName}</SelectItem>))}
                    </SelectContent>
                </Select>
                {selectedRoute && (
                    <Button onClick={() => { updateRoute(selectedRoute.id, {status: 'En Progreso'}).then(() => { setIsRouteStarted(true); refetchData('routes'); }); }} className="w-full h-12 text-lg font-bold">
                        <PlayCircle className="mr-2 h-6 w-6" /> INICIAR GESTIÓN
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
                    <Progress value={(routeClients.filter(c => c.visitStatus === 'Completado').length / (routeClients.length || 1)) * 100} className="h-1.5 mb-2" />
                    <p className="text-[11px] font-bold text-blue-600 animate-pulse uppercase tracking-tight">selecciona un cliente para empezar gestion</p>
                </div>

                <div className="space-y-2">
                    {routeClients.map((c, i) => (
                        <div key={c.ruc} onClick={() => !isSaving && setActiveRuc(c.ruc)} className={cn(
                            "flex items-center justify-between p-3 bg-card border rounded-lg transition-all shadow-sm cursor-pointer", 
                            activeRuc === c.ruc ? "ring-2 ring-primary border-primary" : "hover:bg-accent/50", 
                            c.visitStatus === 'Completado' && "opacity-50 grayscale bg-muted/30"
                        )}>
                            <div className="flex items-center gap-3 overflow-hidden">
                                <span className="text-[10px] font-black text-muted-foreground/40 w-4">{i + 1}</span>
                                <div className="min-w-0">
                                    <p className="font-bold text-sm truncate">{c.nombre_comercial}</p>
                                    <span className="text-[9px] text-muted-foreground truncate block uppercase">{c.ruc}</span>
                                </div>
                            </div>
                            {c.visitStatus === 'Completado' && <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

        <div className="lg:col-span-2">
            <Card className="shadow-lg border-t-4 border-t-primary">
                <CardHeader className="bg-muted/10 pb-6 min-h-[200px] flex flex-col justify-center">
                    {activeClient ? (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-primary leading-tight uppercase break-words">{activeClient.nombre_comercial}</h3>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-mono text-[10px]">{activeClient.ruc}</Badge>
                                    <Badge variant="secondary" className="text-[9px] font-bold uppercase">{activeClient.ejecutivo}</Badge>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 bg-white/80 rounded-2xl border border-primary/10 shadow-sm">
                                <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <p className="text-sm font-semibold text-muted-foreground leading-relaxed">{activeClient.direccion}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4 text-center">
                            <div className="bg-primary/10 p-4 rounded-full">
                                <User className="h-12 w-12 text-primary animate-bounce" />
                            </div>
                            <p className="font-black text-xl text-primary uppercase">selecciona un cliente para empezar gestion</p>
                        </div>
                    )}
                </CardHeader>
                <CardContent className="space-y-8 pt-6">
                    {activeClient && (
                        <div className="space-y-8">
                            <div className={cn("p-5 rounded-2xl border-2 transition-all", activeClient.checkInTime ? "bg-green-50 border-green-200" : "bg-muted/20 border-dashed")}>
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 text-center sm:text-left">
                                        <LogIn className={cn("h-6 w-6", activeClient.checkInTime ? "text-green-600" : "text-muted-foreground")} />
                                        <div>
                                            <h4 className="font-black text-sm uppercase">1. Entrada</h4>
                                            <p className="text-xs font-bold text-muted-foreground">{activeClient.checkInTime ? `HORA: ${activeClient.checkInTime}` : 'Presiona al llegar'}</p>
                                        </div>
                                    </div>
                                    {!activeClient.checkInTime && <Button size="lg" onClick={handleCheckIn} className="w-full sm:w-auto font-black">REGISTRAR LLEGADA</Button>}
                                </div>
                            </div>

                            <div className={cn("space-y-8", !activeClient.checkInTime && "opacity-20 pointer-events-none")}>
                                <div className="space-y-4">
                                    <h4 className="font-black text-sm uppercase flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> 2. Gestión</h4>
                                    <RadioGroup onValueChange={(v: any) => handleFieldChange('visitType', v)} value={activeClient.visitType} className="grid grid-cols-2 gap-4">
                                        <Label className={cn("flex flex-col items-center gap-2 border-2 p-4 rounded-xl cursor-pointer", activeClient.visitType === 'presencial' ? "border-primary bg-primary/5" : "border-muted")}>
                                            <RadioGroupItem value="presencial" className="sr-only" /><MapPin className="h-6 w-6" /><span className="text-[10px] font-bold">PRESENCIAL</span>
                                        </Label>
                                        <Label className={cn("flex flex-col items-center gap-2 border-2 p-4 rounded-xl cursor-pointer", activeClient.visitType === 'telefonica' ? "border-primary bg-primary/5" : "border-muted")}>
                                            <RadioGroupItem value="telefonica" className="sr-only" /><Phone className="h-6 w-6" /><span className="text-[10px] font-bold">TELEFÓNICA</span>
                                        </Label>
                                    </RadioGroup>
                                    {activeClient.visitType === 'telefonica' && <Textarea placeholder="Observaciones de llamada..." value={activeClient.callObservation || ''} onChange={e => handleFieldChange('callObservation', e.target.value)} />}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Venta ($)</Label><Input type="number" placeholder="0.00" value={activeClient.valorVenta ?? ''} onChange={e => handleFieldChange('valorVenta', e.target.value)} /></div>
                                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Cobro ($)</Label><Input type="number" placeholder="0.00" value={activeClient.valorCobro ?? ''} onChange={e => handleFieldChange('valorCobro', e.target.value)} /></div>
                                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Devolución ($)</Label><Input type="number" placeholder="0.00" value={activeClient.devoluciones ?? ''} onChange={e => handleFieldChange('devoluciones', e.target.value)} /></div>
                                </div>
                                
                                <Button onClick={handleConfirmCheckOut} className="w-full h-16 text-lg font-black mt-6 rounded-2xl shadow-xl" disabled={isSaving || !activeClient.visitType}>
                                    {isSaving ? <LoaderCircle className="animate-spin mr-2" /> : <LogOut className="mr-2 h-6 w-6" />} FINALIZAR VISITA
                                </Button>
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
