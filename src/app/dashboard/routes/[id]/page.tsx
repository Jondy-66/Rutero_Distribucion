
'use client';
import { useState, useEffect } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar as CalendarIcon, Users, Check, ChevronsUpDown, LoaderCircle, Clock } from 'lucide-react';
import { getRoute, updateRoute } from '@/lib/firebase/firestore';
import type { Client, User, RoutePlan } from '@/lib/types';
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

  // Data State
  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [supervisors, setSupervisors] = useState<User[]>([]);

  // UI State
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
    if (!route) return;
    setRoute(prev => ({ ...prev!, [field]: value }));
  };

  const handleSelectClient = (ruc: string) => {
    if (!route) return;
    const currentClients = route.clients.map(c => c.ruc);
    const newSelectedRucs = currentClients.includes(ruc)
      ? currentClients.filter(c => c !== ruc)
      : [...currentClients, ruc];
    
    const newClients = clients.filter(c => newSelectedRucs.includes(c.ruc));
    handleInputChange('clients', newClients);
  };
  
  const handleCalendarSelect = () => {
      if(selectedCalendarDate){
          handleInputChange('date', selectedCalendarDate);
      }
      setIsCalendarOpen(false);
  };

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!route) return;

    if (!route.routeName || !route.date || route.clients.length === 0 || !route.supervisorId || !route.startTime || !route.endTime) {
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
      };
      
      delete dataToUpdate.id; // Don't try to update the ID

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
            <CardTitle>Detalles de la Ruta</CardTitle>
            <CardDescription>Modifica los campos y guarda los cambios.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="routeName">Nombre de la Ruta</Label>
              <Input id="routeName" value={route.routeName} onChange={(e) => handleInputChange('routeName', e.target.value)} disabled={isSaving} />
            </div>
            <div className="space-y-2">
              <Label>Seleccionar Clientes</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between" disabled={isSaving}>
                    {route.clients.length > 0 ? `${route.clients.length} clientes seleccionados` : "Seleccionar clientes..."}
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
                            <Check className={cn("mr-2 h-4 w-4", route.clients.some(c => c.ruc === client.ruc) ? "opacity-100" : "opacity-0")} />
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
            <div className="space-y-2">
                <Label htmlFor="dayOfWeek">Día</Label>
                <Select value={route.dayOfWeek} onValueChange={(value) => handleInputChange('dayOfWeek', value)} disabled={isSaving}>
                    <SelectTrigger id="dayOfWeek"><CalendarIcon className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccionar día" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Lunes">Lunes</SelectItem><SelectItem value="Martes">Martes</SelectItem><SelectItem value="Miércoles">Miércoles</SelectItem><SelectItem value="Jueves">Jueves</SelectItem><SelectItem value="Viernes">Viernes</SelectItem><SelectItem value="Sábado">Sábado</SelectItem><SelectItem value="Domingo">Domingo</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="valor-venta">Valor de Venta ($)</Label>
                <Input id="valor-venta" type="number" placeholder="0.00" value={route.valorVenta || ''} onChange={(e) => handleInputChange('valorVenta', parseFloat(e.target.value))} disabled={isSaving} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor-cobro">Valor a Cobrar ($)</Label>
                <Input id="valor-cobro" type="number" placeholder="0.00" value={route.valorCobro || ''} onChange={(e) => handleInputChange('valorCobro', parseFloat(e.target.value))} disabled={isSaving} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="tipo-cobro">Tipo de Cobro</Label>
                <Select value={route.tipoCobro} onValueChange={(value: any) => handleInputChange('tipoCobro', value)} disabled={isSaving}>
                  <SelectTrigger id="tipo-cobro"><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem><SelectItem value="Transferencia">Transferencia</SelectItem><SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="devoluciones">Devoluciones ($)</Label>
                <Input id="devoluciones" type="number" placeholder="0.00" value={route.devoluciones || ''} onChange={(e) => handleInputChange('devoluciones', parseFloat(e.target.value))} disabled={isSaving} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expirados">Expirados ($)</Label>
                <Input id="expirados" type="number" placeholder="0.00" value={route.expirados || ''} onChange={(e) => handleInputChange('expirados', parseFloat(e.target.value))} disabled={isSaving} />
              </div>
            </div>
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
