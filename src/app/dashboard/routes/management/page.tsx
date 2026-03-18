
'use client';
import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Search, MapPin, LoaderCircle, LogIn, LogOut, CheckCircle, Phone, User, PlusCircle, PlayCircle, Trash2, MessageSquare, Users, ThumbsUp } from 'lucide-react';
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

const sanitizeClients = (clients: ClientInRoute[]): any[] => {
    return clients.map(c => {
        const cleaned: any = { ...c };
        if (c.date instanceof Date) cleaned.date = Timestamp.fromDate(c.date);
        const round = (v: any) => {
            if (v === undefined || v === null || v === '') return 0;
            const n = parseFloat(String(v).replace(',', '.'));
            return isNaN(n) ? 0 : Math.round(n * 100) / 100;
        };
        cleaned.valorVenta = round(c.valorVenta);
        cleaned.valorCobro = round(c.valorCobro);
        cleaned.devoluciones = round(c.devoluciones);
        if (c.checkInLocation && (c.checkInLocation as any).latitude) {
            cleaned.checkInLocation = new GeoPoint((c.checkInLocation as any).latitude, (c.checkInLocation as any).longitude);
        }
        return cleaned;
    });
};

type RouteClient = ClientInRoute & { originalIndex: number; id: string; direccion: string };

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

  const selectedRoute = useMemo(() => allRoutes.find(r => r.id === (selectedRouteId || searchParams.get('routeId'))), [selectedRouteId, allRoutes, searchParams]);

  useEffect(() => {
    if (!selectedRoute || Date.now() - lastLocalUpdate.current < 10000) return;
    setCurrentRouteClientsFull(selectedRoute.clients || []);
    setIsRouteStarted(selectedRoute.status === 'En Progreso' || isAdmin);
  }, [selectedRoute, isAdmin]);

  const routeClients = useMemo(() => {
    return currentRouteClientsFull
        .map((c, index) => ({ ...c, originalIndex: index }))
        .filter(c => c.status !== 'Eliminado' && c.date && isToday(c.date instanceof Timestamp ? c.date.toDate() : new Date(c.date as any)))
        .map(c => {
            const details = availableClients.find(ac => String(ac.ruc).trim() === String(c.ruc).trim());
            return { ...c, id: details?.id || c.ruc, direccion: details?.direccion || 'N/A' };
        });
  }, [currentRouteClientsFull, availableClients]);

  const isTodayCompleted = useMemo(() => routeClients.length > 0 && routeClients.every(c => c.visitStatus === 'Completado'), [routeClients]);
  const activeClient = useMemo(() => activeOriginalIndex !== null ? routeClients.find(c => c.originalIndex === activeOriginalIndex) : null, [routeClients, activeOriginalIndex]);

  const handleFieldChange = (field: keyof ClientInRoute, value: any) => {
    if (activeOriginalIndex === null || (activeClient?.visitStatus === 'Completado' && !isAdmin) || isSaving) return;
    lastLocalUpdate.current = Date.now();
    const next = currentRouteClientsFull.map((c, idx) => idx === activeOriginalIndex ? { ...c, [field]: value } : c);
    setCurrentRouteClientsFull(next);
    if (selectedRoute) updateRoute(selectedRoute.id, { clients: sanitizeClients(next) }).catch(console.error);
  };

  const handleCheckIn = async () => {
    if (!selectedRoute || activeOriginalIndex === null || isSaving) return;
    setIsSaving(true);
    lastLocalUpdate.current = Date.now();
    const loc = await new Promise<any>(res => navigator.geolocation.getCurrentPosition(p => res({ latitude: p.coords.latitude, longitude: p.coords.longitude }), () => res(null)));
    const next = currentRouteClientsFull.map((c, idx) => idx === activeOriginalIndex ? { ...c, checkInTime: format(new Date(), 'HH:mm:ss'), checkInLocation: loc } : c);
    await updateRoute(selectedRoute.id, { clients: sanitizeClients(next) });
    setCurrentRouteClientsFull(next);
    setIsSaving(false);
    toast({ title: "Entrada Registrada" });
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedRoute || activeOriginalIndex === null || isSaving) return;
    if (activeClient?.visitType === 'telefonica' && !activeClient.callObservation?.trim()) return toast({ title: "Observación requerida", variant: "destructive" });
    setIsSaving(true);
    lastLocalUpdate.current = Date.now();
    const next = currentRouteClientsFull.map((c, idx) => idx === activeOriginalIndex ? { ...c, checkOutTime: format(new Date(), 'HH:mm:ss'), visitStatus: 'Completado' } : c);
    const allDone = next.filter(c => c.status !== 'Eliminado').every(c => c.visitStatus === 'Completado');
    await updateRoute(selectedRoute.id, { clients: sanitizeClients(next), status: allDone ? 'Completada' : 'En Progreso' });
    setCurrentRouteClientsFull(next);
    if (!isAdmin) setActiveOriginalIndex(null);
    setIsSaving(false);
    refetchData('routes');
    toast({ title: "Visita Finalizada" });
  };

  const handleRemoveClient = async (idx: number) => {
    if (!selectedRoute || !isAdmin) return;
    setIsSaving(true);
    lastLocalUpdate.current = Date.now();
    const next = currentRouteClientsFull.map((c, i) => i === idx ? { ...c, status: 'Eliminado' } : c);
    await updateRoute(selectedRoute.id, { clients: sanitizeClients(next) });
    setCurrentRouteClientsFull(next);
    setIsSaving(false);
    toast({ title: "Cliente eliminado" });
  };

  const handleAddClients = async () => {
    if (!selectedRoute || multiSelectedClients.length === 0) return;
    setIsSaving(true);
    const newOnes: ClientInRoute[] = multiSelectedClients.map(c => ({
        ruc: c.ruc, nombre_comercial: c.nombre_comercial, date: new Date(), visitStatus: 'Pendiente', status: 'Activo', isReadded: true, reAdditionObservation
    }));
    const next = [...currentRouteClientsFull, ...newOnes];
    await updateRoute(selectedRoute.id, { clients: sanitizeClients(next) });
    setCurrentRouteClientsFull(next);
    setIsAddClientDialogOpen(false);
    setMultiSelectedClients([]);
    setIsSaving(false);
    toast({ title: "Clientes añadidos" });
  };

  if (authLoading) return <div className="p-20 text-center"><LoaderCircle className="animate-spin mx-auto h-12 w-12" /></div>;

  return (
    <>
    <PageHeader title="Gestión de Ruta" description="Control diario de visitas." />
    {!isRouteStarted ? (
        <Card className="max-w-md mx-auto shadow-xl">
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
                {selectedRoute && <Button className="w-full font-black" onClick={() => updateRoute(selectedRoute.id, { status: 'En Progreso' }).then(() => setIsRouteStarted(true))}>INICIAR</Button>}
            </CardContent>
        </Card>
    ) : isTodayCompleted && !isAdmin ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center bg-white rounded-3xl shadow-xl p-10 border-4 border-green-50">
            <div className="bg-green-100 p-8 rounded-full mb-6 animate-bounce"><ThumbsUp className="h-16 w-16 text-green-600" /></div>
            <h2 className="text-3xl font-black text-green-700 uppercase mb-4">¡Jornada de hoy completada!</h2>
            <Button className="font-black px-10 h-12 rounded-xl" onClick={() => router.push('/dashboard')}>VOLVER AL PANEL</Button>
        </div>
    ) : (
        <div className="grid lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1 shadow-md">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-center"><CardTitle className="text-sm font-black uppercase">Visitas de Hoy</CardTitle><Badge className="bg-primary">{routeClients.filter(c => c.visitStatus === 'Completado').length} / {routeClients.length}</Badge></div>
                    <Progress value={(routeClients.filter(c => c.visitStatus === 'Completado').length / (routeClients.length || 1)) * 100} className="h-1.5 mt-2" />
                </CardHeader>
                <CardContent className="px-2 space-y-2">
                    <Button variant="outline" className="w-full text-[10px] font-black h-8 border-dashed" onClick={() => setIsAddClientDialogOpen(true)}><PlusCircle className="mr-2 h-3 w-3" /> AÑADIR CLIENTE</Button>
                    <div className="space-y-1">
                        {routeClients.map((c, i) => (
                            <div key={c.originalIndex} onClick={() => (!activeClient?.checkInTime || activeClient.checkOutTime || isAdmin) && setActiveOriginalIndex(c.originalIndex)} className={cn("flex items-center justify-between p-3 border-2 rounded-xl cursor-pointer transition-all", activeOriginalIndex === c.originalIndex ? "border-primary bg-primary/5" : "border-transparent bg-muted/20", c.visitStatus === 'Completado' && !isAdmin && "opacity-40 grayscale")}>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2"><p className="font-black text-xs truncate uppercase">{c.nombre_comercial}</p>{c.isReadded && <Badge className="text-[8px] h-3 px-1 bg-orange-50 text-orange-700">RE-ADICIÓN</Badge>}</div>
                                    <p className="text-[9px] font-mono text-muted-foreground">{c.ruc}</p>
                                </div>
                                <div className="flex items-center gap-1">
                                    {isAdmin && <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); handleRemoveClient(c.originalIndex); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
                                    {c.visitStatus === 'Completado' && <CheckCircle className="h-4 w-4 text-green-500" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
            <div className="lg:col-span-2">
                <Card className="shadow-2xl border-t-4 border-t-primary min-h-[500px]">
                    <CardHeader className="bg-muted/10 h-32 flex flex-col justify-center">
                        {activeClient ? (
                            <div className="space-y-1"><h3 className="text-xl font-black text-primary uppercase">{activeClient.nombre_comercial}</h3><p className="text-[10px] font-bold text-muted-foreground uppercase">{activeClient.direccion}</p></div>
                        ) : <div className="text-center text-muted-foreground uppercase font-black opacity-30">Selecciona un cliente</div>}
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">
                        {activeClient && (
                            <>
                            <div className={cn("p-6 rounded-2xl border-2 transition-all", activeClient.checkInTime ? "bg-green-50 border-green-200" : "bg-muted/20 border-dashed")}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4"><LogIn className={cn("h-8 w-8", activeClient.checkInTime ? "text-green-600" : "text-muted-foreground")} /><div><h4 className="font-black text-xs uppercase">Entrada</h4><p className="text-[9px] font-bold text-muted-foreground">{activeClient.checkInTime || 'Pendiente'}</p></div></div>
                                    {!activeClient.checkInTime && <Button onClick={handleCheckIn} className="font-black h-10 px-6">MARCAR ENTRADA</Button>}
                                </div>
                            </div>
                            <div className={cn("space-y-6 transition-opacity", !activeClient.checkInTime && !isAdmin && "opacity-20 pointer-events-none")}>
                                <RadioGroup onValueChange={v => handleFieldChange('visitType', v)} value={activeClient.visitType} className="grid grid-cols-2 gap-4">
                                    <Label className={cn("flex flex-col items-center gap-2 border-2 p-4 rounded-xl cursor-pointer", activeClient.visitType === 'presencial' ? "border-primary bg-primary/5" : "border-transparent bg-muted/10")}><RadioGroupItem value="presencial" className="sr-only" /><MapPin className="h-6 w-6" /><span className="text-[10px] font-black uppercase">Presencial</span></Label>
                                    <Label className={cn("flex flex-col items-center gap-2 border-2 p-4 rounded-xl cursor-pointer", activeClient.visitType === 'telefonica' ? "border-primary bg-primary/5" : "border-transparent bg-muted/10")}><RadioGroupItem value="telefonica" className="sr-only" /><Phone className="h-6 w-6" /><span className="text-[10px] font-black uppercase">Telefónica</span></Label>
                                </RadioGroup>
                                {activeClient.visitType === 'telefonica' && <div className="space-y-2"><Label className="text-[10px] font-black uppercase text-primary">Observación Obligatoria</Label><Textarea placeholder="Detalles de la llamada..." className="h-24 font-bold text-xs" value={activeClient.callObservation || ''} onChange={e => handleFieldChange('callObservation', e.target.value)} /></div>}
                                <div className="grid grid-cols-3 gap-4">
                                    {['valorVenta', 'valorCobro', 'devoluciones'].map(f => (
                                        <div key={f} className="space-y-1"><Label className="text-[9px] font-black uppercase">{f.replace('valor', '')}</Label><Input type="text" className="h-12 text-lg font-black text-primary" placeholder="0.00" value={activeClient[f as keyof ClientInRoute] ?? ''} onChange={e => handleFieldChange(f as any, e.target.value)} /></div>
                                    ))}
                                </div>
                                <Button onClick={handleConfirmCheckOut} className="w-full h-16 text-lg font-black rounded-2xl shadow-xl" disabled={isSaving || (activeClient.visitStatus === 'Completado' && !isAdmin) || !activeClient.visitType || (activeClient.visitType === 'telefonica' && !activeClient.callObservation?.trim())}>
                                    {isSaving ? <LoaderCircle className="animate-spin h-6 w-6" /> : <LogOut className="mr-2 h-6 w-6" />} {activeClient.visitStatus === 'Completado' ? 'ACTUALIZAR GESTIÓN' : 'FINALIZAR VISITA'}
                                </Button>
                            </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )}
    <Dialog open={isAddClientDialogOpen} onOpenChange={setIsAddClientDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
            <DialogHeader><DialogTitle className="text-xl font-black uppercase">Añadir Clientes</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
                <Input placeholder="Buscar por RUC o Nombre..." value={addClientSearchTerm} onChange={e => setAddClientSearchTerm(e.target.value)} className="h-10 font-bold" />
                <ScrollArea className="h-64 border rounded-xl p-2">
                    {availableClients.filter(c => c.nombre_cliente.toLowerCase().includes(addClientSearchTerm.toLowerCase())).map(c => (
                        <div key={c.ruc} onClick={() => setMultiSelectedClients(prev => prev.some(s => s.ruc === c.ruc) ? prev.filter(s => s.ruc !== c.ruc) : [...prev, c])} className={cn("p-3 rounded-lg flex items-center gap-3 cursor-pointer mb-1", multiSelectedClients.some(s => s.ruc === c.ruc) ? "bg-primary/10 border-primary" : "hover:bg-muted")}>
                            <Checkbox checked={multiSelectedClients.some(s => s.ruc === c.ruc)} />
                            <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase truncate">{c.nombre_comercial}</p><p className="text-[9px] font-mono text-muted-foreground">{c.ruc}</p></div>
                        </div>
                    ))}
                </ScrollArea>
                <div className="space-y-1"><Label className="text-[10px] font-black uppercase">Motivo de Re-adición</Label><Textarea className="h-20 text-xs font-bold" value={reAdditionObservation} onChange={e => setReAdditionObservation(e.target.value)} /></div>
            </div>
            <DialogFooter><Button onClick={handleAddClients} disabled={multiSelectedClients.length === 0 || isSaving} className="w-full font-black">AÑADIR SELECCIONADOS</Button></DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}

export default function RouteManagementPage() { return <Suspense fallback={<div className="p-20 text-center">Cargando...</div>}><RouteManagementContent /></Suspense>; }
