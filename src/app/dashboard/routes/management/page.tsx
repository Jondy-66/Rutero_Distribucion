'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Search, MapPin, LoaderCircle, LogIn, LogOut, CheckCircle, Phone, User, PlusCircle, PlayCircle, X, AlertCircle, Sparkles } from 'lucide-react';
import { updateRoute } from '@/lib/firebase/firestore';
import type { Client, ClientInRoute } from '@/lib/types';
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
import { Timestamp } from 'firebase/firestore';
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
  const [todayFormatted, setTodayFormatted] = useState('');
  
  const [currentRouteClientsFull, setCurrentRouteClientsFull] = useState<ClientInRoute[]>([]);
  const [activeRuc, setActiveRuc] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [addClientSearchTerm, setAddClientSearchTerm] = useState('');
  const [multiSelectedClients, setMultiSelectedClients] = useState<Client[]>([]);

  const isInitialRehydrationDone = useRef(false);
  const SELECTION_KEY = user ? `mgmt_selected_route_v5_${user.id}` : null;

  useEffect(() => {
    setTodayFormatted(format(new Date(), "EEEE, d 'de' MMMM", { locale: es }));
  }, []);

  const selectableRoutes = useMemo(() => {
    return allRoutes.filter(r => {
        const isOwner = r.createdBy === user?.id;
        if (!isOwner) return false;
        const routeDate = r.date instanceof Timestamp ? r.date.toDate() : (r.date instanceof Date ? r.date : new Date(r.date));
        const expirationDate = addDays(startOfDay(routeDate), 7);
        const isExpired = isBefore(expirationDate, startOfDay(new Date()));
        
        return (r.status === 'En Progreso' || r.status === 'Planificada') && !isExpired;
    });
  }, [allRoutes, user]);

  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) return undefined;
    return allRoutes.find(r => r.id === selectedRouteId);
  }, [selectedRouteId, allRoutes]);
  
  useEffect(() => {
    if (authLoading || dataLoading) return;

    const checkAndAutoCloseRoutes = async () => {
        const inProgressRoutes = allRoutes.filter(r => r.createdBy === user?.id && r.status === 'En Progreso');
        for (const r of inProgressRoutes) {
            const routeDate = r.date instanceof Timestamp ? r.date.toDate() : (r.date instanceof Date ? r.date : new Date(r.date));
            const expirationDate = addDays(startOfDay(routeDate), 7);
            
            if (isBefore(expirationDate, startOfDay(new Date()))) {
                const allDone = r.clients.filter(c => c.status !== 'Eliminado').every(c => c.visitStatus === 'Completado');
                const newStatus = allDone ? 'Completada' : 'Incompleta';
                
                await updateRoute(r.id, { status: newStatus });
                toast({ 
                    title: "Ruta Cerrada Automáticamente", 
                    description: `La ruta "${r.routeName}" ha finalizado como ${newStatus}.`,
                    variant: "destructive"
                });
                await refetchData('routes');
            }
        }
    };

    checkAndAutoCloseRoutes();
  }, [allRoutes, user, authLoading, dataLoading, toast, refetchData]);

  useEffect(() => {
    if (authLoading || dataLoading || !selectedRoute) return;
    
    if (!isSaving) {
        const clients = selectedRoute.clients || [];
        setCurrentRouteClientsFull(clients);
        setIsRouteStarted(selectedRoute.status === 'En Progreso');
    }
  }, [selectedRoute, authLoading, dataLoading, isSaving]);

  useEffect(() => {
    if (authLoading || dataLoading || isInitialRehydrationDone.current || !SELECTION_KEY) return;

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
                setIsRouteStarted(found.status === 'En Progreso');
            }
        }
    }
    isInitialRehydrationDone.current = true;
  }, [authLoading, dataLoading, SELECTION_KEY, allRoutes, user]);

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

  const isTodayCompleted = useMemo(() => {
    return routeClients.length > 0 && routeClients.every(c => c.visitStatus === 'Completado');
  }, [routeClients]);

  const isEntireWeekCompleted = useMemo(() => {
      const activeWeekly = currentRouteClientsFull.filter(c => c.status !== 'Eliminado');
      return activeWeekly.length > 0 && activeWeekly.every(c => c.visitStatus === 'Completado');
  }, [currentRouteClientsFull]);

  useEffect(() => {
    if (!activeRuc && routeClients.length > 0 && !isTodayCompleted) {
        const nextPending = routeClients.find(c => c.visitStatus !== 'Completado');
        if (nextPending) setActiveRuc(nextPending.ruc);
    }
  }, [routeClients, activeRuc, isTodayCompleted]);

  const activeClient = useMemo(() => {
    if (!activeRuc) return null;
    return routeClients.find(c => c.ruc === activeRuc) || null;
  }, [routeClients, activeRuc]);

  const isCurrentClientInProgress = !!(activeClient?.checkInTime && !activeClient?.checkOutTime);
  const isCurrentClientCompleted = activeClient?.visitStatus === 'Completado';

  const handleFieldChange = (field: keyof ClientInRoute, value: any) => {
    if (!activeRuc || isCurrentClientCompleted || isSaving) return;
    setCurrentRouteClientsFull(prev => prev.map(c => 
        c.ruc === activeRuc ? { ...c, [field]: value } : c
    ));
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
    if (!selectedRoute || !activeRuc || isCurrentClientCompleted || isSaving) return;
    
    setIsSaving(true);
    const time = format(new Date(), 'HH:mm:ss');
    const location = await getCurrentCoords();

    try {
        const nextClients = currentRouteClientsFull.map(c => 
            c.ruc === activeRuc ? { ...c, checkInTime: time, checkInLocation: location } : c
        );
        setCurrentRouteClientsFull(nextClients);
        await updateRoute(selectedRoute.id, { clients: sanitizeClientsForFirestore(nextClients) });
        await refetchData('routes');
        toast({ title: "Entrada Registrada" });
    } catch (e) {
        toast({ title: "Error al registrar entrada", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedRoute || !activeRuc || isCurrentClientCompleted || isSaving) return;

    setIsSaving(true);
    const time = format(new Date(), 'HH:mm:ss');
    const location = await getCurrentCoords();

    try {
        const nextClients = currentRouteClientsFull.map(c => 
            c.ruc === activeRuc ? { ...c, checkOutTime: time, checkOutLocation: location, visitStatus: 'Completado' } : c
        );

        const allActiveClients = nextClients.filter(c => c.status !== 'Eliminado');
        const allTotalClientsDone = allActiveClients.length > 0 && allActiveClients.every(c => c.visitStatus === 'Completado');

        const newStatus = allTotalClientsDone ? 'Completada' : 'En Progreso';
        
        setCurrentRouteClientsFull(nextClients);
        
        await updateRoute(selectedRoute.id, { 
            clients: sanitizeClientsForFirestore(nextClients), 
            status: newStatus 
        });
        
        await refetchData('routes');
        setActiveRuc(null);

        if (allTotalClientsDone) {
            setIsRouteStarted(false);
            setSelectedRouteId(undefined);
            localStorage.removeItem(SELECTION_KEY!);
        }

        toast({ 
            title: allTotalClientsDone ? "Ruta Completada" : "Visita Finalizada",
            description: allTotalClientsDone ? "Has terminado toda tu planificación semanal." : undefined
        });
    } catch (e) {
        toast({ title: "Error al finalizar visita", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const myAssignedClients = useMemo(() => {
    return availableClients.filter(c => c.ejecutivo === user?.name);
  }, [availableClients, user]);

  const filteredSearchClients = useMemo(() => {
    const term = addClientSearchTerm.toLowerCase();
    return myAssignedClients.filter(c => 
        c.nombre_cliente.toLowerCase().includes(term) || 
        c.nombre_comercial.toLowerCase().includes(term) ||
        c.ruc.includes(term)
    );
  }, [myAssignedClients, addClientSearchTerm]);

  const handleAddClientsToRoute = async () => {
    if (!selectedRoute || multiSelectedClients.length === 0 || isSaving) return;

    setIsSaving(true);
    const newClientsToAdd: ClientInRoute[] = multiSelectedClients.map(c => ({
        ruc: c.ruc,
        nombre_comercial: c.nombre_comercial,
        date: new Date(),
        visitStatus: 'Pendiente',
        status: 'Activo',
        origin: 'manual'
    }));

    const nextFullList = [...currentRouteClientsFull, ...newClientsToAdd];
    
    try {
        await updateRoute(selectedRoute.id, { clients: sanitizeClientsForFirestore(nextFullList) });
        setCurrentRouteClientsFull(nextFullList);
        setMultiSelectedClients([]);
        setAddClientSearchTerm('');
        setIsAddClientDialogOpen(false);
        toast({ title: "Clientes añadidos" });
        await refetchData('routes');
    } catch (e) {
        toast({ title: "Error al añadir", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleSelectClient = (ruc: string) => {
      if (isSaving) return;
      if (isCurrentClientInProgress && activeRuc !== ruc) {
          toast({ title: "Gestión en curso", description: "Finaliza la visita actual primero.", variant: "destructive" });
          return;
      }
      setActiveRuc(ruc);
  };

  if (authLoading) return <div className="flex flex-col items-center justify-center h-[60vh] gap-4"><LoaderCircle className="animate-spin h-12 w-12 text-primary" /><p className="text-muted-foreground">Cargando gestión...</p></div>;

  return (
    <>
    <PageHeader title="Gestión de Ruta" description="Gestión diaria de visitas y ventas."/>
    
    {!isRouteStarted ? (
        <Card className="max-w-2xl mx-auto shadow-lg">
            <CardHeader>
                <CardTitle>Selecciona tu Ruta para Hoy</CardTitle>
                <CardDescription>Solo rutas activas asignadas a ti.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Select onValueChange={(v) => { setSelectedRouteId(v); localStorage.setItem(SELECTION_KEY!, v); }} value={selectedRouteId}>
                    <SelectTrigger className="h-12"><Route className="mr-2 h-5 w-5 text-primary" /><SelectValue placeholder="Elije una ruta" /></SelectTrigger>
                    <SelectContent>
                        {selectableRoutes.length > 0 ? (
                            selectableRoutes.map(r => (<SelectItem key={r.id} value={r.id}>{r.routeName}</SelectItem>))
                        ) : (
                            <SelectItem value="none" disabled>No tienes rutas vigentes para hoy</SelectItem>
                        )}
                    </SelectContent>
                </Select>
                <p className="text-xs text-center font-bold text-muted-foreground uppercase">selecciona un cliente para empezar gestion</p>
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
                <p className="text-muted-foreground text-xs capitalize">{todayFormatted}</p>
            </CardHeader>
            <CardContent className="px-4">
                <div className="mb-6 space-y-3">
                    <div className="flex justify-between text-[10px] uppercase font-black">
                        <span>Progreso Hoy</span>
                        <span className="text-primary">{routeClients.filter(c => c.visitStatus === 'Completado').length} / {routeClients.length}</span>
                    </div>
                    <Progress value={(routeClients.filter(c => c.visitStatus === 'Completado').length / (routeClients.length || 1)) * 100} className="h-2" />
                    
                    <Dialog open={isAddClientDialogOpen} onOpenChange={setIsAddClientDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full h-10 border-dashed border-2 font-bold" disabled={isCurrentClientInProgress}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Añadir Cliente a mi Ruta
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[95vw] sm:max-w-[600px] p-0 overflow-hidden bg-white max-h-[90vh] flex flex-col rounded-2xl">
                            <DialogHeader className="p-4 sm:p-6 pb-2">
                                <DialogTitle className="text-xl sm:text-2xl font-bold text-[#011688]">Añadir Clientes</DialogTitle>
                                <DialogDescription className="text-muted-foreground text-xs sm:text-sm font-medium">Buscador multicriterio (RUC, Nombre, Comercial).</DialogDescription>
                            </DialogHeader>
                            <div className="flex-1 overflow-hidden flex flex-col p-4 sm:p-6 space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                                    <Input placeholder="Buscar..." className="h-12 pl-10 border-[#011688] border-2 rounded-xl text-base w-full" value={addClientSearchTerm} onChange={e => setAddClientSearchTerm(e.target.value)} />
                                </div>
                                <ScrollArea className="flex-1 pr-2">
                                    <div className="space-y-3 pb-2">
                                        {filteredSearchClients.map(c => {
                                            const isSel = multiSelectedClients.some(sc => sc.ruc === c.ruc);
                                            return (
                                                <div key={c.ruc} className={cn("flex items-start space-x-3 p-3 rounded-xl border transition-all cursor-pointer", isSel ? "bg-[#011688]/5 border-[#011688]" : "bg-[#f8f9ff] border-[#e2e8f0]")} onClick={() => setMultiSelectedClients(isSel ? multiSelectedClients.filter(sc => sc.ruc !== c.ruc) : [...multiSelectedClients, c])}>
                                                    <Checkbox checked={isSel} className="mt-1 h-5 w-5 border-[#011688]" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm sm:text-base font-black text-[#011688] uppercase truncate">{c.nombre_comercial}</p>
                                                        <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase truncate">{c.nombre_cliente}</p>
                                                        <p className="text-[10px] sm:text-xs font-mono text-muted-foreground mt-1">{c.ruc}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </div>
                            <DialogFooter className="p-4 sm:p-6 bg-[#f8f9ff] border-t flex flex-row items-center justify-between">
                                <span className="text-[10px] sm:text-sm font-black text-[#011688] uppercase">{multiSelectedClients.length} seleccionados</span>
                                <div className="flex gap-2">
                                    <DialogClose asChild><Button variant="ghost" className="h-9 sm:h-10 font-bold text-[#011688]">Cerrar</Button></DialogClose>
                                    <Button className="h-9 sm:h-10 font-bold bg-[#011688] hover:bg-[#011688]/90 px-4 sm:px-8 rounded-xl" disabled={multiSelectedClients.length === 0 || isSaving} onClick={handleAddClientsToRoute}>
                                        {isSaving && <LoaderCircle className="animate-spin mr-2" />} Añadir
                                    </Button>
                                </div>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="space-y-2">
                    {routeClients.map((c, i) => (
                        <div key={c.ruc} onClick={() => handleSelectClient(c.ruc)} className={cn(
                            "flex items-center justify-between p-3 bg-card border rounded-lg transition-all shadow-sm cursor-pointer", 
                            activeRuc === c.ruc ? "ring-2 ring-primary border-primary" : "hover:bg-accent/50", 
                            c.visitStatus === 'Completado' && "opacity-50 grayscale bg-muted/30",
                            isCurrentClientInProgress && activeRuc !== c.ruc && "opacity-30 cursor-not-allowed"
                        )}>
                            <div className="flex items-center gap-3 overflow-hidden">
                                <span className="text-[10px] font-black text-muted-foreground/40 w-4">{i + 1}</span>
                                <div className="min-w-0">
                                    <p className="font-bold text-sm truncate uppercase">{c.nombre_comercial}</p>
                                    <span className="text-[9px] text-muted-foreground truncate block uppercase font-mono">{c.ruc}</span>
                                </div>
                            </div>
                            {c.visitStatus === 'Completado' && <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />}
                            {isCurrentClientInProgress && activeRuc === c.ruc && <LoaderCircle className="h-4 w-4 animate-spin text-primary" />}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

        <div className="lg:col-span-2">
            <Card className="shadow-lg border-t-4 border-t-primary min-h-[600px] flex flex-col">
                <CardHeader className="bg-muted/10 pb-6 min-h-[200px] flex flex-col justify-center">
                    {isTodayCompleted ? (
                        <div className="flex flex-col items-center justify-center text-center gap-4 py-8 animate-in fade-in zoom-in duration-500">
                            <div className="bg-green-100 p-6 rounded-full shadow-lg ring-4 ring-green-50">
                                <Sparkles className="h-16 w-16 text-green-600" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-3xl font-black text-green-700 uppercase">
                                    {isEntireWeekCompleted ? "¡Ruta Semanal Completada!" : "¡Jornada de Hoy Completada!"}
                                </h3>
                                <p className="text-sm font-bold text-green-600/80 uppercase">
                                    {isEntireWeekCompleted 
                                        ? "Has gestionado todos los clientes de tu planificación semanal." 
                                        : "Has gestionado todos los clientes planificados para este día."}
                                </p>
                            </div>
                        </div>
                    ) : activeClient ? (
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-primary leading-tight uppercase break-words">{activeClient.nombre_comercial}</h3>
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-mono text-[10px]">{activeClient.ruc}</Badge>
                                    <Badge variant={isCurrentClientCompleted ? "success" : "secondary"} className="text-[9px] font-bold uppercase">
                                        {isCurrentClientCompleted ? "VISITA FINALIZADA" : "GESTIÓN EN CURSO"}
                                    </Badge>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 p-4 bg-white/80 rounded-2xl border border-primary/10 shadow-sm">
                                <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                <p className="text-sm font-semibold text-muted-foreground leading-relaxed">{activeClient.direccion}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4 text-center">
                            <div className="bg-primary/10 p-6 rounded-full"><User className="h-16 w-16 text-primary animate-bounce" /></div>
                            <div className="space-y-1">
                                <p className="font-black text-xl text-primary uppercase">selecciona un cliente para empezar gestion</p>
                                <p className="text-xs font-bold text-muted-foreground uppercase">Tus clientes de hoy están listados a la izquierda</p>
                            </div>
                        </div>
                    )}
                </CardHeader>
                
                <CardContent className="space-y-8 pt-6 flex-1">
                    {activeClient && !isTodayCompleted && (
                        <div className="space-y-8">
                            {isCurrentClientCompleted && (
                                <div className="bg-green-100 border border-green-200 p-4 rounded-xl flex items-center gap-3 text-green-800">
                                    <CheckCircle className="h-5 w-5" />
                                    <span className="text-sm font-bold uppercase">Gestión completada. Los datos son ahora de solo lectura.</span>
                                </div>
                            )}

                            <div className={cn("p-5 rounded-2xl border-2 transition-all", activeClient.checkInTime ? "bg-green-50 border-green-200 shadow-inner" : "bg-muted/20 border-dashed")}>
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 text-center sm:text-left">
                                        <LogIn className={cn("h-8 w-8", activeClient.checkInTime ? "text-green-600" : "text-muted-foreground")} />
                                        <div>
                                            <h4 className="font-black text-sm uppercase">1. Entrada</h4>
                                            <p className="text-xs font-bold text-muted-foreground">{activeClient.checkInTime ? `REGISTRADO A LAS: ${activeClient.checkInTime}` : 'Presiona al llegar al local'}</p>
                                        </div>
                                    </div>
                                    {!activeClient.checkInTime && <Button size="lg" onClick={handleCheckIn} disabled={isSaving} className="w-full sm:w-auto font-black shadow-lg">REGISTRAR LLEGADA</Button>}
                                </div>
                            </div>

                            <div className={cn("space-y-8 transition-opacity duration-500", !activeClient.checkInTime && "opacity-20 pointer-events-none")}>
                                <div className="space-y-4">
                                    <h4 className="font-black text-sm uppercase flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> 2. Datos de Gestión</h4>
                                    <RadioGroup onValueChange={(v: any) => handleFieldChange('visitType', v)} value={activeClient.visitType} className="grid grid-cols-2 gap-4" disabled={isCurrentClientCompleted || isSaving}>
                                        <Label className={cn("flex flex-col items-center gap-2 border-2 p-4 rounded-xl cursor-pointer transition-all", activeClient.visitType === 'presencial' ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-muted")}>
                                            <RadioGroupItem value="presencial" className="sr-only" /><MapPin className="h-6 w-6" /><span className="text-[10px] font-black uppercase">PRESENCIAL</span>
                                        </Label>
                                        <Label className={cn("flex flex-col items-center gap-2 border-2 p-4 rounded-xl cursor-pointer transition-all", activeClient.visitType === 'telefonica' ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-muted")}>
                                            <RadioGroupItem value="telefonica" className="sr-only" /><Phone className="h-6 w-6" /><span className="text-[10px] font-black uppercase">TELEFÓNICA</span>
                                        </Label>
                                    </RadioGroup>
                                    {activeClient.visitType === 'telefonica' && <Textarea placeholder="Observaciones de la llamada..." className="font-semibold" value={activeClient.callObservation || ''} onChange={e => handleFieldChange('callObservation', e.target.value)} disabled={isCurrentClientCompleted || isSaving} />}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-primary">Venta ($)</Label><Input type="number" placeholder="0.00" className="h-12 text-lg font-bold" value={activeClient.valorVenta ?? ''} onChange={e => handleFieldChange('valorVenta', e.target.value)} disabled={isCurrentClientCompleted || isSaving} /></div>
                                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-orange-600">Cobro ($)</Label><Input type="number" placeholder="0.00" className="h-12 text-lg font-bold" value={activeClient.valorCobro ?? ''} onChange={e => handleFieldChange('valorCobro', e.target.value)} disabled={isCurrentClientCompleted || isSaving} /></div>
                                    <div className="space-y-1"><Label className="text-[10px] font-black uppercase text-destructive">Devolución ($)</Label><Input type="number" placeholder="0.00" className="h-12 text-lg font-bold" value={activeClient.devoluciones ?? ''} onChange={e => handleFieldChange('devoluciones', e.target.value)} disabled={isCurrentClientCompleted || isSaving} /></div>
                                </div>
                                
                                <Button onClick={handleConfirmCheckOut} className="w-full h-16 text-lg font-black mt-6 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all" disabled={isSaving || !activeClient.visitType || isCurrentClientCompleted}>
                                    {isSaving ? <LoaderCircle className="animate-spin mr-2" /> : <LogOut className="mr-2 h-6 w-6" />} 
                                    {isCurrentClientCompleted ? "VISITA FINALIZADA" : "FINALIZAR VISITA"}
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
