
'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { CalendarIcon, Clock, Plus, Route, Search, GripVertical, Trash2, MapPin, LoaderCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { getClients } from '@/lib/firebase/firestore';
import type { Client } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';

type RouteClient = Client & {
    valorVenta: string;
    valorCobro: string;
    devoluciones: string;
    expirados: string;
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
  const [routeClients, setRouteClients] = useState<RouteClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [gettingLocation, setGettingLocation] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchClients = async () => {
      setLoading(true);
      try {
        const clientsData = await getClients();
        setAvailableClients(clientsData);
      } catch (error: any) {
        console.error("Failed to fetch clients:", error);
        toast({ title: "Error", description: "No se pudieron cargar los clientes.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchClients();
  }, [toast]);


  const handleAddClient = (client: Client) => {
    const newClient: RouteClient = {
        ...client,
        valorVenta: '0.00',
        valorCobro: '0.00',
        devoluciones: '0.00',
        expirados: '0.00',
    };
    setRouteClients(prev => [...prev, newClient]);
  }

  const handleRemoveClient = (index: number) => {
    setRouteClients(prev => prev.filter((_, i) => i !== index));
  }
  
  const handleClientValueChange = (index: number, field: keyof Omit<RouteClient, 'id' | 'ejecutivo' | 'ruc' | 'nombre_cliente' | 'nombre_comercial' | 'provincia' | 'canton' | 'direccion' | 'latitud' | 'longitud' | 'status'>, value: string) => {
      const updatedClients = [...routeClients];
      updatedClients[index][field] = value;
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
        toast({
          title: "Ubicación Obtenida",
          description: `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`
        });
        // Here you would typically update a state or a form field with these coordinates
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
                        <Select>
                            <SelectTrigger>
                                <Route className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Elige una ruta predefinida" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ruta-1">Ruta Quito Norte</SelectItem>
                                <SelectItem value="ruta-2">Ruta Guayaquil Sur</SelectItem>
                            </SelectContent>
                        </Select>
                        <Slider defaultValue={[0]} max={100} step={1} className="py-2"/>
                    </div>
                     <div className="space-y-2">
                        <Label>Fecha</Label>
                        <Button variant="outline" className="w-full justify-start font-normal text-left">
                           <CalendarIcon className="mr-2 h-4 w-4" />
                           10 de julio de 2025
                        </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Hora de Inicio</Label>
                             <Select defaultValue="08:00">
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
                             <Select defaultValue="18:00">
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
                        <Button onClick={handleGetLocation} disabled={gettingLocation} className="w-full">
                            {gettingLocation ? (
                                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <MapPin className="mr-2 h-4 w-4" />
                            )}
                            {gettingLocation ? 'Buscando...' : 'Mi Ubicación'}
                        </Button>
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
                         availableClients.map((client) => (
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
                    <CardTitle>Ruta de Hoy</CardTitle>
                    <CardDescription>Arrastra para reordenar los clientes en tu ruta.</CardDescription>
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
                                <Card key={index} className="p-4 bg-background">
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
                                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleRemoveClient(index)}>
                                                    <Trash2 className="h-5 w-5" />
                                                </Button>
                                            </div>
                                            <Separator className="my-4" />
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                                                    <Label htmlFor={`expirados-${index}`}>Expirados ($)</Label>
                                                    <Input id={`expirados-${index}`} type="number" value={client.expirados} onChange={(e) => handleClientValueChange(index, 'expirados', e.target.value)} />
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
