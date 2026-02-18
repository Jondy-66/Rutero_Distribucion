'use client';
import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar as CalendarIcon, Users, LoaderCircle, Trash2, ThumbsDown, LifeBuoy, AlertTriangle, CheckCircle, XCircle, MessageSquare } from 'lucide-react';
import { getRoute, updateRoute, addNotification } from '@/lib/firebase/firestore';
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
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

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

  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // States for Removal Observation
  const [isRemovalDialogOpen, setIsRemovalDialogOpen] = useState(false);
  const [removalReason, setRemovalReason] = useState('');
  const [rucToToRemove, setRucToToRemove] = useState<string | null>(null);

  const canEdit = useMemo(() => {
    if (!currentUser || !route) return false;
    if (currentUser.role === 'Administrador' && route.status !== 'Completada') return true;
    const isOwner = currentUser.id === route.createdBy;
    return isOwner && (route.status === 'Planificada' || route.status === 'Rechazada' || route.status === 'En Progreso');
  }, [currentUser, route]);

  const canApprove = useMemo(() => {
     if (!currentUser || !route) return false;
     const isPending = route.status === 'Pendiente de Aprobación';
     const isAuthAdmin = currentUser.role === 'Administrador';
     const isMyRouteAsSupervisor = currentUser.id === route.supervisorId;
     return isPending && (isAuthAdmin || isMyRouteAsSupervisor);
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

  const handleOpenRemovalDialog = (ruc: string) => {
    setRucToToRemove(ruc);
    setRemovalReason('');
    setIsRemovalDialogOpen(true);
  };

  const confirmRemoval = () => {
    if (!rucToToRemove || !removalReason.trim()) {
        toast({ title: "Motivo requerido", description: "Debes indicar por qué eliminas este cliente.", variant: "destructive" });
        return;
    }
    setClientsInRoute(prev => prev.map(c => 
        c.ruc === rucToToRemove ? { ...c, status: 'Eliminado', removalObservation: removalReason } : c
    ));
    setIsRemovalDialogOpen(false);
    setRucToToRemove(null);
    toast({ title: "Cliente eliminado", description: "Se ha registrado el motivo de la eliminación." });
  };

  const handleApprove = async () => {
    if (!route || !currentUser) return;
    setIsSaving(true);
    try {
      await updateRoute(routeId, { 
        status: 'Planificada',
        supervisorObservation: 'Ruta aprobada.'
      });
      
      await addNotification({
        userId: route.createdBy,
        title: 'Ruta Aprobada',
        message: `Tu ruta "${route.routeName}" ha sido aprobada.`,
        link: `/dashboard/routes/${routeId}`
      });

      await refetchData('routes');
      toast({ title: 'Éxito', description: 'La ruta ha sido aprobada.' });
      router.push('/dashboard/team-routes');
    } catch (error) {
      toast({ title: 'Error al aprobar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!route || !currentUser || !rejectionReason.trim()) {
        toast({ title: "Motivo requerido", description: "Por favor indica por qué rechazas la ruta.", variant: "destructive" });
        return;
    }
    setIsSaving(true);
    try {
      await updateRoute(routeId, { 
        status: 'Rechazada',
        supervisorObservation: rejectionReason
      });

      await addNotification({
        userId: route.createdBy,
        title: 'Ruta Rechazada',
        message: `Tu ruta "${route.routeName}" ha sido rechazada. Motivo: ${rejectionReason}`,
        link: `/dashboard/routes/${routeId}`
      });

      await refetchData('routes');
      toast({ title: 'Ruta Rechazada', description: 'Se ha enviado la notificación al usuario.' });
      setIsRejectDialogOpen(false);
      router.push('/dashboard/team-routes');
    } catch (error) {
      toast({ title: 'Error al rechazar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

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
        toast({ title: "Recuperación Exitosa", description: `${recovered.length} clientes restaurados.` });
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
      toast({ title: 'Éxito', description: `Ruta actualizada correctamente.` });
    } catch (error) {
      toast({ title: 'Error al actualizar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
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

  if (loading || authLoading) return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;
  if (!route) return notFound();
  
  const isFormDisabled = isSaving || !canEdit || isRecovering;
  
  return (
    <div className="flex flex-col space-y-6">
      <PageHeader 
        title={canApprove ? "Revisar Ruta" : "Detalles de la Ruta"} 
        description="Gestión de paradas y cronograma semanal."
      >
        <Link href="/dashboard/routes">
          <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
        </Link>
      </PageHeader>

      <div className="space-y-6">
        {route.status === 'Rechazada' && (
          <Alert variant="destructive" className="mb-6">
            <ThumbsDown className="h-4 w-4" />
            <AlertTitle>Ruta Rechazada</AlertTitle>
            <AlertDescription>{route.supervisorObservation || 'Sin observaciones del supervisor.'}</AlertDescription>
          </Alert>
        )}

        {activeClientsWithIndex.length === 0 && canRecoverClients && (
          <Alert className="mb-6 border-blue-500 bg-blue-50">
            <AlertTriangle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-800 font-bold">Ruta sin Clientes</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
              <span className="text-blue-700">Parece que esta ruta perdió su información. Puedes intentar restaurar los clientes de la predicción original aquí.</span>
              <Button onClick={handleRecoverClients} disabled={isRecovering} className="bg-blue-600 hover:bg-blue-700 shrink-0 font-bold">
                {isRecovering ? <LoaderCircle className="animate-spin mr-2" /> : <LifeBuoy className="mr-2" />} RECUPERAR DATOS
              </Button>
            </AlertDescription>
          </Alert>
        )}

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
                <SelectTrigger><Users className="mr-2 h-4 w-4" /><SelectValue placeholder="Asignar supervisor" /></SelectTrigger>
                <SelectContent>{supervisors.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Badge variant="outline" className="h-10 w-full flex items-center justify-center font-black uppercase">{route.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Visitas por Día</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {groupedClients.length > 0 ? (
                groupedClients.map(([date, clientsInGroup]) => (
                  <Collapsible key={date} defaultOpen className="border-l-4 pl-4 py-2 border-primary/20 bg-muted/5 rounded-r-lg">
                    <CollapsibleTrigger asChild>
                      <div className="flex w-full items-center justify-between p-2 cursor-pointer hover:bg-muted/50 transition-all">
                        <div className="flex items-center gap-3">
                          <CalendarIcon className="h-5 w-5 text-primary" />
                          <h4 className="font-black text-sm uppercase tracking-tighter">
                            {date === 'Sin Fecha' ? 'Sin Fecha' : format(new Date(date + 'T00:00:00'), "EEEE, dd 'de' MMMM", { locale: es })}
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
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleOpenRemovalDialog(client.ruc)} disabled={isFormDisabled}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <Separator className="my-3" />
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase font-black">Fecha de Visita</Label>
                              <Popover open={calendarOpen[client.ruc]} onOpenChange={(o) => setCalendarOpen(p => ({ ...p, [client.ruc]: o }))}>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" className="w-full justify-start h-9 text-xs font-bold" disabled={isFormDisabled}>
                                    <CalendarIcon className="mr-2 h-3 w-3" />
                                    {client.date ? format(ensureDate(client.date), 'dd/MM/yyyy') : 'Sin Fecha'}
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="p-0" align="start">
                                  <Calendar mode="single" selected={ensureDate(client.date)} onSelect={(d) => handleClientValueChange(client.ruc, 'date', d)} locale={es} />
                                </PopoverContent>
                              </Popover>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase font-black">Venta ($)</Label>
                              <Input type="number" className="h-9 text-xs font-bold" value={client.valorVenta ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'valorVenta', e.target.value)} disabled={isFormDisabled} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px] uppercase font-black">Cobro ($)</Label>
                              <Input type="number" className="h-9 text-xs font-bold" value={client.valorCobro ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'valorCobro', e.target.value)} disabled={isFormDisabled} />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                ))
              ) : (
                <div className="text-center py-12 text-muted-foreground uppercase text-xs font-bold">No hay paradas registradas en esta ruta.</div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end p-4 bg-background sticky bottom-0 border-t z-10 shadow-lg gap-2">
          {canEdit && (
            <Button type="button" onClick={handleUpdateRoute} disabled={isFormDisabled} className="font-black px-8"> 
              {isSaving && <LoaderCircle className="animate-spin mr-2" />} GUARDAR CAMBIOS
            </Button>
          )}
          {canApprove && (
            <div className="flex gap-2">
              <Button 
                variant="destructive" 
                onClick={() => setIsRejectDialogOpen(true)}
                disabled={isSaving}
                className="font-black"
              >
                <XCircle className="mr-2 h-4 w-4" /> RECHAZAR RUTA
              </Button>
              <Button 
                onClick={handleApprove}
                disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 font-black text-white"
              >
                <CheckCircle className="mr-2 h-4 w-4" /> APROBAR RUTA
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-red-600">Rechazar Plan de Ruta</DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase">Por favor, indica el motivo para que el usuario pueda corregir su planificación.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="font-bold uppercase text-[10px]">Observación del Supervisor</Label>
            <Textarea 
              value={rejectionReason} 
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Ej: Motivo del rechazo..."
              className="mt-2 font-bold text-sm h-32"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" className="font-bold">CANCELAR</Button></DialogClose>
            <Button 
              variant="destructive" 
              onClick={handleReject} 
              disabled={isSaving || !rejectionReason.trim()}
              className="font-black"
            >
              {isSaving && <LoaderCircle className="animate-spin mr-2 h-4 w-4" />} CONFIRMAR RECHAZO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRemovalDialogOpen} onOpenChange={setIsRemovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-destructive flex items-center gap-2">
                <Trash2 className="h-5 w-5" /> Eliminar Cliente de Ruta
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase">Es obligatorio indicar el motivo por el cual este cliente no será visitado.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="font-bold uppercase text-[10px]">Motivo de la Eliminación</Label>
            <Textarea 
              value={removalReason} 
              onChange={(e) => setRemovalReason(e.target.value)}
              placeholder="Ej: Cliente solicitó cambio de fecha, local cerrado permanentemente, etc."
              className="mt-2 font-bold text-sm h-32"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" className="font-bold">CANCELAR</Button></DialogClose>
            <Button 
              variant="destructive" 
              onClick={confirmRemoval} 
              disabled={!removalReason.trim()}
              className="font-black"
            >
              ELIMINAR CLIENTE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
