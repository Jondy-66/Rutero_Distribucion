'use client';
import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Calendar as CalendarIcon, Users, Check, ChevronsUpDown, LoaderCircle, Clock } from 'lucide-react';
import { getClients, addRoute } from '@/lib/firebase/firestore';
import type { Client } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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


export default function RoutesPage() {
  const { toast } = useToast();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState<string | undefined>();
  const [endTime, setEndTime] = useState<string | undefined>();
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [routeName, setRouteName] = useState('');

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const clientsData = await getClients();
        setClients(clientsData);
      } catch (error: any) {
        console.error("Failed to fetch clients:", error);
        if (error.code === 'permission-denied') {
            toast({ title: "Error de Permisos", description: "No se pudieron cargar los clientes.", variant: "destructive" });
        } else {
            toast({ title: "Error", description: "No se pudieron cargar los clientes.", variant: "destructive" });
        }
      } finally {
        setLoadingClients(false);
      }
    };
    fetchClients();
  }, [toast]);

  const handleSelectClient = (ruc: string) => {
    setSelectedClients(prev => 
      prev.includes(ruc) ? prev.filter(c => c !== ruc) : [...prev, ruc]
    );
  };
  
  const handleCreateRoute = async () => {
    if (!routeName || !date || selectedClients.length === 0) {
      toast({ title: 'Faltan datos', description: 'Por favor completa todos los campos para crear la ruta.', variant: 'destructive' });
      return;
    }
    setIsCreating(true);
    try {
        const clientsForRoute = clients.filter(c => selectedClients.includes(c.ruc));
        await addRoute({
            routeName,
            date: Timestamp.fromDate(date),
            clients: clientsForRoute,
            status: 'Planificada'
        });
        toast({ title: 'Ruta Creada', description: 'La ruta ha sido planificada exitosamente.' });
        setRouteName('');
        setSelectedClients([]);
        setDate(new Date());
    } catch(error: any) {
        console.error(error);
        if (error.code === 'permission-denied') {
            toast({ title: 'Error de Permisos', description: 'No tienes permiso para crear rutas.', variant: 'destructive' });
        } else {
            toast({ title: 'Error', description: 'No se pudo crear la ruta.', variant: 'destructive' });
        }
    } finally {
        setIsCreating(false);
    }
  }

  return (
    <>
      <PageHeader title="Planificación de Rutas" description="Crea y gestiona tus rutas de venta.">
        <Button onClick={handleCreateRoute} disabled={isCreating}>
            {isCreating ? <LoaderCircle className="animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Crear Ruta
        </Button>
      </PageHeader>
      <div className="grid grid-cols-1 gap-6">
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Detalles de la Ruta</CardTitle>
              <CardDescription>Completa los detalles para tu nuevo plan de ruta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="space-y-2">
                <Label>Seleccionar Clientes</Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between"
                      disabled={loadingClients}
                    >
                      {loadingClients ? 'Cargando clientes...' : selectedClients.length > 0 ? `${selectedClients.length} clientes seleccionados` : "Seleccionar clientes..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Buscar clientes..." />
                      <CommandList>
                        <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                        <CommandGroup>
                          {clients.map((client) => (
                            <CommandItem
                              key={client.ruc}
                              onSelect={() => handleSelectClient(client.ruc)}
                              value={client.nombre_comercial}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedClients.includes(client.ruc) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {client.nombre_comercial}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="routeName">Nombre de la Ruta</Label>
                <Input id="routeName" placeholder="ej., Quito Norte - Semana 24" value={routeName} onChange={(e) => setRouteName(e.target.value)} />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                   <div className="space-y-2">
                      <Label>Fecha</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant={'outline'}
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !date && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, 'PPP', { locale: es }) : <span>Elige una fecha</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={date} onSelect={setDate} initialFocus locale={es} />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="start-time">Hora de Inicio</Label>
                      <Select value={startTime} onValueChange={setStartTime}>
                          <SelectTrigger id="start-time">
                              <Clock className="mr-2 h-4 w-4" />
                              <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                              {startTimeSlots.map(time => (
                                  <SelectItem key={time} value={time}>{time}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end-time">Hora de Fin</Label>
                       <Select value={endTime} onValueChange={setEndTime}>
                          <SelectTrigger id="end-time">
                               <Clock className="mr-2 h-4 w-4" />
                              <SelectValue placeholder="Seleccionar" />
                          </SelectTrigger>
                          <SelectContent>
                              {endTimeSlots.map(time => (
                                  <SelectItem key={time} value={time}>{time}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                    </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supervisor">Asignar Supervisor</Label>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <Input id="supervisor" placeholder="Selecciona un supervisor" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Clientes Seleccionados</CardTitle>
              <CardDescription>{selectedClients.length} clientes seleccionados para esta ruta.</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedClients.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>Aún no hay clientes seleccionados.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {clients.filter(c => selectedClients.includes(c.ruc)).map(client => (
                    <div key={client.id} className="p-3 border rounded-md shadow-sm">
                      <p className="font-semibold">{client.nombre_comercial}</p>
                      <p className="text-sm text-muted-foreground">{client.direccion}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                        <Input placeholder="Ventas" type="number" />
                        <Input placeholder="Pagos" type="number" />
                        <Input placeholder="Devoluciones" type="number" />
                        <Input placeholder="Caducados" type="number" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
