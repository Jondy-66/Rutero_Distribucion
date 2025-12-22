

'use client';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Clock, Plus, Route, Search, GripVertical, Trash2, MapPin, LoaderCircle, LogIn, LogOut, Building2, CheckCircle, AlertTriangle, ChevronRight, Save, Phone, User, PlusCircle, Download } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { getClients, getRoutes, updateRoute } from '@/lib/firebase/firestore';
import type { Client, RoutePlan, ClientInRoute } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, isToday, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { MapView } from '@/components/map-view';
import { isFinite } from 'lodash';
import { Calendar } from '@/components/ui/calendar';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import * as XLSX from 'xlsx';


type RouteClient = Client & {
    visitStatus?: 'Pendiente' | 'Completado';
    valorVenta: string;
    valorCobro: string;
    devoluciones: string;
    promociones: string;
    medicacionFrecuente: string;
    visitType?: 'presencial' | 'telefonica';
    callObservation?: string;
    origin?: 'manual' | 'predicted';
}

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

const timeSlots = generateTimeSlots(8, 18, 30);


export default function RouteManagementPage() {
  const { user, clients: availableClients, routes: allRoutes, loading: authLoading, refetchData } = useAuth();
  
  const [selectedRoute, setSelectedRoute] = useState<RoutePlan | undefined>();
  const [isRouteStarted, setIsRouteStarted] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isRouteExpired, setIsRouteExpired] = useState(false);

  const [routeClients, setRouteClients] = useState<RouteClient[]>([]);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: -1.8312, lng: -78.1834 });
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number} | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isClientMapOpen, setIsClientMapOpen] = useState(false);
  const [clientForMap, setClientForMap] = useState<Client | null>(null);
  const { toast } = useToast();
  
  // State for the active client being managed
  const [activeClient, setActiveClient] = useState<RouteClient | null>(null);
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [visitType, setVisitType] = useState<'presencial' | 'telefonica' | undefined>();
  const [callObservation, setCallObservation] = useState('');

  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [dialogSearchTerm, setDialogSearchTerm] = useState('');

  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<'checkIn' | 'checkOut' | null>(null);
  const [currentTime, setCurrentTime] = useState('');


  const loading = authLoading;
  
  useEffect(() => {
    const currentClient = routeClients.find(c => c.visitStatus !== 'Completado');
    setActiveClient(currentClient || null);
    setCheckInTime(null); // Reset check-in time when client changes
    setVisitType(undefined); // Reset visit type
    setCallObservation(''); // Reset observation
  }, [routeClients]);

  useEffect(() => {
    if (selectedRoute && selectedRoute.status === 'En Progreso') {
        const expirationDate = new Date(selectedRoute.date);
        expirationDate.setHours(18, 0, 0, 0); // 6 PM on the route's date
        if (new Date() > expirationDate) {
            setIsRouteExpired(true);
        }
    } else {
        setIsRouteExpired(false);
    }
}, [selectedRoute]);

  const handleClientValueChange = (ruc: string, field: keyof Omit<RouteClient, keyof Client>, value: string) => {
    setActiveClient(prev => {
        if (prev && prev.ruc === ruc) {
            return { ...prev, [field]: value };
        }
        return prev;
    });
  };

  const handleGetLocation = useCallback((forDialog: boolean = false) => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocalización no soportada",
        description: "Tu navegador no soporta la geolocalización.",
        variant: "destructive"
      });
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGettingLocation(false);
        const { latitude, longitude } = position.coords;
        const newPos = { lat: latitude, lng: longitude };
        setMapCenter(newPos);
        setMarkerPosition(newPos);
        if(!forDialog) {
          toast({
            title: "Ubicación Obtenida",
            description: `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`
          });
        }
      },
      (error) => {
        setGettingLocation(false);
        let description = "No se pudo obtener la ubicación.";
        if (error.code === error.PERMISSION_DENIED) {
            description = "Permiso de ubicación denegado. Actívalo en tu navegador.";
        }
        toast({
          title: "Error de Ubicación",
          description: description,
          variant: "destructive"
        });
      }
    );
  }, [toast]);
  
  const openConfirmationDialog = (action: 'checkIn' | 'checkOut') => {
    handleGetLocation(true);
    setCurrentTime(format(new Date(), 'HH:mm:ss'));
    setConfirmationAction(action);
    setConfirmationDialogOpen(true);
  };

  const handleConfirmAction = () => {
    if (confirmationAction === 'checkIn') {
        handleCheckIn();
    } else if (confirmationAction === 'checkOut') {
        handleConfirmCheckOut();
    }
    setConfirmationDialogOpen(false);
    setConfirmationAction(null);
  };

  const handleCheckIn = () => {
    const time = format(new Date(), 'HH:mm:ss');
    setCheckInTime(time);
    toast({ title: "Entrada Marcada", description: `Hora de entrada registrada a las ${time}` });
  }

  const handleConfirmCheckOut = async () => {
    if (!selectedRoute || !activeClient || !visitType) return;
    
    if (visitType === 'telefonica' && !callObservation) {
        toast({ title: "Observación Requerida", description: "Debes añadir un comentario para la gestión telefónica.", variant: "destructive" });
        return;
    }

    setIsSaving(true);

    try {
        const originalRoutePlan = allRoutes.find(r => r.id === selectedRoute.id);
        if (!originalRoutePlan) {
            throw new Error("No se pudo encontrar el plan de ruta original.");
        }
        let fullRoutePlanClients = [...originalRoutePlan.clients];

        const existingClientInPlan = fullRoutePlanClients.find(c => c.ruc === activeClient.ruc);

        const completedClientData: ClientInRoute = {
            ruc: activeClient.ruc,
            nombre_comercial: activeClient.nombre_comercial,
            date: existingClientInPlan?.date ?? activeClient.date ?? new Date(),
            dayOfWeek: existingClientInPlan?.dayOfWeek,
            startTime: existingClientInPlan?.startTime,
            endTime: existingClientInPlan?.endTime,
            origin: existingClientInPlan?.origin ?? activeClient.origin,
            visitStatus: 'Completado',
            visitType: visitType,
            callObservation: visitType === 'telefonica' ? callObservation : undefined,
            valorVenta: parseFloat(activeClient.valorVenta) || 0,
            valorCobro: parseFloat(activeClient.valorCobro) || 0,
            devoluciones: parseFloat(activeClient.devoluciones) || 0,
            promociones: parseFloat(activeClient.promociones) || 0,
            medicacionFrecuente: parseFloat(activeClient.medicacionFrecuente) || 0,
        };

        Object.keys(completedClientData).forEach(key => {
            if (completedClientData[key as keyof ClientInRoute] === undefined) {
                delete completedClientData[key as keyof ClientInRoute];
            }
        });

        const clientIndex = fullRoutePlanClients.findIndex(c => c.ruc === activeClient.ruc);

        if (clientIndex !== -1) {
            fullRoutePlanClients[clientIndex] = completedClientData;
        } else {
            fullRoutePlanClients.push(completedClientData);
        }

        const updatedLocalRouteClients = routeClients.map(c => 
            c.ruc === activeClient.ruc ? { ...c, visitStatus: 'Completado' as const } : c
        );
        
        toast({ title: "Salida Confirmada", description: `Visita a ${activeClient.nombre_comercial} completada.` });
        
        // Check if all clients are now completed
        const allClientsNowCompleted = updatedLocalRouteClients.every(
            c => c.visitStatus === 'Completado'
        );

        if (allClientsNowCompleted) {
            await updateRoute(selectedRoute.id, { status: 'Completada', clients: fullRoutePlanClients });
            toast({ title: "¡Ruta Finalizada!", description: "Todos los clientes han sido gestionados." });
            setSelectedRoute(prev => prev ? { ...prev, status: 'Completada' } : undefined);
            await refetchData('routes');
        } else {
            await updateRoute(selectedRoute.id, { clients: fullRoutePlanClients });
            // Refetch routes to update the context in the background
            await refetchData('routes');
        }

        // IMPORTANT: Update local state after DB operations to reflect changes
        setRouteClients(updatedLocalRouteClients);


    } catch(error: any) {
        console.error("Error updating route on checkout:", error);
        toast({ title: "Error", description: error.message || "No se pudo actualizar el estado de la visita.", variant: "destructive"});
    } finally {
        setIsSaving(false);
    }
  }
  
  const handleRouteSelect = (routeId: string) => {
      if (!allRoutes) return;
      const route = allRoutes.find(r => r.id === routeId);
      if (route) {
          setSelectedRoute(route);
          setIsRouteStarted(route.status === 'En Progreso');
          
          if (availableClients) {
            const today = startOfDay(new Date());

            const clientsData = route.clients
            .map(clientInRoute => {
                const clientDetails = availableClients.find(c => c.ruc === clientInRoute.ruc);
                return {
                    ...(clientDetails || {}),
                    ...clientInRoute,
                    visitStatus: clientInRoute.visitStatus || 'Pendiente',
                    valorVenta: String(clientInRoute.valorVenta || '0.00'),
                    valorCobro: String(clientInRoute.valorCobro || '0.00'),
                    devoluciones: String(clientInRoute.devoluciones || '0.00'),
                    promociones: String(clientInRoute.promociones || '0.00'),
                    medicacionFrecuente: String(clientInRoute.medicacionFrecuente || '0.00'),
                } as RouteClient;
            }).filter(c => c.id); // Filter out clients that weren't found in availableClients
            setRouteClients(clientsData);
          }
      }
  }

  const handleStartRoute = async () => {
      if (!selectedRoute) return;
      setIsStarting(true);
      try {
          await updateRoute(selectedRoute.id, { status: 'En Progreso' });
          await refetchData('routes');
          setIsRouteStarted(true);
          toast({ title: "Ruta Iniciada", description: `La ruta "${selectedRoute.routeName}" ha comenzado.` });
      } catch (error) {
          console.error("Failed to start route:", error);
          toast({ title: "Error", description: "No se pudo iniciar la ruta.", variant: 'destructive' });
      } finally {
          setIsStarting(false);
      }
  }

    const handleAddClientToRoute = (client: Client) => {
        const newRouteClient: RouteClient = {
            ...client,
            visitStatus: 'Pendiente',
            valorVenta: '0.00',
            valorCobro: '0.00',
            devoluciones: '0.00',
            promociones: '0.00',
            medicacionFrecuente: '0.00',
            origin: 'manual',
        };
        setRouteClients(prev => [...prev, newRouteClient]);
        toast({ title: 'Cliente Añadido', description: `${client.nombre_comercial} ha sido añadido a la ruta de hoy.` });
        setIsAddClientDialogOpen(false);
    }
    
    const availableClientsForDialog = useMemo(() => {
        const currentRucs = new Set(routeClients.map(c => c.ruc));
        
        let clientsToFilter = availableClients;

        if (user?.role === 'Usuario') {
            clientsToFilter = availableClients.filter(c => 
                c.ejecutivo?.trim().toLowerCase() === user.name?.trim().toLowerCase()
            );
        }

        return clientsToFilter.filter(c => {
          if (currentRucs.has(c.ruc)) return false;
          
          const searchTermLower = dialogSearchTerm.toLowerCase();
          return (
            String(c.nombre_cliente).toLowerCase().includes(searchTermLower) ||
            String(c.nombre_comercial).toLowerCase().includes(searchTermLower) ||
            String(c.ruc).includes(searchTermLower)
          );
        });
    }, [availableClients, routeClients, dialogSearchTerm, user]);

  const getNumericValueClass = (value: string) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || value === '') return '';
    if (numericValue < 100) return 'bg-red-100 border-red-300 text-red-900 focus-visible:ring-red-500';
    if (numericValue >= 100) return 'bg-green-100 border-green-300 text-green-900 focus-visible:ring-green-500';
    return '';
  };
  
  const routeDate = useMemo(() => {
    if (selectedRoute) {
        return selectedRoute.date;
    }
    return null;
  }, [selectedRoute]);
  
  const handleViewClientOnMap = (client: Client) => {
    if (isFinite(client.latitud) && isFinite(client.longitud)) {
        setClientForMap(client);
        setIsClientMapOpen(true);
    } else {
        toast({ title: "Ubicación no válida", description: "Este cliente no tiene coordenadas válidas.", variant: "destructive" });
    }
  }

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;

    if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
    ) {
        return;
    }

    const items = Array.from(routeClients);
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);

    setRouteClients(items);
  };
  
  const handleDownloadReport = () => {
    if (!selectedRoute) return;

    const completedClients = routeClients.filter(c => c.visitStatus === 'Completado');
    
    if (completedClients.length === 0) {
        toast({ title: "Sin Datos", description: "No hay clientes gestionados para generar un reporte.", variant: "destructive" });
        return;
    }

    const dataToExport = completedClients.map(client => {
      const fullClient = availableClients.find(c => c.ruc === client.ruc);
      return {
        'RUC': client.ruc,
        'Nombre Comercial': client.nombre_comercial,
        'Nombre Cliente': fullClient?.nombre_cliente || '',
        'Tipo de Visita': client.visitType === 'presencial' ? 'Presencial' : 'Telefónica',
        'Observación Llamada': client.callObservation || '',
        'Valor Venta ($)': parseFloat(client.valorVenta) || 0,
        'Valor Cobro ($)': parseFloat(client.valorCobro) || 0,
        'Devoluciones ($)': parseFloat(client.devoluciones) || 0,
        'Promociones ($)': parseFloat(client.promociones) || 0,
        'Medicación Frecuente ($)': parseFloat(client.medicacionFrecuente) || 0,
      }
    });
    
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Gestión de Ruta");
    XLSX.writeFile(workbook, `reporte_gestion_${selectedRoute.routeName.replace(/ /g, '_')}.xlsx`);
    toast({ title: "Reporte Generado", description: "El reporte de gestión se ha descargado." });
  };


  const hasDescuento = activeClient?.nombre_comercial?.toLowerCase().includes('descuento');
  const isFormDisabled = isRouteExpired || !checkInTime || !visitType;


  return (
    <>
    <PageHeader title="Gestión de Ruta" description="Selecciona, inicia y gestiona tus rutas diarias."/>
    
    {!isRouteStarted ? (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Selecciona una Ruta para Empezar</CardTitle>
                <CardDescription>Elige una de tus rutas planificadas para poder iniciarla y gestionarla.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Ruta</Label>
                    <Select onValueChange={handleRouteSelect} value={selectedRoute?.id} disabled={loading}>
                        <SelectTrigger>
                            <Route className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Elige una ruta planificada para hoy" />
                        </SelectTrigger>
                        <SelectContent>
                            {loading && <SelectItem value="loading" disabled>Cargando rutas...</SelectItem>}
                            {allRoutes && allRoutes
                                .filter(r => 
                                    r.createdBy === user?.id &&
                                    (r.status === 'Planificada' || r.status === 'En Progreso') && 
                                    r.date && isToday(r.date)
                                )
                                .map(route => (
                                    <SelectItem key={route.id} value={route.id}>{route.routeName}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {selectedRoute && (
                    <Button onClick={handleStartRoute} disabled={isStarting || selectedRoute.status !== 'Planificada'} className="w-full">
                        {isStarting && <LoaderCircle className="animate-spin mr-2" />}
                        {selectedRoute.status === 'Planificada' ? 'Iniciar Ruta' : 'Ruta ya en Progreso'}
                    </Button>
                )}
            </CardContent>
        </Card>
    ) : (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column */}
        <div className="lg:col-span-1 flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>{selectedRoute?.routeName}</CardTitle>
                    <CardDescription>Ruta actualmente en progreso.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {selectedRoute && (
                       <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Clientes en Ruta ({routeClients.length})</Label>
                                {(!routeClients.every(c => c.visitStatus === 'Completado') && selectedRoute?.status !== 'Completada') && (
                                <Dialog open={isAddClientDialogOpen} onOpenChange={setIsAddClientDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="ghost" size="sm" disabled={isRouteExpired}>
                                            <PlusCircle className="mr-2 h-4 w-4"/>
                                            Añadir
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl">
                                        <DialogHeader>
                                            <DialogTitle>Añadir Cliente a la Ruta</DialogTitle>
                                            <DialogDescription>
                                                Busca y selecciona un cliente para añadirlo a tu ruta actual.
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
                                                {availableClientsForDialog.map(client => (
                                                <div key={client.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                                    <div className="flex items-center space-x-3">
                                                        <Label htmlFor={`client-${client.id}`} className="font-normal cursor-pointer">
                                                        <p className="font-medium">{client.nombre_comercial}</p>
                                                        <p className="text-xs text-muted-foreground">{client.ruc} - {client.nombre_cliente}</p>
                                                        </Label>
                                                    </div>
                                                    <Button size="sm" onClick={() => handleAddClientToRoute(client)}>
                                                        <Plus className="mr-2"/> Añadir
                                                    </Button>
                                                </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </DialogContent>
                                </Dialog>
                                )}
                            </div>
                            <DragDropContext onDragEnd={onDragEnd}>
                                <Droppable droppableId="clients">
                                {(provided) => (
                                    <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className="mt-2 space-y-2 max-h-[calc(100vh-20rem)] overflow-y-auto pr-2 rounded-md border p-2"
                                    >
                                    {routeClients.length > 0 ? routeClients.map((client, index) => (
                                        <Draggable key={client.ruc} draggableId={client.ruc} index={index} isDragDisabled={client.visitStatus === 'Completado'}>
                                        {(provided, snapshot) => (
                                            <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className={cn(
                                                "flex items-center justify-between text-sm p-2 bg-muted/50 rounded-md relative",
                                                activeClient?.ruc === client.ruc && "bg-primary/10 border-primary/50 border",
                                                client.visitStatus === 'Completado' && 'opacity-60',
                                                snapshot.isDragging && "shadow-lg"
                                            )}
                                            >
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className={cn("cursor-grab", client.visitStatus === 'Completado' && 'cursor-not-allowed')}>
                                                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <span className={cn("font-semibold", activeClient?.ruc === client.ruc && "text-primary")}>{index + 1}.</span>
                                                <span className="truncate flex-1" title={client.nombre_comercial}>{client.nombre_comercial}</span>
                                            </div>
                                            <div className="flex items-center">
                                                {client.visitStatus === 'Completado' && <CheckCircle className="h-4 w-4 text-green-500 mr-2" />}
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {e.stopPropagation(); handleViewClientOnMap(client)}}>
                                                    <MapPin className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            {client.origin === 'manual' && <Badge className="absolute -top-2 -right-2 z-10">Nuevo</Badge>}
                                            </div>
                                        )}
                                        </Draggable>
                                    )) : <p className="text-sm text-muted-foreground text-center py-4">No hay clientes en esta ruta.</p>}
                                    {provided.placeholder}
                                    </div>
                                )}
                                </Droppable>
                            </DragDropContext>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2">
             <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>{selectedRoute ? "Gestión de Cliente" : 'Gestión de Clientes'}</CardTitle>
                            <CardDescription>
                                {activeClient ? `Gestionando a ${activeClient.nombre_comercial}` : 'Selecciona un cliente de la lista para ver sus detalles.'}
                            </CardDescription>
                        </div>
                         {selectedRoute && <Badge variant="secondary">{selectedRoute.status}</Badge>}
                    </div>
                </CardHeader>
                <CardContent>
                     {isRouteExpired && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Ruta Expirada</AlertTitle>
                            <AlertDescription>
                                El tiempo para gestionar esta ruta ha terminado (18:00). Ya no puedes realizar cambios.
                            </AlertDescription>
                        </Alert>
                    )}
                    {!selectedRoute ? (
                        <div className="flex items-center justify-center min-h-[60vh] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-8 text-center">
                            <div>
                                <p className="font-semibold text-lg">Sin Ruta Seleccionada</p>
                                <p className="text-muted-foreground">Por favor, elige una ruta para empezar a gestionar clientes.</p>
                            </div>
                        </div>
                    ) : !activeClient ? (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] rounded-lg border-2 border-dashed border-green-500/50 bg-green-500/10 p-8 text-center text-green-900">
                            <div>
                                <CheckCircle className="h-12 w-12 mx-auto mb-4" />
                                <p className="font-semibold text-xl">¡Ruta Completada!</p>
                                <p>Has gestionado todos los clientes de esta ruta. ¡Buen trabajo!</p>
                                <Button onClick={handleDownloadReport} className="mt-4">
                                    <Download className="mr-2 h-4 w-4" />
                                    Generar Reporte
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Card key={activeClient.id} className="p-4 bg-background">
                                <div className="flex items-start gap-4">
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-lg">{activeClient.nombre_comercial}</p>
                                                <p className="text-sm text-muted-foreground">{activeClient.direccion}</p>
                                            </div>
                                        </div>
                                        <Separator className="my-4" />

                                        <div className="space-y-6">
                                            {/* --- CHECK IN --- */}
                                            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold text-lg">1</div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold">Marcar Entrada</h4>
                                                    <p className="text-sm text-muted-foreground">Registra tu hora de llegada al cliente.</p>
                                                </div>
                                                {checkInTime ? (
                                                     <div className="text-center">
                                                        <p className="font-bold text-green-600">Entrada Marcada</p>
                                                        <p className="text-sm font-mono">{checkInTime}</p>
                                                    </div>
                                                ) : (
                                                    <Button onClick={() => openConfirmationDialog('checkIn')} disabled={isRouteExpired}>
                                                        <LogIn className="mr-2" />
                                                        Marcar Entrada
                                                    </Button>
                                                )}
                                            </div>

                                            {/* --- VISIT TYPE --- */}
                                            <div className={cn("space-y-4 pl-14 transition-opacity", !checkInTime && "opacity-50 pointer-events-none")}>
                                                 <div className="flex items-center gap-4">
                                                     <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold text-lg">2</div>
                                                     <div>
                                                        <h4 className="font-semibold">Tipo de Visita</h4>
                                                        <p className="text-sm text-muted-foreground">Selecciona si la visita es presencial o por llamada.</p>
                                                     </div>
                                                </div>
                                                <RadioGroup onValueChange={(value: any) => setVisitType(value)} value={visitType} className="flex gap-4 pl-14">
                                                    <Label htmlFor="presencial" className="flex items-center gap-2 cursor-pointer rounded-md border p-3 has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
                                                        <RadioGroupItem value="presencial" id="presencial" />
                                                        <User className="mr-1 h-4 w-4" />
                                                        Visita Presencial
                                                    </Label>
                                                    <Label htmlFor="telefonica" className="flex items-center gap-2 cursor-pointer rounded-md border p-3 has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
                                                        <RadioGroupItem value="telefonica" id="telefonica" />
                                                        <Phone className="mr-1 h-4 w-4" />
                                                        Llamada Telefónica
                                                    </Label>
                                                </RadioGroup>
                                                {visitType === 'telefonica' && (
                                                    <div className="pl-14">
                                                        <Label htmlFor="callObservation">Observación de la llamada (requerido)</Label>
                                                        <Textarea
                                                            id="callObservation"
                                                            value={callObservation}
                                                            onChange={(e) => setCallObservation(e.target.value)}
                                                            placeholder="Ej: Cliente solicitó gestionar por teléfono..."
                                                            disabled={isRouteExpired}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            
                                            {/* --- DATA INPUT --- */}
                                            <div className={cn("space-y-4 transition-opacity", isFormDisabled && "opacity-50 pointer-events-none")}>
                                                <div className="flex items-center gap-4">
                                                     <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold text-lg">3</div>
                                                     <div>
                                                        <h4 className="font-semibold">Registrar Gestión</h4>
                                                        <p className="text-sm text-muted-foreground">Ingresa los valores de la visita.</p>
                                                     </div>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pl-14">
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`venta-${activeClient.ruc}`}>Valor de Venta ($)</Label>
                                                        <Input id={`venta-${activeClient.ruc}`} type="number" value={activeClient.valorVenta} onChange={(e) => handleClientValueChange(activeClient.ruc, 'valorVenta', e.target.value)} disabled={isFormDisabled} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`cobro-${activeClient.ruc}`}>Valor de Cobro ($)</Label>
                                                        <Input id={`cobro-${activeClient.ruc}`} type="number" value={activeClient.valorCobro} onChange={(e) => handleClientValueChange(activeClient.ruc, 'valorCobro', e.target.value)} disabled={isFormDisabled} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`devoluciones-${activeClient.ruc}`}>Devoluciones ($)</Label>
                                                        <Input id={`devoluciones-${activeClient.ruc}`} type="number" value={activeClient.devoluciones} onChange={(e) => handleClientValueChange(activeClient.ruc, 'devoluciones', e.target.value)} disabled={isFormDisabled} />
                                                    </div>
                                                    {hasDescuento && (
                                                        <>
                                                            <div className="space-y-1">
                                                                <Label htmlFor={`promociones-${activeClient.ruc}`}>Promociones ($)</Label>
                                                                <Input id={`promociones-${activeClient.ruc}`} type="number" value={activeClient.promociones} onChange={(e) => handleClientValueChange(activeClient.ruc, 'promociones', e.target.value)} className={getNumericValueClass(activeClient.promociones)} disabled={isFormDisabled} />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label htmlFor={`medicacionFrecuente-${activeClient.ruc}`}>Medicación Frecuente ($)</Label>
                                                                <Input id={`medicacionFrecuente-${activeClient.ruc}`} type="number" value={activeClient.medicacionFrecuente} onChange={(e) => handleClientValueChange(activeClient.ruc, 'medicacionFrecuente', e.target.value)} className={getNumericValueClass(activeClient.medicacionFrecuente)} disabled={isFormDisabled} />
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* --- CHECK OUT --- */}
                                            <div className={cn("flex items-center gap-4 p-3 rounded-lg bg-muted/50 transition-opacity", isFormDisabled && "opacity-50 pointer-events-none")}>
                                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold text-lg">4</div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold">Marcar Salida</h4>
                                                    <p className="text-sm text-muted-foreground">Finaliza y guarda la visita a este cliente.</p>
                                                </div>
                                                <Button onClick={() => openConfirmationDialog('checkOut')} disabled={isFormDisabled || isSaving}>
                                                    <LogOut className="mr-2" />
                                                    Marcar y Guardar Salida
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
    )}
    <Dialog open={isClientMapOpen} onOpenChange={setIsClientMapOpen}>
        <DialogContent className="max-w-xl h-[60vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Ubicación de {clientForMap?.nombre_comercial}</DialogTitle>
            </DialogHeader>
            <div className="flex-grow">
                {clientForMap && (
                    <MapView 
                        key={clientForMap.id}
                        clients={[clientForMap]}
                        containerClassName="h-full w-full"
                    />
                )}
            </div>
        </DialogContent>
    </Dialog>
     <Dialog open={confirmationDialogOpen} onOpenChange={setConfirmationDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
            <div className="h-48 w-full">
                 <MapView 
                    key={confirmationAction}
                    center={markerPosition || undefined}
                    markerPosition={markerPosition}
                    containerClassName="h-full w-full"
                />
            </div>
            <div className="p-6 space-y-4 text-center">
                <DialogTitle className="text-xl">
                   Se marcará evento de <br/>
                    <span className="font-bold text-2xl text-primary">
                        {confirmationAction === 'checkIn' ? 'Entrada a Cliente' : 'Salida de Cliente'}
                    </span>
                </DialogTitle>
                <DialogDescription className="text-base">
                    con fecha hoy a las <span className="font-semibold text-foreground">{currentTime}</span>
                    <br />
                    en la ubicación mostrada. ¿Desea continuar?
                </DialogDescription>
            </div>
            <DialogFooter className="bg-muted/50 p-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirmationDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleConfirmAction} disabled={isSaving}>
                    {isSaving && <LoaderCircle className="animate-spin" />}
                    Confirmar
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}
