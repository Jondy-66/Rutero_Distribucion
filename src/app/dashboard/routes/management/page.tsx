
'use client';
import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Search, MapPin, LoaderCircle, LogIn, LogOut, CheckCircle, Phone, User, PlusCircle, Trash2, ThumbsUp, Users, CirclePlus, X } from 'lucide-react';
import { updateRoute } from '@/lib/firebase/firestore';
import type { Client, ClientInRoute } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, isBefore, startOfDay, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Timestamp, GeoPoint } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';

/**
 * Sanitize client data for Firestore storage.
 */
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

  const lastLocalUpdate = useRef<number>(0);
  const isAdmin = user?.role === 'Administrador';

  const selectableRoutes = useMemo(() => {
    return allRoutes.filter(r => {
        if (r.createdBy !== user?.id && !isAdmin) return false;
        if (isAdmin && selectedAgentId !== 'all' && r.createdBy !== selectedAgentId) return false;
        
        const rDate = r.date instanceof Timestamp ? r.date.toDate() : new Date(r.date as any);
        return (r.status !== 'Completada' || isToday(rDate)) && !isBefore(addDays(startOfDay(rDate), 7), startOfDay(new Date()));
    });
  }, [allRoutes, user, isAdmin, selectedAgentId]);

  const selectedRoute = useMemo(() => 
    allRoutes.find(r => r.id === (selectedRouteId || searchParams.get('routeId'))), 
    [selectedRouteId, allRoutes, searchParams]
  );

  useEffect(() => {
    if (!selectedRoute || (Date.now() - lastLocalUpdate.current < 10000)) return;
    setCurrentRouteClientsFull(selectedRoute.clients || []);
    setIsRouteStarted(selectedRoute.status === 'En Progreso' || isAdmin);
  }, [selectedRoute, isAdmin]);

  const routeClients = useMemo(() => {
    return currentRouteClientsFull
        .map((c, index) => ({ ...c, originalIndex: index }))
        .filter(c => {
            if (c.status === 'Eliminado') return false;
            const cDate = c.date instanceof Timestamp ? c.date.toDate() : new Date(c.date as any);
            return isToday(cDate);
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
    activeOriginalIndex !== null ? routeClients.find(c => c.originalIndex === activeOriginalIndex) : null, 
    [routeClients, activeOriginalIndex]
  );

  const handleFieldChange = (field: keyof ClientInRoute, value: any) => {
    if (activeOriginalIndex === null || (activeClient?.visitStatus === 'Completado' && !isAdmin) || isSaving) return;
    
    lastLocalUpdate.current = Date.now();
    const nextClients = currentRouteClientsFull.map((c, idx) => 
        idx === activeOriginalIndex ? { ...c, [field]: value } : c
    );
    
    setCurrentRouteClientsFull(nextClients);
    
    if (selectedRoute) {
        updateRoute(selectedRoute.id, { clients: sanitizeClients(nextClients) }).catch(console.error);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedRoute || activeOriginalIndex === null || isSaving) return;
    setIsSaving(true);
    lastLocalUpdate.current = Date.now();

    try {
        const location = await new Promise<any>((resolve) => {
            if (!navigator.geolocation) return resolve(null);
            navigator.geolocation.getCurrentPosition(
                (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
                () => resolve(null),
                { timeout: 5000 }
            );
        });

        const nextClients = currentRouteClientsFull.map((c, idx) => 
            idx === activeOriginalIndex 
                ? { ...c, checkInTime: format(new Date(), 'HH:mm:ss'), checkInLocation: location } 
                : c
        );

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
    if (!selectedRoute || activeOriginalIndex === null || isSaving) return;
    
    if (activeClient?.visitType === 'telefonica' && !activeClient.callObservation?.trim()) {
        return toast({ title: "Observación requerida", description: "Escribe el resumen de la llamada.", variant: "destructive" });
    }

    setIsSaving(true);
    lastLocalUpdate.current = Date.now();

    try {
        const nextClients = currentRouteClientsFull.map((c, idx) => 
            idx === activeOriginalIndex 
                ? { ...c, checkOutTime: format(new Date(), 'HH:mm:ss'), visitStatus: 'Completado' } 
                : c
        );

        const allDone = nextClients.filter(c => c.status !== 'Eliminado').every(c => c.visitStatus === 'Completado');
        
        await updateRoute(selectedRoute.id, { 
            clients: sanitizeClients(nextClients),
            status: allDone ? 'Completada' : 'En Progreso'
        });

        setCurrentRouteClientsFull(nextClients);
        if (!isAdmin) setActiveOriginalIndex(null);
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
    lastLocalUpdate.current = Date.now();

    try {
        const nextClients = currentRouteClientsFull.map((c, i) => 
            i === idx ? { ...c, status: 'Eliminado' } : c
        );
        await updateRoute(selectedRoute.id, { clients: sanitizeClients(nextClients) });
        setCurrentRouteClientsFull(nextClients);
        toast({ title: "Cliente removido de la ruta" });
    } catch (e) {
        toast({ title: "Error al eliminar", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  const handleAddClients = async () => {
    if (!selectedRoute || multiSelectedClients.length === 0) return;
    setIsSaving(true);

    try {
        const newVisits: ClientInRoute[] = multiSelectedClients.map(c => ({
            ruc: c.ruc,
            nombre_comercial: c.nombre_comercial,
            date: new Date(),
            visitStatus: 'Pendiente',
            status: 'Activo',
            isReadded: true,
            reAdditionObservation
        }));

        const nextClients = [...currentRouteClientsFull, ...newVisits];
        await updateRoute(selectedRoute.id, { clients: sanitizeClients(nextClients) });
        
        setCurrentRouteClientsFull(nextClients);
        setIsAddClientDialogOpen(false);
        setMultiSelectedClients([]);
        setReAdditionObservation('');
        setAddClientSearchTerm('');
        toast({ title: "Clientes añadidos exitosamente" });
    } catch (e) {
        toast({ title: "Error al añadir clientes", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  if (authLoading) return <div className="p-20 text-center"><LoaderCircle className="animate-spin mx-auto h-12 w-12" /></div>;

  return (
    <>
    <PageHeader title="Gestión de Ruta" description="Control diario de visitas y registros de gestión." />
    
    {!isRouteStarted ? (
        <Card className="max-w-md mx-auto shadow-xl border-t-4 border-t-primary">
            <CardHeader><CardTitle>Iniciar Jornada</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                {isAdmin && (
                    <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                        <SelectTrigger><Users className="mr-2 h-4 w-4" /><SelectValue placeholder="Todos los agentes" /></SelectTrigger>
                        <SelectContent>{allUsers.filter(u => u.role !== 'Administrador').map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                    </Select>
                )}
                <Select value={selectedRouteId} onValueChange={setSelectedRouteId}>
                    <SelectTrigger><Route className="mr-2 h-4 w-4 text-primary" /><SelectValue placeholder="Selecciona una ruta" /></SelectTrigger>
                    <SelectContent>{selectableRoutes.map(r => <SelectItem key={r.id} value={r.id}>{r.routeName}</SelectItem>)}</SelectContent>
                </Select>
                {selectedRoute && (
                    <Button 
                        className="w-full font-black h-12" 
                        onClick={() => updateRoute(selectedRoute.id, { status: 'En Progreso' }).then(() => setIsRouteStarted(true))}
                    >
                        INICIAR JORNADA
                    </Button>
                )}
            </CardContent>
        </Card>
    ) : isTodayCompleted && !isAdmin ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center bg-white rounded-3xl shadow-xl p-10 border-4 border-green-50 animate-in zoom-in-95 duration-300">
            <div className="bg-green-100 p-8 rounded-full mb-6 animate-bounce">
                <ThumbsUp className="h-16 w-16 text-green-600" />
            </div>
            <h2 className="text-3xl font-black text-green-700 uppercase mb-4 tracking-tighter">¡Jornada de hoy completada!</h2>
            <p className="text-muted-foreground font-medium mb-8 max-w-xs">Has gestionado todos los clientes programados para hoy con éxito.</p>
            <Button className="font-black px-10 h-14 rounded-2xl text-lg shadow-lg" onClick={() => router.push('/dashboard')}>VOLVER AL PANEL</Button>
        </div>
    ) : (
        <div className="grid lg:grid-cols-3 gap-8">
            {/* PANEL LATERAL: LISTADO DE CLIENTES */}
            <div className="lg:col-span-1 space-y-6">
                <div className="space-y-4 px-2">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-black text-primary uppercase leading-tight tracking-tighter truncate max-w-[240px]" title={selectedRoute?.routeName}>
                                {selectedRoute?.routeName || "Plan de Ruta"}
                            </h2>
                            <p className="text-sm font-bold text-muted-foreground capitalize">
                                {format(new Date(), "EEEE, dd 'De' MMMM", { locale: es })}
                            </p>
                        </div>
                        {isAdmin && (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none font-black text-[10px] px-3 py-1 uppercase tracking-tighter shrink-0">
                                VISTA ADMIN
                            </Badge>
                        )}
                    </div>

                    <div className="space-y-2 pt-2">
                        <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-tighter mb-1">
                            <span className="text-primary">PROGRESO HOY</span>
                            <span className="text-slate-600">
                                {routeClients.filter(c => c.visitStatus === 'Completado').length} / {routeClients.length}
                            </span>
                        </div>
                        <Progress 
                            value={(routeClients.filter(c => c.visitStatus === 'Completado').length / (routeClients.length || 1)) * 100} 
                            className="h-2.5 bg-slate-100 [&>div]:bg-primary" 
                        />
                    </div>

                    <Button 
                        variant="outline" 
                        className="w-full h-14 border-dashed border-2 border-slate-200 bg-slate-50/30 hover:bg-slate-100 text-slate-500 font-black text-sm rounded-2xl flex items-center justify-center gap-2 transition-all mt-4" 
                        onClick={() => setIsAddClientDialogOpen(true)}
                    >
                        <CirclePlus className="h-5 w-5 opacity-60" /> 
                        Añadir Cliente
                    </Button>
                </div>

                <div className="space-y-3 px-2 overflow-y-auto max-h-[60vh] pr-1">
                    {routeClients.map((c, i) => (
                        <div 
                            key={`${c.ruc}-${c.originalIndex}`} 
                            onClick={() => (!activeClient?.checkInTime || activeClient.checkOutTime || isAdmin) && setActiveOriginalIndex(c.originalIndex)} 
                            className={cn(
                                "flex items-center gap-4 p-4 border-2 rounded-2xl cursor-pointer transition-all duration-200", 
                                activeOriginalIndex === c.originalIndex 
                                    ? "border-primary bg-primary/5 shadow-md scale-[1.02]" 
                                    : "border-slate-100 bg-white hover:border-slate-200", 
                                c.visitStatus === 'Completado' && !isAdmin && "opacity-50 grayscale-[0.5]"
                            )}
                        >
                            <span className="text-slate-200 font-black text-xs w-4 shrink-0">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className={cn(
                                        "font-black text-xs truncate uppercase tracking-tight",
                                        activeOriginalIndex === c.originalIndex ? "text-primary" : "text-slate-500"
                                    )}>
                                        {c.nombre_comercial}
                                    </p>
                                    {c.isReadded && <Badge className="text-[8px] h-3.5 px-1.5 bg-orange-100 text-orange-700 font-black border-none uppercase">RE-ADICIÓN</Badge>}
                                </div>
                                <p className="text-[10px] font-mono text-slate-300 mt-0.5">{c.ruc}</p>
                            </div>
                            <div className="flex items-center gap-1">
                                {isAdmin && (
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                                        onClick={(e) => { e.stopPropagation(); handleRemoveClient(c.originalIndex); }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                                {c.visitStatus === 'Completado' && <CheckCircle className={cn("h-5 w-5", activeOriginalIndex === c.originalIndex ? "text-primary" : "text-slate-200")} />}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* PANEL DE DETALLE Y GESTIÓN */}
            <div className="lg:col-span-2">
                <Card className="shadow-2xl border-t-4 border-t-primary min-h-[550px] rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="bg-muted/10 h-36 flex flex-col justify-center px-10">
                        {activeClient ? (
                            <div className="space-y-1">
                                <h3 className="text-2xl font-black text-primary uppercase leading-tight tracking-tight">{activeClient.nombre_comercial}</h3>
                                <p className="text-xs font-bold text-muted-foreground uppercase">{activeClient.direccion}</p>
                            </div>
                        ) : (
                            <div className="text-center text-muted-foreground uppercase font-black opacity-30 tracking-widest">
                                Selecciona un cliente de la lista
                            </div>
                        )}
                    </CardHeader>
                    <CardContent className="p-10 space-y-10">
                        {activeClient && (
                            <>
                            {/* Registro de Entrada */}
                            <div className={cn(
                                "p-8 rounded-[2rem] border-2 transition-all duration-300", 
                                activeClient.checkInTime ? "bg-green-50 border-green-200 shadow-sm" : "bg-muted/20 border-dashed border-slate-300"
                            )}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-6">
                                        <LogIn className={cn("h-10 w-10", activeClient.checkInTime ? "text-green-600" : "text-muted-foreground")} />
                                        <div>
                                            <h4 className="font-black text-sm uppercase tracking-tighter">Registro de Entrada</h4>
                                            <p className="text-xs font-bold text-muted-foreground uppercase mt-1">
                                                {activeClient.checkInTime ? `Marcado a las: ${activeClient.checkInTime}` : 'Pendiente por marcar'}
                                            </p>
                                        </div>
                                    </div>
                                    {!activeClient.checkInTime && (
                                        <Button onClick={handleCheckIn} className="font-black h-12 px-8 rounded-2xl text-sm shadow-md transition-transform hover:scale-105">
                                            MARCAR ENTRADA
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Datos de Gestión */}
                            <div className={cn(
                                "space-y-8 transition-all duration-500", 
                                !activeClient.checkInTime && !isAdmin && "opacity-20 pointer-events-none grayscale"
                            )}>
                                <div className="space-y-4">
                                    <Label className="text-xs font-black uppercase text-slate-500 tracking-wider">Tipo de Visita</Label>
                                    <RadioGroup onValueChange={v => handleFieldChange('visitType', v)} value={activeClient.visitType} className="grid grid-cols-2 gap-6">
                                        <Label className={cn(
                                            "flex flex-col items-center gap-3 border-2 p-6 rounded-[2rem] cursor-pointer transition-all duration-200", 
                                            activeClient.visitType === 'presencial' ? "border-primary bg-primary/5 ring-4 ring-primary/5" : "border-slate-100 bg-slate-50/50 hover:bg-slate-100"
                                        )}>
                                            <RadioGroupItem value="presencial" className="sr-only" />
                                            <MapPin className={cn("h-8 w-8", activeClient.visitType === 'presencial' ? "text-primary" : "text-slate-400")} />
                                            <span className="text-xs font-black uppercase tracking-tighter">Presencial</span>
                                        </Label>
                                        <Label className={cn(
                                            "flex flex-col items-center gap-3 border-2 p-6 rounded-[2rem] cursor-pointer transition-all duration-200", 
                                            activeClient.visitType === 'telefonica' ? "border-primary bg-primary/5 ring-4 ring-primary/5" : "border-slate-100 bg-slate-50/50 hover:bg-slate-100"
                                        )}>
                                            <RadioGroupItem value="telefonica" className="sr-only" />
                                            <Phone className={cn("h-8 w-8", activeClient.visitType === 'telefonica' ? "text-primary" : "text-slate-400")} />
                                            <span className="text-xs font-black uppercase tracking-tighter">Telefónica</span>
                                        </Label>
                                    </RadioGroup>
                                </div>

                                {activeClient.visitType === 'telefonica' && (
                                    <div className="space-y-3 animate-in slide-in-from-top-4 duration-300">
                                        <Label className="text-xs font-black uppercase text-primary tracking-wider">Observación Obligatoria de la Llamada</Label>
                                        <Textarea 
                                            placeholder="Ingresa aquí los detalles clave de la conversación..." 
                                            className="h-32 font-bold text-sm border-2 focus:border-primary rounded-2xl px-4 py-3" 
                                            value={activeClient.callObservation || ''} 
                                            onChange={e => handleFieldChange('callObservation', e.target.value)} 
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-6">
                                    {[
                                        { key: 'valorVenta', label: 'VENTA ($)' },
                                        { key: 'valorCobro', label: 'COBRO ($)' },
                                        { key: 'devoluciones', label: 'DEVOLUCIÓN ($)' }
                                    ].map(f => (
                                        <div key={f.key} className="space-y-2">
                                            <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">{f.label}</Label>
                                            <Input 
                                                type="text" 
                                                className="h-14 text-xl font-black text-primary border-2 border-slate-100 focus:border-primary rounded-2xl bg-slate-50/30 px-4 text-center" 
                                                placeholder="0.00" 
                                                value={activeClient[f.key as keyof ClientInRoute] ?? ''} 
                                                onChange={e => handleFieldChange(f.key as any, e.target.value)} 
                                            />
                                        </div>
                                    ))}
                                </div>

                                <Button 
                                    onClick={handleConfirmCheckOut} 
                                    className="w-full h-20 text-xl font-black rounded-[2rem] shadow-2xl transition-all hover:scale-[1.02] active:scale-100 mt-4" 
                                    disabled={
                                        isSaving || 
                                        (activeClient.visitStatus === 'Completado' && !isAdmin) || 
                                        !activeClient.visitType || 
                                        (activeClient.visitType === 'telefonica' && !activeClient.callObservation?.trim())
                                    }
                                >
                                    {isSaving ? (
                                        <LoaderCircle className="animate-spin h-8 w-8" />
                                    ) : (
                                        <>
                                            <LogOut className="mr-3 h-7 w-7" /> 
                                            {activeClient.visitStatus === 'Completado' ? 'ACTUALIZAR GESTIÓN' : 'FINALIZAR VISITA'}
                                        </>
                                    )}
                                </Button>
                            </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )}

    {/* DIALOGO PARA AÑADIR CLIENTES - OPTIMIZADO PARA PANTALLA */}
    <Dialog open={isAddClientDialogOpen} onOpenChange={setIsAddClientDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-xl rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col max-h-[90vh]">
            <DialogHeader className="bg-primary/5 p-8 pb-6 shrink-0 relative">
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter text-primary pr-8">Catálogo de Clientes</DialogTitle>
                <DialogDescription className="text-[10px] font-bold uppercase text-slate-400 mt-1">Selecciona clientes para re-añadir a tu ruta de hoy</DialogDescription>
                <DialogClose className="absolute right-6 top-8 opacity-70 hover:opacity-100">
                    <X className="h-6 w-6" />
                </DialogClose>
            </DialogHeader>
            
            <div className="px-8 py-4 space-y-4 shrink-0 border-b">
                <div className="relative">
                    <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                    <Input 
                        placeholder="Buscar por RUC o Nombre del Cliente..." 
                        value={addClientSearchTerm} 
                        onChange={e => setAddClientSearchTerm(e.target.value)} 
                        className="h-12 pl-12 font-bold rounded-2xl border-2 border-slate-100 focus:border-primary transition-all" 
                    />
                </div>
            </div>

            <ScrollArea className="flex-1 px-8 py-4 bg-slate-50/30">
                <div className="space-y-3 pb-4">
                    {availableClients
                        .filter(c => {
                            const search = addClientSearchTerm.toLowerCase();
                            return String(c.nombre_cliente || '').toLowerCase().includes(search) || 
                                   String(c.nombre_comercial || '').toLowerCase().includes(search) || 
                                   String(c.ruc || '').includes(search);
                        })
                        .map(c => (
                            <div 
                                key={c.id} 
                                onClick={() => setMultiSelectedClients(prev => 
                                    prev.some(s => s.ruc === c.ruc) ? prev.filter(s => s.ruc !== c.ruc) : [...prev, c]
                                )} 
                                className={cn(
                                    "p-4 rounded-2xl flex items-center gap-4 cursor-pointer transition-all border-2", 
                                    multiSelectedClients.some(s => s.ruc === c.ruc) 
                                        ? "bg-primary/10 border-primary shadow-sm" 
                                        : "bg-white border-slate-100 hover:border-slate-300"
                                )}
                            >
                                <Checkbox checked={multiSelectedClients.some(s => s.ruc === c.ruc)} className="rounded-md h-5 w-5 border-2 border-primary" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-black uppercase truncate text-slate-700 leading-tight">{c.nombre_comercial || c.nombre_cliente}</p>
                                    <div className="flex items-center gap-3 mt-1">
                                        <p className="text-[10px] font-mono text-slate-400">{c.ruc}</p>
                                        <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-white border-slate-200 text-slate-400 font-bold uppercase">{c.ejecutivo}</Badge>
                                    </div>
                                </div>
                            </div>
                        ))
                    }
                    {availableClients.length === 0 && (
                        <div className="py-20 text-center space-y-2">
                            <Users className="h-12 w-12 mx-auto text-slate-200" />
                            <p className="text-sm font-bold text-slate-400 uppercase">No se encontraron clientes en tu panel</p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            <div className="p-8 pt-6 border-t space-y-6 shrink-0 bg-white">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-wider ml-1">Observación de Re-adición (Opcional)</Label>
                    <Textarea 
                        className="h-20 text-xs font-bold border-2 border-slate-100 rounded-2xl px-4 py-3 focus:border-primary transition-all resize-none" 
                        placeholder="Indica el motivo de esta nueva visita..."
                        value={reAdditionObservation} 
                        onChange={e => setReAdditionObservation(e.target.value)} 
                    />
                </div>
                <div className="flex items-center gap-4">
                    <DialogClose asChild>
                        <Button variant="ghost" className="h-14 font-bold flex-1 text-slate-400 hover:text-slate-600">CANCELAR</Button>
                    </DialogClose>
                    <Button 
                        onClick={handleAddClients} 
                        disabled={multiSelectedClients.length === 0 || isSaving} 
                        className="h-14 font-black flex-[2] rounded-2xl text-lg shadow-xl transition-transform hover:scale-[1.02] active:scale-95"
                    >
                        {isSaving ? <LoaderCircle className="animate-spin h-6 w-6" /> : `AÑADIR ${multiSelectedClients.length} CLIENTES`}
                    </Button>
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
