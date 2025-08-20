
'use client';
import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Calendar as CalendarIcon, Users, Check, ChevronsUpDown, LoaderCircle, Clock, Trash2, Save } from 'lucide-react';
import { addRoutesBatch } from '@/lib/firebase/firestore';
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
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

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
  const { toast } = useToast();
  const { user, users, clients, loading } = useAuth();
  
  // Form State
  const [routeName, setRouteName] = useState('');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | undefined>();
  
  // Client selection and details
  const [selectedClients, setSelectedClients] = useState<ClientInRoute[]>([]);
  
  // Data State
  const [supervisors, setSupervisors] = useState<User[]>([]);
  
  // UI State
  const [openClientSelector, setOpenClientSelector] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Staging area for routes
  const [stagedRoutes, setStagedRoutes] = useState<StagedRoute[]>([]);
  
  useEffect(() => {
    if (users) {
      setSupervisors(users.filter(u => u.role === 'Supervisor'));
    }
  }, [users]);

  const handleSelectClient = (ruc: string) => {
    const client = clients.find(c => c.ruc === ruc);
    if (!client) return;
    
    setSelectedClients(prev => {
        const isAlreadyInRoute = prev.some(c => c.ruc === ruc);
        if (isAlreadyInRoute) {
            return prev.filter(c => c.ruc !== ruc);
        } else {
            return [...prev, { 
                ruc: client.ruc, 
                nombre_comercial: client.nombre_comercial,
                date: new Date(),
            }];
        }
    });
  };

  const handleClientDetailChange = (ruc: string, field: keyof Omit<ClientInRoute, 'ruc' | 'nombre_comercial'>, value: any) => {
    setSelectedClients(prev => prev.map(client => 
      client.ruc === ruc ? { ...client, [field]: value } : client
    ));
  };
  
  const resetForm = () => {
    setRouteName('');
    setSelectedClients([]);
    setSelectedSupervisorId(undefined);
  }

  const handleAddToStage = () => {
    if (!routeName || selectedClients.length === 0 || !selectedSupervisorId) {
      toast({ title: 'Faltan datos', description: 'Por favor completa el nombre de la ruta, el supervisor y añade al menos un cliente.', variant: 'destructive' });
      return;
    }
    if (!user) {
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
        clients: selectedClients,
        status: 'Planificada',
        supervisorId: selectedSupervisorId,
        supervisorName: supervisor.name,
        createdBy: user.id,
    };

    setStagedRoutes(prev => [...prev, newStagedRoute]);
    toast({ title: 'Ruta Añadida', description: `La ruta "${routeName}" ha sido añadida a la lista.` });
    resetForm();
  }
  
  const handleRemoveFromStage = (tempId: number) => {
    setStagedRoutes(prev => prev.filter(r => r.tempId !== tempId));
  }

  const handleSaveAllRoutes = async () => {
    if (stagedRoutes.length === 0) {
        toast({ title: 'Lista Vacía', description: 'No hay rutas planificadas para guardar.', variant: 'destructive' });
        return;
    }
    setIsSaving(true);
    try {
        const routesToSave = stagedRoutes.map(({ tempId, ...rest }) => ({
            ...rest,
            clients: rest.clients.map(c => ({
              ...c,
              date: c.date ? Timestamp.fromDate(c.date) : undefined
            })),
        }));

        await addRoutesBatch(routesToSave as any);
        toast({ title: 'Rutas Guardadas', description: `${stagedRoutes.length} rutas han sido guardadas exitosamente.` });
        setStagedRoutes([]);
    } catch(error: any) {
        console.error(error);
        if (error.code === 'permission-denied') {
            toast({ title: 'Error de Permisos', description: 'No tienes permiso para crear rutas.', variant: 'destructive' });
        } else {
            toast({ title: 'Error', description: 'No se pudieron guardar las rutas.', variant: 'destructive' });
        }
    } finally {
        setIsSaving(false);
    }
  }

  const isLoading = loading;

  const clientsForSelection = clients.filter(c => !selectedClients.some(sc => sc.ruc === c.ruc));

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
              <Input id="routeName" placeholder="ej., Quito Norte - Semana 24" value={routeName} onChange={(e) => setRouteName(e.target.value)} disabled={isLoading}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="supervisor">Asignar Supervisor</Label>
               <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId} disabled={isLoading}>
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
            
            <Separator />

            <div className="space-y-2">
              <Label>Añadir Clientes a la Ruta</Label>
              <Popover open={openClientSelector} onOpenChange={setOpenClientSelector}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={openClientSelector}
                    className="w-full justify-between"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Cargando clientes...' : 'Seleccionar clientes...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar por RUC, nombre..." />
                    <CommandList>
                      <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                      <CommandGroup>
                        {clientsForSelection.map((client) => (
                          <CommandItem
                            key={client.ruc}
                            onSelect={() => handleSelectClient(client.ruc)}
                            value={`${client.nombre_comercial} ${client.nombre_cliente} ${client.ruc}`}
                          >
                            <Check className="mr-2 h-4 w-4 opacity-0" />
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

            {selectedClients.length > 0 && (
                <Collapsible defaultOpen className="space-y-4">
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" className="w-full justify-between p-2">
                            <span>Clientes Seleccionados ({selectedClients.length})</span>
                            <ChevronsUpDown className="h-4 w-4" />
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-4 p-2 pt-0 max-h-[60vh] overflow-y-auto">
                        {selectedClients.map((client, index) => (
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
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                                    <div className="space-y-2">
                                        <Label htmlFor={`dayOfWeek-${client.ruc}`}>Día</Label>
                                        <Select value={client.dayOfWeek} onValueChange={(value) => handleClientDetailChange(client.ruc, 'dayOfWeek', value)} >
                                            <SelectTrigger id={`dayOfWeek-${client.ruc}`}><CalendarIcon className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccionar día" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Lunes">Lunes</SelectItem><SelectItem value="Martes">Martes</SelectItem><SelectItem value="Miércoles">Miércoles</SelectItem><SelectItem value="Jueves">Jueves</SelectItem><SelectItem value="Viernes">Viernes</SelectItem><SelectItem value="Sábado">Sábado</SelectItem><SelectItem value="Domingo">Domingo</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fecha</Label>
                                        <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={'outline'} className={cn('w-full justify-start text-left font-normal', !client.date && 'text-muted-foreground')}>
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {client.date ? format(client.date, 'PPP', { locale: es }) : <span>Elige una fecha</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={client.date} onSelect={(date) => handleClientDetailChange(client.ruc, 'date', date)} initialFocus locale={es} />
                                        </PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`start-time-${client.ruc}`}>Hora de Inicio</Label>
                                        <Select value={client.startTime} onValueChange={(value) => handleClientDetailChange(client.ruc, 'startTime', value)}>
                                        <SelectTrigger id={`start-time-${client.ruc}`}><Clock className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                        <SelectContent>{startTimeSlots.map(time => (<SelectItem key={time} value={time}>{time}</SelectItem>))}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`end-time-${client.ruc}`}>Hora de Fin</Label>
                                        <Select value={client.endTime} onValueChange={(value) => handleClientDetailChange(client.ruc, 'endTime', value)}>
                                        <SelectTrigger id={`end-time-${client.ruc}`}><Clock className="mr-2 h-4 w-4" /><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                        <SelectContent>{endTimeSlots.map(time => (<SelectItem key={time} value={time}>{time}</SelectItem>))}</SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </CollapsibleContent>
                </Collapsible>
            )}
          </CardContent>
           <CardFooter>
            <Button onClick={handleAddToStage} disabled={isLoading} className="w-full">
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
                                {route.clients.length} cliente(s)
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
                <CardFooter className="border-t pt-6">
                    <Button onClick={handleSaveAllRoutes} disabled={isSaving} className="w-full">
                        {isSaving ? <LoaderCircle className="animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Guardar Todas las Rutas
                    </Button>
                </CardFooter>
            )}
        </Card>
      </div>
    </>
  );
}

    