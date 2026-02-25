'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Calendar as CalendarIcon, Users, LoaderCircle, Trash2, Search, MessageSquare } from 'lucide-react';
import { addRoutesBatch } from '@/lib/firebase/firestore';
import type { Client, User, RoutePlan, ClientInRoute } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

const ensureDate = (d: any): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (d && typeof d.toDate === 'function') return d.toDate();
  const date = new Date(d);
  return isNaN(date.getTime()) ? new Date() : date;
};

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
  
  const [isFromPrediction, setIsFromPrediction] = useState(false);
  const [predictedDateStrings, setPredictedDateStrings] = useState<Set<string>>(new Set());

  // States for the "Add Client" Dialog
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [dialogSearchTerm, setDialogSearchTerm] = useState('');
  const [dialogSelectedClients, setDialogSelectedClients] = useState<Client[]>([]);
  const [targetDateForAdd, setTargetDateForAdd] = useState<Date | null>(null);
  
  // States for Removal Observation
  const [isRemovalDialogOpen, setIsRemovalDialogOpen] = useState(false);
  const [removalReason, setRemovalReason] = useState('');
  const [rucToToRemove, setRucToToRemove] = useState<string | null>(null);

  const [stagedRoutes, setStagedRoutes] = useState<StagedRoute[]>([]);

  // Si hay rutas en la lista, el formulario de la izquierda se bloquea
  const isFormLocked = stagedRoutes.length > 0;

  useEffect(() => {
    if (users) setSupervisors(users.filter(u => u.role === 'Supervisor'));
    if (currentUser?.supervisorId) setSelectedSupervisorId(currentUser.supervisorId);
    
    const predictionDataStr = localStorage.getItem('predictionRoute');
    if (predictionDataStr) {
        try {
            const data = JSON.parse(predictionDataStr);
            const dateStrings = new Set<string>();
            const clientsFromPred: ClientInRoute[] = data.clients.map((c: any) => {
                const d = c.date ? new Date(c.date) : new Date();
                dateStrings.add(format(d, 'yyyy-MM-dd'));
                return {
                    ...c,
                    date: d,
                    origin: 'predicted',
                    status: 'Activo'
                };
            });
            setRouteName(data.routeName || '');
            if (clientsFromPred[0]?.date) setRouteDate(clientsFromPred[0].date);
            setSelectedClients(clientsFromPred);
            setIsFromPrediction(true);
            setPredictedDateStrings(dateStrings);
            localStorage.removeItem('predictionRoute');
        } catch (e) { console.error(e); }
    }
  }, [users, currentUser]);

  const filteredDialogClients = useMemo(() => {
    const term = dialogSearchTerm.toLowerCase();
    return (clients || [])
      .filter(c => c.ejecutivo === currentUser?.name)
      .filter(c => 
        c.nombre_cliente.toLowerCase().includes(term) || 
        c.nombre_comercial.toLowerCase().includes(term) ||
        c.ruc.includes(term)
      )
      .filter(c => !selectedClients.some(sc => sc.ruc === c.ruc && sc.status !== 'Eliminado'));
  }, [clients, dialogSearchTerm, selectedClients, currentUser]);

  const handleOpenAddDialog = (date: Date) => {
    if (isFormLocked) return;
    setTargetDateForAdd(date);
    setIsClientDialogOpen(true);
  };

  const handleOpenRemovalDialog = (ruc: string) => {
    if (isFormLocked) return;
    setRucToToRemove(ruc);
    setRemovalReason('');
    setIsRemovalDialogOpen(true);
  };

  const confirmRemoval = () => {
    if (!rucToToRemove || !removalReason.trim()) {
        toast({ title: "Motivo requerido", description: "Debes indicar por qué eliminas este cliente.", variant: "destructive" });
        return;
    }
    setSelectedClients(prev => prev.map(c => 
        c.ruc === rucToToRemove ? { ...c, status: 'Eliminado', removalObservation: removalReason } : c
    ));
    setIsRemovalDialogOpen(false);
    setRucToToRemove(null);
    toast({ title: "Cliente eliminado", description: "Se ha registrado el motivo de la eliminación." });
  };

  const handleAddClientsToSelected = () => {
    if (dialogSelectedClients.length === 0 || !targetDateForAdd) return;
    
    const newClients: ClientInRoute[] = dialogSelectedClients.map(c => ({
      ruc: c.ruc,
      nombre_comercial: c.nombre_comercial,
      date: targetDateForAdd,
      status: 'Activo',
      origin: 'manual',
      visitStatus: 'Pendiente'
    }));
    
    setSelectedClients(prev => [...prev, ...newClients]);
    setDialogSelectedClients([]);
    setDialogSearchTerm('');
    setIsClientDialogOpen(false);
    toast({ title: `${newClients.length} clientes añadidos al día ${format(targetDateForAdd, 'EEEE', { locale: es })}` });
  };

  const handleAddToStage = () => {
    if (!routeName || !selectedSupervisorId || selectedClients.filter(c => c.status !== 'Eliminado').length === 0) {
      toast({ title: 'Faltan datos', description: 'Asegúrate de tener un nombre, supervisor y al menos un cliente.', variant: 'destructive' });
      return;
    }
    const supervisor = supervisors.find(s => s.id === selectedSupervisorId);
    setStagedRoutes(prev => [...prev, {
        tempId: Date.now(),
        routeName,
        date: routeDate || new Date(),
        clients: [...selectedClients],
        status: 'Planificada',
        supervisorId: selectedSupervisorId!,
        supervisorName: supervisor?.name || '',
        createdBy: currentUser!.id,
    }]);
    // No limpiamos routeName ni selectedClients aquí para que el usuario vea lo que añadió, pero el form se bloquea
    toast({ title: 'Ruta añadida a la lista de espera' });
  }

  const handleSaveAllRoutes = async (sendForApproval: boolean) => {
    setIsSaving(true);
    try {
        const routesToSave = stagedRoutes.map(({ tempId, ...rest }) => ({
            ...rest,
            status: (sendForApproval ? 'Pendiente de Aprobación' : 'Planificada') as RoutePlan['status']
        }));
        await addRoutesBatch(routesToSave);
        toast({ title: 'Rutas Guardadas con Éxito' });
        await refetchData('routes');
        router.push('/dashboard/routes');
    } catch(e) { 
        console.error(e);
        toast({ title: 'Error al guardar', variant: 'destructive' });
    } finally { 
        setIsSaving(false); 
    }
  }

  const activeClientsWithIndex = useMemo(() => 
    selectedClients
      .map((c, i) => ({...c, originalIndex: i})) 
      .filter(c => c.status !== 'Eliminado')
      .map((c, i) => ({...c, globalIndex: i}))
  , [selectedClients]);

  const displayedDays = useMemo(() => {
    if (isFromPrediction) {
        return Array.from(predictedDateStrings)
            .sort()
            .map(ds => new Date(ds + 'T00:00:00'));
    }
    const base = routeDate || new Date();
    const monday = startOfWeek(base, { weekStartsOn: 1 });
    return Array.from({ length: 5 }).map((_, i) => addDays(monday, i));
  }, [isFromPrediction, predictedDateStrings, routeDate]);

  return (
    <>
      <PageHeader title="Planificación de Rutas" description="Crea y guarda planes de ruta de 5 días." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={cn(isFormLocked && "opacity-60 grayscale-[0.5]")}>
          <CardHeader>
            <CardTitle>Detalles de la Ruta</CardTitle>
            <CardDescription>Configura los clientes y fechas para tu nuevo plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la Ruta</Label>
              <Input 
                placeholder="Ej: Ruta Norte Semana 08" 
                value={routeName} 
                onChange={(e) => setRouteName(e.target.value)} 
                disabled={isFormLocked}
              />
            </div>
            <div className="space-y-2">
                <Label>Supervisor</Label>
                <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId} disabled={isFormLocked}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar supervisor" /></SelectTrigger>
                    <SelectContent>{supervisors.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                </Select>
            </div>
            
            <Separator />

            {!isFromPrediction && (
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-tight text-[#011688]">Cronograma Semanal</h3>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="font-bold" disabled={isFormLocked}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                Cambiar Semana Base
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0">
                            <Calendar mode="single" selected={routeDate} onSelect={setRouteDate} locale={es} />
                        </PopoverContent>
                    </Popover>
                </div>
            )}

            <div className="space-y-4">
                {displayedDays.map((day) => {
                    const dayClients = activeClientsWithIndex.filter(c => isSameDay(ensureDate(c.date), day));
                    const canAddThisDay = !isFromPrediction || predictedDateStrings.has(format(day, 'yyyy-MM-dd'));
                    
                    return (
                        <Collapsible key={day.toISOString()} defaultOpen className="border-l-4 pl-4 py-2 border-[#011688]/20 bg-slate-50/50 rounded-r-lg">
                            <div className="flex w-full items-center justify-between p-2">
                                <CollapsibleTrigger asChild>
                                    <div className="flex items-center gap-3 cursor-pointer hover:bg-slate-100 rounded-lg transition-all p-1">
                                        <CalendarIcon className="h-5 w-5 text-[#011688]" />
                                        <h4 className="font-black text-sm uppercase">
                                            {format(day, 'EEEE, dd \'de\' MMMM', { locale: es })}
                                        </h4>
                                        <Badge variant="secondary" className={cn("font-black", dayClients.length === 0 && "opacity-30")}>
                                            {dayClients.length}
                                        </Badge>
                                    </div>
                                </CollapsibleTrigger>
                                {canAddThisDay && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="font-black text-[#011688] hover:bg-[#011688]/10 h-8"
                                        onClick={() => handleOpenAddDialog(day)}
                                        disabled={isFormLocked}
                                    >
                                        <PlusCircle className="mr-1 h-4 w-4" />
                                        AÑADIR
                                    </Button>
                                )}
                            </div>
                            <CollapsibleContent className="space-y-4 p-2 mt-2">
                                {dayClients.map((client) => (
                                    <Card key={client.ruc} className="p-4 relative hover:shadow-md transition-shadow border-l-2 border-l-[#011688]/10">
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-black text-sm text-[#011688] uppercase">{client.globalIndex + 1}. {client.nombre_comercial}</p>
                                                    {client.origin === 'manual' && (
                                                        <Badge variant="success" className="text-[8px] font-black h-4 px-1.5 animate-pulse">NUEVO</Badge>
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-mono text-muted-foreground">{client.ruc}</p>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenRemovalDialog(client.ruc)} disabled={isFormLocked}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                                {dayClients.length === 0 && (
                                    <p className="text-[10px] text-center text-muted-foreground/60 italic uppercase font-bold py-2">Sin clientes asignados</p>
                                )}
                            </CollapsibleContent>
                        </Collapsible>
                    );
                })}
            </div>
          </CardContent>
           <CardFooter>
            <Button 
                onClick={handleAddToStage} 
                className="w-full h-12 font-black uppercase tracking-tighter" 
                disabled={activeClientsWithIndex.length === 0 || isFormLocked}
            >
                Añadir a la Lista
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Rutas en Lista</CardTitle>
            <CardDescription>Rutas pendientes por ser guardadas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stagedRoutes.map(r => (
                <Card key={r.tempId} className="p-4 flex justify-between items-center bg-[#011688]/5 border-[#011688]/20">
                    <div>
                        <p className="font-black text-[#011688] uppercase text-sm">{r.routeName}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase">
                            {r.clients.filter(c => c.status !== 'Eliminado').length} CLIENTES | SUPERVISOR: {r.supervisorName}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setStagedRoutes(prev => prev.filter(st => st.tempId !== r.tempId))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </Card>
            ))}
            {stagedRoutes.length === 0 && (
                <div className="text-center py-12 text-muted-foreground font-bold uppercase text-xs">La lista de rutas está vacía</div>
            )}
          </CardContent>
          <CardFooter>
            {stagedRoutes.length > 0 && (
                <Button onClick={() => handleSaveAllRoutes(true)} className="w-full h-12 font-black bg-green-600 hover:bg-green-700" disabled={isSaving}>
                    {isSaving ? <LoaderCircle className="animate-spin mr-2" /> : null}
                    GUARDAR Y ENVIAR A APROBACIÓN
                </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      {/* Dialog for Adding Clients */}
      <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[600px] p-0 overflow-hidden bg-white max-h-[90vh] flex flex-col rounded-2xl">
            <DialogHeader className="p-6 pb-2">
                <DialogTitle className="text-2xl font-black text-[#011688] uppercase">
                    Añadir a {targetDateForAdd ? format(targetDateForAdd, 'EEEE', { locale: es }) : 'Día'}
                </DialogTitle>
                <DialogDescription className="font-bold text-muted-foreground uppercase text-xs">Buscador multicriterio (RUC, Nombre, Comercial).</DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar..."
                        className="pl-10 h-12 border-2 border-[#011688]/20 focus:border-[#011688] rounded-xl font-bold"
                        value={dialogSearchTerm}
                        onChange={(e) => setDialogSearchTerm(e.target.value)}
                    />
                </div>
                <ScrollArea className="flex-1 pr-2">
                    <div className="space-y-3">
                        {filteredDialogClients.map((client) => {
                            const isSelected = dialogSelectedClients.some(c => c.ruc === client.ruc);
                            return (
                                <div
                                    key={client.ruc}
                                    className={cn(
                                        "flex items-center space-x-4 p-4 rounded-xl border-2 transition-all cursor-pointer",
                                        isSelected ? "bg-[#011688]/5 border-[#011688]" : "bg-slate-50 border-transparent hover:border-slate-200"
                                    )}
                                    onClick={() => {
                                        if (isSelected) {
                                            setDialogSelectedClients(prev => prev.filter(c => c.ruc !== client.ruc));
                                        } else {
                                            setDialogSelectedClients(prev => [...prev, client]);
                                        }
                                    }}
                                >
                                    <Checkbox checked={isSelected} className="h-5 w-5 border-[#011688]" />
                                    <div className="flex-1">
                                        <p className="text-sm font-black text-[#011688] uppercase">{client.nombre_comercial}</p>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{client.nombre_cliente}</p>
                                        <p className="text-[10px] font-mono text-muted-foreground mt-1">{client.ruc}</p>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredDialogClients.length === 0 && (
                            <div className="text-center py-12 text-muted-foreground font-bold uppercase text-xs">No se encontraron clientes disponibles</div>
                        )}
                    </div>
                </ScrollArea>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex items-center justify-between">
                <span className="text-xs font-black text-[#011688] uppercase">{dialogSelectedClients.length} seleccionados</span>
                <div className="flex gap-2">
                    <DialogClose asChild><Button variant="ghost" className="font-bold">CANCELAR</Button></DialogClose>
                    <Button onClick={handleAddClientsToSelected} disabled={dialogSelectedClients.length === 0} className="font-bold bg-[#011688] px-8 text-white">AÑADIR AL DÍA</Button>
                </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Removal Observation */}
      <Dialog open={isRemovalDialogOpen} onOpenChange={setIsRemovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-black uppercase text-destructive flex items-center gap-2">
                <Trash2 className="h-5 w-5" /> Eliminar Cliente de Ruta
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase">Es obligatorio indicar el motivo por el cual este cliente no será visitado.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="font-bold uppercase text-[10px]">Motivo de la Eliminación</Label>
            <Textarea 
              value={removalReason} 
              onChange={(e) => setRemovalReason(e.target.value)}
              placeholder="Ej: Cliente solicitó cambio de fecha, local cerrado permanentemente, etc."
              className="mt-2 font-bold text-sm h-32"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" className="font-bold">CANCELAR</Button></DialogClose>
            <Button 
              variant="destructive" 
              onClick={confirmRemoval} 
              disabled={!removalReason.trim()}
              className="font-black"
            >
              ELIMINAR CLIENTE
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
