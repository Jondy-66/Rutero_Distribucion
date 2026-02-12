
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Calendar as CalendarIcon, Users, ChevronsUpDown, LoaderCircle, Clock, Trash2, Save, Search, Send } from 'lucide-react';
import { addRoutesBatch, addNotification } from '@/lib/firebase/firestore';
import type { Client, User, RoutePlan, ClientInRoute } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogHeader, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

type StagedRoute = Omit<RoutePlan, 'id' | 'createdAt'> & { tempId: number };

export default function NewRoutePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser, users, clients, loading, refetchData } = useAuth();
  
  const [routeName, setRouteName] = useState('');
  const [routeDate, setRouteDate] = useState<Date | undefined>(new Date());
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | undefined>();
  const [selectedClients, setSelectedClients] = useState<ClientInRoute[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState<{ [key: string]: boolean }>({});
  const [isRouteCalendarOpen, setIsRouteCalendarOpen] = useState(false);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [dialogSearchTerm, setDialogSearchTerm] = useState('');
  const [dialogSelectedClients, setDialogSelectedClients] = useState<Client[]>([]);
  const [stagedRoutes, setStagedRoutes] = useState<StagedRoute[]>([]);
  
  const [clientToRemove, setClientToRemove] = useState<ClientInRoute | null>(null);
  const [removalObservation, setRemovalObservation] = useState('');

  const [currentAddDate, setCurrentAddDate] = useState<Date | null>(null);
  const [isAddClientToDateDialogOpen, setIsAddClientToDateDialogOpen] = useState(false);
  const [addDialogSelectedClients, setAddDialogSelectedClients] = useState<Client[]>([]);
  const [addDialogSearchTerm, setAddDialogSearchTerm] = useState('');

  const isLoading = loading;
  const isFormDisabled = isLoading || stagedRoutes.length > 0;

  useEffect(() => {
    if (users) {
      const filteredSupervisors = users.filter(u => u.role === 'Supervisor');
      setSupervisors(filteredSupervisors);
    }
    if (currentUser?.role === 'Usuario' && currentUser.supervisorId) {
        setSelectedSupervisorId(currentUser.supervisorId);
    }
    
    const predictionDataStr = localStorage.getItem('predictionRoute');
    if (predictionDataStr) {
        try {
            const predictionData = JSON.parse(predictionDataStr);
            const clientsFromPrediction: ClientInRoute[] = predictionData.clients.map((c: any) => ({
                ...c,
                date: c.date ? new Date(c.date) : new Date(),
                origin: 'predicted',
                status: 'Activo'
            }));
            
            setRouteName(predictionData.routeName || '');
            if (clientsFromPrediction.length > 0 && clientsFromPrediction[0].date) {
                setRouteDate(clientsFromPrediction[0].date);
            }
            setSelectedSupervisorId(predictionData.supervisorId || (currentUser?.supervisorId ?? undefined));
            setSelectedClients(clientsFromPrediction);
            setDialogSelectedClients(clients.filter(c => clientsFromPrediction.some(pc => pc.ruc === c.ruc)));

            toast({
                title: 'Predicción Cargada',
                description: 'Los datos de la predicción se han cargado en el formulario.'
            });

        } catch (error) {
            console.error("Error parsing prediction data from localStorage:", error);
            toast({
                title: 'Error de Carga',
                description: 'No se pudieron cargar los datos de la predicción.',
                variant: 'destructive'
            });
        } finally {
            localStorage.removeItem('predictionRoute');
        }
    }
  }, [users, currentUser, toast, clients]);

  useEffect(() => {
    if (isClientDialogOpen) {
      const currentSelectedClientsFromMainList = clients.filter(c => selectedClients.some(sc => sc.ruc === c.ruc && sc.status !== 'Eliminado'));
      setDialogSelectedClients(currentSelectedClientsFromMainList);
    }
  }, [isClientDialogOpen, clients, selectedClients]);

  const handleClientDetailChange = (ruc: string, field: keyof Omit<ClientInRoute, 'ruc' | 'nombre_comercial'>, value: any) => {
    setSelectedClients(prev => prev.map(client => 
      client.ruc === ruc ? { ...client, [field]: value } : client
    ));
  };
  
  const resetForm = () => {
    setRouteName('');
    setRouteDate(new Date());
    setSelectedClients([]);
    setDialogSelectedClients([]);
    if (currentUser?.role !== 'Usuario') {
        setSelectedSupervisorId(undefined);
    }
  }

  const handleAddToStage = () => {
    if (!routeName || !routeDate || selectedClients.filter(c => c.status !== 'Eliminado').length === 0 || !selectedSupervisorId) {
      toast({ title: 'Faltan datos', description: 'Por favor completa el nombre, fecha, supervisor y añade al menos un cliente activo.', variant: 'destructive' });
      return;
    }
    if (!currentUser) {
        toast({ title: 'Error', description: 'Debes iniciar sesión para crear una ruta.', variant: 'destructive' });
        return;
    }

    const supervisor = supervisors.find(s => s.id === selectedSupervisorId);
    if (!supervisor) {
        toast({ title: 'Error', description: 'Supervisor no encontrado.', variant: 'destructive' });
        return;
    }
    
    const newStagedRoute: StagedRoute = {
        tempId: Date.now(),
        routeName,
        date: routeDate,
        clients: [...selectedClients], // Ensure we capture individual dates
        status: 'Planificada',
        supervisorId: selectedSupervisorId,
        supervisorName: supervisor.name,
        createdBy: currentUser.id,
    };

    setStagedRoutes(prev => [...prev, newStagedRoute]);
    toast({ title: 'Ruta Añadida', description: `La ruta "${routeName}" ha sido añadida a la lista.` });
    resetForm();
  }
  
  const handleRemoveFromStage = (tempId: number) => {
    const routeToEdit = stagedRoutes.find(r => r.tempId === tempId);
    if (routeToEdit) {
      setRouteName(routeToEdit.routeName);
      setRouteDate(routeToEdit.date);
      setSelectedSupervisorId(routeToEdit.supervisorId);
      setSelectedClients(routeToEdit.clients);
      setDialogSelectedClients(clients.filter(c => routeToEdit.clients.some(sc => sc.ruc === c.ruc && sc.status !== 'Eliminado')));
    }
    setStagedRoutes(prev => prev.filter(r => r.tempId !== tempId));
  }
  
  const handleConfirmRemoval = () => {
    if (!clientToRemove) return;
    if (!removalObservation.trim()) {
        toast({ title: 'Observación requerida', description: 'Debes añadir una observación para eliminar al cliente.', variant: 'destructive'});
        return;
    }

    setSelectedClients(prev => prev.map(c => 
        c.ruc === clientToRemove.ruc ? { ...c, status: 'Eliminado', removalObservation: removalObservation } : c
    ));
    
    toast({ title: 'Cliente Marcado', description: `${clientToRemove.nombre_comercial} ha sido marcado como eliminado.`});
    setClientToRemove(null);
    setRemovalObservation('');
  }

  const handleSaveAllRoutes = async (sendForApproval: boolean) => {
    if (stagedRoutes.length === 0) {
        toast({ title: 'Lista Vacía', description: 'No hay rutas planificadas para guardar.', variant: 'destructive' });
        return;
    }
    if (!currentUser) return;

    setIsSaving(true);
    try {
        const routesToSave = stagedRoutes.map(({ tempId, ...rest }) => ({
            ...rest,
            status: (sendForApproval ? 'Pendiente de Aprobación' : 'Planificada') as RoutePlan['status']
        }));

        const routeIds = await addRoutesBatch(routesToSave);
        
        if (sendForApproval) {
            for (let i = 0; i < stagedRoutes.length; i++) {
                const route = stagedRoutes[i];
                const routeId = routeIds[i];
                await addNotification({
                    userId: route.supervisorId,
                    title: 'Nueva ruta para aprobar',
                    message: `${currentUser.name} ha enviado la ruta "${route.routeName}" para tu aprobación.`,
                    link: `/dashboard/routes/${routeId}`
                });
            }
        }
        
        toast({ title: 'Rutas Guardadas', description: `${stagedRoutes.length} rutas han sido ${sendForApproval ? 'enviadas a aprobación' : 'guardadas como planificadas'}.` });
        setStagedRoutes([]);
        await refetchData('routes');
        if (sendForApproval) {
            router.push('/dashboard/routes');
        }
    } catch(error: any) {
        console.error("Error saving routes:", error);
        if (error.code === 'permission-denied') {
            toast({ title: 'Error de Permisos', description: 'No tienes permiso para crear rutas.', variant: 'destructive' });
        } else {
            toast({ title: 'Error', description: error.message || 'No se pudieron guardar las rutas.', variant: 'destructive' });
        }
    } finally {
        setIsSaving(false);
    }
  }

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
    const mainRouteDateObj = routeDate instanceof Date ? routeDate : (routeDate ? new Date(routeDate) : new Date());
    
    const newClientsInRoute: ClientInRoute[] = dialogSelectedClients.map(client => {
        const existingClient = selectedClients.find(sc => sc.ruc === client.ruc);
        if (existingClient) {
            // CRITICAL: Strictly preserve existing individual client date
            return { 
                ...existingClient, 
                status: 'Activo', 
                date: existingClient.date ? new Date(existingClient.date) : mainRouteDateObj 
            };
        }
        return {
            ruc: client.ruc,
            nombre_comercial: client.nombre_comercial,
            date: mainRouteDateObj,
            origin: 'manual',
            status: 'Activo'
        };
    });

    const finalClients = selectedClients.map(originalClient => {
        const isStillSelected = newClientsInRoute.some(nc => nc.ruc === originalClient.ruc);
        if (isStillSelected) {
            return newClientsInRoute.find(nc => nc.ruc === originalClient.ruc)!;
        }
        return {
            ...originalClient,
            status: 'Eliminado' as const,
            removalObservation: originalClient.removalObservation || 'Eliminado de la selección',
        };
    }).concat(
        newClientsInRoute.filter(nc => !selectedClients.some(oc => oc.ruc === nc.ruc))
    );

    setSelectedClients(finalClients);
    setIsClientDialogOpen(false);
};

  const handleOpenAddClientToDateDialog = (date: Date) => {
      setCurrentAddDate(date);
      setAddDialogSelectedClients([]);
      setAddDialogSearchTerm('');
      setIsAddClientToDateDialogOpen(true);
  }

  const handleConfirmAddClientToDate = () => {
    if (addDialogSelectedClients.length === 0 || !currentAddDate) {
        setIsAddClientToDateDialogOpen(false);
        return;
    }

    const newClientsToAdd: ClientInRoute[] = addDialogSelectedClients.map(client => ({
        ruc: client.ruc,
        nombre_comercial: client.nombre_comercial,
        date: currentAddDate,
        origin: 'manual',
        status: 'Activo'
    }));

    setSelectedClients(prev => [...prev, ...newClientsToAdd]);
    setIsAddClientToDateDialogOpen(false);
    toast({
        title: `${newClientsToAdd.length} cliente(s) añadido(s)`,
        description: `Se han añadido a la fecha ${format(currentAddDate, 'PPP', { locale: es })}.`
    });
  }

  const handleAddDialogClientToggle = (client: Client) => {
    setAddDialogSelectedClients(prev => {
        const isSelected = prev.some(c => c.ruc === client.ruc);
        if (isSelected) {
            return prev.filter(c => c.ruc !== client.ruc);
        } else {
            return [...prev, client];
        }
    });
  };
  
  const filteredAvailableClients = useMemo(() => {
    let userClients = clients;
    if (currentUser?.role === 'Usuario' || currentUser?.role === 'Telemercaderista') {
      userClients = clients.filter(c => c.ejecutivo === currentUser.name);
    }
    
    return userClients.filter(c => 
        String(c.nombre_cliente).toLowerCase().includes(dialogSearchTerm.toLowerCase()) ||
        String(c.nombre_comercial).toLowerCase().includes(dialogSearchTerm.toLowerCase()) ||
        String(c.ruc).includes(dialogSearchTerm)
    );
  }, [clients, dialogSearchTerm, currentUser]);

  const availableClientsForAddDialog = useMemo(() => {
    if (!currentAddDate) return [];

    const dateKey = format(currentAddDate, 'yyyy-MM-dd');
    const existingRucsForDate = new Set(
      selectedClients
        .filter(c => c.date && format(new Date(c.date), 'yyyy-MM-dd') === dateKey && c.status !== 'Eliminado')
        .map(c => c.ruc)
    );
    
    let userClients = clients.filter(c => !existingRucsForDate.has(c.ruc));
    
    if (currentUser?.role === 'Usuario' || currentUser?.role === 'Telemercaderista') {
      userClients = userClients.filter(c => c.ejecutivo === currentUser.name);
    }
    
    if (!addDialogSearchTerm) return userClients;

    return userClients.filter(c => 
        String(c.nombre_cliente).toLowerCase().includes(addDialogSearchTerm.toLowerCase()) ||
        String(c.nombre_comercial).toLowerCase().includes(addDialogSearchTerm.toLowerCase()) ||
        String(c.ruc).includes(addDialogSearchTerm)
    );
  }, [clients, selectedClients, addDialogSearchTerm, currentUser, currentAddDate]);

  const activeClientsWithIndex = useMemo(() => 
    selectedClients
      .map((c, i) => ({...c, originalIndex: i})) 
      .filter(c => c.status !== 'Eliminado')
      .map((c, i) => ({...c, globalIndex: i}))
  , [selectedClients]);

  const groupedClients = useMemo(() => {
    const groups: { [date: string]: typeof activeClientsWithIndex } = {};
    
    activeClientsWithIndex.forEach(client => {
        const dateObj = client.date ? new Date(client.date) : null;
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

  const removedClients = useMemo(() => {
    return selectedClients.filter(c => c.status === 'Eliminado');
  }, [selectedClients]);

  return (
    <>
      <PageHeader title="Planificación de Rutas" description="Crea y añade planes de ruta a la lista para guardarlos." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Detalles de la Ruta</CardTitle>
            <CardDescription>Completa los detalles y añade la ruta a la lista de planificación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="routeName">Nombre de la Ruta</Label>
              <Input id="routeName" placeholder="ej., Quito Norte - Semana 24" value={routeName} onChange={(e) => setRouteName(e.target.value)} disabled={isFormDisabled}/>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                <Label htmlFor="supervisor">Asignar Supervisor</Label>
                <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId} disabled={isFormDisabled || currentUser?.role === 'Usuario'}>
                    <SelectTrigger id="supervisor">
                        <Users className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                        {isLoading ? (
                            <SelectItem value="loading" disabled>Cargando...</SelectItem>
                        ) : (
                            supervisors.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))
                        )}
                    </SelectContent>
                </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="routeDate">Fecha de la Ruta</Label>
                    <Popover open={isRouteCalendarOpen} onOpenChange={setIsRouteCalendarOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                id="routeDate"
                                variant={"outline"}
                                className={cn(
                                "w-full justify-start text-left font-normal",
                                !routeDate && "text-muted-foreground"
                                )}
                                disabled={isFormDisabled}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {routeDate ? format(new Date(routeDate), "PPP", {locale: es}) : <span>Elige una fecha</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={routeDate ? new Date(routeDate) : undefined}
                                onSelect={setRouteDate}
                                initialFocus
                                locale={es}
                            />
                            <div className="p-2 border-t border-border">
                                <Button onClick={() => setIsRouteCalendarOpen(false)} className="w-full">
                                    Seleccionar
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
            
            <Separator />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Clientes en la Ruta</Label>
                <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="link" size="sm" className="h-auto p-0" disabled={isFormDisabled}>
                            Gestionar Selección ({selectedClients.filter(c => c.status !== 'Eliminado').length})
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Seleccionar Clientes</DialogTitle>
                            <DialogDescription>Añade o quita clientes de tu plan general.</DialogDescription>
                        </DialogHeader>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar..." className="pl-8" value={dialogSearchTerm} onChange={(e) => setDialogSearchTerm(e.target.value)}/>
                        </div>
                        <ScrollArea className="h-72">
                            <div className="space-y-2 p-1">
                            {filteredAvailableClients.map(client => (
                                <div key={client.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                    <div className="flex items-center space-x-3">
                                        <Checkbox 
                                            id={`client-diag-${client.id}`}
                                            checked={dialogSelectedClients.some(c => c.ruc === client.ruc)}
                                            onCheckedChange={() => handleDialogClientToggle(client)}
                                        />
                                        <Label htmlFor={`client-diag-${client.id}`} className="font-normal cursor-pointer">
                                            <p className="font-medium">{client.nombre_comercial}</p>
                                            <p className="text-xs text-muted-foreground">{client.ruc}</p>
                                        </Label>
                                    </div>
                                </div>
                            ))}
                            </div>
                        </ScrollArea>
                        <DialogFooter>
                            <Button onClick={handleConfirmClientSelection}>Confirmar Selección</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
              </div>
               <div className="flex h-10 w-full items-center rounded-md border border-input bg-background/50 px-3 py-2 text-sm text-muted-foreground">
                  <Users className="mr-2 h-4 w-4"/>
                  <span>{selectedClients.filter(c => c.status !== 'Eliminado').length} cliente(s) en la ruta</span>
              </div>
            </div>
            
            <div className="space-y-2 mt-4 max-h-[60vh] overflow-y-auto pr-2">
                {groupedClients.map(([date, clientsInGroup]) => (
                    <Collapsible key={date} defaultOpen className="border-l-2 pl-4 -ml-4 py-2 border-slate-200">
                        <CollapsibleTrigger asChild>
                            <div className="flex w-full items-center justify-between rounded-lg p-2 cursor-pointer hover:bg-muted/50">
                                <div className="flex items-center gap-3">
                                    <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                                    <h4 className="font-semibold">
                                        {date === 'Sin Fecha' 
                                            ? 'Clientes Sin Fecha' 
                                            : format(new Date(date + 'T00:00:00'), 'EEEE, dd \'de\' MMMM', { locale: es })}
                                    </h4>
                                    <Badge variant="secondary">{clientsInGroup.length}</Badge>
                                </div>
                                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7"
                                      onClick={() => handleOpenAddClientToDateDialog(new Date(date + 'T00:00:00'))}
                                      disabled={isFormDisabled || date === 'Sin Fecha'}
                                  >
                                      <PlusCircle className="h-4 w-4 mr-1" />
                                      Añadir
                                  </Button>
                                   <div className="p-1.5">
                                      <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                </div>
                            </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 p-2 pt-2">
                            {clientsInGroup.map((client) => {
                                const hasDescuento = client.nombre_comercial.toLowerCase().includes('descuento');
                                const isNew = client.origin === 'manual';
                                const isFromPrediction = client.origin === 'predicted';
                                
                                return (
                                <Card key={client.ruc} className={cn(
                                    "p-4 bg-muted/50 relative", 
                                    isNew && "border-green-500", 
                                    isFromPrediction && "border-blue-500",
                                )}>
                                    {isNew && <Badge className="absolute -top-2 -right-2 z-10">Nuevo</Badge>}
                                    {isFromPrediction && <Badge variant="secondary" className="absolute -top-2 -right-2 z-10">Predicción</Badge>}
                                    
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{client.globalIndex + 1}. {client.nombre_comercial}</p>
                                            <p className="text-xs text-muted-foreground">{client.ruc}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setClientToRemove(client)} disabled={isFormDisabled}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                    <Separator className="my-2" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                                        <div className="space-y-2">
                                            <Label htmlFor={`dayOfWeek-${client.ruc}`}>Día</Label>
                                            <Select value={client.dayOfWeek} onValueChange={(value) => handleClientDetailChange(client.ruc, 'dayOfWeek', value)} disabled={isFormDisabled} >
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
                                                {client.date ? format(new Date(client.date), 'PPP', { locale: es }) : <span>Elige una fecha</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="p-0">
                                                <Calendar mode="single" selected={client.date ? new Date(client.date) : undefined} onSelect={(date) => handleClientDetailChange(client.ruc, 'date', date)} initialFocus locale={es} />
                                                <div className="p-2 border-t border-border"><Button onClick={() => setCalendarOpen(prev => ({ ...prev, [client.ruc]: false }))} className="w-full">Seleccionar</Button></div>
                                            </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`start-time-${client.ruc}`}>Hora de Inicio</Label>
                                            <Select value={client.startTime} onValueChange={(value) => handleClientDetailChange(client.ruc, 'startTime', value)} disabled={isFormDisabled}>
                                            <SelectTrigger id={`start-time-${client.ruc}`}><Clock className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                            <SelectContent>{startTimeSlots.map(time => (<SelectItem key={time} value={time}>{time}</SelectItem>))}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`end-time-${client.ruc}`}>Hora de Fin</Label>
                                            <Select value={client.endTime} onValueChange={(value) => handleClientDetailChange(client.ruc, 'endTime', value)} disabled={isFormDisabled}>
                                            <SelectTrigger id={`end-time-${client.ruc}`}><Clock className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                            <SelectContent>{endTimeSlots.map(time => (<SelectItem key={time} value={time}>{time}</SelectItem>))}</SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </Card>
                                )
                            })}
                        </CollapsibleContent>
                    </Collapsible>
                ))}
                {removedClients.length > 0 && (
                    <Collapsible defaultOpen className="border-l-2 pl-4 -ml-4 py-2 border-destructive/30">
                        <CollapsibleTrigger asChild>
                            <div className="flex w-full items-center justify-between rounded-lg p-2 cursor-pointer hover:bg-muted/50">
                                <div className="flex items-center gap-3 text-destructive">
                                    <Trash2 className="h-5 w-5" />
                                    <h4 className="font-semibold">Clientes Eliminados</h4>
                                    <Badge variant="destructive">{removedClients.length}</Badge>
                                </div>
                                <Button variant="ghost" size="sm" className="w-9 p-0 text-destructive">
                                    <ChevronsUpDown className="h-4 w-4" />
                                </Button>
                            </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 p-2 pt-2">
                            {removedClients.map((client, index) => (
                                <Card key={client.ruc} className="p-4 bg-red-500/10 border-red-500/50 relative">
                                    <Badge variant="destructive" className="absolute -top-2 -right-2 z-10">Eliminado</Badge>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold line-through">{index + 1}. {client.nombre_comercial}</p>
                                            <p className="text-xs text-muted-foreground">{client.ruc}</p>
                                        </div>
                                    </div>
                                    <Separator className="my-2" />
                                    {client.removalObservation && (
                                        <Alert variant="destructive" className="mt-2">
                                            <AlertDescription>
                                                <strong>Observación:</strong> {client.removalObservation}
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </Card>
                            ))}
                        </CollapsibleContent>
                    </Collapsible>
                )}
            </div>
          </CardContent>
           <CardFooter>
            <Button onClick={handleAddToStage} disabled={isFormDisabled} className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir a la Lista de Planificación
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Rutas Planificadas</CardTitle>
            <CardDescription>{stagedRoutes.length} rutas en la lista para ser guardadas.</CardDescription>
          </CardHeader>
          <CardContent>
            {stagedRoutes.length === 0 ? (
              <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
                <p>Aún no has añadido rutas.</p>
                <p className="text-sm">Completa el formulario y haz clic en "Añadir a la Lista".</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                {stagedRoutes.map((route) => (
                  <Card key={route.tempId} className="p-4 shadow-sm">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-semibold text-lg">{route.routeName}</p>
                            <p className="text-sm text-muted-foreground">
                                {route.clients.filter(c => c.status !== 'Eliminado').length} cliente(s)
                            </p>
                        </div>
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleRemoveFromStage(route.tempId)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    <Separator className="my-3" />
                    <div className="space-y-2 text-sm">
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">Supervisor:</span>
                            <span className="font-medium">{route.supervisorName}</span>
                         </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
            {stagedRoutes.length > 0 && (
                <CardFooter className="flex-col items-stretch gap-2 border-t pt-6">
                    <Button onClick={() => handleSaveAllRoutes(true)} disabled={isSaving} className="w-full">
                        {isSaving ? <LoaderCircle className="animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                        Guardar y Enviar a Aprobación
                    </Button>
                </CardFooter>
            )}
        </Card>
      </div>

       <AlertDialog open={!!clientToRemove} onOpenChange={() => setClientToRemove(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar a {clientToRemove?.nombre_comercial}?</AlertDialogTitle>
                <AlertDialogDescription>
                    Para eliminar a este cliente de la ruta, por favor, introduce una observación. El cliente se marcará como eliminado pero no se borrará del historial.
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
     <Dialog open={isAddClientToDateDialogOpen} onOpenChange={setIsAddClientToDateDialogOpen}>
        <DialogContent className="max-w-2xl">
            <DialogHeader>
                <DialogTitle>Añadir Clientes a la Fecha</DialogTitle>
                <DialogDescription>
                    {currentAddDate ? `Selecciona clientes para añadir al día ${format(currentAddDate, 'PPP', { locale: es })}.` : ''}
                </DialogDescription>
            </DialogHeader>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Buscar clientes no asignados..." 
                    className="pl-8" 
                    value={addDialogSearchTerm}
                    onChange={(e) => setAddDialogSearchTerm(e.target.value)}
                />
            </div>
            <ScrollArea className="h-72">
                <div className="space-y-2 p-1">
                {availableClientsForAddDialog.map(client => (
                    <div key={client.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                        <div className="flex items-center space-x-3">
                            <Checkbox 
                                id={`add-client-${client.id}`}
                                checked={addDialogSelectedClients.some(c => c.ruc === client.ruc)}
                                onCheckedChange={() => handleAddDialogClientToggle(client)}
                            />
                            <Label htmlFor={`add-client-${client.id}`} className="font-normal cursor-pointer">
                            <p className="font-medium">{client.nombre_comercial}</p>
                            <p className="text-xs text-muted-foreground">{client.ruc} - {client.nombre_cliente}</p>
                            </Label>
                        </div>
                    </div>
                ))}
                {availableClientsForAddDialog.length === 0 && <p className="text-center text-muted-foreground py-4">No hay más clientes disponibles.</p>}
                </div>
            </ScrollArea>
            <DialogFooter>
                <span className="text-sm text-muted-foreground mr-auto">{addDialogSelectedClients.length} cliente(s) seleccionados</span>
                <Button variant="ghost" onClick={() => setIsAddClientToDateDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleConfirmAddClientToDate}>Añadir Clientes</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
