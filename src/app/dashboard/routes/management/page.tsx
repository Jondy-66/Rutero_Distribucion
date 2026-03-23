
'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Search, MapPin, LoaderCircle, LogIn, LogOut, CheckCircle, Phone, Trash2, ThumbsUp, Users, CirclePlus, X, AlertTriangle } from 'lucide-react';
import { updateRoute } from '@/lib/firebase/firestore';
import type { Client, ClientInRoute } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, startOfDay, endOfWeek, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Timestamp, GeoPoint } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const sanitizeClients = (clients: ClientInRoute[]): any[] => {
    return clients.map(c => {
        const cleaned: any = { ...c };
        if (c.date instanceof Date) cleaned.date = Timestamp.fromDate(c.date);
        
        const parseValue = (v: any) => {
            if (v === undefined || v === null || v === '') return 0;
            const normalized = String(v).replace(',', '.');
            const num = parseFloat(normalized);
            return isNaN(num) ? 0 : Math.round(num * 100) / 100;
        };

        cleaned.valorVenta = parseValue(c.valorVenta);
        cleaned.valorCobro = parseValue(c.valorCobro);
        cleaned.devoluciones = parseValue(c.devoluciones);
        
        if (c.checkInLocation && (c.checkInLocation as any).latitude) {
            cleaned.checkInLocation = new GeoPoint((c.checkInLocation as any).latitude, (c.checkInLocation as any).longitude);
        }
        if (c.checkOutLocation && (c.checkOutLocation as any).latitude) {
            cleaned.checkOutLocation = new GeoPoint((c.checkOutLocation as any).latitude, (c.checkOutLocation as any).longitude);
        }
        return cleaned;
    });
};

function RouteManagementContent() {
  const { user, clients: availableClients, routes: allRoutes, users: allUsers, loading: authLoading, refetchData } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [isRouteStarted, setIsRouteStarted] = useState(false);
  const [currentRouteClientsFull, setCurrentRouteClientsFull] = useState<ClientInRoute[]>([]);
  const [activeOriginalIndex, setActiveOriginalIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [addClientSearchTerm, setAddClientSearchTerm] = useState('');
  const [multiSelectedClients, setMultiSelectedClients] = useState<Client[]>([]);
  const [reAdditionObservation, setReAdditionObservation] = useState('');
  const [isExpired, setIsExpired] = useState(false);

  const isAdmin = user?.role === 'Administrador';
  const isSupervisor = user?.role === 'Supervisor';
  const isManager = isAdmin || isSupervisor;

  useEffect(() => {
    const check = () => {
      const now = new Date();
      const deadline = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0);
      setIsExpired(now > deadline && !isAdmin);
    };
    check();
    const timer = setInterval(check, 30000);
    return () => clearInterval(timer);
  }, [isAdmin]);

  const managedUsers = useMemo(() => {
    if (!user) return [];
    if (user.role === 'Administrador') {
      return allUsers.filter(u => u.role === 'Usuario' || u.role === 'Telemercaderista');
    }
    if (user.role === 'Supervisor') {
      return allUsers.filter(u => u.supervisorId === user.id);
    }
    return [];
  }, [allUsers, user]);

  const selectableRoutes = useMemo(() => {
    const today = startOfDay(new Date());
    const managedUserIds = new Set(managedUsers.map(u => u.id));

    return allRoutes.filter(r => {
        const isOwnRoute = r.createdBy === user?.id;
        const isTeamRoute = managedUserIds.has(r.createdBy);

        if (!isOwnRoute && !isTeamRoute && !isAdmin) return false;
        
        if (isManager && selectedAgentId !== 'all' && r.createdBy !== selectedAgentId) return false;
        
        if (r.status === 'Pendiente de Aprobación' || r.status === 'Rechazada') return false;

        const rDate = r.date instanceof Timestamp ? r.date.toDate() : new Date(r.date as any);
        const routeEndOfWeek = endOfWeek(rDate, { weekStartsOn: 1 });

        if (isBefore(routeEndOfWeek, today)) return false;
        
        return true;
    });
  }, [allRoutes, user, isAdmin, isManager, selectedAgentId, managedUsers]);

  const selectedRoute = useMemo(() => 
    allRoutes.find(r => r.id === (selectedRouteId || searchParams.get('routeId'))), 
    [selectedRouteId, allRoutes, searchParams]
  );

  useEffect(() => {
    if (!selectedRoute) return;
    const rDate = selectedRoute.date instanceof Timestamp ? selectedRoute.date.toDate() : new Date(selectedRoute.date as any);
    const routeEndOfWeek = endOfWeek(rDate, { weekStartsOn: 1 });
    const isPastWeek = isBefore(routeEndOfWeek, startOfDay(new Date()));

    if (isPastWeek && !isAdmin) {
        toast({ 
            title: "Ruta de Semana Pasada", 
            description: "No es posible gestionar rutas cuya semana operativa ya finalizó.", 
            variant: "destructive" 
        });
        setSelectedRouteId(undefined);
        return;
    }

    setCurrentRouteClientsFull(selectedRoute.clients || []);
    setIsRouteStarted(selectedRoute.status === 'En Progreso' || isAdmin || isSupervisor);
    setActiveOriginalIndex(null); 
  }, [selectedRoute, isAdmin, isSupervisor, toast]);

  const routeClients = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    return currentRouteClientsFull
        .map((c, index) => ({ ...c, originalIndex: index }))
        .filter(c => {
            if (c.status === 'Eliminado') return false;
            const cDate = c.date instanceof Timestamp ? c.date.toDate() : (c.date ? new Date(c.date) : null);
            if (!cDate) return false;
            return format(cDate, 'yyyy-MM-dd') === todayStr;
        })
        .map(c => {
            const details = availableClients.find(ac => String(ac.ruc || '').trim() === String(c.ruc || '').trim());
            return { ...c, id: details?.id || c.ruc, direccion: details?.direccion || 'N/A' };
        });
  }, [currentRouteClientsFull, availableClients]);

  const isTodayCompleted = useMemo(() => 
    routeClients.length > 0 && routeClients.every(c => c.visitStatus === 'Completado'), 
    [routeClients]
  );

  const activeClient = useMemo(() => 
    activeOriginalIndex !== null ? currentRouteClientsFull[activeOriginalIndex] : null, 
    [currentRouteClientsFull, activeOriginalIndex]
  );

  const isManaged = activeClient?.visitStatus === 'Completado';
  const isEditingDisabled = (isManaged || isExpired) && !isAdmin;

  const handleFieldChange = (field: keyof ClientInRoute, value: any) => {
    if (activeOriginalIndex === null || isEditingDisabled || isSaving) return;
    
    const nextClients = [...currentRouteClientsFull];
    nextClients[activeOriginalIndex] = { ...nextClients[activeOriginalIndex], [field]: value };
    
    setCurrentRouteClientsFull(nextClients);
    
    if (selectedRoute) {
        updateRoute(selectedRoute.id, { clients: sanitizeClients(nextClients) }).catch(console.error);
    }
  };

  const getGeoLocation = () => {
    return new Promise<any>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
            (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
            () => resolve(null),
            { timeout: 5000, enableHighAccuracy: true }
        );
    });
  };

  const handleCheckIn = async () => {
    if (!selectedRoute || activeOriginalIndex === null || isSaving || isEditingDisabled || isExpired) return;
    setIsSaving(true);
    try {
        const location = await getGeoLocation();
        const nextClients = [...currentRouteClientsFull];
        nextClients[activeOriginalIndex] = { 
            ...nextClients[activeOriginalIndex], 
            checkInTime: format(new Date(), 'HH:mm:ss'), 
            checkInLocation: location 
        };
        await updateRoute(selectedRoute.id, { clients: sanitizeClients(nextClients) });
        setCurrentRouteClientsFull(nextClients);
        toast({ title: "Entrada Registrada" });
    } catch (e) {
        toast({ title: "Error al registrar entrada", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedRoute || activeOriginalIndex === null || isSaving || isEditingDisabled || isExpired) return;
    const clientToFinish = currentRouteClientsFull[activeOriginalIndex];
    if (clientToFinish?.visitType === 'telefonica' && !clientToFinish.callObservation?.trim()) {
        return toast({ title: "Observación requerida", variant: "destructive" });
    }

    setIsSaving(true);
    try {
        const location = await getGeoLocation();
        const nextClients = [...currentRouteClientsFull];
        nextClients[activeOriginalIndex] = { 
            ...nextClients[activeOriginalIndex], 
            checkOutTime: format(new Date(), 'HH:mm:ss'), 
            checkOutLocation: location, 
            visitStatus: 'Completado' 
        };

        const allDone = nextClients.filter(c => c.status !== 'Eliminado').every(c => c.visitStatus === 'Completado');
        await updateRoute(selectedRoute.id, { 
            clients: sanitizeClients(nextClients),
            status: allDone ? 'Completada' : 'En Progreso'
        });

        setCurrentRouteClientsFull(nextClients);
        if (!isAdmin && !isSupervisor) setActiveOriginalIndex(null);
        toast({ title: "Visita Finalizada" });
        await refetchData('routes');
    } catch (e) {
        toast({ title: "Error al finalizar", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleRemoveClient = async (idx: number) => {
    if (!selectedRoute || !isAdmin) return;
    setIsSaving(true);
    try {
        const nextClients = currentRouteClientsFull.map((c, i) => i === idx ? { ...c, status: 'Eliminado' } : c);
        await updateRoute(selectedRoute.id, { clients: sanitizeClients(nextClients) });
        setCurrentRouteClientsFull(nextClients);
        toast({ title: "Cliente removido" });
    } catch (e) {
        toast({ title: "Error al eliminar", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleAddClients = async () => {
    if (!selectedRoute || multiSelectedClients.length === 0 || isExpired) return;
    if (needsReadditionObservation && !reAdditionObservation.trim()) {
        toast({ title: "Atención", description: "Ingresa el motivo de re-adición.", variant: "destructive" });
        return;
    }
    setIsSaving(true);
    try {
        const newVisits: ClientInRoute[] = multiSelectedClients.map(c => {
            const isAlreadyInPlan = currentRouteClientsFull.some(cc => cc.ruc === c.ruc && cc.status !== 'Eliminado');
            return {
                ruc: c.ruc,
                nombre_comercial: c.nombre_comercial,
                date: new Date(),
                visitStatus: 'Pendiente',
                status: 'Activo',
                isReadded: true,
                reAdditionObservation: isAlreadyInPlan ? reAdditionObservation : ''
            };
        });
        const nextClients = [...currentRouteClientsFull, ...newVisits];
        await updateRoute(selectedRoute.id, { clients: sanitizeClients(nextClients) });
        setCurrentRouteClientsFull(nextClients);
        setIsAddClientDialogOpen(false);
        setMultiSelectedClients([]);
        setReAdditionObservation('');
        toast({ title: "Clientes añadidos" });
    } catch (e) {
        toast({ title: "Error al añadir", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const needsReadditionObservation = useMemo(() => {
    return multiSelectedClients.some(sc => currentRouteClientsFull.some(cc => cc.ruc === sc.ruc && cc.status !== 'Eliminado'));
  }, [multiSelectedClients, currentRouteClientsFull]);

  if (authLoading) return <div className="p-20 text-center"><LoaderCircle className="animate-spin mx-auto h-12 w-12" /></div>;

  return (
    <>
    <PageHeader title="Gestión de Ruta" description="Control diario de visitas y registros de gestión." />
    
    {isExpired && !isAdmin && (
        <Alert variant="destructive" className="mb-6 border-red-600 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800 font-black uppercase">Jornada Expirada</AlertTitle>
            <AlertDescription className="text-red-700 font-bold uppercase text-[10px]">
                HAS SUPERADO EL TIEMPO LÍMITE (19:00). EL REGISTRO DE GESTIÓN HA SIDO BLOQUEADO. CONTACTA A TU SUPERVISOR.
            </AlertDescription>
        </Alert>
    )}

    {!isRouteStarted ? (
        <Card className="max-w-md mx-auto shadow-xl border-t-4 border-t-primary">
            <CardHeader><CardTitle className="text-slate-950 font-black uppercase">Seleccionar Jornada</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                {isManager && (
                    <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                        <SelectTrigger className="h-12 border-2 border-slate-200 font-bold text-slate-950">
                            <Users className="mr-2 h-4 w-4 text-primary" />
                            <SelectValue placeholder={isAdmin ? "Todos los agentes" : "Mi equipo"} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all" className="font-bold">Todos los disponibles</SelectItem>
                            {managedUsers.map(u => <SelectItem key={u.id} value={u.id} className="font-bold">{u.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
                <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                    <SelectTrigger className="h-12 border-2 border-slate-200 font-bold text-slate-950">
                        <Route className="mr-2 h-4 w-4 text-primary" />
                        <SelectValue placeholder="Selecciona una ruta..." />
                    </SelectTrigger>
                    <SelectContent>
                        {selectableRoutes.length > 0 ? (
                            selectableRoutes.map(r => <SelectItem key={r.id} value={r.id} className="font-bold">{r.routeName} ({r.status})</SelectItem>)
                        ) : (
                            <SelectItem value="none" disabled className="font-bold">No hay rutas disponibles.</SelectItem>
                        )}
                    </SelectContent>
                </Select>
                {selectedRoute && (
                    <Button 
                        className="w-full font-black h-12 rounded-xl text-lg shadow-lg" 
                        onClick={() => updateRoute(selectedRoute.id, { status: 'En Progreso' }).then(() => setIsRouteStarted(true))}
                        disabled={isExpired}
                    >
                        {isExpired ? 'JORNADA EXPIRADA' : 'INICIAR GESTIÓN'}
                    </Button>
                )}
            </CardContent>
        </Card>
    ) : isTodayCompleted && !isManager ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center bg-white rounded-3xl shadow-xl p-10 border-4 border-green-50 animate-in zoom-in-95 duration-300">
            <div className="bg-green-100 p-8 rounded-full mb-6 animate-bounce">
                <ThumbsUp className="h-16 w-16 text-green-600" />
            </div>
            <h2 className="text-3xl font-black text-green-700 uppercase mb-2 tracking-tighter">¡Jornada de hoy completada!</h2>
            <p className="text-slate-950 font-black mb-8 max-w-xs uppercase text-xs">Has gestionado todos los clientes programados para hoy con éxito.</p>
            <Button 
                variant="outline" 
                className="font-black h-14 rounded-2xl text-lg border-2 px-10 border-primary text-primary" 
                onClick={() => router.push('/dashboard')}
            >
                VOLVER AL PANEL
            </Button>
        </div>
    ) : (
        <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                <Card className="shadow-2xl border-t-4 border-t-primary h-[80vh] min-h-[550px] rounded-[2.5rem] overflow-hidden flex flex-col bg-white">
                    <CardHeader className="bg-muted/10 px-8 py-6 space-y-1 shrink-0 border-b">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1 min-w-0">
                                <h2 className="text-2xl font-black text-primary uppercase leading-tight tracking-tighter truncate" title={selectedRoute?.routeName}>
                                    {selectedRoute?.routeName || "Plan de Ruta"}
                                </h2>
                                <p className="text-xs font-black text-slate-950 uppercase">
                                    {format(new Date(), "EEEE, dd 'De' MMMM", { locale: es })}
                                </p>
                            </div>
                            {isManager && <Badge className="bg-slate-950 text-white font-black text-[10px] px-3 py-1 uppercase shrink-0">{user?.role}</Badge>}
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 flex flex-col gap-6 flex-1 min-h-0 overflow-hidden">
                        <div className="space-y-2 shrink-0">
                            <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-tighter mb-1">
                                <span className="text-primary">PROGRESO HOY</span>
                                <span className="text-slate-950 font-black">
                                    {routeClients.filter(c => c.visitStatus === 'Completado').length} / {routeClients.length}
                                </span>
                            </div>
                            <Progress value={(routeClients.filter(c => c.visitStatus === 'Completado').length / (routeClients.length || 1)) * 100} className="h-3 bg-slate-100 [&>div]:bg-primary" />
                        </div>

                        <Button 
                            variant="outline" 
                            className="w-full h-14 border-dashed border-2 border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-950 font-black text-sm rounded-2xl flex items-center justify-center gap-2 transition-all shrink-0 shadow-sm" 
                            onClick={() => setIsAddClientDialogOpen(true)}
                            disabled={isExpired}
                        >
                            <CirclePlus className="h-5 w-5 text-primary" /> 
                            Añadir Cliente
                        </Button>

                        <ScrollArea className="flex-1 pr-1">
                            <div className="space-y-3 pb-4">
                                {routeClients.map((c, i) => (
                                    <div 
                                        key={`${c.ruc}-${c.originalIndex}`} 
                                        onClick={() => (!activeClient?.checkInTime || activeClient.checkOutTime || isManager) && setActiveOriginalIndex(c.originalIndex)} 
                                        className={cn(
                                            "flex items-center gap-4 p-4 border-2 rounded-2xl cursor-pointer transition-all duration-200", 
                                            activeOriginalIndex === c.originalIndex ? "border-primary bg-primary/5 shadow-md scale-[1.02]" : "border-slate-100 bg-white hover:border-slate-300"
                                        )}
                                    >
                                        <span className="text-slate-950 font-black text-xs w-4 shrink-0">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className={cn("font-black text-xs truncate uppercase tracking-tight text-slate-950", activeOriginalIndex === c.originalIndex && "text-primary")}>{c.nombre_comercial}</p>
                                                {c.isReadded && <Badge className="text-[8px] h-3.5 px-1.5 bg-orange-600 text-white font-black border-none uppercase">RE-ADICIÓN</Badge>}
                                            </div>
                                            <p className="text-[10px] font-black text-slate-950 mt-0.5 opacity-80">{c.ruc}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {isAdmin && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleRemoveClient(c.originalIndex); }}><Trash2 className="h-4 w-4" /></Button>
                                            )}
                                            {c.visitStatus === 'Completado' && <CheckCircle className={cn("h-5 w-5", activeOriginalIndex === c.originalIndex ? "text-primary" : "text-green-600")} />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-2">
                <Card className="shadow-2xl border-t-4 border-t-primary min-h-[550px] h-[80vh] rounded-[2.5rem] overflow-hidden flex flex-col bg-white">
                    <CardHeader className="bg-muted/10 h-36 flex flex-col justify-center px-10 shrink-0 border-b">
                        {activeClient ? (
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-primary uppercase leading-tight tracking-tight">{activeClient.nombre_comercial}</h3>
                                <p className="text-xs font-black text-slate-950 uppercase">{activeClient.direccion}</p>
                            </div>
                        ) : (
                            <div className="text-center text-slate-950 uppercase font-black opacity-40 tracking-widest text-lg">Selecciona un cliente para gestionar</div>
                        )}
                    </CardHeader>
                    <CardContent className="p-10 space-y-10 flex-1 overflow-y-auto">
                        {activeClient && (
                            <>
                            <div className={cn("p-8 rounded-[2rem] border-2 transition-all duration-300", activeClient.checkInTime ? "bg-green-50 border-green-200 shadow-sm" : "bg-slate-50 border-dashed border-slate-300")}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-6">
                                        <LogIn className={cn("h-10 w-10", activeClient.checkInTime ? "text-green-600" : "text-slate-950")} />
                                        <div>
                                            <h4 className="font-black text-sm uppercase tracking-tighter text-slate-950">Registro de Entrada</h4>
                                            <p className="text-xs font-black text-slate-950 uppercase mt-1">
                                                {activeClient.checkInTime ? `Marcado a las: ${activeClient.checkInTime}` : 'Pendiente por marcar'}
                                            </p>
                                        </div>
                                    </div>
                                    {!activeClient.checkInTime && (
                                        <Button onClick={handleCheckIn} className="font-black h-12 px-8 rounded-2xl text-sm shadow-md transition-transform hover:scale-105" disabled={isExpired}>MARCAR ENTRADA</Button>
                                    )}
                                </div>
                            </div>

                            <div className={cn("space-y-8 transition-all duration-500", !activeClient.checkInTime && !isManager && "pointer-events-none")}>
                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase text-slate-950 tracking-wider ml-1">Tipo de Visita</Label>
                                    <RadioGroup onValueChange={v => handleFieldChange('visitType', v)} value={activeClient.visitType} className="grid grid-cols-2 gap-6" disabled={isEditingDisabled}>
                                        <Label className={cn("flex flex-col items-center gap-3 border-2 p-6 rounded-[2rem] cursor-pointer transition-all duration-200", activeClient.visitType === 'presencial' ? "border-primary bg-primary/5 ring-4 ring-primary/5" : "border-slate-100 bg-slate-50 hover:bg-slate-100 shadow-sm")}>
                                            <RadioGroupItem value="presencial" className="sr-only" />
                                            <MapPin className={cn("h-8 w-8", activeClient.visitType === 'presencial' ? "text-primary" : "text-slate-950")} />
                                            <span className="text-xs font-black uppercase tracking-tighter text-slate-950">Presencial</span>
                                        </Label>
                                        <Label className={cn("flex flex-col items-center gap-3 border-2 p-6 rounded-[2rem] cursor-pointer transition-all duration-200", activeClient.visitType === 'telefonica' ? "border-primary bg-primary/5 ring-4 ring-primary/5" : "border-slate-100 bg-slate-50 hover:bg-slate-100 shadow-sm")}>
                                            <RadioGroupItem value="telefonica" className="sr-only" />
                                            <Phone className={cn("h-8 w-8", activeClient.visitType === 'telefonica' ? "text-primary" : "text-slate-950")} />
                                            <span className="text-xs font-black uppercase tracking-tighter text-slate-950">Telefónica</span>
                                        </Label>
                                    </RadioGroup>
                                </div>

                                {activeClient.visitType === 'telefonica' && (
                                    <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                                        <Label className="text-xs font-black uppercase text-primary tracking-wider ml-1">Observación Obligatoria de la Llamada</Label>
                                        <Textarea placeholder="Ingresa detalles de la conversación..." className="h-32 font-black text-sm border-2 border-slate-200 focus:border-primary rounded-2xl text-slate-950 shadow-sm" value={activeClient.callObservation || ''} onChange={e => handleFieldChange('callObservation', e.target.value)} disabled={isEditingDisabled} />
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-6">
                                    {[
                                        { key: 'valorVenta', label: 'VENTA ($)' },
                                        { key: 'valorCobro', label: 'COBRO ($)' },
                                        { key: 'devoluciones', label: 'DEVOLUCIÓN ($)' }
                                    ].map(f => (
                                        <div key={f.key} className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-slate-950 tracking-widest ml-1">{f.label}</Label>
                                            <Input type="text" className="h-14 text-xl font-black text-primary border-2 border-slate-200 focus:border-primary rounded-2xl bg-slate-50 text-center text-slate-950 shadow-sm" placeholder="0.00" value={activeClient[f.key as keyof ClientInRoute] ?? ''} onChange={e => handleFieldChange(f.key as any, e.target.value)} disabled={isEditingDisabled} />
                                        </div>
                                    ))}
                                </div>

                                {(activeClient.visitType === 'presencial' || isManager) && (
                                    <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                                        <Label className="text-xs font-black uppercase text-slate-950 tracking-wider ml-1">Observaciones de la Visita</Label>
                                        <Textarea placeholder="Comentarios del cliente o motivos del resultado..." className="h-32 font-black text-sm border-2 border-slate-200 focus:border-primary rounded-2xl text-slate-950 shadow-sm bg-slate-50" value={activeClient.visitObservation || ''} onChange={e => handleFieldChange('visitObservation', e.target.value)} disabled={isEditingDisabled} />
                                    </div>
                                )}

                                <Button 
                                    onClick={handleConfirmCheckOut} 
                                    className="w-full h-20 text-xl font-black rounded-[2rem] shadow-2xl transition-all hover:scale-[1.02] mt-4" 
                                    disabled={isSaving || isEditingDisabled || !activeClient.visitType || (activeClient.visitType === 'telefonica' && !activeClient.callObservation?.trim())}
                                >
                                    {isSaving ? <LoaderCircle className="animate-spin h-8 w-8" /> : <><LogOut className="mr-3 h-7 w-7" /> {activeClient.visitStatus === 'Completado' ? 'VISITA COMPLETADA' : 'FINALIZAR VISITA'}</>}
                                </Button>
                            </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )}

    <Dialog open={isAddClientDialogOpen} onOpenChange={(open) => { setIsAddClientDialogOpen(open); if(!open) { setMultiSelectedClients([]); setReAdditionObservation(''); setAddClientSearchTerm(''); } }}>
        <DialogContent className="w-[95vw] sm:max-w-2xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col h-[85vh] bg-white">
            <DialogHeader className="bg-primary/5 p-8 pb-6 shrink-0 relative">
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary pr-8">Catálogo de Clientes</DialogTitle>
                <DialogDescription className="text-[10px] font-black uppercase text-slate-950 mt-1">Selecciona clientes para añadir a tu ruta de hoy</DialogDescription>
                <DialogClose className="absolute right-6 top-8"><X className="h-6 w-6 text-slate-950 hover:text-primary transition-colors" /></DialogClose>
            </DialogHeader>
            <div className="px-8 py-4 shrink-0 border-b bg-white">
                <div className="relative">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-950 font-black" />
                    <Input placeholder="Buscar por RUC o Nombre..." value={addClientSearchTerm} onChange={e => setAddClientSearchTerm(e.target.value)} className="h-12 pl-12 font-black rounded-2xl border-2 border-slate-300 focus:border-primary text-slate-950" />
                </div>
            </div>
            <ScrollArea className="flex-1 px-8 py-4 bg-slate-50">
                <div className="grid grid-cols-1 gap-3 pb-6">
                    {availableClients
                        .filter(c => {
                            if (user?.role !== 'Administrador' && c.ejecutivo !== user?.name) return false;
                            const search = addClientSearchTerm.toLowerCase();
                            return String(c.nombre_cliente || '').toLowerCase().includes(search) || String(c.nombre_comercial || '').toLowerCase().includes(search) || String(c.ruc).includes(search);
                        })
                        .map(c => (
                            <div key={c.id} onClick={() => setMultiSelectedClients(prev => prev.some(s => s.ruc === c.ruc) ? prev.filter(s => s.ruc !== c.ruc) : [...prev, c])} className={cn("p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border-2", multiSelectedClients.some(s => s.ruc === c.ruc) ? "bg-primary/10 border-primary shadow-md" : "bg-white border-slate-100 hover:border-slate-300 shadow-sm")}>
                                <Checkbox checked={multiSelectedClients.some(s => s.ruc === c.ruc)} className="rounded-md h-5 w-5 border-2 border-primary" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-black uppercase truncate text-slate-950">{c.nombre_comercial || c.nombre_cliente}</p>
                                    <p className="text-[10px] font-black text-slate-950 mt-1 opacity-80">{c.ruc}</p>
                                </div>
                            </div>
                        ))
                    }
                </div>
            </ScrollArea>
            <div className="p-8 pt-6 border-t space-y-6 shrink-0 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                {needsReadditionObservation && multiSelectedClients.length > 0 && (
                    <div className="space-y-2 animate-in slide-in-from-bottom-2 duration-300">
                        <Label className="text-[10px] font-black uppercase text-primary tracking-wider ml-1">Observación de Re-adición (Obligatoria)</Label>
                        <Textarea className="h-20 text-xs font-black border-2 border-slate-300 rounded-2xl px-4 py-3 focus:border-primary text-slate-950 bg-slate-50 shadow-inner" placeholder="Indica el motivo de esta nueva visita..." value={reAdditionObservation} onChange={e => setReAdditionObservation(e.target.value)} />
                    </div>
                )}
                <div className="flex items-center gap-4">
                    <DialogClose asChild><Button variant="ghost" className="h-14 font-black flex-1 text-slate-950 border-2 border-slate-100 rounded-2xl">CANCELAR</Button></DialogClose>
                    <Button onClick={handleAddClients} disabled={multiSelectedClients.length === 0 || isSaving || (needsReadditionObservation && !reAdditionObservation.trim())} className="h-14 font-black flex-[2] rounded-2xl text-lg shadow-xl">{isSaving ? <LoaderCircle className="animate-spin h-6 w-6" /> : `AÑADIR ${multiSelectedClients.length} CLIENTES`}</Button>
                </div>
            </div>
        </DialogContent>
    </Dialog>
    </>
  );
}

export default function RouteManagementPage() { 
    return (
        <Suspense fallback={<div className="p-20 text-center"><LoaderCircle className="animate-spin mx-auto h-12 w-12" /></div>}>
            <RouteManagementContent />
        </Suspense>
    ); 
}
