'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Route, Search, GripVertical, MapPin, LoaderCircle, LogIn, LogOut, CheckCircle, AlertTriangle, Phone, User, PlusCircle, Download } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { updateRoute } from '@/lib/firebase/firestore';
import type { Client, RoutePlan, ClientInRoute } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { MapView } from '@/components/map-view';
import { isFinite } from 'lodash';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import * as XLSX from 'xlsx';
import { Timestamp, GeoPoint } from 'firebase/firestore';

type RouteClient = Client & ClientInRoute;

export default function RouteManagementPage() {
  const { user, clients: availableClients, routes: allRoutes, loading: authLoading, refetchData } = useAuth();
  
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [isRouteStarted, setIsRouteStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isRouteExpired, setIsRouteExpired] = useState(false);
  const [remainingTime, setRemainingTime] = useState({ hours: 0, minutes: 0, seconds: 0, expired: false });
  const [todayFormatted, setTodayFormatted] = useState('');
  
  const [currentRouteClientsFull, setCurrentRouteClientsFull] = useState<ClientInRoute[]>([]);
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number} | null>(null);
  const [isClientMapOpen, setIsClientMapOpen] = useState(false);
  const [clientForMap, setClientForMap] = useState<Client | null>(null);
  const { toast } = useToast();
  
  const [activeClient, setActiveClient] = useState<RouteClient | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [visitType, setVisitType] = useState<'presencial' | 'telefonica' | undefined>();
  const [callObservation, setCallObservation] = useState('');

  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [dialogSearchTerm, setDialogSearchTerm] = useState('');

  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<'checkIn' | 'checkOut' | null>(null);
  const [currentTime, setCurrentTime] = useState('');

  // Claves de persistencia corregidas
  const SELECTION_KEY = user ? `mgmt_selected_route_${user.id}` : null;
  const DRAFT_KEY = (rid: string, ruc: string) => user ? `mgmt_draft_${user.id}_${rid}_${ruc}` : null;

  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) return undefined;
    return allRoutes.find(r => r.id === selectedRouteId);
  }, [selectedRouteId, allRoutes]);
  
  useEffect(() => {
    setTodayFormatted(format(new Date(), "EEEE, d 'de' MMMM", { locale: es }));
  }, []);

  useEffect(() => {
    if (!authLoading && SELECTION_KEY) {
      const savedId = localStorage.getItem(SELECTION_KEY);
      if (savedId && allRoutes.some(r => r.id === savedId)) {
        handleRouteSelect(savedId);
      }
    }
  }, [authLoading, SELECTION_KEY, allRoutes]);

  useEffect(() => {
    if (selectedRoute) {
        setCurrentRouteClientsFull(selectedRoute.clients);
        if (['En Progreso', 'Incompleta'].includes(selectedRoute.status)) {
          setIsRouteStarted(true);
        } else {
          setIsRouteStarted(false);
        }
    } else {
        setCurrentRouteClientsFull([]);
        setIsRouteStarted(false);
    }
  }, [selectedRoute]);
  
  const routeClients = useMemo(() => {
    return currentRouteClientsFull
        .filter(c => {
            if (c.status === 'Eliminado') return false;
            const cDate = c.date instanceof Timestamp ? c.date.toDate() : c.date;
            return cDate ? isToday(cDate) : false;
        })
        .map(c => {
            const details = availableClients.find(ac => ac.ruc === c.ruc);
            return {
                ...(details || {}),
                ...c,
                valorVenta: String(c.valorVenta ?? ''),
                valorCobro: String(c.valorCobro ?? ''),
                devoluciones: String(c.devoluciones ?? ''),
                promociones: String(c.promociones ?? ''),
                medicacionFrecuente: String(c.medicacionFrecuente ?? ''),
            } as RouteClient;
        }).filter(c => c.id);
  }, [currentRouteClientsFull, availableClients]);

   useEffect(() => {
    const nextPending = routeClients.find(c => c.visitStatus !== 'Completado');
    if (nextPending) {
        if (!activeClient || activeClient.visitStatus === 'Completado' || activeClient.ruc !== nextPending.ruc) {
            setActiveClient(nextPending);
            if (selectedRouteId) {
                const key = DRAFT_KEY(selectedRouteId, nextPending.ruc);
                if (key) {
                    const saved = localStorage.getItem(key);
                    if (saved) {
                        try {
                            const draft = JSON.parse(saved);
                            setVisitType(draft.visitType);
                            setCallObservation(draft.callObservation || '');
                            setActiveClient(prev => prev ? { ...prev, ...draft } : null);
                        } catch (e) { console.error(e); }
                    } else {
                        setVisitType(undefined);
                        setCallObservation('');
                    }
                }
            }
        }
    } else {
        setActiveClient(null);
    }
  }, [routeClients, activeClient?.visitStatus, selectedRouteId]);

  useEffect(() => {
    if (activeClient && selectedRouteId && !activeClient.visitStatus) {
        const key = DRAFT_KEY(selectedRouteId, activeClient.ruc);
        if (key) {
            localStorage.setItem(key, JSON.stringify({
                visitType, callObservation,
                valorVenta: activeClient.valorVenta,
                valorCobro: activeClient.valorCobro,
                devoluciones: activeClient.devoluciones,
                promociones: activeClient.promociones,
                medicacionFrecuente: activeClient.medicacionFrecuente,
            }));
        }
    }
  }, [activeClient, visitType, callObservation, selectedRouteId]);

  const handleRouteSelect = (routeId: string) => {
      setSelectedRouteId(routeId);
      if (SELECTION_KEY) localStorage.setItem(SELECTION_KEY, routeId);
  }

  const handleStartRoute = async () => {
      if (!selectedRoute) return;
      setIsStarting(true);
      try {
          await updateRoute(selectedRoute.id, { status: 'En Progreso' });
          await refetchData('routes');
          setIsRouteStarted(true);
          toast({ title: "Ruta Iniciada" });
      } catch (error) { console.error(error); } finally { setIsStarting(false); }
  }

  const handleCheckIn = async () => {
    if (!selectedRoute || !activeClient) return;
    const time = format(new Date(), 'HH:mm:ss');
    const location = markerPosition ? new GeoPoint(markerPosition.lat, markerPosition.lng) : null;
    setIsSaving(true);
    try {
        const updated = currentRouteClientsFull.map(c => 
            c.ruc === activeClient.ruc ? { ...c, checkInTime: time, checkInLocation: location } : c
        );
        await updateRoute(selectedRoute.id, { clients: updated });
        await refetchData('routes');
        toast({ title: "Entrada Registrada" });
    } catch (error) { console.error(error); } finally { setIsSaving(true); }
  };

  const handleConfirmCheckOut = async () => {
    if (!selectedRoute || !activeClient || !visitType) return;
    setIsSaving(true);
    try {
        const time = format(new Date(), 'HH:mm:ss');
        const location = markerPosition ? new GeoPoint(markerPosition.lat, markerPosition.lng) : null;
        const updated = currentRouteClientsFull.map(c => {
            if (c.ruc === activeClient.ruc) {
                return { 
                    ...c, 
                    checkOutTime: time, checkOutLocation: location,
                    visitStatus: 'Completado' as const, visitType,
                    valorVenta: parseFloat(activeClient.valorVenta) || 0,
                    valorCobro: parseFloat(activeClient.valorCobro) || 0,
                    devoluciones: parseFloat(activeClient.devoluciones) || 0,
                    promociones: parseFloat(activeClient.promociones) || 0,
                    medicacionFrecuente: parseFloat(activeClient.medicacionFrecuente) || 0,
                    callObservation: visitType === 'telefonica' ? callObservation : undefined
                };
            }
            return c;
        });
        
        const allDone = updated.filter(c => c.status !== 'Eliminado').every(c => c.visitStatus === 'Completado');
        const todaysDone = updated.filter(c => c.status !== 'Eliminado' && isToday(c.date instanceof Timestamp ? c.date.toDate() : c.date!)).every(c => c.visitStatus === 'Completado');

        let newStatus = selectedRoute.status;
        if (allDone) newStatus = 'Completada';
        else if (todaysDone && newStatus === 'Incompleta') newStatus = 'En Progreso';

        await updateRoute(selectedRoute.id, { clients: updated, status: newStatus });
        await refetchData('routes');
        const key = DRAFT_KEY(selectedRoute.id, activeClient.ruc);
        if (key) localStorage.removeItem(key);
        toast({ title: "Salida Confirmada" });
    } catch(error) { console.error(error); } finally { setIsSaving(false); }
  }

  const onDragEnd = async (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || !selectedRoute) return;
    const items = Array.from(routeClients);
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);
    const updatedFull = currentRouteClientsFull.map(c => {
        const match = items.find(i => i.ruc === c.ruc);
        return match ? { ...c, ...match } : c;
    });
    setIsSaving(true);
    await updateRoute(selectedRoute.id, { clients: updatedFull });
    await refetchData('routes');
    setIsSaving(false);
  };

  return (
    <>
    <PageHeader title="Gestión de Ruta" description="Selecciona, inicia y gestiona tus rutas diarias."/>
    {!isRouteStarted ? (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Selecciona una Ruta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <Select onValueChange={handleRouteSelect} value={selectedRouteId}>
                    <SelectTrigger><Route className="mr-2 h-4 w-4" /><SelectValue placeholder="Elije una ruta para hoy" /></SelectTrigger>
                    <SelectContent>
                        {allRoutes.filter(r => r.createdBy === user?.id && ['Planificada', 'En Progreso', 'Incompleta'].includes(r.status))
                            .map(r => {
                                const d = r.date instanceof Timestamp ? r.date.toDate() : r.date;
                                return <SelectItem key={r.id} value={r.id}>{r.routeName} - {format(d, 'dd/MM/yyyy')} ({r.status})</SelectItem>;
                            })
                        }
                    </SelectContent>
                </Select>
                {selectedRoute && <Button onClick={handleStartRoute} disabled={isStarting} className="w-full">Iniciar Gestión</Button>}
            </CardContent>
        </Card>
    ) : (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
            <CardHeader>
                <CardTitle>{selectedRoute?.routeName}</CardTitle>
                <CardDescription>Ruta en progreso.<br/><span className="text-primary font-bold">{todayFormatted}</span></CardDescription>
            </CardHeader>
            <CardContent>
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="clients">
                        {(provided) => (
                            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                                {routeClients.map((c, i) => (
                                    <Draggable key={c.ruc} draggableId={c.ruc} index={i} isDragDisabled={c.visitStatus === 'Completado'}>
                                        {(p) => (
                                            <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} className={cn("flex items-center justify-between p-2 bg-muted rounded-md", activeClient?.ruc === c.ruc && "border-primary border")}>
                                                <div className="flex items-center gap-2"><GripVertical className="h-4 w-4"/><span className="truncate">{c.nombre_comercial}</span></div>
                                                {c.visitStatus === 'Completado' && <CheckCircle className="h-4 w-4 text-green-500" />}
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>
            </CardContent>
        </Card>
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>{activeClient ? activeClient.nombre_comercial : 'Día Completado'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {activeClient ? (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div><h4 className="font-bold">1. Entrada</h4><p className="text-sm">{activeClient.checkInTime || 'Pendiente'}</p></div>
                                {!activeClient.checkInTime && <Button onClick={() => handleCheckIn()}>Marcar Entrada</Button>}
                            </div>
                            <div className={cn("space-y-4", !activeClient.checkInTime && "opacity-50 pointer-events-none")}>
                                <h4 className="font-bold">2. Tipo de Visita</h4>
                                <RadioGroup onValueChange={(v: any) => setVisitType(v)} value={visitType} className="flex gap-4">
                                    <Label className="flex items-center gap-2 border p-2 rounded-md"><RadioGroupItem value="presencial"/> Presencial</Label>
                                    <Label className="flex items-center gap-2 border p-2 rounded-md"><RadioGroupItem value="telefonica"/> Telefónica</Label>
                                </RadioGroup>
                                {visitType === 'telefonica' && <Textarea placeholder="Observación..." value={callObservation} onChange={e => setCallObservation(e.target.value)}/>}
                                <h4 className="font-bold">3. Gestión</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1"><Label>Venta ($)</Label><Input type="number" value={activeClient.valorVenta} onChange={e => handleClientValueChange(activeClient.ruc, 'valorVenta', e.target.value)}/></div>
                                    <div className="space-y-1"><Label>Cobro ($)</Label><Input type="number" value={activeClient.valorCobro} onChange={e => handleClientValueChange(activeClient.ruc, 'valorCobro', e.target.value)}/></div>
                                </div>
                                <Button onClick={() => handleConfirmCheckOut()} className="w-full" disabled={isSaving || !visitType}>Guardar y Finalizar Visita</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-12"><CheckCircle className="h-12 w-12 mx-auto text-green-500"/><p className="mt-4 font-bold">¡Todo listo por hoy!</p></div>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
    )}
    </>
  );
}
