
'use client';
import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Calendar as CalendarIcon, Users, Check, ChevronsUpDown, LoaderCircle, Clock, Trash2, Save } from 'lucide-react';
import { addRoutesBatch } from '@/lib/firebase/firestore';
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
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
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

type StagedRoute = Omit<RoutePlan, 'id' | 'createdAt'> & { tempId: number };

export default function NewRoutePage() {
  const { toast } = useToast();
  const { user, users, clients, loading } = useAuth();
  
  // Form State
  const [routeName, setRouteName] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [startTime, setStartTime] = useState<string | undefined>();
  const [endTime, setEndTime] = useState<string | undefined>();
  const [valorVenta, setValorVenta] = useState('');
  const [valorCobro, setValorCobro] = useState('');
  const [tipoCobro, setTipoCobro] = useState<'Efectivo' | 'Transferencia' | 'Cheque' | undefined>();
  const [devoluciones, setDevoluciones] = useState('');
  const [expirados, setExpirados] = useState('');
  const [promociones, setPromociones] = useState('');
  const [medicacionFrecuente, setMedicacionFrecuente] = useState('');
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | undefined>();
  const [dayOfWeek, setDayOfWeek] = useState<string | undefined>();
  const [isDiaFarmacia, setIsDiaFarmacia] = useState(false);
  
  // Data State
  const [supervisors, setSupervisors] = useState<User[]>([]);
  
  // UI State
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Staging area for routes
  const [stagedRoutes, setStagedRoutes] = useState<StagedRoute[]>([]);
  
  useEffect(() => {
    if (users) {
      setSupervisors(users.filter(u => u.role === 'Supervisor'));
    }
  }, [users]);
  
  const handleCalendarSelect = () => {
      setDate(selectedCalendarDate);
      setIsCalendarOpen(false);
  };

  const handleSelectClient = (ruc: string) => {
    setSelectedClients(prev => 
      prev.includes(ruc) ? prev.filter(c => c !== ruc) : [...prev, ruc]
    );
  };
  
  const resetForm = () => {
    setRouteName('');
    setSelectedClients([]);
    setDate(new Date());
    setDayOfWeek(undefined);
    setStartTime(undefined);
    setEndTime(undefined);
    setSelectedSupervisorId(undefined);
    setValorVenta('');
    setValorCobro('');
    setTipoCobro(undefined);
    setDevoluciones('');
    setExpirados('');
    setPromociones('');
    setMedicacionFrecuente('');
    setIsDiaFarmacia(false);
  }

  const handleAddToStage = () => {
    if (!routeName || !date || selectedClients.length === 0 || !selectedSupervisorId || !startTime || !endTime) {
      toast({ title: 'Faltan datos', description: 'Por favor completa todos los campos para añadir la ruta.', variant: 'destructive' });
      return;
    }
    if (!user) {
        toast({ title: 'Error', description: 'Debes iniciar sesión para crear una ruta.', variant: 'destructive' });
        return;
    }

    const clientsForRoute = clients.filter(c => selectedClients.includes(c.ruc));
    const supervisor = supervisors.find(s => s.id === selectedSupervisorId);

    if (!supervisor) {
        toast({ title: 'Error', description: 'Supervisor no encontrado.', variant: 'destructive' });
        return;
    }
    
    const newStagedRoute: StagedRoute = {
        tempId: Date.now(),
        routeName,
        date,
        dayOfWeek,
        clients: clientsForRoute,
        status: 'Planificada',
        supervisorId: selectedSupervisorId,
        supervisorName: supervisor.name,
        createdBy: user.id,
        startTime,
        endTime,
        valorVenta: parseFloat(valorVenta) || 0,
        valorCobro: parseFloat(valorCobro) || 0,
        tipoCobro,
        devoluciones: parseFloat(devoluciones) || 0,
        expirados: parseFloat(expirados) || 0,
        promociones: parseFloat(promociones) || 0,
        medicacionFrecuente: parseFloat(medicacionFrecuente) || 0,
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
            date: Timestamp.fromDate(rest.date),
        }));

        await addRoutesBatch(routesToSave);
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

  const getNumericValueClass = (value: string) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || value === '') return '';
    if (numericValue < 100) return 'bg-red-100 border-red-300 text-red-900 focus-visible:ring-red-500';
    if (numericValue >= 100) return 'bg-green-100 border-green-300 text-green-900 focus-visible:ring-green-500';
    return '';
  };

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
              <Label>Seleccionar Clientes</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Cargando clientes...' : selectedClients.length > 0 ? `${selectedClients.length} clientes seleccionados` : "Seleccionar clientes..."}
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
                          <CommandItem
                            key={client.ruc}
                            onSelect={() => handleSelectClient(client.ruc)}
                            value={`${client.nombre_comercial} ${client.nombre_cliente} ${client.ruc}`}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedClients.includes(client.ruc) ? "opacity-100" : "opacity-0"
                              )}
                            />
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
                <Select value={dayOfWeek} onValueChange={setDayOfWeek} disabled={isLoading}>
                    <SelectTrigger id="dayOfWeek">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Seleccionar día" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Lunes">Lunes</SelectItem>
                        <SelectItem value="Martes">Martes</SelectItem>
                        <SelectItem value="Miércoles">Miércoles</SelectItem>
                        <SelectItem value="Jueves">Jueves</SelectItem>
                        <SelectItem value="Viernes">Viernes</SelectItem>
                        <SelectItem value="Sábado">Sábado</SelectItem>
                        <SelectItem value="Domingo">Domingo</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label>Fecha</Label>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant={'outline'}
                        className={cn(
                          'w-full justify-start text-left font-normal',
                          !date && 'text-muted-foreground'
                        )}
                         disabled={isLoading}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, 'PPP', { locale: es }) : <span>Elige una fecha</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={selectedCalendarDate} onSelect={setSelectedCalendarDate} initialFocus locale={es} />
                      <div className="p-2 border-t border-border">
                          <Button onClick={handleCalendarSelect} className="w-full">Seleccionar</Button>
                      </div>
                    </PopoverContent>
                  </Popover>
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
                <div className="space-y-2">
                  <Label htmlFor="start-time">Hora de Inicio</Label>
                  <Select value={startTime} onValueChange={setStartTime}  disabled={isLoading}>
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
                   <Select value={endTime} onValueChange={setEndTime}  disabled={isLoading}>
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
                 <div className="space-y-2">
                    <Label htmlFor="valor-venta">Valor de Venta ($)</Label>
                    <Input id="valor-venta" type="number" placeholder="0.00" value={valorVenta} onChange={(e) => setValorVenta(e.target.value)} disabled={isLoading} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="valor-cobro">Valor a Cobrar ($)</Label>
                    <Input id="valor-cobro" type="number" placeholder="0.00" value={valorCobro} onChange={(e) => setValorCobro(e.target.value)} disabled={isLoading} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="tipo-cobro">Tipo de Cobro</Label>
                   <Select value={tipoCobro} onValueChange={(v: any) => setTipoCobro(v)}  disabled={isLoading}>
                      <SelectTrigger id="tipo-cobro">
                          <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="Efectivo">Efectivo</SelectItem>
                          <SelectItem value="Transferencia">Transferencia</SelectItem>
                          <SelectItem value="Cheque">Cheque</SelectItem>
                      </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="devoluciones">Devoluciones ($)</Label>
                    <Input id="devoluciones" type="number" placeholder="0.00" value={devoluciones} onChange={(e) => setDevoluciones(e.target.value)} disabled={isLoading} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="expirados">Expirados ($)</Label>
                    <Input id="expirados" type="number" placeholder="0.00" value={expirados} onChange={(e) => setExpirados(e.target.value)} disabled={isLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="farmacia-descuento">Farmacia el Descuento</Label>
                  <Select onValueChange={(value) => setIsDiaFarmacia(value === 'si')} disabled={isLoading} defaultValue="no">
                      <SelectTrigger id="farmacia-descuento">
                          <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="si">Sí</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                  </Select>
                </div>
                <div /> 
                {isDiaFarmacia && (
                  <>
                    <div className="space-y-2">
                        <Label htmlFor="promociones">Promociones ($)</Label>
                        <Input id="promociones" type="number" placeholder="0.00" value={promociones} onChange={(e) => setPromociones(e.target.value)} disabled={isLoading} className={getNumericValueClass(promociones)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="medicacionFrecuente">Medicación Frecuente ($)</Label>
                        <Input id="medicacionFrecuente" type="number" placeholder="0.00" value={medicacionFrecuente} onChange={(e) => setMedicacionFrecuente(e.target.value)} disabled={isLoading} className={getNumericValueClass(medicacionFrecuente)}/>
                    </div>
                  </>
                )}
            </div>
          </CardContent>
           <CardFooter>
            <Button onClick={handleAddToStage} disabled={isLoading} className="w-full">
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir a la Lista
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
                                {format(route.date, 'PPP', { locale: es })} | {route.startTime} - {route.endTime}
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
                         <div className="flex justify-between">
                            <span className="text-muted-foreground">Clientes:</span>
                            <Badge variant="secondary">{route.clients.length}</Badge>
                         </div>
                         {route.dayOfWeek && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Día:</span>
                                <span className="font-medium">{route.dayOfWeek}</span>
                            </div>
                         )}
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
