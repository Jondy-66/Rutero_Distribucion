
'use client';
import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Search, MapPin, LoaderCircle, LogIn, LogOut, CheckCircle, Phone, User, PlusCircle, PlayCircle, X, AlertCircle, ThumbsUp, Trash2, MessageSquare, Users } from 'lucide-react';
import { updateRoute } from '@/lib/firebase/firestore';
import type { Client, ClientInRoute, RoutePlan } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, isBefore, startOfDay, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
            if (val === undefined || val === null || val === '') return 0;
            const n = parseFloat(String(val).replace(',', '.'));
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

type RouteClient = Client & ClientInRoute & { originalIndex: number };

function RouteManagementContent() {
  const { user, clients: availableClients, routes: allRoutes, users: allUsers, loading: authLoading, dataLoading, refetchData } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeIdFromParams = searchParams.get('routeId');
  
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [isRouteStarted, setIsRouteStarted] = useState(false);
  const [todayFormatted, setTodayFormatted] = useState('');
  
  const [currentRouteClientsFull, setCurrentRouteClientsFull] = useState<ClientInRoute[]>([]);
  const [activeOriginalIndex, setActiveOriginalIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [addClientSearchTerm, setAddClientSearchTerm] = useState('');
  const [multiSelectedClients, setMultiSelectedClients] = useState<Client[]>([]);
  const [reAdditionObservation, setReAdditionObservation] = useState('');

  const isInitialRehydrationDone = useRef(false);
  const lastLocalUpdateTimestamp = useRef<number>(0);
  const SELECTION_KEY = user ? `mgmt_selected_route_v9_${user.id}` : null;

  useEffect(() => {
    setTodayFormatted(format(new Date(), "EEEE, d 'de' MMMM", { locale: es }));
  }, []);

  const isAdmin = user?.role === 'Administrador';

  const selectableRoutes = useMemo(() => {
    return allRoutes.filter(r => {
        const isOwner = r.createdBy === user?.id;
        if (!isOwner && !isAdmin) return false;
        if (isAdmin && selectedAgentId !== 'all' && r.createdBy !== selectedAgentId) return false;

        const routeDate = r.date instanceof Timestamp ? r.date.toDate() : (r.date instanceof Date ? r.date : new Date(r.date));
        const expirationDate = addDays(startOfDay(routeDate), 7);
        return (r.status === 'En Progreso' || r.status === 'Planificada' || r.status === 'Completada' || r.status === 'Incompleta') && !isBefore(expirationDate, startOfDay(new Date()));
    });
  }, [allRoutes, user, isAdmin, selectedAgentId]);

  const selectedRoute = useMemo(() => selectedRouteId ? allRoutes.find(r => r.id === selectedRouteId) : undefined, [selectedRouteId, allRoutes]);
  
  useEffect(() => {
    if (authLoading || dataLoading || !selectedRoute) return;
    if (Date.now() - lastLocalUpdateTimestamp.current < 10000) return;

    if (!isSaving) {
        setCurrentRouteClientsFull(selectedRoute.clients || []);
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
        .map((c, index) => ({ ...c, originalIndex: index }))
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

  const isTodayCompleted = useMemo(() => routeClients.length > 0 && routeClients.every(c => c.visitStatus === 'Completado'), [routeClients]);

  const activeClient = useMemo(() => activeOriginalIndex !== null ? routeClients.find(c => c.originalIndex === activeOriginalIndex) || null : null, [routeClients, activeOriginalIndex]);

  useEffect(() => {
    if (activeOriginalIndex === null && routeClients.length > 0 && !isTodayCompleted) {
        const activeVisit = routeClients.find(c => c.checkInTime && !c.checkOutTime);
        if (activeVisit) setActiveOriginalIndex(activeVisit.originalIndex);
        else {
            const nextPending = routeClients.find(c => c.visitStatus !== 'Completado');
            if (nextPending) setActiveOriginalIndex(nextPending.originalIndex);
        }
    }
  }, [routeClients, activeOriginalIndex, isTodayCompleted]);

  const handleFieldChange = (field: keyof ClientInRoute, value: any) => {
    if (activeOriginalIndex === null || (activeClient?.visitStatus === 'Completado' && !isAdmin) || isSaving) return;
    lastLocalUpdateTimestamp.current = Date.now();
    
    const nextClients = currentRouteClientsFull.map((c, idx) => idx === activeOriginalIndex ? { ...c, [field]: value } : c);
    setCurrentRouteClientsFull(nextClients);
    
    if (selectedRoute) {
        updateRoute(selectedRoute.id, { clients: sanitizeClientsForFirestore(nextClients) }).catch(console.error);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedRoute || activeOriginalIndex === null || (activeClient?.visitStatus === 'Completado' && !isAdmin) || isSaving) return;
    setIsSaving(true);
    lastLocalUpdateTimestamp.current = Date.now();
    
    const time = format(new Date(), 'HH:mm:ss');
    const location = await new Promise<{ latitude: number, longitude: number } | null>(resolve => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(p => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }), () => resolve(null), { enableHighAccuracy: true, timeout: 6000 });
    });

    const nextClients = currentRouteClientsFull.map((c, idx) => idx === activeOriginalIndex ? { ...c, checkInTime: time, checkInLocation: location } : c);
    setCurrentRouteClientsFull(nextClients);
    
    try {
        await updateRoute(selectedRoute.id, { clients: sanitizeClientsForFirestore(nextClients) });
        toast({ title: "Entrada Registrada" });
    } finally { setIsSaving(false); }
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedRoute || activeOriginalIndex === null || (activeClient?.visitStatus === 'Completado' && !isAdmin) || isSaving) return;
    if (activeClient?.visitType === 'telefonica' && !activeClient.callObservation?.trim()) {
        toast({ title: "Observación Requerida", variant: "destructive" });
        return;
    }

    setIsSaving(true);
    lastLocalUpdateTimestamp.current = Date.now();
    const time = format(new Date(), 'HH:mm:ss');
    
    const nextClients = currentRouteClientsFull.map((c, idx) => idx === activeOriginalIndex ? { ...c, checkOutTime: time, visitStatus: 'Completado' } : c);
    const activeClientsOnly = nextClients.filter(c => c.status !== 'Eliminado');
    const allDone = activeClientsOnly.length > 0 && activeClientsOnly.every(c => c.visitStatus === 'Completado');

    const updateData: any = { 
        clients: sanitizeClientsForFirestore(nextClients), 
        status: allDone ? 'Completada' : (selectedRoute.status === 'Planificada' ? 'En Progreso' : selectedRoute.status)
    };
    if (allDone) updateData.statusReason = "Jornada completada.";

    setCurrentRouteClientsFull(nextClients);
    try {
        await updateRoute(selectedRoute.id, updateData);
        toast({ title: "Visita Finalizada", variant: allDone ? "success" : "default" });
        if (!isAdmin) setActiveOriginalIndex(null);
        setTimeout(() => refetchData('routes'), 1000);
    } finally { setIsSaving(false); }
  };

  const handleRemoveClientToday = async (originalIndex: number) => {
    if (!selectedRoute || !isAdmin || isSaving) return;
    setIsSaving(true);
    lastLocalUpdateTimestamp.current = Date.now();
    const nextClients = currentRouteClientsFull.map((c, idx) => idx === originalIndex ? { ...c, status: 'Eliminado' as const } : c);
    try {
        await updateRoute(selectedRoute.id, { clients: sanitizeClientsForFirestore(nextClients) });
        setCurrentRouteClientsFull(nextClients);
        if (activeOriginalIndex === originalIndex) setActiveOriginalIndex(null);
        toast({ title: "Cliente removido" });
        refetchData('routes');
    } finally { setIsSaving(false); }
  };

  const handleAddClientsToRoute = async () => {
    if (!selectedRoute || multiSelectedClients.length === 0 || isSaving) return;
    const needsObs = multiSelectedClients.some(c => currentRouteClientsFull.some(e => String(e.ruc).trim() === String(c.ruc).trim() && (e.visitStatus === 'Completado' || !isToday(e.date instanceof Timestamp ? e.date.toDate() : new Date(e.date as any)))));
    if (needsObs && !reAdditionObservation.trim()) return toast({ title: "Observación requerida", variant: "destructive" });

    setIsSaving(true);
    lastLocalUpdateTimestamp.current = Date.now();
    const newClients: ClientInRoute[] = multiSelectedClients.map(c => {
        const existing = currentRouteClientsFull.find(e => String(e.ruc).trim() === String(c.ruc).trim());
        const isRe = !!existing && (existing.visitStatus === 'Completado' || !isToday(existing.date instanceof Timestamp ? existing.date.toDate() : new Date(existing.date as any)));
        return { ruc: c.ruc, nombre_comercial: c.nombre_comercial, date: new Date(), visitStatus: 'Pendiente', status: 'Activo', isReadded: isRe, reAdditionObservation: isRe ? reAdditionObservation : undefined };
    });

    const nextFull = [...currentRouteClientsFull, ...newClients];
    try {
        await updateRoute(selectedRoute.id, { clients: sanitizeClientsForFirestore(nextFull) });
        setCurrentRouteClientsFull(nextFull);
        setMultiSelectedClients([]);
        setReAdditionObservation('');
        setIsAddClientDialogOpen(false);
        toast({ title: "Clientes añadidos" });
        refetchData('routes');
    } finally { setIsSaving(false); }
  };

  if (authLoading) return <div className="flex flex-col items-center justify-center h-[60vh] gap-4"><LoaderCircle className="animate-spin h-12 w-12 text-primary" /><p className="text-muted-foreground font-black">CARGANDO GESTIÓN...</p></div>;

  return (
    <>
    <PageHeader title="Gestión de Ruta" description="Control diario de visitas."/>
    
    {!isRouteStarted ? (
        <Card className="max-w-2xl mx-auto shadow-lg">
            <CardHeader><CardTitle>Selecciona la Ruta a {isAdmin ? 'Supervisar' : 'Gestionar'}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                {isAdmin && (
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">Agente</Label>
                        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                            <SelectTrigger><Users className="mr-2 h-4 w-4" /><SelectValue placeholder="Todos los agentes" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos los agentes</SelectItem>
                                {allUsers.filter(u => u.role === 'Usuario' || u.role === 'Telemercaderista').map(u => (<SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground">Planificación Vigente</Label>
                    <Select onValueChange={v => { setSelectedRouteId(v); if(SELECTION_KEY) localStorage.setItem(SELECTION_KEY, v); }} value={selectedRouteId}>
                        <SelectTrigger className="h-12"><Route className="mr-2 h-5 w-5 text-primary" /><SelectValue placeholder="Elije una ruta" /></SelectTrigger>
                        <SelectContent>
                            {selectableRoutes.map(r => (<SelectItem key={r.id} value={r.id}>{r.routeName} ({allUsers.find(u => u.id === r.createdBy)?.name})</SelectItem>))}
                        </SelectContent>
                    </Select>
                </div>
                {selectedRoute && (
                    <Button onClick={() => updateRoute(selectedRoute.id, {status: 'En Progreso'}).then(() => { setIsRouteStarted(true); refetchData('routes'); })} className="w-full h-12 text-lg font-black uppercase">
                        <PlayCircle className="mr-2 h-6 w-6" /> INICIAR JORNADA
                    </Button>
                )}
            </CardContent>
        </Card>
    ) : isTodayCompleted && !isAdmin ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-10 bg-white rounded-3xl shadow-xl border-4 border-green-50 animate-in zoom-in-95 duration-500">
            <div className="bg-green-100 p-8 rounded-full mb-8 relative">
                <ThumbsUp className="h-20 w-20 text-green-600" />
                <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
            </div>
            <h2 className="text-4xl font-black text-green-700 uppercase tracking-tighter mb-4">¡JORNADA COMPLETADA!</h2>
            <p className="text-sm font-bold text-green-600/80 uppercase mb-8">Has gestionado todos los clientes planificados para hoy.</p>
            <Button className="font-black bg-green-600 hover:bg-green-700 px-12 h-14 text-lg rounded-2xl shadow-xl" onClick={() => router.push('/dashboard')}>VOLVER AL PANEL</Button>
        </div>
    ) : (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-md h-fit">
            <CardHeader className="pb-3 px-4">
                <CardTitle className="text-lg truncate uppercase font-black">{selectedRoute?.routeName}</CardTitle>
                <p className="text-muted-foreground text-[10px] font-black uppercase">{todayFormatted}</p>
            </CardHeader>
            <CardContent className="px-4">
                <div className="mb-6 space-y-3">
                    <div className="flex justify-between text-[10px] uppercase font-black">
                        <span>Progreso Hoy</span>
                        <span className="text-primary">{routeClients.filter(c => c.visitStatus === 'Completado').length} / {routeClients.length}</span>
                    </div>
                    <Progress value={(routeClients.filter(c => c.visitStatus === 'Completado').length / (routeClients.length || 1)) * 100} className="h-2" />
                    <Button variant="outline" className="w-full h-10 border-dashed border-2 font-black uppercase text-[10px]" disabled={activeClient?.checkInTime && !activeClient?.checkOutTime && !isAdmin} onClick={() => setIsAddClientDialogOpen(true)}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Añadir Cliente
                    </Button>
                </div>

                <div className="space-y-2">
                    {routeClients.map((c, i) => (
                        <div key={`${c.ruc}-${c.originalIndex}`} onClick={() => (!isSaving && (isAdmin || !activeClient?.checkInTime || activeClient.checkOutTime || activeOriginalIndex === c.originalIndex)) && setActiveOriginalIndex(c.originalIndex)} className={cn(
                            "flex items-center justify-between p-3 bg-card border-2 rounded-xl transition-all cursor-pointer relative group", 
                            activeOriginalIndex === c.originalIndex ? "border-primary bg-primary/5" : "hover:border-primary/20", 
                            c.visitStatus === 'Completado' && !isAdmin && "opacity-50 grayscale bg-muted/20 border-transparent"
                        )}>
                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                                <span className="text-[10px] font-black text-muted-foreground/40">{i + 1}</span>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <p className="font-black text-xs truncate uppercase">{c.nombre_comercial}</p>
                                        {c.isReadded && <Badge variant="outline" className="text-[8px] bg-orange-50 text-orange-700 font-black h-4 px-1">RE-ADICIÓN</Badge>}
                                    </div>
                                    <span className="text-[9px] text-muted-foreground truncate block font-mono">{c.ruc}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {isAdmin && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); handleRemoveClientToday(c.originalIndex); }}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                                {c.visitStatus === 'Completado' && <CheckCircle className="h-5 w-5 text-green-500" />}
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

        <div className="lg:col-span-2">
            <Card className="shadow-xl border-t-4 border-t-primary min-h-[600px] flex flex-col">
                <CardHeader className="bg-muted/5 min-h-[180px] flex flex-col justify-center">
                    {activeClient ? (
                        <div className="space-y-4">
                            <h3 className="text-2xl font-black text-primary uppercase">{activeClient.nombre_comercial}</h3>
                            <div className="flex items-start gap-3 p-4 bg-white rounded-2xl border-2 border-primary/5 shadow-sm">
                                <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                <p className="text-sm font-bold text-muted-foreground uppercase leading-tight">{activeClient.direccion}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-4">
                            <User className="h-16 w-16 text-primary/20" />
                            <p className="font-black text-xl uppercase opacity-40 text-center">Selecciona un cliente de la lista</p>
                        </div>
                    )}
                </CardHeader>
                
                <CardContent className="space-y-8 pt-8 flex-1">
                    {activeClient && (
                        <div className="space-y-8">
                            <div className={cn("p-6 rounded-2xl border-2 transition-all", activeClient.checkInTime ? "bg-green-50 border-green-200" : "bg-muted/20 border-dashed")}>
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 text-center sm:text-left">
                                        <LogIn className={cn("h-10 w-10", activeClient.checkInTime ? "text-green-600" : "text-muted-foreground")} />
                                        <div><h4 className="font-black text-sm uppercase">1. Registro de Entrada</h4><p className="text-[10px] font-black uppercase text-muted-foreground">{activeClient.checkInTime ? `LLEGADA: ${activeClient.checkInTime}` : 'Presiona al llegar al local'}</p></div>
                                    </div>
                                    {!activeClient.checkInTime && <Button size="lg" onClick={handleCheckIn} disabled={isSaving} className="font-black px-10 shadow-lg">REGISTRAR ENTRADA</Button>}
                                </div>
                            </div>

                            <div className={cn("space-y-8 transition-opacity", !activeClient.checkInTime && !isAdmin && "opacity-20 pointer-events-none")}>
                                <div className="space-y-4">
                                    <h4 className="font-black text-sm uppercase flex items-center gap-2 text-primary"><Phone className="h-4 w-4" /> 2. Datos de Gestión</h4>
                                    <RadioGroup onValueChange={v => handleFieldChange('visitType', v)} value={activeClient.visitType} className="grid grid-cols-2 gap-4">
                                        <Label className={cn("flex flex-col items-center gap-3 border-2 p-5 rounded-2xl cursor-pointer transition-all", activeClient.visitType === 'presencial' ? "border-primary bg-primary/5" : "border-muted/40 opacity-60")}>
                                            <RadioGroupItem value="presencial" className="sr-only" /><MapPin className="h-8 w-8" /><span className="text-[10px] font-black uppercase">PRESENCIAL</span>
                                        </Label>
                                        <Label className={cn("flex flex-col items-center gap-3 border-2 p-5 rounded-2xl cursor-pointer transition-all", activeClient.visitType === 'telefonica' ? "border-primary bg-primary/5" : "border-muted/40 opacity-60")}>
                                            <RadioGroupItem value="telefonica" className="sr-only" /><Phone className="h-8 w-8" /><span className="text-[10px] font-black uppercase">TELEFÓNICA</span>
                                        </Label>
                                    </RadioGroup>
                                </div>

                                {activeClient.visitType === 'telefonica' && (
                                    <div className="space-y-2 animate-in slide-in-from-top-2">
                                        <Label className="text-[10px] font-black uppercase flex items-center gap-2 text-primary"><MessageSquare className="h-3 w-3" /> Observación Obligatoria</Label>
                                        <Textarea placeholder="Escribe aquí el resumen de la llamada..." className="h-28 font-bold text-sm border-2 focus:border-primary" value={activeClient.callObservation || ''} onChange={e => handleFieldChange('callObservation', e.target.value)} />
                                    </div>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {['valorVenta', 'valorCobro', 'devoluciones'].map(f => (
                                        <div key={f} className="space-y-1">
                                            <Label className="text-[10px] font-black uppercase text-muted-foreground">{f === 'valorVenta' ? 'Venta' : f === 'valorCobro' ? 'Cobro' : 'Devolución'} ($)</Label>
                                            <Input type="text" placeholder="0.00" className="h-14 text-xl font-black text-primary border-2" value={String(activeClient[f as keyof ClientInRoute] ?? '')} onChange={e => handleFieldChange(f as any, e.target.value)} disabled={activeClient.visitStatus === 'Completado' && !isAdmin} />
                                        </div>
                                    ))}
                                </div>
                                
                                <Button onClick={handleConfirmCheckOut} className="w-full h-20 text-xl font-black rounded-3xl shadow-2xl mt-10 transition-transform active:scale-95" disabled={isSaving || (activeClient.visitStatus === 'Completado' && !isAdmin) || !activeClient.visitType || (activeClient.visitType === 'telefonica' && !activeClient.callObservation?.trim())}>
                                    {isSaving ? <LoaderCircle className="animate-spin h-8 w-8" /> : <LogOut className="mr-3 h-8 w-8" />} 
                                    {activeClient.visitStatus === 'Completado' ? "ACTUALIZAR GESTIÓN" : "FINALIZAR VISITA"}
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col rounded-3xl p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-2"><DialogTitle className="text-2xl font-black uppercase text-primary">Añadir Clientes a Hoy</DialogTitle></DialogHeader>
            <div className="p-6 space-y-4 flex-1 flex flex-col overflow-hidden">
                <Input placeholder="Buscar por RUC o Nombre..." value={addClientSearchTerm} onChange={e => setAddClientSearchTerm(e.target.value)} className="h-12 border-2" />
                <ScrollArea className="flex-1 border-2 rounded-2xl p-2 bg-muted/5">
                    <div className="space-y-2">
                        {availableClients.filter(c => c.ejecutivo === (allUsers.find(u => u.id === selectedRoute?.createdBy)?.name || user?.name) && (c.nombre_cliente.toLowerCase().includes(addClientSearchTerm.toLowerCase()) || String(c.ruc).includes(addClientSearchTerm))).map(c => {
                            const isSel = multiSelectedClients.some(sc => sc.ruc === c.ruc);
                            const existing = currentRouteClientsFull.find(e => String(e.ruc).trim() === String(c.ruc).trim());
                            const isManaged = existing?.visitStatus === 'Completado';
                            return (
                                <div key={c.ruc} className={cn("p-4 rounded-xl border-2 flex items-center gap-4 cursor-pointer transition-all", isSel ? "border-primary bg-primary/5" : "border-transparent bg-white")} onClick={() => setMultiSelectedClients(isSel ? multiSelectedClients.filter(sc => sc.ruc !== c.ruc) : [...multiSelectedClients, c])}>
                                    <Checkbox checked={isSel} />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2"><p className="text-sm font-black uppercase">{c.nombre_comercial}</p>{isManaged && <Badge variant="outline" className="text-[8px] font-black bg-orange-50 text-orange-700">GESTIONADO</Badge>}</div>
                                        <p className="text-[10px] font-mono text-muted-foreground">{c.ruc}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-primary">Observación de Re-adición</Label>
                    <Textarea placeholder="Indica el motivo si el cliente ya fue gestionado..." value={reAdditionObservation} onChange={e => setReAdditionObservation(e.target.value)} className="h-24 font-bold border-2" />
                </div>
            </div>
            <DialogFooter className="p-6 bg-muted/10">
                <Button onClick={handleAddClientsToRoute} disabled={multiSelectedClients.length === 0 || isSaving} className="font-black px-10 h-12 uppercase">Añadir Seleccionados</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

export default function RouteManagementPage() { return <Suspense fallback={<div className="p-8">Cargando...</div>}><RouteManagementContent /></Suspense>; }
