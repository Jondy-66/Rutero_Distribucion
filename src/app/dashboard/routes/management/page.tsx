
'use client';
import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Search, MapPin, LoaderCircle, LogIn, LogOut, CheckCircle, Phone, Trash2, Users, CirclePlus, X, AlertTriangle, Calendar as CalendarIcon } from 'lucide-react';
import { updateRoute } from '@/lib/firebase/firestore';
import type { Client, ClientInRoute, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const ensureDate = (d: any): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (d && typeof d.toDate === 'function') return d.toDate();
  const date = new Date(d);
  return isNaN(date.getTime()) ? new Date() : date;
};

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
  const { user, clients: availableClients, routes: allRoutes, users: allUsers, loading: authLoading, dataLoading, refetchData } = useAuth();
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

  const managedUsersForSelector = useMemo(() => {
    if (!user) return [];
    let base: User[] = [];
    if (user.role === 'Administrador') {
      base = allUsers.filter(u => u.role === 'Usuario' || u.role === 'Telemercaderista' || u.role === 'Supervisor');
    } else if (user.role === 'Supervisor') {
      const subordinates = allUsers.filter(u => u.supervisorId === user.id);
      base = [user, ...subordinates];
    }
    return base;
  }, [allUsers, user]);

  const selectableRoutes = useMemo(() => {
    const managedUserIds = new Set(managedUsersForSelector.map(u => u.id));
    const today = new Date();
    const currentMonday = startOfWeek(today, { weekStartsOn: 1 });
    const currentSunday = endOfWeek(today, { weekStartsOn: 1 });

    return allRoutes.filter(r => {
        const isOwnRoute = r.createdBy === user?.id;
        const isTeamRoute = managedUserIds.has(r.createdBy);

        if (!isOwnRoute && !isTeamRoute && !isAdmin) return false;
        
        if (isManager && selectedAgentId !== 'all' && r.createdBy !== selectedAgentId) return false;
        
        // REGLA ESTRICTA DE ESTADO: Solo rutas activas. Ignorar completadas, pendientes o rechazadas.
        if (r.status !== 'Planificada' && r.status !== 'En Progreso') return false;

        // REGLA DE FECHA: Solo rutas de la semana actual para evitar gestiones de semanas pasadas
        const rDate = ensureDate(r.date);
        if (rDate < startOfDay(currentMonday) || rDate > endOfDay(currentSunday)) {
            if (!isAdmin) return false; // El admin puede verlas todas, el usuario solo las de su semana
        }
        
        return true;
    });
  }, [allRoutes, user, isAdmin, isManager, selectedAgentId, managedUsersForSelector]);

  const selectedRoute = useMemo(() => 
    allRoutes.find(r => r.id === (selectedRouteId || searchParams.get('routeId'))), 
    [selectedRouteId, allRoutes, searchParams]
  );

  useEffect(() => {
    if (!selectedRoute) return;
    setCurrentRouteClientsFull(selectedRoute.clients || []);
    setIsRouteStarted(selectedRoute.status === 'En Progreso' || isAdmin || isSupervisor);
    setActiveOriginalIndex(null); 
  }, [selectedRoute, isAdmin, isSupervisor]);

  const todaysClients = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return currentRouteClientsFull
        .map((c, index) => {
            const details = availableClients.find(ac => String(ac.ruc || '').trim() === String(c.ruc || '').trim());
            return { ...c, originalIndex: index, direccion: details?.direccion || 'N/A' };
        })
        .filter(c => {
            if (c.status === 'Eliminado') return false;
            const cDate = ensureDate(c.date);
            return format(cDate, 'yyyy-MM-dd') === todayStr;
        });
  }, [currentRouteClientsFull, availableClients]);

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

  const isDataSyncing = authLoading || (dataLoading && allRoutes.length === 0);
  if (isDataSyncing) return <div className="p-20 text-center"><LoaderCircle className="animate-spin mx-auto h-12 w-12 text-primary" /><p className="mt-4 font-black uppercase text-xs text-slate-950">Sincronizando rutas...</p></div>;

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
            <CardHeader><CardTitle className="text-slate-950 font-black uppercase text-center">Seleccionar Jornada</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                {isManager && (
                    <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                        <SelectTrigger className="h-12 border-2 border-slate-200 font-black text-slate-950">
                            <Users className="mr-2 h-4 w-4 text-primary" />
                            <SelectValue placeholder="Filtrar por agente..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all" className="font-black">Todos los disponibles</SelectItem>
                            {managedUsersForSelector.map(u => (
                                <SelectItem key={u.id} value={u.id} className="font-black">
                                    {u.name} {u.id === user?.id ? "(TÚ)" : ""}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
                <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                    <SelectTrigger className="h-12 border-2 border-slate-200 font-black text-slate-950">
                        <Route className="mr-2 h-4 w-4 text-primary" />
                        <SelectValue placeholder="Selecciona una ruta..." />
                    </SelectTrigger>
                    <SelectContent>
                        {selectableRoutes.length > 0 ? (
                            selectableRoutes.map(r => <SelectItem key={r.id} value={r.id} className="font-black">{r.routeName} ({r.status})</SelectItem>)
                        ) : (
                            <SelectItem value="none" disabled className="font-black text-slate-950">No hay rutas activas para esta semana.</SelectItem>
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
    ) : (
        <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
                <Card className="shadow-2xl border-t-4 border-t-primary h-[85vh] min-h-[600px] rounded-[2.5rem] overflow-hidden flex flex-col bg-white">
                    <CardHeader className="bg-muted/10 px-8 py-6 border-b shrink-0">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <h2 className="text-xl font-black text-primary uppercase leading-tight tracking-tighter truncate max-w-[200px]" title={selectedRoute?.routeName}>
                                    {selectedRoute?.routeName || "Plan de Ruta"}
                                </h2>
                                <p className="text-[10px] font-black text-slate-950 uppercase">Hoy: {format(new Date(), 'EEEE dd', { locale: es })}</p>
                            </div>
                            <Badge className="bg-slate-950 text-white font-black text-[9px] px-2 py-0.5 uppercase shrink-0">{user?.role}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
                        <Button 
                            variant="outline" 
                            className="w-full h-12 border-dashed border-2 border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shrink-0" 
                            onClick={() => setIsAddClientDialogOpen(true)}
                            disabled={isExpired}
                        >
                            <CirclePlus className="h-4 w-4 text-primary" /> 
                            Añadir Cliente a Hoy
                        </Button>

                        <ScrollArea className="flex-1 pr-1">
                            <div className="space-y-3 pb-6">
                                {todaysClients.length > 0 ? (
                                    todaysClients.map((c) => (
                                        <div 
                                            key={`${c.ruc}-${c.originalIndex}`} 
                                            onClick={() => (!activeClient?.checkInTime || activeClient.checkOutTime || isManager) && setActiveOriginalIndex(c.originalIndex)} 
                                            className={cn(
                                                "flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 bg-white", 
                                                activeOriginalIndex === c.originalIndex ? "border-primary bg-primary/5 shadow-md scale-[1.02]" : "border-slate-100 hover:border-slate-300"
                                            )}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className={cn("font-black text-xs truncate uppercase tracking-tight text-slate-950", activeOriginalIndex === c.originalIndex && "text-primary")}>
                                                    {c.nombre_comercial}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-[9px] font-black text-slate-950 uppercase">{c.ruc}</p>
                                                    {c.isReadded && <Badge className="text-[8px] h-3 px-1 bg-orange-600 text-white font-black border-none uppercase">RE-ADICIÓN</Badge>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {isAdmin && (
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); handleRemoveClient(c.originalIndex); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                                                )}
                                                {c.visitStatus === 'Completado' && (
                                                    <Badge variant="success" className="font-black text-[9px] uppercase border-none">
                                                        <CheckCircle className="h-3 w-3 mr-1" /> OK
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12 px-4 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200">
                                        <CalendarIcon className="h-8 w-8 mx-auto text-slate-300 mb-3" />
                                        <p className="text-[10px] font-black text-slate-950 uppercase">No hay visitas programadas para hoy en esta ruta.</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            <div className="lg:col-span-2">
                <Card className="shadow-2xl border-t-4 border-t-primary min-h-[600px] h-[85vh] rounded-[2.5rem] overflow-hidden flex flex-col bg-white">
                    <CardHeader className="bg-muted/10 h-36 flex flex-col justify-center px-10 shrink-0 border-b">
                        {activeClient ? (
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-primary uppercase leading-tight tracking-tight">{activeClient.nombre_comercial}</h3>
                                <p className="text-xs font-black text-slate-950 uppercase">{activeClient.direccion}</p>
                            </div>
                        ) : (
                            <div className="text-center text-slate-950 uppercase font-black tracking-widest text-lg">Selecciona un cliente de hoy</div>
                        )}
                    </CardHeader>
                    <CardContent className="p-10 space-y-8 flex-1 overflow-y-auto">
                        {activeClient && (
                            <>
                            <div className={cn("p-6 rounded-[1.5rem] border-2 transition-all duration-300", activeClient.checkInTime ? "bg-green-50 border-green-200 shadow-sm" : "bg-slate-50 border-dashed border-slate-300")}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <LogIn className={cn("h-8 w-8", activeClient.checkInTime ? "text-green-600" : "text-slate-950")} />
                                        <div>
                                            <h4 className="font-black text-xs uppercase tracking-tighter text-slate-950">Registro de Entrada</h4>
                                            <p className="text-[10px] font-black text-slate-950 uppercase mt-1">
                                                {activeClient.checkInTime ? `Marcado a las: ${activeClient.checkInTime}` : 'Pendiente'}
                                            </p>
                                        </div>
                                    </div>
                                    {!activeClient.checkInTime && (
                                        <Button onClick={handleCheckIn} className="font-black h-10 px-6 rounded-xl text-xs shadow-md transition-transform hover:scale-105" disabled={isExpired}>MARCAR ENTRADA</Button>
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
                                        <Label className="text-xs font-black uppercase text-primary tracking-wider ml-1">Observación Obligatoria</Label>
                                        <Textarea placeholder="Ingresa detalles de la conversación..." className="h-24 font-black text-sm border-2 border-slate-200 focus:border-primary rounded-2xl text-slate-950 shadow-sm bg-white" value={activeClient.callObservation || ''} onChange={e => handleFieldChange('callObservation', e.target.value)} disabled={isEditingDisabled} />
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
                                            <Input type="text" className="h-14 text-xl font-black text-primary border-2 border-slate-200 focus:border-primary rounded-2xl bg-white text-center text-slate-950 shadow-sm" placeholder="0.00" value={activeClient[f.key as keyof ClientInRoute] ?? ''} onChange={e => handleFieldChange(f.key as any, e.target.value)} disabled={isEditingDisabled} />
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                                    <Label className="text-xs font-black uppercase text-slate-950 tracking-wider ml-1">Observaciones de la Visita</Label>
                                    <Textarea placeholder="Comentarios del cliente..." className="h-24 font-black text-sm border-2 border-slate-200 focus:border-primary rounded-2xl text-slate-950 shadow-sm bg-white" value={activeClient.visitObservation || ''} onChange={e => handleFieldChange('visitObservation', e.target.value)} disabled={isEditingDisabled} />
                                </div>

                                <Button 
                                    onClick={handleConfirmCheckOut} 
                                    className="w-full h-16 text-lg font-black rounded-[1.5rem] shadow-2xl transition-all hover:scale-[1.02] mt-4" 
                                    disabled={isSaving || isEditingDisabled || !activeClient.visitType || (activeClient.visitType === 'telefonica' && !activeClient.callObservation?.trim())}
                                >
                                    {isSaving ? <LoaderCircle className="animate-spin h-6 w-6" /> : <><LogOut className="mr-2 h-6 w-6" /> {activeClient.visitStatus === 'Completado' ? 'VISITA COMPLETADA' : 'FINALIZAR VISITA'}</>}
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
                <DialogDescription className="text-[10px] font-black uppercase text-slate-950 mt-1">Añadir a la jornada de hoy</DialogDescription>
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
                                    <p className="text-[10px] font-black text-slate-950 mt-1">{c.ruc}</p>
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
        <Suspense fallback={<div className="p-20 text-center"><LoaderCircle className="animate-spin mx-auto h-12 w-12 text-primary" /></div>}>
            <RouteManagementContent />
        </Suspense>
    ); 
}
