'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, MapPin, LoaderCircle, Phone, AlertTriangle, ThumbsUp, Users as UsersIcon, Clock, Sparkles, CheckCircle2, PlusCircle, Search, ArrowLeft, Building2, Trash2, RefreshCw } from 'lucide-react';
import { updateRoute, addNotification } from '@/lib/firebase/firestore';
import type { Client, ClientInRoute, RoutePlan } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay, startOfWeek, isBefore, startOfDay, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Timestamp, GeoPoint, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

const parseMoney = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val || typeof val !== 'string') return 0;
    const clean = val.replace(',', '.').replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

const ensureDate = (d: any): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (d instanceof Timestamp) return d.toDate();
  if (d && typeof d.toDate === 'function') return d.toDate();
  const date = new Date(d);
  return isNaN(date.getTime()) ? new Date() : date;
};

const sanitizeClients = (clients: ClientInRoute[]): any[] => {
    if (!clients) return [];
    return clients.map(c => {
        if (!c) return null;
        const cleaned: any = { 
            ruc: String(c.ruc || ''),
            nombre_comercial: String(c.nombre_comercial || 'Sin Nombre'),
            visitStatus: c.visitStatus || 'Pendiente',
            status: (c.status === 'Eliminado') ? 'Eliminado' : 'Activo',
            visitType: c.visitType || null,
            isReadded: !!c.isReadded,
            reAdditionObservation: String(c.reAdditionObservation || ''),
            visitObservation: String(c.visitObservation || ''),
            callObservation: String(c.callObservation || ''),
            removalObservation: String(c.removalObservation || ''),
            checkInTime: c.checkInTime || null,
            checkOutTime: c.checkOutTime || null,
            valorVenta: parseMoney(c.valorVenta),
            valorCobro: parseMoney(c.valorCobro),
            devoluciones: parseMoney(c.devoluciones),
            promociones: parseMoney(c.promociones),
            medicacionFrecuente: parseMoney(c.medicacionFrecuente),
            selectedBranch: c.selectedBranch || 'Matriz'
        };
        const d = ensureDate(c.date);
        cleaned.date = Timestamp.fromDate(d);
        if (c.checkInLocation) cleaned.checkInLocation = c.checkInLocation;
        if (c.checkOutLocation) cleaned.checkOutLocation = c.checkOutLocation;
        return cleaned;
    }).filter(Boolean);
};

function RouteManagementContent() {
  const { user, routes: allRoutes, clients: catalogClients, loading: authLoading, users: allUsers } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [routeOverride, setRouteOverride] = useState<RoutePlan | null>(null);
  const [activeOriginalIndex, setActiveOriginalIndex] = useState<number | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const [isReAddDialogOpen, setIsReAddDialogOpen] = useState(false);
  const [reAddSearchTerm, setReAddSearchTerm] = useState('');
  const [reAddJustification, setReAddJustification] = useState('');
  const [tempSelectedClient, setTempSelectedClient] = useState<Client | null>(null);

  // Estados para eliminación administrativa
  const [isAdminRemovalDialogOpen, setIsAdminRemovalDialogOpen] = useState(false);
  const [adminRemovalReason, setAdminRemovalReason] = useState('');

  const [localVisitObs, setLocalVisitObs] = useState('');
  const [localCallObs, setLocalCallObs] = useState('');
  const [localVenta, setLocalVenta] = useState('');
  const [localCobro, setLocalCobro] = useState('');
  const [localDevol, setLocalDevol] = useState('');
  const [localBranch, setLocalBranch] = useState('Matriz');

  const isAdmin = user?.role === 'Administrador';

  useEffect(() => {
    if (user?.id) {
        const urlId = searchParams.get('routeId');
        const savedId = localStorage.getItem(`activeRouteId_${user.id}`);
        const savedIndex = localStorage.getItem(`activeClientIndex_${user.id}`);
        if (urlId) setSelectedRouteId(urlId);
        else if (savedId) {
            setSelectedRouteId(savedId);
            if (savedIndex) setActiveOriginalIndex(parseInt(savedIndex));
        }
    }
  }, [user?.id, searchParams]);

  useEffect(() => {
    if (user?.id && selectedRouteId) localStorage.setItem(`activeRouteId_${user.id}`, selectedRouteId);
    if (user?.id && activeOriginalIndex !== null) localStorage.setItem(`activeClientIndex_${user.id}`, String(activeOriginalIndex));
    else if (user?.id) localStorage.removeItem(`activeClientIndex_${user.id}`);
  }, [selectedRouteId, activeOriginalIndex, user?.id]);

  useEffect(() => {
    const rid = selectedRouteId || searchParams.get('routeId');
    if (!rid) return;
    const unsub = onSnapshot(doc(db, 'routes', rid), (snap) => {
        if (snap.exists()) setRouteOverride({ id: snap.id, ...snap.data() } as any);
    });
    return () => unsub();
  }, [selectedRouteId, searchParams]);

  const selectedRoute = useMemo(() => {
    if (routeOverride) return routeOverride;
    const rid = selectedRouteId || searchParams.get('routeId');
    return allRoutes.find(r => r.id === rid);
  }, [routeOverride, selectedRouteId, allRoutes, searchParams]);

  useEffect(() => {
    const check = () => {
      if (isAdmin) { setIsExpired(false); return; }
      const now = new Date();
      let limitHour = 19;
      let limitMinute = 0;
      if (selectedRoute?.extendedClosingTime) {
        const [h, m] = selectedRoute.extendedClosingTime.split(':').map(Number);
        if (!isNaN(h)) { limitHour = h; limitMinute = m; }
      } else {
        const routeOwner = allUsers.find(u => u.id === selectedRoute?.createdBy);
        const userToCheck = routeOwner || user;
        if (userToCheck?.extendedClosingTime && userToCheck?.extendedClosingDays?.includes(now.getDay())) {
            const [h, m] = userToCheck.extendedClosingTime.split(':').map(Number);
            if (!isNaN(h)) { limitHour = h; limitMinute = m; }
        }
      }
      const currentMin = now.getHours() * 60 + now.getMinutes();
      setIsExpired(currentMin >= (limitHour * 60 + limitMinute));
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [isAdmin, selectedRoute, allUsers, user]);

  const todaysClients = useMemo(() => {
    if (!selectedRoute) return [];
    const now = new Date();
    const allMappedClients = (selectedRoute.clients || []).map((c, index) => ({ ...c, originalIndex: index }));
    return allMappedClients.filter(c => c.status !== 'Eliminado' && isSameDay(ensureDate(c.date), now));
  }, [selectedRoute]);

  const allRouteFinished = useMemo(() => {
    if (!selectedRoute) return false;
    return todaysClients.length > 0 && todaysClients.every(c => c.visitStatus === 'Completado');
  }, [todaysClients, selectedRoute]);

  const activeClient = useMemo(() => activeOriginalIndex !== null ? selectedRoute?.clients[activeOriginalIndex] : null, [activeOriginalIndex, selectedRoute]);
  
  const catalogClient = useMemo(() => {
    if (!activeClient) return null;
    return catalogClients.find(c => c.ruc === activeClient.ruc);
  }, [activeClient, catalogClients]);

  const clientInManagement = useMemo(() => todaysClients.find(c => c.checkInTime && !c.checkOutTime), [todaysClients]);

  useEffect(() => {
      if (activeClient) {
          setLocalVisitObs(activeClient.visitObservation || '');
          setLocalCallObs(activeClient.callObservation || '');
          setLocalVenta(activeClient.valorVenta ? String(activeClient.valorVenta) : '');
          setLocalCobro(activeClient.valorCobro ? String(activeClient.valorCobro) : '');
          setLocalDevol(activeClient.devoluciones ? String(activeClient.devoluciones) : '');
          setLocalBranch(activeClient.selectedBranch || 'Matriz');
      }
  }, [activeOriginalIndex, activeClient?.ruc]);

  const isObservationMissing = useMemo(() => {
    if (!activeClient) return false;
    if (activeClient.visitType === 'telefonica') return !localVisitObs.trim();
    if (activeClient.visitType === 'presencial') {
        const v = parseMoney(localVenta), c = parseMoney(localCobro), d = parseMoney(localDevol);
        return v === 0 && c === 0 && d === 0 && !localVisitObs.trim();
    }
    return false;
  }, [activeClient, localVenta, localCobro, localDevol, localVisitObs]);

  const isEditDisabled = useMemo(() => {
    if (isAdmin) return false;
    if (isExpired) return true;
    if (activeClient?.visitStatus === 'Completado') return true;
    return false;
  }, [isAdmin, isExpired, activeClient]);

  const handleCheckIn = () => {
    if (!selectedRoute || activeOriginalIndex === null || clientInManagement || isEditDisabled) return;
    setIsSaving(true);
    const timeStr = format(new Date(), 'HH:mm:ss');
    const proceed = (coords?: {lat: number, lng: number}) => {
        const next = [...selectedRoute.clients];
        next[activeOriginalIndex!] = { 
            ...next[activeOriginalIndex!], 
            checkInTime: timeStr, 
            selectedBranch: localBranch,
            checkInLocation: coords ? new GeoPoint(coords.lat, coords.lng) : null 
        };
        updateRoute(selectedRoute.id, { clients: sanitizeClients(next), status: 'En Progreso' });
        setIsSaving(false);
    };
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            p => proceed({ lat: p.coords.latitude, lng: p.coords.longitude }), 
            () => proceed(),
            { timeout: 4000, enableHighAccuracy: true, maximumAge: 0 } 
        );
    } else { proceed(); }
  };

  const handleResetCheckIn = async () => {
      if (!selectedRoute || activeOriginalIndex === null || !isAdmin) return;
      setIsSaving(true);
      try {
          const next = [...selectedRoute.clients];
          next[activeOriginalIndex!] = { 
              ...next[activeOriginalIndex!], 
              checkInTime: null, 
              checkInLocation: null,
              selectedBranch: 'Matriz',
              visitType: null,
              visitStatus: 'Pendiente'
          };
          await updateRoute(selectedRoute.id, { clients: sanitizeClients(next) });
          toast({ title: "Gestión Reseteada", description: "El cliente ha vuelto al estado inicial." });
          setIsSaving(false);
      } catch (e) {
          setIsSaving(false);
          toast({ title: "Error", variant: "destructive" });
      }
  };

  const handleConfirmAdminRemoval = async () => {
      if (!selectedRoute || activeOriginalIndex === null || !isAdmin || !adminRemovalReason.trim()) return;
      setIsSaving(true);
      try {
          const next = [...selectedRoute.clients];
          next[activeOriginalIndex!] = { 
              ...next[activeOriginalIndex!], 
              status: 'Eliminado', 
              removalObservation: adminRemovalReason,
              visitStatus: 'Pendiente',
              checkInTime: null,
              checkOutTime: null
          };
          await updateRoute(selectedRoute.id, { clients: sanitizeClients(next) });
          setActiveOriginalIndex(null);
          setIsAdminRemovalDialogOpen(false);
          setAdminRemovalReason('');
          toast({ title: "Cliente Quitado", description: "La parada ha sido eliminada de la jornada." });
      } catch (e) {
          toast({ title: "Error", variant: "destructive" });
      } finally {
          setIsSaving(false);
      }
  };

  const handleCheckOut = () => {
    if (!selectedRoute || activeOriginalIndex === null || isObservationMissing || isEditDisabled) return;
    setIsSaving(true);
    const timeStr = format(new Date(), 'HH:mm:ss');
    const proceed = (coords?: {lat: number, lng: number}) => {
        const next = [...selectedRoute.clients];
        next[activeOriginalIndex!] = { 
            ...next[activeOriginalIndex!], visitObservation: localVisitObs, callObservation: localCallObs,
            valorVenta: parseMoney(localVenta), valorCobro: parseMoney(localCobro), devoluciones: parseMoney(localDevol),
            checkOutTime: timeStr, visitStatus: 'Completado', checkOutLocation: coords ? new GeoPoint(coords.lat, coords.lng) : null
        };
        const allDone = sanitizeClients(next).filter(c => c.status !== 'Eliminado').every(c => c.visitStatus === 'Completado');
        setActiveOriginalIndex(null);
        updateRoute(selectedRoute.id, { clients: sanitizeClients(next), status: allDone ? 'Completada' : 'En Progreso' });
        setIsSaving(false);
    };
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            p => proceed({ lat: p.coords.latitude, lng: p.coords.longitude }), 
            () => proceed(),
            { timeout: 4000, enableHighAccuracy: true, maximumAge: 0 }
        );
    } else { proceed(); }
  };

  const filteredCatalog = useMemo(() => {
      const term = reAddSearchTerm.toLowerCase().trim();
      const routeOwner = allUsers.find(u => u.id === selectedRoute?.createdBy);
      const targetExecutive = (isAdmin && routeOwner) ? routeOwner.name : user?.name;
      return (catalogClients || [])
          .filter(c => c.ejecutivo?.trim().toLowerCase() === targetExecutive?.trim().toLowerCase())
          .filter(c => (c.nombre_cliente || '').toLowerCase().includes(term) || (c.nombre_comercial || '').toLowerCase().includes(term) || String(c.ruc || '').includes(term));
  }, [catalogClients, reAddSearchTerm, user?.name, isAdmin, allUsers, selectedRoute?.createdBy]);

  const handleConfirmReAdd = async () => {
      if (!selectedRoute || !tempSelectedClient || !reAddJustification.trim()) return;
      setIsSaving(true);
      try {
          const newClient: ClientInRoute = {
              ruc: tempSelectedClient.ruc, nombre_comercial: tempSelectedClient.nombre_comercial,
              date: Timestamp.now(), status: 'Activo', visitStatus: 'Pendiente', isReadded: true, reAdditionObservation: reAddJustification
          };
          const nextClients = [...selectedRoute.clients, newClient];
          await updateRoute(selectedRoute.id, { clients: sanitizeClients(nextClients) });
          toast({ title: "Cliente Añadido" });
          setIsReAddDialogOpen(false); setTempSelectedClient(null); setReAddJustification(''); setReAddSearchTerm('');
      } catch (e) { toast({ title: "Error", variant: "destructive" }); } finally { setIsSaving(false); }
  };

  const mondayOfCurrentWeek = useMemo(() => startOfDay(startOfWeek(new Date(), { weekStartsOn: 1 })), []);

  const visibleRoutes = useMemo(() => {
      return allRoutes.filter(r => {
          const isOwn = isAdmin || r.createdBy === user?.id;
          if (!isOwn) return false;
          const rDate = r.date instanceof Timestamp ? r.date.toDate() : new Date(r.date as any);
          const isFromThisWeekOrFuture = !isBefore(startOfDay(rDate), mondayOfCurrentWeek);
          if (!isFromThisWeekOrFuture) return false;
          return r.status === 'En Progreso' || r.status === 'Planificada';
      });
  }, [allRoutes, user?.id, isAdmin, mondayOfCurrentWeek]);

  if (authLoading) return <div className="p-20 text-center"><LoaderCircle className="animate-spin h-10 mx-auto" /></div>;

  if (allRouteFinished && !activeOriginalIndex && !isAdmin) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 animate-in zoom-in duration-500">
              <div className="bg-white p-8 rounded-[3rem] shadow-2xl relative border-4 border-primary">
                <ThumbsUp className="h-24 w-24 text-primary mx-auto animate-bounce" />
              </div>
              <h1 className="text-5xl font-black text-slate-950 uppercase tracking-tighter mt-8 mb-4">¡LO LOGRASTE!</h1>
              <p className="text-xl font-bold text-slate-500 uppercase">Has gestionado todos los clientes del día.</p>
          </div>
      );
  }

  return (
    <div className="flex flex-col gap-6">
        <PageHeader title={isAdmin ? "Supervisión de Jornada" : "Gestión de Jornada"} />
        {isExpired && !isAdmin && (
            <div className="bg-destructive/10 border-2 border-destructive text-destructive p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                <AlertTriangle className="h-6 w-6" /><span className="font-black uppercase text-sm">Jornada Bloqueada (19:00+)</span>
            </div>
        )}
        
        {!selectedRoute ? (
            <Card className="max-w-md mx-auto border-t-4 border-t-primary shadow-2xl rounded-[2.5rem] overflow-hidden"><CardHeader className="bg-slate-50 border-b p-8"><CardTitle className="text-center uppercase text-primary font-black">Activar mi Jornada</CardTitle></CardHeader><CardContent className="space-y-4 p-8">
                <Select value={selectedRouteId} onValueChange={setSelectedRouteId}><SelectTrigger className="h-12 border-2 font-black text-slate-950 rounded-xl"><Route className="mr-2 h-4 w-4 text-primary" /><SelectValue placeholder="Seleccionar Plan de Ruta" /></SelectTrigger><SelectContent className="font-black">{visibleRoutes.map(r => <SelectItem key={r.id} value={r.id} className="font-black uppercase text-xs">{r.routeName}</SelectItem>)}</SelectContent></Select>
                {selectedRouteId && <Button className="w-full h-14 font-black shadow-xl uppercase text-lg rounded-2xl" onClick={() => updateRoute(selectedRouteId, { status: 'En Progreso' })}>INICIAR RUTA DIARIA</Button>}
            </CardContent></Card>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className={cn("shadow-xl border-t-4 border-t-primary rounded-[2.5rem] overflow-hidden bg-white flex flex-col", activeOriginalIndex !== null ? "hidden lg:flex" : "flex")}>
                    <CardHeader className="bg-slate-50 border-b p-6 flex flex-row justify-between items-center">
                        <div><h2 className="text-lg font-black uppercase text-primary tracking-tighter">{selectedRoute.routeName}</h2><p className="text-[10px] font-bold text-slate-400 uppercase">Lista de paradas para hoy</p></div>
                        <Button variant="outline" size="sm" className="font-black text-[9px] uppercase border-primary text-primary rounded-xl" onClick={() => setIsReAddDialogOpen(true)} disabled={isExpired && !isAdmin}><PlusCircle className="mr-1 h-3.5 w-3.5" /> Cliente Extra</Button>
                    </CardHeader>
                    <CardContent className="p-4 flex-1 overflow-hidden">
                        <ScrollArea className="h-[60vh] pr-2">
                            <div className="space-y-3">
                                {todaysClients.map(c => {
                                    const isBeingManaged = !!c.checkInTime && !c.checkOutTime;
                                    return (
                                        <div key={c.originalIndex} onClick={() => setActiveOriginalIndex(c.originalIndex)} className={cn("p-5 border-2 rounded-2xl cursor-pointer transition-all relative overflow-hidden", activeOriginalIndex === c.originalIndex ? "border-primary bg-primary/5 shadow-md" : "border-slate-100 bg-white")}>
                                            <div className="flex justify-between items-start mb-2">
                                                <p className={cn("font-black text-xs uppercase leading-tight flex-1", activeOriginalIndex === c.originalIndex ? "text-primary" : "text-slate-950")}>{c.nombre_comercial}</p>
                                                {c.visitStatus === 'Completado' ? <Badge variant="success" className="text-[8px] font-black uppercase border-none">OK</Badge> : isBeingManaged && <Badge variant="outline" className="text-[8px] font-black text-primary border-primary animate-pulse uppercase">EN CURSO</Badge>}
                                            </div>
                                            <div className="flex items-center gap-2"><Badge variant="outline" className="text-[8px] font-bold border-slate-200">{c.ruc}</Badge>{c.checkInTime && <span className="text-[9px] font-black text-slate-400 uppercase">{c.checkInTime}</span>}</div>
                                            {isBeingManaged && <div className="absolute bottom-0 left-0 h-1 bg-primary animate-pulse w-full" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className={cn("lg:col-span-2 shadow-2xl border-t-4 border-t-primary rounded-[2.5rem] overflow-hidden bg-white", activeOriginalIndex === null ? "hidden lg:block" : "block")}>
                    <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center gap-4"><Button variant="ghost" size="icon" className="lg:hidden rounded-full h-10 w-10" onClick={() => setActiveOriginalIndex(null)}><ArrowLeft className="h-6 w-6" /></Button><div className="flex-1 min-w-0"><CardTitle className="uppercase text-primary font-black tracking-tighter truncate text-xl">{activeClient?.nombre_comercial || "Selecciona un cliente"}</CardTitle></div>
                    {isAdmin && activeClient && (
                        <div className="flex gap-2">
                             {activeClient.checkInTime && activeClient.visitStatus !== 'Completado' && (
                                <Button variant="outline" size="sm" onClick={handleResetCheckIn} className="text-orange-600 border-orange-200 font-black uppercase text-[10px] bg-orange-50 hover:bg-orange-100 shadow-sm">
                                    <RefreshCw className="mr-1 h-3 w-3" /> Resetear Ingreso
                                </Button>
                             )}
                             <Button variant="outline" size="sm" onClick={() => setIsAdminRemovalDialogOpen(true)} className="text-red-600 border-red-200 font-black uppercase text-[10px] bg-red-50 hover:bg-red-100 shadow-sm">
                                <Trash2 className="mr-1 h-3 w-3" /> Quitar Parada
                             </Button>
                        </div>
                    )}
                    </CardHeader>
                    <CardContent className="p-4 sm:p-8">
                        {activeClient ? (
                            <div className="space-y-8">
                                {catalogClient?.branches && catalogClient.branches.length > 0 && (
                                    <div className="space-y-2 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                                        <Label className="text-[10px] font-black uppercase text-slate-500">Ubicación de Gestión</Label>
                                        <Select value={localBranch} onValueChange={setLocalBranch} disabled={isEditDisabled || !!activeClient.checkInTime}>
                                            <SelectTrigger className="h-11 font-black"><Building2 className="mr-2 h-4 w-4 text-primary" /><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Matriz" className="font-bold">Sede Principal (Matriz)</SelectItem>
                                                {catalogClient.branches.map(b => (
                                                    <SelectItem key={b.id} value={b.name || b.id} className="font-bold">{b.name || `Sucursal ${b.id.slice(-4)}`}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[9px] font-bold text-slate-400 italic">
                                            {localBranch === 'Matriz' ? catalogClient.direccion : (catalogClient.branches.find(b => b.name === localBranch || b.id === localBranch)?.address)}
                                        </p>
                                    </div>
                                )}

                                <div className={cn("p-6 rounded-[2rem] border-2 flex items-center justify-between", activeClient.checkInTime ? "bg-green-50 border-green-200" : "bg-slate-50 border-dashed border-slate-200")}>
                                    <div><p className="text-[10px] font-black uppercase text-slate-400">Hora de Ingreso</p><p className="text-3xl font-black text-slate-950">{activeClient.checkInTime || "--:--:--"}</p></div>
                                    {!activeClient.checkInTime && <Button onClick={handleCheckIn} disabled={isSaving || !!clientInManagement || isEditDisabled} className="font-black h-14 px-10 uppercase rounded-2xl shadow-xl">{isSaving ? <LoaderCircle className="animate-spin h-6 w-6" /> : "Marcar Entrada (GPS)"}</Button>}
                                </div>
                                <div className={cn("space-y-8", !activeClient.checkInTime && "opacity-20 pointer-events-none")}>
                                    <div className="space-y-4"><Label className="text-[11px] font-black uppercase text-slate-500">Tipo de Gestión</Label><RadioGroup value={activeClient.visitType || undefined} onValueChange={v => { if (!isEditDisabled) { const next = [...selectedRoute.clients]; next[activeOriginalIndex!].visitType = v as any; updateRoute(selectedRoute.id, { clients: sanitizeClients(next) }); } }} className="grid grid-cols-2 gap-4"><Label className={cn("flex flex-col items-center p-6 border-2 rounded-[2rem] cursor-pointer transition-all", activeClient.visitType === 'presencial' ? "border-primary bg-primary/5" : "bg-slate-50")}><RadioGroupItem value="presencial" className="sr-only" /><MapPin className="h-8 w-8 mb-3" /><span className="text-xs font-black uppercase">Presencial</span></Label><Label className={cn("flex flex-col items-center p-6 border-2 rounded-[2rem] cursor-pointer transition-all", activeClient.visitType === 'telefonica' ? "border-primary bg-primary/5" : "bg-slate-50")}><RadioGroupItem value="telefonica" className="sr-only" /><Phone className="h-8 w-8 mb-3" /><span className="text-xs font-black uppercase">Telefónica</span></Label></RadioGroup></div>
                                    <div className="grid grid-cols-3 gap-3"><div className="space-y-2"><Label className="text-[8px] font-black text-center block uppercase">Venta ($)</Label><Input value={localVenta} onChange={e => setLocalVenta(e.target.value)} disabled={isEditDisabled} className="h-14 font-black text-center text-primary text-xl border-2 rounded-2xl" placeholder="0.00" /></div><div className="space-y-2"><Label className="text-[8px] font-black text-center block uppercase">Cobro ($)</Label><Input value={localCobro} onChange={e => setLocalCobro(e.target.value)} disabled={isEditDisabled} className="h-14 font-black text-center text-primary text-xl border-2 rounded-2xl" placeholder="0.00" /></div><div className="space-y-2"><Label className="text-[8px] font-black text-center block uppercase">Devol. ($)</Label><Input value={localDevol} onChange={e => setLocalDevol(e.target.value)} disabled={isEditDisabled} className="h-14 font-black text-center text-primary text-xl border-2 rounded-2xl" placeholder="0.00" /></div></div>
                                    <div className="space-y-2"><Label className={cn("text-[10px] font-black uppercase text-slate-950", isObservationMissing && "text-red-600")}>Observaciones de Gestión {isObservationMissing && "(OBLIGATORIA)"}</Label><Textarea value={localVisitObs} onChange={e => setLocalVisitObs(e.target.value)} disabled={isEditDisabled} className="border-2 rounded-[1.5rem] p-4 text-base font-black text-slate-950 min-h-[120px]" placeholder="Resultado de la gestión..." /></div>
                                    {activeClient.visitStatus !== 'Completado' ? <Button onClick={handleCheckOut} disabled={isSaving || isObservationMissing || !activeClient.visitType || isEditDisabled} className="w-full h-16 text-xl font-black uppercase shadow-2xl rounded-[1.5rem] bg-slate-950 hover:bg-slate-900">{isSaving ? <LoaderCircle className="animate-spin h-8 w-8" /> : "Finalizar Gestión"}</Button> : <div className="p-8 bg-green-50 border-2 border-green-200 rounded-[2rem] text-center"><CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" /><p className="text-xl font-black text-green-900 uppercase">Gestión Finalizada</p></div>}
                                </div>
                            </div>
                        ) : <div className="text-center py-24 flex flex-col items-center gap-6 opacity-30"><UsersIcon className="h-20 w-20" /><p className="font-black text-2xl uppercase tracking-widest text-slate-950">Selecciona un cliente de la lista</p></div>}
                    </CardContent>
                </Card>
            </div>
        )}

        <Dialog open={isReAddDialogOpen} onOpenChange={setIsReAddDialogOpen}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-[2.5rem]">
                <DialogHeader className="p-8 pb-4 bg-slate-50 border-b"><DialogTitle className="text-2xl font-black text-primary uppercase">Añadir Cliente Extra</DialogTitle></DialogHeader>
                <div className="p-8 space-y-6">
                    <div className="relative"><Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" /><input placeholder="BUSCAR POR NOMBRE O RUC..." className="pl-12 h-12 w-full border-2 rounded-2xl font-black uppercase text-xs outline-none" value={reAddSearchTerm} onChange={(e) => setReAddSearchTerm(e.target.value)} /></div>
                    <ScrollArea className="h-[30vh] border-2 border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                        {filteredCatalog.slice(0, 15).map((client) => (
                            <div key={client.ruc} className={cn("flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border-2 mb-2", tempSelectedClient?.ruc === client.ruc ? "bg-primary/5 border-primary" : "bg-white border-transparent")} onClick={() => setTempSelectedClient(client)}>
                                <div className="flex-1"><p className="text-xs font-black text-slate-950 uppercase">{client.nombre_comercial}</p><p className="text-[9px] font-mono text-slate-400 font-bold uppercase">{client.ruc}</p></div>
                            </div>
                        ))}
                    </ScrollArea>
                    {tempSelectedClient && (
                        <div className="space-y-3">
                            <Label className="text-[10px] font-black uppercase text-primary">Justificación Obligatoria</Label>
                            <Textarea 
                                placeholder="Escribe el motivo..." 
                                className="border-2 rounded-2xl h-24 font-black text-slate-950" 
                                value={reAddJustification} 
                                onChange={e => setReAddJustification(e.target.value)} 
                            />
                        </div>
                    )}
                </div>
                <DialogFooter className="p-8 bg-slate-50 border-t flex justify-end gap-4"><Button variant="ghost" className="font-black uppercase" onClick={() => setIsReAddDialogOpen(false)}>CANCELAR</Button><Button disabled={!tempSelectedClient || !reAddJustification.trim() || isSaving} onClick={handleConfirmReAdd} className="font-black px-8 h-12 shadow-xl uppercase rounded-xl">Confirmar Adición</Button></DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isAdminRemovalDialogOpen} onOpenChange={setIsAdminRemovalDialogOpen}>
            <DialogContent className="sm:max-w-[500px] rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
                <DialogHeader className="p-8 pb-4 bg-red-50 border-b">
                    <DialogTitle className="text-xl font-black uppercase text-red-600 flex items-center gap-2">
                        <Trash2 className="h-6 w-6" /> Quitar Parada de Jornada
                    </DialogTitle>
                </DialogHeader>
                <div className="p-8 space-y-4">
                    <p className="text-xs font-bold text-slate-500 uppercase leading-relaxed">
                        Como administrador, puedes eliminar una parada programada (incluso si está "En curso") si el vendedor no puede completarla.
                    </p>
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-red-600">Justificación Técnica Obligatoria</Label>
                        <Textarea 
                            placeholder="Ej: Cliente cerrado por feriado, vendedor reporta siniestro..." 
                            className="h-32 border-2 border-red-100 rounded-2xl font-black text-slate-950 text-sm focus:ring-red-500/20"
                            value={adminRemovalReason}
                            onChange={e => setAdminRemovalReason(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter className="p-8 bg-slate-50 border-t flex justify-end gap-3">
                    <DialogClose asChild><Button variant="ghost" className="font-black uppercase">Cancelar</Button></DialogClose>
                    <Button 
                        disabled={!adminRemovalReason.trim() || isSaving} 
                        onClick={handleConfirmAdminRemoval}
                        className="bg-red-600 hover:bg-red-700 text-white font-black px-8 h-12 shadow-xl uppercase rounded-xl"
                    >
                        {isSaving ? <LoaderCircle className="animate-spin mr-2 h-4 w-4" /> : "Confirmar Eliminación"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}

export default function RouteManagementPage() { return <Suspense fallback={<div className="p-20 text-center"><LoaderCircle className="animate-spin mx-auto h-12 w-12 text-primary" /></div>}><RouteManagementContent /></Suspense>; }