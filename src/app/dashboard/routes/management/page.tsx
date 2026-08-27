'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, MapPin, LoaderCircle, LogIn, LogOut, Phone, AlertTriangle, ThumbsUp, Users as UsersIcon, Clock, Sparkles, MessageSquare, Trash2, ArrowLeft, CheckCircle2, PlusCircle, Search } from 'lucide-react';
import { updateRoute } from '@/lib/firebase/firestore';
import type { Client, ClientInRoute, RoutePlan } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay, startOfDay } from 'date-fns';
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
import Image from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';

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
            medicacionFrecuente: parseMoney(c.medicacionFrecuente)
        };
        const d = ensureDate(c.date);
        cleaned.date = Timestamp.fromDate(d);
        if (c.checkInLocation) cleaned.checkInLocation = c.checkInLocation;
        if (c.checkOutLocation) cleaned.checkOutLocation = c.checkOutLocation;
        return cleaned;
    }).filter(Boolean);
};

function RouteManagementContent() {
  const { user, routes: allRoutes, clients: catalogClients, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>(searchParams.get('routeId') || undefined);
  const [routeOverride, setRouteOverride] = useState<RoutePlan | null>(null);
  const [activeOriginalIndex, setActiveOriginalIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  // Estados para re-adición
  const [isReAddDialogOpen, setIsReAddDialogOpen] = useState(false);
  const [reAddSearchTerm, setReAddSearchTerm] = useState('');
  const [reAddJustification, setReAddJustification] = useState('');
  const [tempSelectedClient, setTempSelectedClient] = useState<Client | null>(null);

  const [localVisitObs, setLocalVisitObs] = useState('');
  const [localCallObs, setLocalCallObs] = useState('');
  const [localVenta, setLocalVenta] = useState('');
  const [localCobro, setLocalCobro] = useState('');
  const [localDevol, setLocalDevol] = useState('');

  const isAdmin = user?.role === 'Administrador';

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
        limitHour = h; limitMinute = m;
      } 
      const currentMin = now.getHours() * 60 + now.getMinutes();
      setIsExpired(currentMin >= (limitHour * 60 + limitMinute));
    };
    check();
    const t = setInterval(check, 60000);
    return () => clearInterval(t);
  }, [isAdmin, selectedRoute?.extendedClosingTime]);

  const todaysClients = useMemo(() => {
    if (!selectedRoute) return [];
    const today = startOfDay(new Date());
    return (selectedRoute.clients || [])
        .map((c, index) => ({ ...c, originalIndex: index }))
        .filter(c => c.status !== 'Eliminado' && isSameDay(startOfDay(ensureDate(c.date)), today));
  }, [selectedRoute]);

  const allTodayFinished = useMemo(() => {
    return todaysClients.length > 0 && todaysClients.every(c => c.visitStatus === 'Completado');
  }, [todaysClients]);

  const activeClient = useMemo(() => activeOriginalIndex !== null ? selectedRoute?.clients[activeOriginalIndex] : null, [activeOriginalIndex, selectedRoute]);
  const clientInManagement = useMemo(() => todaysClients.find(c => c.checkInTime && !c.checkOutTime), [todaysClients]);

  useEffect(() => {
      if (activeClient) {
          setLocalVisitObs(activeClient.visitObservation || '');
          setLocalCallObs(activeClient.callObservation || '');
          setLocalVenta(activeClient.valorVenta ? String(activeClient.valorVenta) : '');
          setLocalCobro(activeClient.valorCobro ? String(activeClient.valorCobro) : '');
          setLocalDevol(activeClient.devoluciones ? String(activeClient.devoluciones) : '');
      }
  }, [activeOriginalIndex, activeClient?.ruc]);

  const isPresencialMissingObs = useMemo(() => {
    if (!activeClient || activeClient.visitType !== 'presencial') return false;
    const v = parseMoney(localVenta), c = parseMoney(localCobro), d = parseMoney(localDevol);
    return v === 0 && c === 0 && d === 0 && !localVisitObs.trim();
  }, [activeClient, localVenta, localCobro, localDevol, localVisitObs]);

  const isEditDisabled = useMemo(() => {
    if (isAdmin) return false;
    if (isExpired) return true;
    if (activeClient?.visitStatus === 'Completado') return true;
    return false;
  }, [isAdmin, isExpired, activeClient]);

  const handleCheckIn = () => {
    if (!selectedRoute || activeOriginalIndex === null || clientInManagement || isEditDisabled) {
        if (clientInManagement) {
            toast({ title: "Gestión en curso", description: "Debes finalizar la gestión actual antes de iniciar otra.", variant: "destructive" });
        }
        return;
    }
    setIsSaving(true);
    const timeStr = format(new Date(), 'HH:mm:ss');
    const proceed = (coords?: {lat: number, lng: number}) => {
        const next = [...selectedRoute.clients];
        next[activeOriginalIndex] = { ...next[activeOriginalIndex], checkInTime: timeStr, checkInLocation: coords ? new GeoPoint(coords.lat, coords.lng) : null };
        updateRoute(selectedRoute.id, { clients: sanitizeClients(next), status: 'En Progreso' }).finally(() => setIsSaving(false));
    };
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            p => proceed({ lat: p.coords.latitude, lng: p.coords.longitude }), 
            () => proceed(),
            { timeout: 8000, enableHighAccuracy: true } // Timeout de 8s para evitar bloqueos
        );
    } else {
        proceed();
    }
  };

  const handleCheckOut = () => {
    if (!selectedRoute || activeOriginalIndex === null || isPresencialMissingObs || isEditDisabled) {
        if (isPresencialMissingObs) {
            toast({ title: "Observación requerida", description: "Debes justificar por qué los valores son $0.", variant: "destructive" });
        }
        return;
    }
    setIsSaving(true);
    const timeStr = format(new Date(), 'HH:mm:ss');
    const proceed = (coords?: {lat: number, lng: number}) => {
        const next = [...selectedRoute.clients];
        next[activeOriginalIndex] = { 
            ...next[activeOriginalIndex], visitObservation: localVisitObs, callObservation: localCallObs,
            valorVenta: parseMoney(localVenta), valorCobro: parseMoney(localCobro), devoluciones: parseMoney(localDevol),
            checkOutTime: timeStr, visitStatus: 'Completado', checkOutLocation: coords ? new GeoPoint(coords.lat, coords.lng) : null
        };
        const allDone = sanitizeClients(next).filter(c => c.status !== 'Eliminado').every(c => c.visitStatus === 'Completado');
        updateRoute(selectedRoute.id, { clients: sanitizeClients(next), status: allDone ? 'Completada' : 'En Progreso' }).finally(() => { setActiveOriginalIndex(null); setIsSaving(false); });
    };
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            p => proceed({ lat: p.coords.latitude, lng: p.coords.longitude }), 
            () => proceed(),
            { timeout: 8000, enableHighAccuracy: true }
        );
    } else {
        proceed();
    }
  };

  const filteredCatalog = useMemo(() => {
      const term = reAddSearchTerm.toLowerCase().trim();
      return (catalogClients || [])
          .filter(c => c.ejecutivo?.trim().toLowerCase() === user?.name?.trim().toLowerCase())
          .filter(c => 
              (c.nombre_cliente || '').toLowerCase().includes(term) || 
              (c.nombre_comercial || '').toLowerCase().includes(term) || 
              (c.ruc || '').includes(term)
          )
          .filter(c => !todaysClients.some(tc => tc.ruc === c.ruc));
  }, [catalogClients, reAddSearchTerm, todaysClients, user?.name]);

  const handleConfirmReAdd = async () => {
      if (!selectedRoute || !tempSelectedClient || !reAddJustification.trim()) return;
      setIsSaving(true);
      try {
          const newClient: ClientInRoute = {
              ruc: tempSelectedClient.ruc,
              nombre_comercial: tempSelectedClient.nombre_comercial,
              date: Timestamp.now(),
              status: 'Activo',
              visitStatus: 'Pendiente',
              isReadded: true,
              reAdditionObservation: reAddJustification
          };
          const nextClients = [...selectedRoute.clients, newClient];
          await updateRoute(selectedRoute.id, { clients: sanitizeClients(nextClients) });
          toast({ title: "Cliente Añadido", description: `${tempSelectedClient.nombre_comercial} se agregó a tu ruta de hoy.` });
          setIsReAddDialogOpen(false);
          setTempSelectedClient(null);
          setReAddJustification('');
          setReAddSearchTerm('');
      } catch (e) {
          toast({ title: "Error", description: "No se pudo re-adicionar el cliente.", variant: "destructive" });
      } finally {
          setIsSaving(false);
      }
  };

  if (authLoading) return <div className="p-20 text-center"><LoaderCircle className="animate-spin h-10 mx-auto" /></div>;

  if (allTodayFinished && !activeOriginalIndex) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center p-6 animate-in zoom-in duration-500">
              <div className="relative mb-8">
                  <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 animate-pulse" />
                  <div className="bg-white p-8 rounded-[3rem] shadow-2xl relative border-4 border-primary">
                    <ThumbsUp className="h-24 w-24 text-primary mx-auto animate-bounce" />
                  </div>
              </div>
              <h1 className="text-5xl font-black text-slate-950 uppercase tracking-tighter mb-4">¡LO LOGRASTE!</h1>
              <p className="text-xl font-bold text-slate-500 uppercase max-w-md">Has completado todas tus paradas programadas para el día de hoy.</p>
              <div className="mt-10 flex gap-4">
                  <Button variant="outline" className="font-black h-12 px-8 uppercase" onClick={() => setSelectedRouteId(undefined)}>CAMBIAR RUTA</Button>
                  <Button className="font-black h-12 px-8 uppercase" onClick={() => window.location.reload()}>VER RESUMEN</Button>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col gap-6">
        <PageHeader title="Gestión de Jornada" />
        {isExpired && !isAdmin && (
            <div className="bg-destructive/10 border-2 border-destructive text-destructive p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                <AlertTriangle className="h-6 w-6" />
                <span className="font-black uppercase text-sm">Jornada Bloqueada: El horario de edición ha concluido (19:00).</span>
            </div>
        )}
        
        {!selectedRoute ? (
            <Card className="max-w-md mx-auto border-t-4 border-t-primary shadow-2xl rounded-[2.5rem] overflow-hidden"><CardHeader className="bg-slate-50 border-b p-8"><CardTitle className="text-center uppercase text-primary font-black">Activar mi Jornada</CardTitle></CardHeader><CardContent className="space-y-4 p-8">
                <Select value={selectedRouteId} onValueChange={setSelectedRouteId}><SelectTrigger className="h-12 border-2 font-black text-slate-950 rounded-xl"><Route className="mr-2 h-4 w-4 text-primary" /><SelectValue placeholder="Seleccionar Plan de Ruta" /></SelectTrigger><SelectContent className="font-black">{allRoutes.filter(r => ['Planificada', 'En Progreso'].includes(r.status) && (isAdmin || r.createdBy === user?.id)).map(r => <SelectItem key={r.id} value={r.id} className="font-black uppercase text-xs">{r.routeName}</SelectItem>)}</SelectContent></Select>
                {selectedRouteId && <Button className="w-full h-14 font-black shadow-xl uppercase text-lg rounded-2xl" onClick={() => updateRoute(selectedRouteId, { status: 'En Progreso' })}>INICIAR RUTA DIARIA</Button>}
            </CardContent></Card>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LISTA DE PARADAS - Ocultar en móvil si hay un cliente seleccionado */}
                <Card className={cn(
                    "shadow-xl border-t-4 border-t-primary rounded-[2.5rem] overflow-hidden bg-white flex flex-col transition-all",
                    activeOriginalIndex !== null ? "hidden lg:flex" : "flex"
                )}>
                    <CardHeader className="bg-slate-50 border-b p-6 flex flex-row justify-between items-center">
                        <div>
                            <h2 className="text-lg font-black uppercase text-primary tracking-tighter">{selectedRoute.routeName}</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Lista de paradas para hoy</p>
                        </div>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="font-black text-[9px] uppercase border-primary text-primary rounded-xl"
                            onClick={() => setIsReAddDialogOpen(true)}
                            disabled={isExpired && !isAdmin}
                        >
                            <PlusCircle className="mr-1 h-3.5 w-3.5" /> Cliente Extra
                        </Button>
                    </CardHeader>
                    <CardContent className="p-4 flex-1 overflow-hidden">
                        <ScrollArea className="h-[60vh] pr-2">
                            <div className="space-y-3">
                                {todaysClients.map(c => {
                                    const isBeingManaged = clientInManagement?.originalIndex === c.originalIndex;
                                    
                                    return (
                                        <div key={c.originalIndex} onClick={() => setActiveOriginalIndex(c.originalIndex)} className={cn(
                                            "p-5 border-2 rounded-2xl cursor-pointer transition-all relative overflow-hidden group",
                                            activeOriginalIndex === c.originalIndex ? "border-primary bg-primary/5 shadow-md scale-[1.02]" : "border-slate-100 bg-white",
                                            c.visitStatus === 'Completado' && "opacity-80"
                                        )}>
                                            <div className="flex justify-between items-start mb-2">
                                                <p className={cn("font-black text-xs uppercase leading-tight flex-1", activeOriginalIndex === c.originalIndex ? "text-primary" : "text-slate-950")}>{c.nombre_comercial}</p>
                                                {c.visitStatus === 'Completado' && <Badge variant="success" className="text-[8px] font-black h-4 px-1.5 border-none uppercase">OK</Badge>}
                                                {c.isReadded && <Badge className="bg-orange-100 text-orange-700 text-[7px] font-black h-3.5 px-1 uppercase border-none">Extra</Badge>}
                                                {/* Reemplazo del punto azul por texto EN CURSO */}
                                                {isBeingManaged && <span className="text-[8px] font-black text-primary animate-pulse uppercase tracking-tighter shadow-[0_0_8px_hsl(var(--primary)/0.2)]">EN CURSO</span>}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-[8px] font-bold border-slate-200">{c.ruc}</Badge>
                                                {c.checkInTime && <span className="text-[9px] font-black text-slate-400 uppercase">{c.checkInTime}</span>}
                                            </div>
                                            {isBeingManaged && <div className="absolute bottom-0 left-0 h-1 bg-primary animate-progress-loop w-full" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* PANEL DE GESTIÓN - Ocultar en móvil si no hay cliente seleccionado */}
                <Card className={cn(
                    "lg:col-span-2 shadow-2xl border-t-4 border-t-primary rounded-[2.5rem] overflow-hidden bg-white transition-all",
                    activeOriginalIndex === null ? "hidden lg:block" : "block"
                )}>
                    <CardHeader className="bg-slate-50 border-b p-6 flex flex-row items-center gap-4">
                        {/* Botón de regreso para móvil */}
                        {activeOriginalIndex !== null && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="lg:hidden rounded-full h-10 w-10 hover:bg-slate-200" 
                                onClick={() => setActiveOriginalIndex(null)}
                            >
                                <ArrowLeft className="h-6 w-6" />
                            </Button>
                        )}
                        <div className="flex-1 min-w-0">
                            <CardTitle className="uppercase text-primary font-black tracking-tighter truncate text-xl">
                                {activeClient?.nombre_comercial || "Selecciona un cliente"}
                            </CardTitle>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{activeClient?.ruc || "Para ver el panel de gestión"}</p>
                        </div>
                        {activeClient?.isReadded && <Badge className="bg-orange-500 text-white font-black px-3 uppercase text-[10px] hidden sm:inline-flex">CLIENTE RE-ADICIONADO</Badge>}
                    </CardHeader>
                    <CardContent className="p-4 sm:p-8">
                        {activeClient ? (
                            <div className="space-y-8 animate-in fade-in duration-300">
                                <div className={cn(
                                    "p-6 sm:p-8 rounded-[2rem] border-2 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner transition-all",
                                    activeClient.checkInTime ? "bg-green-50 border-green-200" : "bg-slate-50 border-dashed border-slate-200"
                                )}>
                                    <div className="text-center sm:text-left">
                                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Hora de Ingreso</p>
                                        <p className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tighter">{activeClient.checkInTime || "--:--:--"}</p>
                                    </div>
                                    {!activeClient.checkInTime && (
                                        <Button 
                                            onClick={handleCheckIn} 
                                            disabled={isSaving || !!clientInManagement || isEditDisabled} 
                                            className="w-full sm:w-auto font-black h-14 sm:h-16 px-10 uppercase text-base sm:text-lg rounded-2xl shadow-xl hover:scale-105 transition-transform"
                                        >
                                            <LogIn className="mr-2 h-6 w-6" /> Marcar Entrada (GPS)
                                        </Button>
                                    )}
                                    {activeClient.checkInTime && <CheckCircle2 className="h-10 w-10 text-green-500" />}
                                </div>

                                <div className={cn("space-y-8 transition-all duration-500", !activeClient.checkInTime && "opacity-20 pointer-events-none")}>
                                    <div className="space-y-4">
                                        <Label className="text-[11px] font-black uppercase text-slate-500 tracking-widest pl-1">Tipo de Gestión</Label>
                                        <RadioGroup 
                                            value={activeClient.visitType || undefined} 
                                            onValueChange={v => {
                                                if (isEditDisabled) return;
                                                const next = [...selectedRoute.clients];
                                                next[activeOriginalIndex!].visitType = v as any;
                                                updateRoute(selectedRoute.id, { clients: sanitizeClients(next) });
                                            }} 
                                            className="grid grid-cols-2 gap-4 sm:gap-6"
                                            disabled={isEditDisabled}
                                        >
                                            <Label className={cn(
                                                "flex flex-col items-center p-4 sm:p-6 border-2 rounded-[2rem] cursor-pointer transition-all",
                                                activeClient.visitType === 'presencial' ? "border-primary bg-primary/5 ring-4 ring-primary/5" : "bg-slate-50 border-slate-100 hover:border-slate-200"
                                            )}>
                                                <RadioGroupItem value="presencial" className="sr-only" />
                                                <MapPin className={cn("h-8 w-8 sm:h-10 sm:w-10 mb-3", activeClient.visitType === 'presencial' ? "text-primary" : "text-slate-300")} />
                                                <span className="text-[10px] sm:text-xs font-black uppercase">Presencial</span>
                                            </Label>
                                            <Label className={cn(
                                                "flex flex-col items-center p-4 sm:p-6 border-2 rounded-[2rem] cursor-pointer transition-all",
                                                activeClient.visitType === 'telefonica' ? "border-primary bg-primary/5 ring-4 ring-primary/5" : "bg-slate-50 border-slate-100 hover:border-slate-200"
                                            )}>
                                                <RadioGroupItem value="telefonica" className="sr-only" />
                                                <Phone className={cn("h-8 w-8 sm:h-10 sm:w-10 mb-3", activeClient.visitType === 'telefonica' ? "text-primary" : "text-slate-300")} />
                                                <span className="text-[10px] sm:text-xs font-black uppercase">Telefónica</span>
                                            </Label>
                                        </RadioGroup>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="grid grid-cols-3 gap-3 sm:gap-6">
                                            <div className="space-y-2">
                                                <Label className="text-[8px] sm:text-[9px] font-black text-center block uppercase text-slate-500">Venta ($)</Label>
                                                <Input value={localVenta} onChange={e => setLocalVenta(e.target.value)} disabled={isEditDisabled} className="h-12 sm:h-14 font-black text-center text-primary text-lg sm:text-xl border-2 rounded-2xl" placeholder="0.00" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[8px] sm:text-[9px] font-black text-center block uppercase text-slate-500">Cobro ($)</Label>
                                                <Input value={localCobro} onChange={e => setLocalCobro(e.target.value)} disabled={isEditDisabled} className="h-12 sm:h-14 font-black text-center text-primary text-lg sm:text-xl border-2 rounded-2xl" placeholder="0.00" />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[8px] sm:text-[9px] font-black text-center block uppercase text-slate-500">Devol. ($)</Label>
                                                <Input value={localDevol} onChange={e => setLocalDevol(e.target.value)} disabled={isEditDisabled} className="h-12 sm:h-14 font-black text-center text-primary text-lg sm:text-xl border-2 rounded-2xl" placeholder="0.00" />
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className={cn("text-[10px] sm:text-[11px] font-black uppercase pl-1 transition-colors", isPresencialMissingObs ? "text-red-600" : "text-slate-500")}>
                                                Observaciones de Gestión {isPresencialMissingObs && "(OBLIGATORIA SI VALORES SON $0)"}
                                            </Label>
                                            <Textarea 
                                                value={localVisitObs} 
                                                onChange={e => setLocalVisitObs(e.target.value)} 
                                                disabled={isEditDisabled}
                                                className={cn("border-2 rounded-[1.5rem] p-4 text-sm sm:text-base font-bold min-h-[120px] transition-all", isPresencialMissingObs && "border-red-500 bg-red-50 focus:ring-red-100")} 
                                                placeholder="Describe el resultado de la visita o llamada..." 
                                            />
                                        </div>
                                    </div>

                                    {activeClient.visitStatus !== 'Completado' ? (
                                        <Button 
                                            onClick={handleCheckOut} 
                                            disabled={isSaving || isPresencialMissingObs || !activeClient.visitType || isEditDisabled} 
                                            className="w-full h-16 sm:h-20 text-xl sm:text-2xl font-black uppercase shadow-2xl rounded-[1.5rem] bg-slate-950 hover:bg-slate-900 transition-all hover:scale-[1.01]"
                                        >
                                            {isSaving ? <LoaderCircle className="animate-spin h-8 w-8" /> : <><LogOut className="mr-3 h-6 w-6 sm:h-8 sm:w-8" /> Finalizar Gestión</>}
                                        </Button>
                                    ) : (
                                        <div className="p-6 sm:p-8 bg-green-50 border-2 border-green-200 rounded-[2rem] text-center">
                                            <CheckCircle2 className="h-10 w-10 sm:h-12 sm:w-12 text-green-600 mx-auto mb-3" />
                                            <p className="text-lg sm:text-xl font-black text-green-900 uppercase tracking-tighter">Gestión Finalizada</p>
                                            <p className="text-[10px] sm:text-xs font-bold text-green-700 uppercase mt-1">Sincronizado con éxito: {activeClient.checkOutTime}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-24 sm:py-32 flex flex-col items-center gap-6 opacity-30 select-none">
                                <Image src="https://i.ibb.co/JjfktNsS/Routify.png" alt="Routify" width={180} height={60} className="grayscale" />
                                <p className="font-black text-xl sm:text-2xl uppercase tracking-widest text-slate-400">Selecciona un cliente de la lista</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        )}

        <Dialog open={isReAddDialogOpen} onOpenChange={setIsReAddDialogOpen}>
            <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden rounded-[2.5rem]">
                <DialogHeader className="p-8 pb-4 bg-slate-50 border-b">
                    <DialogTitle className="text-2xl font-black text-primary uppercase tracking-tighter">Añadir Cliente Extra</DialogTitle>
                    <DialogDescription className="text-xs font-bold uppercase text-slate-500">Solo visualizas clientes de tu propio panel asignado.</DialogDescription>
                </DialogHeader>
                <div className="p-8 space-y-6">
                    <div className="relative">
                        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
                        <Input 
                            placeholder="BUSCAR POR NOMBRE O RUC..." 
                            className="pl-12 h-12 border-2 rounded-2xl font-black uppercase text-xs" 
                            value={reAddSearchTerm} 
                            onChange={(e) => setReAddSearchTerm(e.target.value)} 
                        />
                    </div>

                    <ScrollArea className="h-[30vh] border-2 border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                        <div className="space-y-2">
                            {filteredCatalog.length > 0 ? filteredCatalog.slice(0, 15).map((client) => (
                                <div 
                                    key={client.ruc} 
                                    className={cn(
                                        "flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border-2",
                                        tempSelectedClient?.ruc === client.ruc ? "bg-primary/5 border-primary shadow-sm" : "bg-white border-transparent hover:border-slate-200"
                                    )}
                                    onClick={() => setTempSelectedClient(client)}
                                >
                                    <div className={cn("h-5 w-5 rounded-full border-2 flex items-center justify-center", tempSelectedClient?.ruc === client.ruc ? "border-primary bg-primary" : "border-slate-300")}>
                                        {tempSelectedClient?.ruc === client.ruc && <div className="h-2 w-2 rounded-full bg-white" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-black text-slate-950 uppercase truncate">{client.nombre_comercial}</p>
                                        <p className="text-[9px] font-mono text-slate-400 font-bold uppercase">{client.ruc}</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="p-10 text-center opacity-30 font-black uppercase text-[10px] tracking-widest">Sin resultados en tu catálogo autorizado</div>
                            )}
                        </div>
                    </ScrollArea>

                    {tempSelectedClient && (
                        <div className="space-y-3 animate-in slide-in-from-bottom-2">
                            <Label className="text-[10px] font-black uppercase text-primary tracking-widest pl-1">Justificación Obligatoria</Label>
                            <Textarea 
                                placeholder="Escribe el motivo de esta visita extra..." 
                                className="border-2 rounded-2xl h-24 font-bold text-sm"
                                value={reAddJustification}
                                onChange={e => setReAddJustification(e.target.value)}
                            />
                        </div>
                    )}
                </div>
                <DialogFooter className="p-8 bg-slate-50 border-t flex items-center justify-between gap-4">
                    <Button variant="ghost" className="font-black uppercase" onClick={() => setIsReAddDialogOpen(false)}>CANCELAR</Button>
                    <Button 
                        disabled={!tempSelectedClient || !reAddJustification.trim() || isSaving}
                        onClick={handleConfirmReAdd}
                        className="font-black px-8 h-12 shadow-xl uppercase rounded-xl"
                    >
                        {isSaving ? <LoaderCircle className="animate-spin" /> : "Confirmar Adición"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}

export default function RouteManagementPage() { return <Suspense fallback={<div className="p-20 text-center"><LoaderCircle className="animate-spin mx-auto h-12 w-12 text-primary" /></div>}><RouteManagementContent /></Suspense>; }