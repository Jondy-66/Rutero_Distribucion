

'use client';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar as CalendarIcon, Users, Check, ChevronsUpDown, LoaderCircle, Clock, Trash2, PlusCircle, Search, ThumbsUp, ThumbsDown, Eye, Send } from 'lucide-react';
import { getRoute, updateRoute, addNotification } from '@/lib/firebase/firestore';
import type { Client, User, RoutePlan, ClientInRoute } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogHeader, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';


const generateTimeSlots = (startHour: number, endHour: number, interval: number, startMinute = 0) => {
    const slots = [];
    for (let hour = startHour; hour <= endHour; hour++) {
        for (let minute = (hour === startHour ? startMinute : 0); minute < 60; minute += interval) {
            if (hour === endHour && minute > 0) break;
            const time = new Date(1970, 0, 1, hour, minute);
            slots.push(format(time, 'HH:mm'));
        }
    }
    return slots;
};

const startTimeSlots = generateTimeSlots(8, 18, 30);
const endTimeSlots = generateTimeSlots(8, 18, 30, 30);

export default function EditRoutePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser, users, clients, loading: authLoading, refetchData } = useAuth();
  const routeId = params.id;

  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [originalClients, setOriginalClients] = useState<ClientInRoute[]>([]);
  const [clientsInRoute, setClientsInRoute] = useState<ClientInRoute[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [calendarOpen, setCalendarOpen] = useState<{[key: string]: boolean}>({});
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [dialogSearchTerm, setDialogSearchTerm] = useState('');
  const [dialogSelectedClients, setDialogSelectedClients] = useState<Client[]>([]);

  const [clientToRemove, setClientToRemove] = useState<ClientInRoute | null>(null);
  const [removalObservation, setRemovalObservation] = useState('');

  
  const canEdit = useMemo(() => {
    if (!currentUser || !route) return false;
    // Admin can edit unless it's completed
    if (currentUser.role === 'Administrador' && route.status !== 'Completada') return true;
    
    // The user who created it can edit if it's 'Planificada' (and it's a predicted route or a normal draft) or 'Rechazada'
    const isOwner = currentUser.id === route.createdBy;
    const isEditableStatus = route.status === 'Planificada' || route.status === 'Rechazada';
    
    return isOwner && isEditableStatus;
}, [currentUser, route]);


  const canApprove = useMemo(() => {
     if (!currentUser || !route) return false;
     // Admin can always approve/reject.
     if (currentUser.role === 'Administrador' && route.status === 'Pendiente de Aprobación') return true;
     // Supervisor can approve/reject if they are the assigned supervisor.
     return currentUser.id === route.supervisorId && route.status === 'Pendiente de Aprobación';
  }, [currentUser, route]);


  useEffect(() => {
    const fetchRouteData = async () => {
      setLoading(true);
      try {
        const routeData = await getRoute(routeId);
        if (routeData) {
          // A route is considered "new" if it was just created from prediction.
          // This flag is used to allow initial editing before the first save.
          const isNew = routeData.origin === 'predicted' && (!routeData.createdAt || (Timestamp.now().toMillis() - (routeData.createdAt as Timestamp).toMillis()) < 5 * 60 * 1000);
          setRoute({ ...routeData, isNew });
          setClientsInRoute(routeData.clients || []);
          setOriginalClients(routeData.clients || []); // Store the initial list
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
  
    useEffect(() => {
        if (route && !route.supervisorId && currentUser?.role === 'Usuario' && currentUser.supervisorId) {
            handleInputChange('supervisorId', currentUser.supervisorId);
        }
    }, [route, currentUser]);

  useEffect(() => {
    if (isClientDialogOpen) {
      const currentSelectedClientsFromMainList = clients.filter(c => clientsInRoute.some(sc => sc.ruc === c.ruc));
      setDialogSelectedClients(currentSelectedClientsFromMainList);
    }
  }, [isClientDialogOpen, clients, clientsInRoute]);

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

  const handleUpdateRoute = async (e: React.FormEvent, newStatus?: RoutePlan['status']) => {
    e.preventDefault();
    if (!route || !currentUser) return;

    if (!newStatus) { // Only validate if saving, not when approving/rejecting
        if (!route.routeName || clientsInRoute.length === 0 || !route.supervisorId) {
            toast({ title: 'Faltan datos', description: 'Por favor completa el nombre de la ruta, el supervisor y añade al menos un cliente.', variant: 'destructive' });
            return;
        }
    }

    if (newStatus === 'Rechazada' && !route.supervisorObservation) {
        toast({ title: 'Observación Requerida', description: 'Debes proporcionar una observación para rechazar la ruta.', variant: 'destructive' });
        return;
    }


    setIsSaving(true);
    try {
      const supervisor = supervisors.find(s => s.id === route.supervisorId);
      const dataToUpdate: Partial<RoutePlan> = {
        ...route,
        supervisorName: supervisor?.name || '',
        clients: clientsInRoute.map(c => ({
          ...c,
          valorVenta: parseFloat(String(c.valorVenta)) || 0,
          valorCobro: parseFloat(String(c.valorCobro)) || 0,
          devoluciones: parseFloat(String(c.devoluciones)) || 0,
          promociones: parseFloat(String(c.promociones)) || 0,
          medicacionFrecuente: parseFloat(String(c.medicacionFrecuente)) || 0,
          date: c.date ? Timestamp.fromDate(c.date) : null
        })),
        isNew: false, // After the first save/action, it's no longer "new"
      };
      
      if(newStatus) {
        dataToUpdate.status = newStatus;

        if (newStatus === 'Pendiente de Aprobación') {
            await addNotification({
                userId: route.supervisorId,
                title: 'Nueva ruta para aprobar',
                message: `${currentUser.name} ha enviado la ruta "${route.routeName}" para tu aprobación.`,
                link: `/dashboard/routes/${routeId}`
            });
        } else if (newStatus === 'Planificada' || newStatus === 'Rechazada') {
            // Send notification to the user who created the route for approval/rejection
            await addNotification({
                userId: route.createdBy,
                title: `Ruta ${newStatus === 'Planificada' ? 'Aprobada' : 'Rechazada'}`,
                message: `Tu ruta "${route.routeName}" ha sido ${newStatus === 'Planificada' ? 'aprobada' : 'rechazada'} por ${currentUser.name}.`,
                link: `/dashboard/routes/${routeId}`
            });
        }
      }

      delete (dataToUpdate as any).id;
      // delete (dataToUpdate as any).isNew; // This is now explicitly set to false

      await updateRoute(routeId, dataToUpdate);
      await refetchData('routes');

      const successMessage = newStatus ? 'revisada' : 'actualizada';
      toast({ title: 'Éxito', description: `Ruta ${successMessage} correctamente.` });
      
      // Only redirect if a status change occurred (approval, rejection, sent for approval)
      if (newStatus) {
        router.push('/dashboard/routes');
      } else {
        // If just saving, stay on the page and update the local state
        setRoute(prev => prev ? { ...prev, ...dataToUpdate, isNew: false } : null);
      }

    } catch (error: any) {
      console.error(error);
      toast({ title: 'Error', description: 'No se pudo actualizar la ruta.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDialogClientToggle = (client: Client) => {
    setDialogSelectedClients(prev => {
        const isSelected = prev.some(c => c.ruc === client.ruc);
        if (isSelected) {
            return prev.filter(c => c.ruc !== client.ruc);
        } else {
            return [...prev, client];
        }
    });
  };

  const handleConfirmClientSelection = () => {
    const newClientsInRoute: ClientInRoute[] = dialogSelectedClients.map(client => {
        const existingClient = clientsInRoute.find(c => c.ruc === client.ruc);
        if (existingClient) {
            return existingClient;
        }
        return {
            ruc: client.ruc,
            nombre_comercial: client.nombre_comercial,
            date: new Date(),
            origin: 'manual' // Mark as manually added
        };
    });
    setClientsInRoute(newClientsInRoute);
    setIsClientDialogOpen(false);
  };
  
  const handleConfirmRemoval = () => {
    if (!clientToRemove) return;
    if (!removalObservation.trim()) {
        toast({ title: 'Observación requerida', description: 'Debes añadir una observación para eliminar al cliente.', variant: 'destructive'});
        return;
    }

    setClientsInRoute(prev => prev.map(c => 
        c.ruc === clientToRemove.ruc ? { ...c, status: 'Removed', removalObservation: removalObservation } : c
    ).filter(c => c.ruc !== clientToRemove.ruc));
    
    toast({ title: 'Cliente Eliminado', description: `${clientToRemove.nombre_comercial} ha sido quitado de la ruta.`});
    setClientToRemove(null);
    setRemovalObservation('');
  }
  
    const filteredAvailableClients = useMemo(() => {
    // Return all clients that belong to the user (if 'Usuario') or all clients (if 'Admin'/'Supervisor')
    const userClients = clients.filter(c => {
      if (currentUser?.role === 'Usuario') {
        return c.ejecutivo === currentUser.name;
      }
      return true; // Admin/Supervisor can see all
    });

    // Then, filter by search term
    return userClients.filter(c => {
      const searchTermLower = dialogSearchTerm.toLowerCase();
      return (
        String(c.nombre_cliente).toLowerCase().includes(searchTermLower) ||
        String(c.nombre_comercial).toLowerCase().includes(searchTermLower) ||
        String(c.ruc).includes(dialogSearchTerm)
      );
    });
  }, [clients, dialogSearchTerm, currentUser]);
  
  const originalClientRucs = useMemo(() => new Set(originalClients.map(c => c.ruc)), [originalClients]);

  const canSendForApproval = useMemo(() => {
      if (!currentUser || !route) return false;
      return currentUser.id === route.createdBy && (route.status === 'Planificada' || route.status === 'Rechazada');
  }, [currentUser, route]);


  if (loading || authLoading) {
    return (
      <>
        <PageHeader title="Editar Ruta" description="Cargando datos de la ruta..." />
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-32" />
          </CardFooter>
        </Card>
      </>
    );
  }

  if (!route) {
    return notFound();
  }
  
  const isFormDisabled = isSaving || !canEdit;
  
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
            {route.supervisorObservation || 'Esta ruta fue rechazada por el supervisor. Contacta con él para más detalles.'}
          </AlertDescription>
        </Alert>
      )}

       {route.status === 'Pendiente de Aprobación' && !canApprove && (
        <Alert className="mb-6">
          <Eye className="h-4 w-4" />
          <AlertTitle>Pendiente de Revisión</AlertTitle>
          <AlertDescription>
            Esta ruta está esperando la aprobación de tu supervisor. No podrás editarla hasta que sea aprobada o rechazada.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={(e) => handleUpdateRoute(e)}>
        <div className="space-y-6">
            <Card>
            <CardHeader>
                <CardTitle>Detalles Generales de la Ruta</CardTitle>
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
                    <Select value={route.status} onValueChange={(value: any) => handleInputChange('status', value)} disabled={true}>
                    <SelectTrigger id="status"><SelectValue placeholder="Seleccionar estado" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Pendiente de Aprobación">Pendiente de Aprobación</SelectItem>
                        <SelectItem value="Planificada">Planificada</SelectItem>
                        <SelectItem value="En Progreso">En Progreso</SelectItem>
                        <SelectItem value="Completada">Completada</SelectItem>
                        <SelectItem value="Rechazada">Rechazada</SelectItem>
                    </SelectContent>
                    </Select>
                </div>
            </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Clientes en Ruta</CardTitle>
                    <CardDescription>Añade clientes a la ruta y especifica los detalles de la visita para cada uno.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <Label>Añadir o Quitar Clientes</Label>
                        <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full justify-start" disabled={isFormDisabled}>
                                <PlusCircle className="mr-2 h-4 w-4"/>
                                Añadir o Quitar Clientes ({clientsInRoute.length} seleccionados)
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>Seleccionar Clientes</DialogTitle>
                                <DialogDescription>
                                    Elige los clientes que formarán parte de esta ruta.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Buscar por nombre, RUC..." 
                                    className="pl-8" 
                                    value={dialogSearchTerm}
                                    onChange={(e) => setDialogSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="h-72">
                                <div className="space-y-2 p-1">
                                {filteredAvailableClients.map(client => (
                                    <div key={client.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                    <div className="flex items-center space-x-3">
                                        <Checkbox 
                                        id={`client-${client.id}`}
                                        checked={dialogSelectedClients.some(c => c.ruc === client.ruc)}
                                        onCheckedChange={() => handleDialogClientToggle(client)}
                                        />
                                        <Label htmlFor={`client-${client.id}`} className="font-normal cursor-pointer">
                                        <p className="font-medium">{client.nombre_comercial}</p>
                                        <p className="text-xs text-muted-foreground">{client.ruc} - {client.nombre_cliente}</p>
                                        </Label>
                                    </div>
                                    </div>
                                ))}
                                </div>
                            </ScrollArea>
                            <DialogFooter>
                                <span className="text-sm text-muted-foreground mr-auto">{dialogSelectedClients.length} cliente(s) seleccionados</span>
                                <Button variant="ghost" onClick={() => setIsClientDialogOpen(false)}>Cancelar</Button>
                                <Button onClick={handleConfirmClientSelection}>Actualizar Clientes</Button>
                            </DialogFooter>
                        </DialogContent>
                        </Dialog>
                    </div>
                    {clientsInRoute.length > 0 && (
                        <Collapsible defaultOpen className="space-y-4 mt-4">
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="w-full justify-between p-2">
                                    <span>Ver/Ocultar Detalles de Clientes ({clientsInRoute.length})</span>
                                    <ChevronsUpDown className="h-4 w-4" />
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-4 p-2 pt-0 max-h-[60vh] overflow-y-auto">
                                {clientsInRoute.map((client, index) => {
                                    const hasDescuento = client.nombre_comercial.toLowerCase().includes('descuento');
                                    const isNew = client.origin === 'manual';
                                    const isFromPrediction = client.origin === 'predicted';
                                    return (
                                    <Card key={client.ruc} className={cn("p-4 bg-muted/50 relative", isNew && "border-green-500", isFromPrediction && "border-blue-500")}>
                                        {isNew && <Badge className="absolute -top-2 -right-2 z-10">Nuevo</Badge>}
                                        {isFromPrediction && <Badge variant="secondary" className="absolute -top-2 -right-2 z-10">Predicción</Badge>}
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold">{index + 1}. {client.nombre_comercial}</p>
                                                <p className="text-xs text-muted-foreground">{client.ruc}</p>
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setClientToRemove(client)} disabled={isFormDisabled}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                        <Separator className="my-2" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                                            <div className="space-y-2">
                                                <Label htmlFor={`dayOfWeek-${client.ruc}`}>Día</Label>
                                                <Select value={client.dayOfWeek} onValueChange={(value) => handleClientValueChange(client.ruc, 'dayOfWeek', value)} disabled={isFormDisabled}>
                                                    <SelectTrigger id={`dayOfWeek-${client.ruc}`}><CalendarIcon className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccionar día" /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Lunes">Lunes</SelectItem><SelectItem value="Martes">Martes</SelectItem><SelectItem value="Miércoles">Miércoles</SelectItem><SelectItem value="Jueves">Jueves</SelectItem><SelectItem value="Viernes">Viernes</SelectItem><SelectItem value="Sábado">Sábado</SelectItem><SelectItem value="Domingo">Domingo</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Fecha</Label>
                                                <Popover open={calendarOpen[client.ruc] || false} onOpenChange={(isOpen) => setCalendarOpen(prev => ({ ...prev, [client.ruc]: isOpen }))}>
                                                <PopoverTrigger asChild>
                                                    <Button variant={'outline'} className={cn('w-full justify-start text-left font-normal', !client.date && 'text-muted-foreground')} disabled={isFormDisabled}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {client.date ? format(client.date, 'PPP', { locale: es }) : <span>Elige una fecha</span>}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="p-0">
                                                    <Calendar mode="single" selected={client.date} onSelect={(date) => handleClientValueChange(client.ruc, 'date', date)} initialFocus locale={es} />
                                                    <div className="p-2 border-t border-border"><Button onClick={() => setCalendarOpen(prev => ({ ...prev, [client.ruc]: false }))} className="w-full">Seleccionar</Button></div>
                                                </PopoverContent>
                                                </Popover>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`start-time-${client.ruc}`}>Hora de Inicio</Label>
                                                <Select value={client.startTime} onValueChange={(value) => handleClientValueChange(client.ruc, 'startTime', value)} disabled={isFormDisabled}>
                                                <SelectTrigger id={`start-time-${client.ruc}`}><Clock className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                                <SelectContent>{startTimeSlots.map(time => (<SelectItem key={time} value={time}>{time}</SelectItem>))}</SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`end-time-${client.ruc}`}>Hora de Fin</Label>
                                                <Select value={client.endTime} onValueChange={(value) => handleClientValueChange(client.ruc, 'endTime', value)} disabled={isFormDisabled}>
                                                <SelectTrigger id={`end-time-${client.ruc}`}><Clock className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                                <SelectContent>{endTimeSlots.map(time => (<SelectItem key={time} value={time}>{time}</SelectItem>))}</SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <Separator className="my-4" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                                            <div className="space-y-2">
                                                <Label htmlFor={`valor-venta-${client.ruc}`}>Valor de Venta ($)</Label>
                                                <Input id={`valor-venta-${client.ruc}`} type="text" placeholder="0.00" value={client.valorVenta ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'valorVenta', e.target.value)} disabled={isFormDisabled} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`valor-cobro-${client.ruc}`}>Valor a Cobrar ($)</Label>
                                                <Input id={`valor-cobro-${client.ruc}`} type="text" placeholder="0.00" value={client.valorCobro ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'valorCobro', e.target.value)} disabled={isFormDisabled} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`tipo-cobro-${client.ruc}`}>Tipo de Cobro</Label>
                                                <Select value={client.tipoCobro} onValueChange={(value: any) => handleClientValueChange(client.ruc, 'tipoCobro', value)} disabled={isFormDisabled}>
                                                <SelectTrigger id={`tipo-cobro-${client.ruc}`}><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Efectivo">Efectivo</SelectItem><SelectItem value="Transferencia">Transferencia</SelectItem><SelectItem value="Cheque">Cheque</SelectItem>
                                                </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor={`devoluciones-${client.ruc}`}>Devoluciones ($)</Label>
                                                <Input id={`devoluciones-${client.ruc}`} type="text" placeholder="0.00" value={client.devoluciones ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'devoluciones', e.target.value)} disabled={isFormDisabled} />
                                            </div>
                                            {hasDescuento && (
                                                <>
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`promociones-${client.ruc}`}>Promociones ($)</Label>
                                                        <Input id={`promociones-${client.ruc}`} type="text" placeholder="0.00" value={client.promociones ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'promociones', e.target.value)} disabled={isFormDisabled} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`medicacionFrecuente-${client.ruc}`}>Medicación Frecuente ($)</Label>
                                                        <Input id={`medicacionFrecuente-${client.ruc}`} type="text" placeholder="0.00" value={client.medicacionFrecuente ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'medicacionFrecuente', e.target.value)} disabled={isFormDisabled} />
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </Card>
                                    )
                                })}
                            </CollapsibleContent>
                        </Collapsible>
                    )}
                </CardContent>
            </Card>

            {canApprove && (
                <Card>
                    <CardHeader>
                        <CardTitle>Aprobación del Supervisor</CardTitle>
                        <CardDescription>Revisa y aprueba o rechaza esta ruta. Tu decisión será notificada.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="supervisorObservation">Observaciones</Label>
                            <Textarea 
                                id="supervisorObservation"
                                placeholder="Añade un comentario para el usuario (requerido si se rechaza)..."
                                value={route.supervisorObservation || ''}
                                onChange={(e) => handleInputChange('supervisorObservation', e.target.value)}
                                disabled={isSaving}
                            />
                        </div>
                    </CardContent>
                    <CardFooter className="gap-2">
                        <Button type="button" variant="outline" className="text-destructive border-destructive hover:bg-destructive/10 hover:text-destructive" onClick={(e) => handleUpdateRoute(e, 'Rechazada')} disabled={isSaving || !route.supervisorObservation}>
                            <ThumbsDown className="mr-2 h-4 w-4"/> Rechazar Ruta
                        </Button>
                        <Button type="button" className="bg-green-600 hover:bg-green-700 text-white" onClick={(e) => handleUpdateRoute(e, 'Planificada')} disabled={isSaving}>
                            <ThumbsUp className="mr-2 h-4 w-4"/> Aprobar Ruta
                        </Button>
                    </CardFooter>
                </Card>
            )}

            <div className="flex justify-end gap-2">
                {canEdit && (
                    <Button type="submit" disabled={isFormDisabled}>
                        {isSaving && <LoaderCircle className="animate-spin" />}
                        Guardar Cambios
                    </Button>
                )}
                {canSendForApproval && (
                     <Button type="button" onClick={(e) => handleUpdateRoute(e, 'Pendiente de Aprobación')} disabled={isSaving}>
                        {isSaving && <LoaderCircle className="animate-spin mr-2" />}
                        <Send className="mr-2 h-4 w-4"/>
                        Enviar a Aprobación
                    </Button>
                )}
            </div>
        </div>
      </form>
       <AlertDialog open={!!clientToRemove} onOpenChange={() => setClientToRemove(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar a {clientToRemove?.nombre_comercial}?</AlertDialogTitle>
                <AlertDialogDescription>
                    Para eliminar a este cliente de la ruta, por favor, introduce una observación.
                </AlertDialogDescription>
            </AlertDialogHeader>
             <div className="py-4">
                <Label htmlFor="removal-observation">Observación (requerido)</Label>
                <Textarea
                    id="removal-observation"
                    value={removalObservation}
                    onChange={(e) => setRemovalObservation(e.target.value)}
                    placeholder="Ej: Cliente solicitó no ser visitado esta semana."
                />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setRemovalObservation('')}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleConfirmRemoval}>Confirmar Eliminación</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
