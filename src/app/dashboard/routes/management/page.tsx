
'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, MapPin, LoaderCircle, LogIn, LogOut, Phone, CirclePlus, AlertTriangle, ThumbsUp, Users as UsersIcon, Clock, Sparkles, MessageSquare, Trash2, ArrowLeft } from 'lucide-react';
import { updateRoute } from '@/lib/firebase/firestore';
import type { Client, ClientInRoute, RoutePlan } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Timestamp, GeoPoint, onSnapshot, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
        const isActuallyFinished = !!c.checkOutTime;
        const cleaned: any = { 
            ruc: String(c.ruc || ''),
            nombre_comercial: String(c.nombre_comercial || 'Sin Nombre'),
            visitStatus: isActuallyFinished ? 'Completado' : 'Pendiente',
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
  const { user, clients: availableClients, routes: allRoutes, users: allUsers, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>(searchParams.get('routeId') || undefined);
  const [routeOverride, setRouteOverride] = useState<RoutePlan | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');
  const [activeOriginalIndex, setActiveOriginalIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [addClientSearchTerm, setAddClientSearchTerm] = useState('');
  const [multiSelectedClients, setMultiSelectedClients] = useState<Client[]>([]);
  const [reAdditionObservation, setReAdditionObservation] = useState('');
  const [isExpired, setIsExpired] = useState(false);

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

  const handleCheckIn = () => {
    if (!selectedRoute || activeOriginalIndex === null || clientInManagement) return;
    setIsSaving(true);
    const timeStr = format(new Date(), 'HH:mm:ss');
    const proceed = (coords?: {lat: number, lng: number}) => {
        const next = [...selectedRoute.clients];
        next[activeOriginalIndex] = { ...next[activeOriginalIndex], checkInTime: timeStr, checkInLocation: coords ? new GeoPoint(coords.lat, coords.lng) : null };
        updateRoute(selectedRoute.id, { clients: sanitizeClients(next), status: 'En Progreso' }).finally(() => setIsSaving(false));
    };
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => proceed({ lat: p.coords.latitude, lng: p.coords.longitude }), () => proceed());
    else proceed();
  };

  const handleCheckOut = () => {
    if (!selectedRoute || activeOriginalIndex === null || isPresencialMissingObs) return;
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
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => proceed({ lat: p.coords.latitude, lng: p.coords.longitude }), () => proceed());
    else proceed();
  };

  if (authLoading) return <div className="p-20 text-center"><LoaderCircle className="animate-spin h-10 mx-auto" /></div>;

  return (
    <div className="flex flex-col gap-6">
        <PageHeader title="Gestión de Jornada" />
        {isExpired && !isAdmin && <Alert variant="destructive" className="mb-4"><AlertTriangle /><AlertTitle>Jornada Bloqueada</AlertTitle><AlertDescription>El horario de edición ha concluido.</AlertDescription></Alert>}
        
        {!selectedRoute ? (
            <Card className="max-w-md mx-auto"><CardHeader><CardTitle className="text-center uppercase">Activar mi Jornada</CardTitle></CardHeader><CardContent className="space-y-4">
                <Select value={selectedRouteId} onValueChange={setSelectedRouteId}><SelectTrigger className="h-12 font-black"><Route className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccionar Plan de Ruta" /></SelectTrigger><SelectContent>{allRoutes.filter(r => ['Planificada', 'En Progreso'].includes(r.status) && (isAdmin || r.createdBy === user?.id)).map(r => <SelectItem key={r.id} value={r.id}>{r.routeName}</SelectItem>)}</SelectContent></Select>
                {selectedRouteId && <Button className="w-full h-12 font-black" onClick={() => updateRoute(selectedRouteId, { status: 'En Progreso' })}>INICIAR RUTA</Button>}
            </CardContent></Card>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className={cn("shadow-xl border-t-4 border-t-primary rounded-3xl", activeOriginalIndex !== null && "hidden lg:block")}>
                    <CardHeader className="bg-slate-50 border-b"><h2 className="text-lg font-black uppercase text-primary">{selectedRoute.routeName}</h2></CardHeader>
                    <CardContent className="p-4"><ScrollArea className="h-[60vh]"><div className="space-y-2">
                        {todaysClients.map(c => (
                            <div key={c.originalIndex} onClick={() => setActiveOriginalIndex(c.originalIndex)} className={cn("p-4 border-2 rounded-2xl cursor-pointer transition-all", activeOriginalIndex === c.originalIndex ? "border-primary bg-primary/5" : "border-slate-100")}>
                                <p className="font-black text-xs uppercase">{c.nombre_comercial}</p>
                                {c.visitStatus === 'Completado' && <Badge variant="success" className="text-[8px] mt-1">OK</Badge>}
                            </div>
                        ))}
                    </div></ScrollArea></CardContent>
                </Card>

                <Card className={cn("lg:col-span-2 shadow-xl border-t-4 border-t-primary rounded-3xl", activeOriginalIndex === null && "hidden lg:block")}>
                    <CardHeader className="bg-slate-50 border-b">
                        {activeClient && <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setActiveOriginalIndex(null)}><ArrowLeft /></Button>}
                        <CardTitle className="uppercase text-primary">{activeClient?.nombre_comercial || "Selecciona un cliente"}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        {activeClient ? (
                            <div className="space-y-6">
                                <div className={cn("p-6 rounded-2xl border-2 flex items-center justify-between", activeClient.checkInTime ? "bg-green-50 border-green-200" : "bg-slate-50 border-dashed")}>
                                    <div><p className="text-[10px] font-black uppercase text-slate-500">Llegada</p><p className="text-xl font-black">{activeClient.checkInTime || "--:--:--"}</p></div>
                                    {!activeClient.checkInTime && <Button onClick={handleCheckIn} disabled={isSaving || !!clientInManagement} className="font-black h-12 px-8 uppercase">Marcar Entrada</Button>}
                                </div>
                                <div className={cn("space-y-6", !activeClient.checkInTime && "opacity-20 pointer-events-none")}>
                                    <RadioGroup value={activeClient.visitType || undefined} onValueChange={v => { const next = [...selectedRoute.clients]; next[activeOriginalIndex!].visitType = v as any; updateRoute(selectedRoute.id, { clients: sanitizeClients(next) }); }} className="grid grid-cols-2 gap-4"><Label className={cn("flex flex-col items-center p-4 border-2 rounded-2xl cursor-pointer", activeClient.visitType === 'presencial' ? "border-primary bg-primary/5" : "bg-slate-50")}><RadioGroupItem value="presencial" className="sr-only" /><MapPin className="h-8 w-8 mb-2" /><span className="text-[10px] font-black uppercase">Presencial</span></Label><Label className={cn("flex flex-col items-center p-4 border-2 rounded-2xl cursor-pointer", activeClient.visitType === 'telefonica' ? "border-primary bg-primary/5" : "bg-slate-50")}><RadioGroupItem value="telefonica" className="sr-only" /><Phone className="h-8 w-8 mb-2" /><span className="text-[10px] font-black uppercase">Telefónica</span></Label></RadioGroup>
                                    <div className="space-y-4">
                                        <div className="space-y-2"><Label className={cn("text-[10px] font-black uppercase", isPresencialMissingObs && "text-red-600 animate-pulse")}>Observaciones {isPresencialMissingObs && "(OBLIGATORIA SI VALORES SON $0)"}</Label><Textarea value={localVisitObs} onChange={e => setLocalVisitObs(e.target.value)} className={cn("border-2", isPresencialMissingObs && "border-red-500")} placeholder="Motivo de la gestión..." /></div>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-1"><Label className="text-[8px] font-black text-center block">VENTA ($)</Label><Input value={localVenta} onChange={e => setLocalVenta(e.target.value)} className="h-12 font-black text-center text-primary" /></div>
                                            <div className="space-y-1"><Label className="text-[8px] font-black text-center block">COBRO ($)</Label><Input value={localCobro} onChange={e => setLocalCobro(e.target.value)} className="h-12 font-black text-center text-primary" /></div>
                                            <div className="space-y-1"><Label className="text-[8px] font-black text-center block">DEVOL ($)</Label><Input value={localDevol} onChange={e => setLocalDevol(e.target.value)} className="h-12 font-black text-center text-primary" /></div>
                                        </div>
                                    </div>
                                    <Button onClick={handleCheckOut} disabled={isSaving || isPresencialMissingObs || !activeClient.visitType} className="w-full h-14 text-lg font-black uppercase shadow-xl"><LogOut className="mr-2" /> Finalizar Gestión</Button>
                                </div>
                            </div>
                        ) : <div className="text-center py-20 opacity-20 font-black text-lg">SELECCIONA UN CLIENTE</div>}
                    </CardContent>
                </Card>
            </div>
        )}
    </div>
  );
}

export default function RouteManagementPage() { return <Suspense fallback={<div className="p-20 text-center"><LoaderCircle className="animate-spin mx-auto h-12 w-12 text-primary" /></div>}><RouteManagementContent /></Suspense>; }
