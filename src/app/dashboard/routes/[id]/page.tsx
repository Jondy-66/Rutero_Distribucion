'use client';
import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar as CalendarIcon, Users, LoaderCircle, Trash2, ThumbsDown, LifeBuoy, AlertTriangle } from 'lucide-react';
import { getRoute, updateRoute } from '@/lib/firebase/firestore';
import { getPredicciones } from '@/services/api';
import type { Client, User, RoutePlan, ClientInRoute } from '@/lib/types';
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
    const isEditableStatus = route.status === 'Planificada' || route.status === 'Rechazada' || route.status === 'En Progreso';
    return isOwner && isEditableStatus;
  }, [currentUser, route]);

  const canApprove = useMemo(() => {
     if (!currentUser || !route) return false;
     if (currentUser.role === 'Administrador' && route.status === 'Pendiente de Aprobación') return true;
     return currentUser.id === route.supervisorId && route.status === 'Pendiente de Aprobación';
  }, [currentUser, route]);

  // Nuevo permiso granular
  const canRecoverClients = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'Administrador') return true;
    return currentUser.permissions?.includes('recover-clients') || false;
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
        console.error("Failed to fetch route data:", error);
        toast({ title: "Error", description: "No se pudo cargar la ruta.", variant: "destructive" });
        notFound();
      } finally {
        setLoading(false);
      }
    };
    if (routeId) {
        fetchRouteData();
    }
  }, [routeId, toast]);
  
  useEffect(() => {
      if (users) {
          setSupervisors(users.filter(u => u.role === 'Supervisor'));
      }
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
    if (!route || !route.routeName.includes("Ruta Predicha")) {
        toast({ title: "Acción no permitida", description: "Solo se pueden recuperar clientes de rutas generadas por predicción.", variant: "destructive"});
        return;
    }
    
    setIsRecovering(true);
    try {
        const execMatch = route.routeName.match(/para (.*?) -/);
        const ejecutivo = execMatch ? execMatch[1] : '';
        const dateObj = route.date instanceof Timestamp ? route.date.toDate() : new Date(route.date);
        const fecha_inicio = format(dateObj, 'yyyy-MM-dd');

        toast({ title: "Recuperando...", description: "Buscando datos de la predicción original." });

        const predictions = await getPredicciones({ ejecutivo, fecha_inicio, dias: 7 });

        if (predictions.length === 0) {
            toast({ title: "No se encontró respaldo", description: "No hay predicciones activas para este ejecutivo en la fecha seleccionada.", variant: "destructive" });
            return;
        }

        const recovered: ClientInRoute[] = predictions.map(p => {
            const ruc = (p as any).ruc || (p as any).RUC || (p as any).cliente_id;
            return {
                ruc,
                nombre_comercial: (p as any).nombre_comercial || (p as any).Cliente || 'Cliente Recuperado',
                date: p.fecha_predicha ? new Date(p.fecha_predicha) : dateObj,
                valorVenta: parseFloat(String(p.ventas)) || 0,
                valorCobro: parseFloat(String(p.cobros)) || 0,
                promociones: parseFloat(String(p.promociones)) || 0,
                origin: 'predicted',
                status: 'Activo',
                visitStatus: 'Pendiente'
            };
        });

        setClientsInRoute(recovered);
        toast({ title: "Recuperación Exitosa", description: `Se han restaurado ${recovered.length} clientes. Guarda los cambios para finalizar.` });

    } catch (error: any) {
        console.error(error);
        toast({ title: "Fallo de Recuperación", description: "Ocurrió un error al intentar re-ejecutar la predicción.", variant: "destructive" });
    } finally {
        setIsRecovering(false);
    }
  };

  const handleUpdateRoute = async (e: React.FormEvent, newStatus?: RoutePlan['status']) => {
    e.preventDefault();
    if (!route || !currentUser) return;

    const activeClients = clientsInRoute.filter(c => c.status !== 'Eliminado');

    if (!newStatus) {
        if (!route.routeName || activeClients.length === 0 || !route.supervisorId) {
            toast({ title: 'Faltan datos', description: 'Por favor completa el nombre de la ruta, el supervisor y añade al menos un cliente activo.', variant: 'destructive' });
            return;
        }
    }

    setIsSaving(true);
    try {
      const supervisor = supervisors.find(s => s.id === route.supervisorId);
      
      const sanitizedClients = clientsInRoute.map(c => {
          const clientDate = ensureDate(c.date);
          return {
            ...c,
            valorVenta: parseFloat(String(c.valorVenta)) || 0,
            valorCobro: parseFloat(String(c.valorCobro)) || 0,
            devoluciones: parseFloat(String(c.devoluciones)) || 0,
            promociones: parseFloat(String(c.promociones)) || 0,
            medicacionFrecuente: parseFloat(String(c.medicacionFrecuente)) || 0,
            date: Timestamp.fromDate(clientDate)
          };
      });

      const dataToUpdate: Partial<RoutePlan> = {
        ...route,
        supervisorName: supervisor?.name || '',
        clients: sanitizedClients,
        date: route.date ? Timestamp.fromDate(ensureDate(route.date)) : Timestamp.now(),
      };
      
      if(newStatus) {
        dataToUpdate.status = newStatus;
      }

      const { id, ...cleanedData } = dataToUpdate as any;
      await updateRoute(routeId, cleanedData);
      await refetchData('routes');

      toast({ title: 'Éxito', description: `Ruta actualizada correctamente.` });
      if (newStatus) router.push('/dashboard/routes');

    } catch (error: any) {
      console.error(error);
      toast({ title: 'Error', description: 'No se pudo actualizar la ruta.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmRemoval = () => {
    if (!clientToRemove) return;
    if (!removalObservation.trim()) {
        toast({ title: 'Observación requerida', description: 'Debes añadir una observación.', variant: 'destructive'});
        return;
    }

    setClientsInRoute(prev => prev.map(c => 
        c.ruc === clientToRemove.ruc ? { ...c, status: 'Eliminado', removalObservation: removalObservation } : c
    ));
    setClientToRemove(null);
    setRemovalObservation('');
  }
  
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
        const clientDateKey = dateObj && !isNaN(dateObj.getTime()) ? format(dateObj, 'yyyy-MM-dd') : 'Sin Fecha';
        if (!groups[clientDateKey]) {
          groups[clientDateKey] = [];
        }
        groups[clientDateKey].push(client);
      });
      
    return Object.entries(groups).sort(([dateA], [dateB]) => {
        if (dateA === 'Sin Fecha') return 1;
        if (dateB === 'Sin Fecha') return -1;
        return new Date(dateA).getTime() - new Date(dateB).getTime();
    });
  }, [activeClientsWithIndex]);

  if (loading || authLoading) {
    return (
      <>
        <PageHeader title="Editar Ruta" description="Cargando..." />
        <Skeleton className="h-96 w-full" />
      </>
    );
  }

  if (!route) return notFound();
  const isFormDisabled = isSaving || !canEdit || isRecovering;
  
  return (
    <>
      <PageHeader title={canApprove ? "Revisar Ruta" : "Editar Ruta"} description="Actualiza los detalles de la ruta planificada.">
        <Link href="/dashboard/routes">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a la Lista
          </Button>
        </Link>
      </PageHeader>

      {route.status === 'Rechazada' && (
        <Alert variant="destructive" className="mb-6">
          <ThumbsDown className="h-4 w-4" />
          <AlertTitle>Ruta Rechazada</AlertTitle>
          <AlertDescription>
            {route.supervisorObservation || 'Esta ruta fue rechazada.'}
          </AlertDescription>
        </Alert>
      )}

      {activeClientsWithIndex.length === 0 && canRecoverClients && !loading && route.routeName.includes("Ruta Predicha") && (
          <Alert className="mb-6 border-blue-500 bg-blue-50 shadow-md">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertTitle className="text-blue-800 font-bold">Ruta Vacía Detectada</AlertTitle>
              <AlertDescription className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
                  <span className="text-blue-700">Esta ruta parece haber perdido sus clientes. Puedes recuperarlos automáticamente usando la predicción original.</span>
                  <Button onClick={handleRecoverClients} disabled={isRecovering} variant="default" className="bg-blue-600 hover:bg-blue-700 shrink-0 font-bold">
                      {isRecovering ? <LoaderCircle className="animate-spin mr-2 h-4 w-4" /> : <LifeBuoy className="mr-2 h-4 w-4" />}
                      Recuperar Clientes
                  </Button>
              </AlertDescription>
          </Alert>
      )}

      <form onSubmit={(e) => handleUpdateRoute(e)}>
        <div className="space-y-6">
            <Card>
            <CardHeader>
                <CardTitle>Detalles Generales</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="routeName">Nombre de la Ruta</Label>
                <Input id="routeName" value={route.routeName} onChange={(e) => handleInputChange('routeName', e.target.value)} disabled={isFormDisabled} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="supervisor">Asignar Supervisor</Label>
                    <Select value={route.supervisorId} onValueChange={(value) => handleInputChange('supervisorId', value)} disabled={isFormDisabled}>
                    <SelectTrigger id="supervisor"><Users className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{supervisors.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="status">Estado</Label>
                    <Badge variant="outline" className="h-10 w-full flex items-center justify-center font-bold">{route.status}</Badge>
                </div>
            </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Clientes en Ruta</CardTitle>
                    <CardDescription>Visualización y ajuste de visitas por día.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        {groupedClients.map(([date, clientsInGroup]) => (
                            <Collapsible key={date} defaultOpen className="border-l-2 pl-4 py-2 border-slate-200">
                                <CollapsibleTrigger asChild>
                                    <div className="flex w-full items-center justify-between rounded-lg p-2 cursor-pointer hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                                            <h4 className="font-semibold text-sm">
                                                {date === 'Sin Fecha' 
                                                    ? 'Sin Fecha' 
                                                    : format(new Date(date + 'T00:00:00'), 'EEEE, dd \'de\' MMMM', { locale: es })}
                                            </h4>
                                            <Badge variant="secondary" className="font-black">{clientsInGroup.length}</Badge>
                                        </div>
                                    </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="space-y-4 p-2">
                                    {clientsInGroup.map((client) => (
                                        <Card key={client.ruc} className="p-4 relative hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start">
                                                <div className="space-y-1">
                                                    <p className="font-bold text-sm text-primary">{client.globalIndex + 1}. {client.nombre_comercial}</p>
                                                    <p className="text-[10px] font-mono text-muted-foreground uppercase">{client.ruc}</p>
                                                </div>
                                                <Button type="button" variant="ghost" size="icon" onClick={() => setClientToRemove(client)} disabled={isFormDisabled}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                            <Separator className="my-3" />
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase font-black">Fecha Visita</Label>
                                                    <Popover open={calendarOpen[client.ruc]} onOpenChange={(isOpen) => setCalendarOpen(prev => ({ ...prev, [client.ruc]: isOpen }))}>
                                                    <PopoverTrigger asChild>
                                                        <Button variant="outline" className="w-full justify-start h-9 text-xs" disabled={isFormDisabled}>
                                                            <CalendarIcon className="mr-2 h-3 w-3" />
                                                            {client.date ? format(ensureDate(client.date), 'dd/MM/yyyy') : 'Elije'}
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="p-0" align="start">
                                                        <Calendar mode="single" selected={ensureDate(client.date)} onSelect={(d) => handleClientValueChange(client.ruc, 'date', d)} locale={es} />
                                                    </PopoverContent>
                                                    </Popover>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase font-black">Venta ($)</Label>
                                                    <Input type="number" className="h-9 text-xs" value={client.valorVenta ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'valorVenta', e.target.value)} disabled={isFormDisabled} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-[10px] uppercase font-black">Cobro ($)</Label>
                                                    <Input type="number" className="h-9 text-xs" value={client.valorCobro ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'valorCobro', e.target.value)} disabled={isFormDisabled} />
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </CollapsibleContent>
                            </Collapsible>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end gap-2 p-4 bg-background sticky bottom-0 border-t z-10">
                {canEdit && (
                    <Button type="submit" disabled={isFormDisabled} className="font-bold shadow-lg">
                        {isSaving && <LoaderCircle className="animate-spin mr-2 h-4 w-4" />}
                        Guardar Cambios
                    </Button>
                )}
            </div>
        </div>
      </form>

      <AlertDialog open={!!clientToRemove} onOpenChange={() => setClientToRemove(null)}>
        <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>¿Eliminar cliente de la ruta?</AlertDialogTitle></AlertDialogHeader>
             <div className="py-4 space-y-2">
                <Label className="font-bold">Observación de la eliminación</Label>
                <Textarea value={removalObservation} onChange={(e) => setRemovalObservation(e.target.value)} placeholder="Ej: Cliente cerrado, cambio de día, etc." />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmRemoval} className="bg-destructive hover:bg-destructive/90">Confirmar Eliminación</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
