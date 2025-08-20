
'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Clock, Plus, Route, Search, GripVertical, Trash2, MapPin, LoaderCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { getClients, getRoutes } from '@/lib/firebase/firestore';
import type { Client, RoutePlan } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { MapView } from '@/components/map-view';


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
  const { toast } = useToast();

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
    setRouteClients(prev => prev.filter((client) => client.ruc !== ruc));
  }
  
  const handleClientValueChange = (index: number, field: keyof Omit<RouteClient, keyof Client>, value: string) => {
      const updatedClients = [...routeClients];
      const clientToUpdate = { ...updatedClients[index], [field]: value };
      updatedClients[index] = clientToUpdate;
      setRouteClients(updatedClients);
  }

  const handleGetLocation = () => {
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
        toast({
          title: "Ubicación Obtenida",
          description: `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`
        });
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
          const clientsWithValues = route.clients.map(client => ({
            ...client,
            valorVenta: String(route.valorVenta || '0.00'),
            valorCobro: String(route.valorCobro || '0.00'),
            devoluciones: String(route.devoluciones || '0.00'),
            promociones: String(route.promociones || '0.00'),
            medicacionFrecuente: String(route.medicacionFrecuente || '0.00'),
          }));
          setRouteClients(clientsWithValues);
      }
  }

  const getNumericValueClass = (value: string) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || value === '') return '';
    if (numericValue < 100) return 'bg-red-100 border-red-300 text-red-900 focus-visible:ring-red-500';
    if (numericValue >= 100) return 'bg-green-100 border-green-300 text-green-900 focus-visible:ring-green-500';
    return '';
  };


  return (
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
                     <div className="space-y-2">
                        <Label>Fecha</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start font-normal text-left", !selectedRoute?.date && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedRoute?.date ? format(selectedRoute.date, 'PPP', {locale: es}) : 'Selecciona una fecha'}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar mode="single" selected={selectedRoute?.date} initialFocus locale={es} />
                            </PopoverContent>
                        </Popover>
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
                                    <Button onClick={handleGetLocation} disabled={gettingLocation}>
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
                            <CardTitle>{selectedRoute ? selectedRoute.routeName : 'Ruta de Hoy'}</CardTitle>
                            <CardDescription>Arrastra para reordenar los clientes en tu ruta.</CardDescription>
                        </div>
                         {selectedRoute && <Badge variant="secondary">{selectedRoute.status}</Badge>}
                    </div>
                </CardHeader>
                <CardContent>
                    {routeClients.length === 0 ? (
                        <div className="flex items-center justify-center min-h-[60vh] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-8 text-center">
                            <div>
                                <p className="font-semibold text-lg">Tu ruta está vacía.</p>
                                <p className="text-muted-foreground">Selecciona una ruta o añade clientes para empezar.</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {routeClients.map((client, index) => (
                                <Card key={client.id} className="p-4 bg-background">
                                    <div className="flex items-start gap-4">
                                        <div className="flex items-center gap-2 pt-1">
                                            <span className="font-bold text-lg">{index + 1}</span>
                                            <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-lg">{client.nombre_comercial}</p>
                                                    <p className="text-sm text-muted-foreground">{client.direccion}</p>
                                                </div>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleRemoveClient(client.ruc)}>
                                                    <Trash2 className="h-5 w-5" />
                                                </Button>
                                            </div>
                                            <Separator className="my-4" />
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                <div className="space-y-1">
                                                    <Label htmlFor={`venta-${index}`}>Valor de Venta ($)</Label>
                                                    <Input id={`venta-${index}`} type="number" value={client.valorVenta} onChange={(e) => handleClientValueChange(index, 'valorVenta', e.target.value)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`cobro-${index}`}>Valor de Cobro ($)</Label>
                                                    <Input id={`cobro-${index}`} type="number" value={client.valorCobro} onChange={(e) => handleClientValueChange(index, 'valorCobro', e.target.value)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`devoluciones-${index}`}>Devoluciones ($)</Label>
                                                    <Input id={`devoluciones-${index}`} type="number" value={client.devoluciones} onChange={(e) => handleClientValueChange(index, 'devoluciones', e.target.value)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`promociones-${index}`}>Promociones ($)</Label>
                                                    <Input id={`promociones-${index}`} type="number" value={client.promociones} onChange={(e) => handleClientValueChange(index, 'promociones', e.target.value)} className={getNumericValueClass(client.promociones)} />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label htmlFor={`medicacionFrecuente-${index}`}>Medicación Frecuente ($)</Label>
                                                    <Input id={`medicacionFrecuente-${index}`} type="number" value={client.medicacionFrecuente} onChange={(e) => handleClientValueChange(index, 'medicacionFrecuente', e.target.value)} className={getNumericValueClass(client.medicacionFrecuente)} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
