'use client';
import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar as CalendarIcon, Users, LoaderCircle, Trash2, ThumbsDown, LifeBuoy, AlertTriangle } from 'lucide-react';
import { getRoute, updateRoute } from '@/lib/firebase/firestore';
import { getPredicciones } from '@/services/api';
import type { User, RoutePlan, ClientInRoute } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogHeader, 
  AlertDialogContent, 
  AlertDialogTitle, 
  AlertDialogDescription, 
  AlertDialogFooter 
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

const ensureDate = (d: any): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (d && typeof d.toDate === 'function') return d.toDate();
  const date = new Date(d);
  return isNaN(date.getTime()) ? new Date() : date;
};

export default function EditRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: routeId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser, users, loading: authLoading, refetchData } = useAuth();

  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [clientsInRoute, setClientsInRoute] = useState<ClientInRoute[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  
  const [calendarOpen, setCalendarOpen] = useState<{[key: string]: boolean}>({});
  const [clientToRemove, setClientToRemove] = useState<ClientInRoute | null>(null);
  const [removalObservation, setRemovalObservation] = useState('');

  const canEdit = useMemo(() => {
    if (!currentUser || !route) return false;
    if (currentUser.role === 'Administrador' && route.status !== 'Completada') return true;
    const isOwner = currentUser.id === route.createdBy;
    return isOwner && (route.status === 'Planificada' || route.status === 'Rechazada' || route.status === 'En Progreso');
  }, [currentUser, route]);

  const canApprove = useMemo(() => {
     if (!currentUser || !route) return false;
     return (currentUser.role === 'Administrador' || currentUser.id === route.supervisorId) && route.status === 'Pendiente de Aprobación';
  }, [currentUser, route]);

  const canRecoverClients = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'Administrador' || currentUser.permissions?.includes('recover-clients') || false;
  }, [currentUser]);

  useEffect(() => {
    const fetchRouteData = async () => {
      setLoading(true);
      try {
        const routeData = await getRoute(routeId);
        if (routeData) {
          setRoute(routeData);
          setClientsInRoute(routeData.clients || []);
        } else {
          notFound();
        }
      } catch (error) {
        toast({ title: "Error", description: "No se pudo cargar la ruta.", variant: "destructive" });
        notFound();
      } finally {
        setLoading(false);
      }
    };
    if (routeId) fetchRouteData();
  }, [routeId, toast]);
  
  useEffect(() => {
      if (users) setSupervisors(users.filter(u => u.role === 'Supervisor'));
  }, [users]);

  const handleInputChange = <K extends keyof RoutePlan>(field: K, value: RoutePlan[K]) => {
    setRoute(prev => (prev ? { ...prev, [field]: value } : null));
  };
  
  const handleClientValueChange = useCallback((ruc: string, field: keyof Omit<ClientInRoute, 'ruc' | 'nombre_comercial'>, value: any) => {
      setClientsInRoute(prev => 
          prev.map(client => 
              client.ruc === ruc 
                  ? { ...client, [field]: value }
                  : client
          )
      );
  }, []);

  const handleRecoverClients = async () => {
    if (!route) return;
    setIsRecovering(true);
    try {
        const execMatch = route.routeName.match(/para (.*?) -/);
        const ejecutivo = execMatch ? execMatch[1] : '';
        const dateObj = ensureDate(route.date);
        const fecha_inicio = format(dateObj, 'yyyy-MM-dd');

        const predictions = await getPredicciones({ ejecutivo, fecha_inicio, dias: 7 });

        if (predictions.length === 0) {
            toast({ title: "Sin respaldo", description: "No hay predicciones para esta fecha.", variant: "destructive" });
            return;
        }

        const recovered: ClientInRoute[] = predictions.map(p => ({
            ruc: (p as any).ruc || (p as any).RUC || (p as any).cliente_id,
            nombre_comercial: (p as any).nombre_comercial || (p as any).Cliente || 'Cliente Recuperado',
            date: p.fecha_predicha ? new Date(p.fecha_predicha + 'T00:00:00') : dateObj,
            valorVenta: parseFloat(String(p.ventas)) || 0,
            valorCobro: parseFloat(String(p.cobros)) || 0,
            status: 'Activo',
            visitStatus: 'Pendiente'
        }));

        setClientsInRoute(recovered);
        toast({ title: "Recuperación Exitosa" });
    } catch (error) {
        toast({ title: "Error de Recuperación", variant: "destructive" });
    } finally {
        setIsRecovering(false);
    }
  };

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!route || !currentUser) return;
    setIsSaving(true);
    try {
      const supervisor = supervisors.find(s => s.id === route.supervisorId);
      const sanitizedClients = clientsInRoute.map(c => ({
        ...c,
        valorVenta: parseFloat(String(c.valorVenta)) || 0,
        valorCobro: parseFloat(String(c.valorCobro)) || 0,
        date: c.date ? Timestamp.fromDate(ensureDate(c.date)) : null
      }));

      await updateRoute(routeId, {
        ...route,
        supervisorName: supervisor?.name || route.supervisorName,
        clients: sanitizedClients,
        date: Timestamp.fromDate(ensureDate(route.date)),
      });
      await refetchData('routes');
      toast({ title: 'Éxito', description: `Ruta actualizada.` });
    } catch (error) {
      toast({ title: 'Error al actualizar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmRemoval = () => {
    if (!clientToRemove || !removalObservation.trim()) return;
    setClientsInRoute(prev => prev.map(c => 
        c.ruc === clientToRemove.ruc ? { ...c, status: 'Eliminado', removalObservation: removalObservation } : c
    ));
    setClientToRemove(null);
    setRemovalObservation('');
  };
  
  const activeClientsWithIndex = useMemo(() => 
    clientsInRoute
      .map((c, i) => ({...c, originalIndex: i})) 
      .filter(c => c.status !== 'Eliminado')
      .map((c, i) => ({...c, globalIndex: i}))
  , [clientsInRoute]);

  const groupedClients = useMemo(() => {
    const groups: { [date: string]: typeof activeClientsWithIndex } = {};
    activeClientsWithIndex.forEach(client => {
        const dateObj = ensureDate(client.date);
        const key = dateObj && !isNaN(dateObj.getTime()) ? format(dateObj, 'yyyy-MM-dd') : 'Sin Fecha';
        if (!groups[key]) groups[key] = [];
        groups[key].push(client);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [activeClientsWithIndex]);

  if (loading || authLoading) return <Skeleton className="h-96 w-full" />;
  if (!route) return notFound();
  const isFormDisabled = isSaving || !canEdit || isRecovering;
  
  return (
    <>
      <PageHeader title={canApprove ? "Revisar Ruta" : "Detalles de la Ruta"} description="Gestión de paradas y cronograma.">
        <Link href="/dashboard/routes"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button></Link>
      </PageHeader>

      {route.status === 'Rechazada' && (
        <Alert variant="destructive" className="mb-6">
          <ThumbsDown className="h-4 w-4" />
          <AlertTitle>Ruta Rechazada</AlertTitle>
          <AlertDescription>{route.supervisorObservation || 'Sin observaciones.'}</AlertDescription>
        </Alert>
      )}

      {activeClientsWithIndex.length === 0 && canRecoverClients && (
          <Alert className="mb-6 border-blue-500 bg-blue-50">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 font-bold">Ruta sin Clientes</AlertTitle>
              <AlertDescription className="flex items-center justify-between gap-4 mt-2">
                  <span className="text-blue-700">Puedes restaurar los clientes de la predicción original aquí.</span>
                  <Button onClick={handleRecoverClients} disabled={isRecovering} className="bg-blue-600 hover:bg-blue-700 shrink-0 font-bold">
                      {isRecovering ? <LoaderCircle className="animate-spin mr-2" /> : <LifeBuoy className="mr-2" />} RECUPERAR
                  </Button>
              </AlertDescription>
          </Alert>
      )}

      <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Información General</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                    <Label>Nombre de la Ruta</Label>
                    <Input value={route.routeName} onChange={(e) => handleInputChange('routeName', e.target.value)} disabled={isFormDisabled} />
                </div>
                <div className="space-y-2">
                    <Label>Supervisor</Label>
                    <Select value={route.supervisorId} onValueChange={(v) => handleInputChange('supervisorId', v)} disabled={isFormDisabled}>
                        <SelectTrigger><Users className="mr-2 h-4 w-4" /><SelectValue placeholder="Asignar" /></SelectTrigger>
                        <SelectContent>{supervisors.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2"><Label>Estado</Label><Badge variant="outline" className="h-10 w-full flex items-center justify-center font-black uppercase">{route.status}</Badge></div>
            </CardContent>
          </Card>

          <Card>
              <CardHeader><CardTitle>Visitas (Lunes a Viernes)</CardTitle></CardHeader>
              <CardContent>
                  <div className="space-y-4">
                      {groupedClients.map(([date, clientsInGroup]) => (
                          <Collapsible key={date} defaultOpen className="border-l-4 pl-4 py-2 border-primary/20 bg-muted/5 rounded-r-lg">
                              <CollapsibleTrigger asChild>
                                  <div className="flex w-full items-center justify-between p-2 cursor-pointer hover:bg-muted/50 transition-all">
                                      <div className="flex items-center gap-3">
                                          <CalendarIcon className="h-5 w-5 text-primary" />
                                          <h4 className="font-black text-sm uppercase tracking-tighter">
                                              {date === 'Sin Fecha' ? 'Sin Fecha' : format(new Date(date + 'T00:00:00'), 'EEEE, dd \'de\' MMMM', { locale: es })}
                                          </h4>
                                          <Badge variant="secondary" className="font-black">{clientsInGroup.length}</Badge>
                                      </div>
                                  </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-4 p-2 mt-2">
                                  {clientsInGroup.map((client) => (
                                      <Card key={client.ruc} className="p-4 relative hover:shadow-md border-l-2 border-l-primary/10">
                                          <div className="flex justify-between items-start">
                                              <div className="space-y-1">
                                                  <p className="font-bold text-sm text-primary uppercase">{client.globalIndex + 1}. {client.nombre_comercial}</p>
                                                  <p className="text-[10px] font-mono text-muted-foreground uppercase">{client.ruc}</p>
                                              </div>
                                              <Button type="button" variant="ghost" size="icon" onClick={() => setClientToRemove(client)} disabled={isFormDisabled}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                          </div>
                                          <Separator className="my-3" />
                                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                              <div className="space-y-1">
                                                  <Label className="text-[10px] uppercase font-black">Fecha</Label>
                                                  <Popover open={calendarOpen[client.ruc]} onOpenChange={(o) => setCalendarOpen(p => ({ ...p, [client.ruc]: o }))}>
                                                      <PopoverTrigger asChild><Button variant="outline" className="w-full justify-start h-9 text-xs font-bold" disabled={isFormDisabled}><CalendarIcon className="mr-2 h-3 w-3" />{client.date ? format(ensureDate(client.date), 'dd/MM/yyyy') : 'Sin Fecha'}</Button></PopoverTrigger>
                                                      <PopoverContent className="p-0" align="start"><Calendar mode="single" selected={ensureDate(client.date)} onSelect={(d) => handleClientValueChange(client.ruc, 'date', d)} locale={es} /></PopoverContent>
                                                  </Popover>
                                              </div>
                                              <div className="space-y-1"><Label className="text-[10px] uppercase font-black">Venta ($)</Label><Input type="number" className="h-9 text-xs font-bold" value={client.valorVenta ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'valorVenta', e.target.value)} disabled={isFormDisabled} /></div>
                                              <div className="space-y-1"><Label className="text-[10px] uppercase font-black">Cobro ($)</Label><Input type="number" className="h-9 text-xs font-bold" value={client.valorCobro ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'valorCobro', e.target.value)} disabled={isFormDisabled} /></div>
                                          </div>
                                      </Card>
                                  ))}
                              </CollapsibleContent>
                          </Collapsible>
                      ))}
                  </div>
              </CardContent>
          </Card>

          <div className="flex justify-end p-4 bg-background sticky bottom-0 border-t z-10 shadow-lg">
              {canEdit && <Button type="button" onClick={handleUpdateRoute} disabled={isFormDisabled} className="font-black px-8"> {isSaving && <LoaderCircle className="animate-spin mr-2" />} GUARDAR CAMBIOS</Button>}
          </div>
      </div>

      <AlertDialog open={!!clientToRemove} onOpenChange={() => setClientToRemove(null)}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>¿Quitar cliente?</AlertDialogTitle></AlertDialogHeader>
             <div className="py-4 space-y-2">
                <Label className="font-bold uppercase text-[10px]">Motivo</Label>
                <Textarea value={removalObservation} onChange={(e) => setRemovalObservation(e.target.value)} placeholder="Ej: Negocio cerrado..." />
            </div>
            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleConfirmRemoval} className="bg-destructive hover:bg-destructive/90 font-bold">CONFIRMAR</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}