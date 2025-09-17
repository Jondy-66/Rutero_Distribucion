
'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Clock, Plus, Route, Search, GripVertical, Trash2, MapPin, LoaderCircle, LogIn, LogOut, Building2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { getClients, getRoutes } from '@/lib/firebase/firestore';
import type { Client, RoutePlan } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
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


type RouteClient = Client & {
    valorVenta: string;
    valorCobro: string;
    devoluciones: string;
    promociones: string;
    medicacionFrecuente: string;
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
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [routes, setRoutes] = useState<RoutePlan[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RoutePlan | undefined>();

  const [routeClients, setRouteClients] = useState<RouteClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: -1.8312, lng: -78.1834 });
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number} | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isClientMapOpen, setIsClientMapOpen] = useState(false);
  const [clientForMap, setClientForMap] = useState<Client | null>(null);
  const { toast } = useToast();
  const [selectedClient, setSelectedClient] = useState<RouteClient | null>(null);

  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [clientsData, routesData] = await Promise.all([getClients(), getRoutes()]);
        setAvailableClients(clientsData);
        setRoutes(routesData);
      } catch (error: any) {
        console.error("Failed to fetch data:", error);
        toast({ title: "Error", description: "No se pudieron cargar los clientes y rutas.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);
  
  const unassignedClients = useMemo(() => {
    const assignedRucs = new Set(routeClients.map(c => c.ruc));
    return availableClients.filter(c => !assignedRucs.has(c.ruc));
  }, [availableClients, routeClients]);


  const handleAddClient = (client: Client) => {
    const newClient: RouteClient = {
        ...client,
        valorVenta: '0.00',
        valorCobro: '0.00',
        devoluciones: '0.00',
        promociones: '0.00',
        medicacionFrecuente: '0.00',
    };
    setRouteClients(prev => [...prev, newClient]);
  }

  const handleRemoveClient = (ruc: string) => {
    setRouteClients(prev => {
        const updatedClients = prev.filter((client) => client.ruc !== ruc);
        if (selectedClient?.ruc === ruc) {
            setSelectedClient(null);
        }
        return updatedClients;
    });
  }
  
  const handleClientValueChange = (ruc: string, field: keyof Omit<RouteClient, keyof Client>, value: string) => {
      setRouteClients(prevClients => {
          const updatedClients = prevClients.map(client => {
              if (client.ruc === ruc) {
                  return { ...client, [field]: value };
              }
              return client;
          });
          const updatedSelectedClient = updatedClients.find(c => c.ruc === ruc);
          if (updatedSelectedClient) {
              setSelectedClient(updatedSelectedClient);
          }
          return updatedClients;
      });
  }

  const handleGetLocation = (forDialog: boolean = false) => {
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
  };
  
  const handleCheckInOpen = () => {
    setCheckInTime(format(new Date(), 'HH:mm:ss'));
    handleGetLocation(true);
  }

  const handleCheckOutOpen = () => {
    setCheckOutTime(format(new Date(), 'HH:mm:ss'));
    handleGetLocation(true);
  }

  const handleSaveLocation = () => {
      if(!markerPosition) {
          toast({ title: "Sin ubicación", description: "No se ha fijado una ubicación para guardar.", variant: "destructive" });
          return;
      }
      // Here you would typically save the location to your state or database
      toast({ title: "Ubicación Guardada", description: `Lat: ${markerPosition.lat.toFixed(4)}, Lon: ${markerPosition.lng.toFixed(4)}` });
      setIsMapOpen(false);
  }
  
  const handleRouteSelect = (routeId: string) => {
      const route = routes.find(r => r.id === routeId);
      if (route) {
          setSelectedRoute(route);
          setSelectedClient(null); // Reset selected client when route changes
          const clientsData = route.clients.map(clientInRoute => {
              const clientDetails = availableClients.find(c => c.ruc === clientInRoute.ruc);
              return {
                  ...(clientDetails || {}), // Detalle completo del cliente
                  ...clientInRoute, // Datos específicos de la ruta
                  valorVenta: String(clientInRoute.valorVenta || '0.00'),
                  valorCobro: String(clientInRoute.valorCobro || '0.00'),
                  devoluciones: String(clientInRoute.devoluciones || '0.00'),
                  promociones: String(clientInRoute.promociones || '0.00'),
                  medicacionFrecuente: String(clientInRoute.medicacionFrecuente || '0.00'),
              } as RouteClient;
          }).filter(c => c.id); // Ensure only valid clients are added
          setRouteClients(clientsData);
      }
  }

  const getNumericValueClass = (value: string) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || value === '') return '';
    if (numericValue < 100) return 'bg-red-100 border-red-300 text-red-900 focus-visible:ring-red-500';
    if (numericValue >= 100) return 'bg-green-100 border-green-300 text-green-900 focus-visible:ring-green-500';
    return '';
  };
  
  const routeDate = useMemo(() => {
    if (selectedRoute && selectedRoute.clients.length > 0 && selectedRoute.clients[0].date) {
        return selectedRoute.clients[0].date;
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

  const esFarmacia = selectedClient?.nombre_comercial?.toLowerCase().includes('farmacia');


  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column */}
        <div className="lg:col-span-1 flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Configuración de Ruta</CardTitle>
                    <CardDescription>Selecciona una ruta o configura una nueva.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Seleccionar Ruta</Label>
                        <Select onValueChange={handleRouteSelect} value={selectedRoute?.id} disabled={loading}>
                            <SelectTrigger>
                                <Route className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Elige una ruta planificada" />
                            </SelectTrigger>
                            <SelectContent>
                                {routes.map(route => (
                                    <SelectItem key={route.id} value={route.id}>{route.routeName}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedRoute && (
                       <div className="space-y-4">
                            <Separator />
                            <div>
                                <Label>Clientes en Ruta ({routeClients.length})</Label>
                                <div className="mt-2 space-y-2 max-h-60 overflow-y-auto pr-2 rounded-md border p-2">
                                    {routeClients.length > 0 ? routeClients.map(client => (
                                        <div 
                                            key={client.ruc} 
                                            className={cn(
                                                "flex items-center justify-between text-sm p-2 bg-muted/50 rounded-md cursor-pointer hover:bg-muted",
                                                selectedClient?.ruc === client.ruc && "bg-primary/10 border-primary/50 border"
                                            )}
                                            onClick={() => setSelectedClient(client)}
                                        >
                                            <span className="truncate flex-1" title={client.nombre_comercial}>{client.nombre_comercial}</span>
                                            <div className="flex items-center">
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {e.stopPropagation(); handleViewClientOnMap(client)}}>
                                                    <MapPin className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )) : <p className="text-sm text-muted-foreground text-center py-4">No hay clientes en esta ruta.</p>}
                                </div>
                            </div>
                        </div>
                    )}

                     <div className="space-y-2">
                        <Label>Fecha</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start font-normal text-left", !routeDate && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {routeDate ? format(routeDate, 'PPP', {locale: es}) : 'Selecciona una fecha'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={routeDate || undefined} initialFocus locale={es} />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-4">
                        <Separator />
                        <Label className="flex items-center gap-2 text-muted-foreground">
                            <Building2 className="h-5 w-5" />
                            Marcación Entrada/Salida
                        </Label>
                        <div className="grid grid-cols-2 gap-4">
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="flex-col h-auto py-3" onClick={handleCheckInOpen} disabled={!selectedClient}>
                                        <LogIn className="h-6 w-6 text-primary mb-2" />
                                        <span className="font-semibold text-primary">MARCAR ENTRADA</span>
                                        <span className="text-xs text-muted-foreground">(Pend. Hoy)</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <div className="h-40 -mx-6 -mt-6 rounded-t-lg overflow-hidden">
                                        {gettingLocation || !markerPosition ? (
                                             <Skeleton className="h-full w-full" />
                                        ) : (
                                            <MapView center={markerPosition} markerPosition={markerPosition} containerClassName="h-full w-full" />
                                        )}
                                    </div>
                                    <AlertDialogHeader className="text-center items-center">
                                    <AlertDialogTitle className="text-2xl">Entrada a Cliente</AlertDialogTitle>
                                    <AlertDialogDescription className="text-base">
                                        Se marcará evento de entrada con fecha <br />
                                        <span className="font-bold text-lg text-foreground">
                                             hoy a las {checkInTime}
                                        </span>
                                        <br />
                                        en la ubicación mostrada. ¿Desea continuar?
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex-row gap-4">
                                        <AlertDialogCancel className="w-full">Cancelar</AlertDialogCancel>
                                        <AlertDialogAction className="w-full">Confirmar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" className="flex-col h-auto py-3" onClick={handleCheckOutOpen} disabled={!selectedClient}>
                                        <LogOut className="h-6 w-6 text-primary mb-2" />
                                        <span className="font-semibold text-primary">MARCAR SALIDA</span>
                                        <span className="text-xs text-muted-foreground">(Pend. Hoy)</span>
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <div className="h-40 -mx-6 -mt-6 rounded-t-lg overflow-hidden">
                                        {gettingLocation || !markerPosition ? (
                                             <Skeleton className="h-full w-full" />
                                        ) : (
                                            <MapView center={markerPosition} markerPosition={markerPosition} containerClassName="h-full w-full" />
                                        )}
                                    </div>
                                    <AlertDialogHeader className="text-center items-center">
                                    <AlertDialogTitle className="text-2xl">Salida de Cliente</AlertDialogTitle>
                                    <AlertDialogDescription className="text-base">
                                        Se marcará evento de salida con fecha <br />
                                        <span className="font-bold text-lg text-foreground">
                                             hoy a las {checkOutTime}
                                        </span>
                                        <br />
                                        en la ubicación mostrada. ¿Desea continuar?
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex-row gap-4">
                                        <AlertDialogCancel className="w-full">Cancelar</AlertDialogCancel>
                                        <AlertDialogAction className="w-full">Confirmar</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>


                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Hora de Inicio</Label>
                             <Select value={selectedRoute?.startTime} defaultValue="08:00">
                                <SelectTrigger>
                                     <Clock className="mr-2 h-4 w-4" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {timeSlots.map(time => (
                                        <SelectItem key={time} value={time}>{time}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Hora de Fin</Label>
                             <Select value={selectedRoute?.endTime} defaultValue="18:00">
                                <SelectTrigger>
                                     <Clock className="mr-2 h-4 w-4" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                     {timeSlots.map(time => (
                                        <SelectItem key={time} value={time}>{time}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
                            <DialogTrigger asChild>
                                <Button className="w-full">
                                    <MapPin className="mr-2 h-4 w-4" />
                                    Mi Ubicación
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                                <DialogHeader>
                                    <DialogTitle>Verificar Ubicación</DialogTitle>
                                    <DialogDescription>
                                        Usa el botón para encontrar tu ubicación actual o arrastra el marcador. Haz clic en guardar cuando termines.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="flex-grow">
                                     <MapView 
                                        center={mapCenter}
                                        markerPosition={markerPosition}
                                        containerClassName="h-full w-full"
                                     />
                                </div>
                                <DialogFooter>
                                    <Button onClick={() => handleGetLocation(false)} disabled={gettingLocation}>
                                        {gettingLocation && <LoaderCircle className="animate-spin" />}
                                        {gettingLocation ? 'Buscando...' : 'Obtener Mi Ubicación Actual'}
                                    </Button>
                                    <Button onClick={handleSaveLocation} variant="default">
                                        Guardar Ubicación
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <div className="flex items-center space-x-2">
                            <Checkbox id="phone-call" />
                            <label
                                htmlFor="phone-call"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                Llamada telefónica
                            </label>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Clientes Disponibles</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative mb-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar por RUC, nombre..." className="pl-8" />
                    </div>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                       {loading ? (
                         Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between">
                               <div className="space-y-2">
                                   <Skeleton className="h-4 w-32" />
                                   <Skeleton className="h-3 w-48" />
                               </div>
                               <Skeleton className="h-8 w-20" />
                           </div>
                         ))
                       ) : (
                         unassignedClients.map((client) => (
                           <div key={client.id} className="flex items-center justify-between">
                              <div>
                                  <p className="font-medium">{client.nombre_comercial}</p>
                                  <p className="text-sm text-muted-foreground">{client.nombre_cliente}</p>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => handleAddClient(client)}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Añadir
                              </Button>
                          </div>
                         ))
                       )}
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2">
             <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>{selectedRoute ? selectedRoute.routeName : 'Gestión de Clientes'}</CardTitle>
                            <CardDescription>
                                {selectedClient ? `Gestionando a ${selectedClient.nombre_comercial}` : 'Selecciona un cliente de la lista para ver sus detalles.'}
                            </CardDescription>
                        </div>
                         {selectedRoute && <Badge variant="secondary">{selectedRoute.status}</Badge>}
                    </div>
                </CardHeader>
                <CardContent>
                    {!selectedRoute ? (
                        <div className="flex items-center justify-center min-h-[60vh] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-8 text-center">
                            <div>
                                <p className="font-semibold text-lg">Sin Ruta Seleccionada</p>
                                <p className="text-muted-foreground">Por favor, elige una ruta para empezar a gestionar clientes.</p>
                            </div>
                        </div>
                    ) : !selectedClient ? (
                        <div className="flex items-center justify-center min-h-[60vh] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-8 text-center">
                            <div>
                                <p className="font-semibold text-lg">Selecciona un Cliente</p>
                                <p className="text-muted-foreground">Haz clic en un cliente de la lista de la izquierda para ver y editar sus detalles.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Card key={selectedClient.id} className="p-4 bg-background">
                                <div className="flex items-start gap-4">
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-lg">{selectedClient.nombre_comercial}</p>
                                                <p className="text-sm text-muted-foreground">{selectedClient.direccion}</p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleRemoveClient(selectedClient.ruc)}>
                                                <Trash2 className="h-5 w-5" />
                                            </Button>
                                        </div>
                                        <Separator className="my-4" />
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <div className="space-y-1">
                                                <Label htmlFor={`venta-${selectedClient.ruc}`}>Valor de Venta ($)</Label>
                                                <Input id={`venta-${selectedClient.ruc}`} type="number" value={selectedClient.valorVenta} onChange={(e) => handleClientValueChange(selectedClient.ruc, 'valorVenta', e.target.value)} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor={`cobro-${selectedClient.ruc}`}>Valor de Cobro ($)</Label>
                                                <Input id={`cobro-${selectedClient.ruc}`} type="number" value={selectedClient.valorCobro} onChange={(e) => handleClientValueChange(selectedClient.ruc, 'valorCobro', e.target.value)} />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor={`devoluciones-${selectedClient.ruc}`}>Devoluciones ($)</Label>
                                                <Input id={`devoluciones-${selectedClient.ruc}`} type="number" value={selectedClient.devoluciones} onChange={(e) => handleClientValueChange(selectedClient.ruc, 'devoluciones', e.target.value)} />
                                            </div>
                                            {esFarmacia && (
                                                <>
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`promociones-${selectedClient.ruc}`}>Promociones ($)</Label>
                                                        <Input id={`promociones-${selectedClient.ruc}`} type="number" value={selectedClient.promociones} onChange={(e) => handleClientValueChange(selectedClient.ruc, 'promociones', e.target.value)} className={getNumericValueClass(selectedClient.promociones)} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`medicacionFrecuente-${selectedClient.ruc}`}>Medicación Frecuente ($)</Label>
                                                        <Input id={`medicacionFrecuente-${selectedClient.ruc}`} type="number" value={selectedClient.medicacionFrecuente} onChange={(e) => handleClientValueChange(selectedClient.ruc, 'medicacionFrecuente', e.target.value)} className={getNumericValueClass(selectedClient.medicacionFrecuente)} />
                                                    </div>
                                                </>
                                            )}
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
    </>
  );
}

    
