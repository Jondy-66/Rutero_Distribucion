
'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar as CalendarIcon, Users, Check, ChevronsUpDown, LoaderCircle, Clock, Trash2 } from 'lucide-react';
import { getRoute, updateRoute } from '@/lib/firebase/firestore';
import type { Client, User, RoutePlan, ClientInRoute } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';

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
  const { clients, users, loading: authLoading } = useAuth();

  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [clientsInRoute, setClientsInRoute] = useState<ClientInRoute[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);

  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>();

  useEffect(() => {
    const fetchRouteData = async () => {
      setLoading(true);
      try {
        const routeData = await getRoute(params.id);
        if (routeData) {
          setRoute(routeData);
          setClientsInRoute(routeData.clients || []);
          setSelectedCalendarDate(routeData.date);
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
    fetchRouteData();
  }, [params.id, toast]);
  
  useEffect(() => {
      if (users) {
          setSupervisors(users.filter(u => u.role === 'Supervisor'));
      }
  }, [users]);


  const handleInputChange = <K extends keyof RoutePlan>(field: K, value: RoutePlan[K]) => {
    setRoute(prev => (prev ? { ...prev, [field]: value } : null));
  };

  const handleSelectClient = (ruc: string) => {
    const client = clients.find(c => c.ruc === ruc);
    if (!client) return;
    
    setClientsInRoute(prev => {
        const isAlreadyInRoute = prev.some(c => c.ruc === ruc);
        if (isAlreadyInRoute) {
            return prev.filter(c => c.ruc !== ruc);
        } else {
            return [...prev, { 
                ruc: client.ruc, 
                nombre_comercial: client.nombre_comercial 
            }];
        }
    });
  };
  
  const handleCalendarSelect = () => {
      if(selectedCalendarDate){
          handleInputChange('date', selectedCalendarDate);
      }
      setIsCalendarOpen(false);
  };
  
  const handleClientValueChange = useCallback((ruc: string, field: keyof Omit<ClientInRoute, 'ruc' | 'nombre_comercial'>, value: string) => {
      setClientsInRoute(prev => 
          prev.map(client => 
              client.ruc === ruc 
                  ? { ...client, [field]: value }
                  : client
          )
      );
  }, []);

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!route) return;

    if (!route.routeName || !route.date || clientsInRoute.length === 0 || !route.supervisorId || !route.startTime || !route.endTime) {
      toast({ title: 'Faltan datos', description: 'Por favor completa todos los campos requeridos.', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const supervisor = supervisors.find(s => s.id === route.supervisorId);
      const dataToUpdate: Partial<RoutePlan> = {
        ...route,
        supervisorName: supervisor?.name || '',
        date: Timestamp.fromDate(route.date),
        clients: clientsInRoute.map(c => ({
          ...c,
          valorVenta: parseFloat(String(c.valorVenta)) || 0,
          valorCobro: parseFloat(String(c.valorCobro)) || 0,
          devoluciones: parseFloat(String(c.devoluciones)) || 0,
          promociones: parseFloat(String(c.promociones)) || 0,
          medicacionFrecuente: parseFloat(String(c.medicacionFrecuente)) || 0,
        })),
      };
      
      delete dataToUpdate.id;

      await updateRoute(params.id, dataToUpdate);

      toast({ title: 'Éxito', description: 'Ruta actualizada correctamente.' });
      router.push('/dashboard/routes');
    } catch (error: any) {
      console.error(error);
      toast({ title: 'Error', description: 'No se pudo actualizar la ruta.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

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
  
  return (
    <>
      <PageHeader title="Editar Ruta" description="Actualiza los detalles de la ruta planificada.">
        <Link href="/dashboard/routes">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a la Lista
          </Button>
        </Link>
      </PageHeader>
      <form onSubmit={handleUpdateRoute}>
        <Card>
          <CardHeader>
            <CardTitle>Detalles Generales de la Ruta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="routeName">Nombre de la Ruta</Label>
              <Input id="routeName" value={route.routeName} onChange={(e) => handleInputChange('routeName', e.target.value)} disabled={isSaving} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="space-y-2">
                <Label htmlFor="dayOfWeek">Día</Label>
                <Select value={route.dayOfWeek} onValueChange={(value) => handleInputChange('dayOfWeek', value)} disabled={isSaving}>
                    <SelectTrigger id="dayOfWeek"><CalendarIcon className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccionar día" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Lunes">Lunes</SelectItem><SelectItem value="Martes">Martes</SelectItem><SelectItem value="Miércoles">Miércoles</SelectItem><SelectItem value="Jueves">Jueves</SelectItem><SelectItem value="Viernes">Viernes</SelectItem><SelectItem value="Sábado">Sábado</SelectItem><SelectItem value="Domingo">Domingo</SelectItem>
                    </SelectContent>
                </Select>
            </div>
              <div className="space-y-2">
                <Label>Fecha</Label>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant={'outline'} className={cn('w-full justify-start text-left font-normal', !route.date && 'text-muted-foreground')} disabled={isSaving}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {route.date ? format(route.date, 'PPP', { locale: es }) : <span>Elige una fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={selectedCalendarDate} onSelect={setSelectedCalendarDate} initialFocus locale={es} />
                    <div className="p-2 border-t border-border"><Button onClick={handleCalendarSelect} className="w-full">Seleccionar</Button></div>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supervisor">Asignar Supervisor</Label>
                <Select value={route.supervisorId} onValueChange={(value) => handleInputChange('supervisorId', value)} disabled={isSaving}>
                  <SelectTrigger id="supervisor"><Users className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{supervisors.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start-time">Hora de Inicio</Label>
                <Select value={route.startTime} onValueChange={(value) => handleInputChange('startTime', value)} disabled={isSaving}>
                  <SelectTrigger id="start-time"><Clock className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{startTimeSlots.map(time => (<SelectItem key={time} value={time}>{time}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time">Hora de Fin</Label>
                <Select value={route.endTime} onValueChange={(value) => handleInputChange('endTime', value)} disabled={isSaving}>
                  <SelectTrigger id="end-time"><Clock className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{endTimeSlots.map(time => (<SelectItem key={time} value={time}>{time}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
            <CardHeader>
                <CardTitle>Clientes en Ruta</CardTitle>
                <CardDescription>Añade clientes a la ruta y especifica los detalles de la visita para cada uno.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    <Label>Añadir o Quitar Clientes</Label>
                    <Popover open={open} onOpenChange={setOpen}>
                        <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between" disabled={isSaving}>
                            {clientsInRoute.length > 0 ? `${clientsInRoute.length} clientes seleccionados` : "Seleccionar clientes..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                        <Command>
                            <CommandInput placeholder="Buscar por RUC, nombre..." />
                            <CommandList>
                            <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                            <CommandGroup>
                                {clients.map((client) => (
                                <CommandItem key={client.ruc} onSelect={() => handleSelectClient(client.ruc)} value={`${client.nombre_comercial} ${client.nombre_cliente} ${client.ruc}`}>
                                    <Check className={cn("mr-2 h-4 w-4", clientsInRoute.some(c => c.ruc === client.ruc) ? "opacity-100" : "opacity-0")} />
                                    <div>
                                    <p>{client.nombre_comercial}</p>
                                    <p className="text-xs text-muted-foreground">{client.ruc}</p>
                                    </div>
                                </CommandItem>
                                ))}
                            </CommandGroup>
                            </CommandList>
                        </Command>
                        </PopoverContent>
                    </Popover>
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
                            {clientsInRoute.map((client, index) => (
                                <Card key={client.ruc} className="p-4 bg-muted/50">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{index + 1}. {client.nombre_comercial}</p>
                                            <p className="text-xs text-muted-foreground">{client.ruc}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSelectClient(client.ruc)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                    <Separator className="my-2" />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                        <div className="space-y-2">
                                            <Label htmlFor={`valor-venta-${client.ruc}`}>Valor de Venta ($)</Label>
                                            <Input id={`valor-venta-${client.ruc}`} type="text" placeholder="0.00" value={client.valorVenta ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'valorVenta', e.target.value)} disabled={isSaving} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`valor-cobro-${client.ruc}`}>Valor a Cobrar ($)</Label>
                                            <Input id={`valor-cobro-${client.ruc}`} type="text" placeholder="0.00" value={client.valorCobro ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'valorCobro', e.target.value)} disabled={isSaving} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`tipo-cobro-${client.ruc}`}>Tipo de Cobro</Label>
                                            <Select value={client.tipoCobro} onValueChange={(value: any) => handleClientValueChange(client.ruc, 'tipoCobro', value)} disabled={isSaving}>
                                            <SelectTrigger id={`tipo-cobro-${client.ruc}`}><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Efectivo">Efectivo</SelectItem><SelectItem value="Transferencia">Transferencia</SelectItem><SelectItem value="Cheque">Cheque</SelectItem>
                                            </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`devoluciones-${client.ruc}`}>Devoluciones ($)</Label>
                                            <Input id={`devoluciones-${client.ruc}`} type="text" placeholder="0.00" value={client.devoluciones ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'devoluciones', e.target.value)} disabled={isSaving} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`promociones-${client.ruc}`}>Promociones ($)</Label>
                                            <Input id={`promociones-${client.ruc}`} type="text" placeholder="0.00" value={client.promociones ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'promociones', e.target.value)} disabled={isSaving} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor={`medicacionFrecuente-${client.ruc}`}>Medicación Frecuente ($)</Label>
                                            <Input id={`medicacionFrecuente-${client.ruc}`} type="text" placeholder="0.00" value={client.medicacionFrecuente ?? ''} onChange={(e) => handleClientValueChange(client.ruc, 'medicacionFrecuente', e.target.value)} disabled={isSaving} />
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </CollapsibleContent>
                    </Collapsible>
                )}
            </CardContent>
            <CardFooter>
                <Button type="submit" disabled={isSaving}>
                {isSaving && <LoaderCircle className="animate-spin" />}
                Guardar Cambios
                </Button>
            </CardFooter>
        </Card>
      </form>
    </>
  );
}
