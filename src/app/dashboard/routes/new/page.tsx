'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Calendar as CalendarIcon, Users, LoaderCircle, Trash2, Search, AlertCircle, ShieldCheck, ChevronDown, Info, ArrowUp, ArrowDown, Send } from 'lucide-react';
import { addRoutesBatch, getUser, addNotification } from '@/lib/firebase/firestore';
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
  const [routeDate, setRouteDate] = useState<Date | undefined>(() => {
      const now = new Date();
      const day = now.getDay();
      if (day === 6) return addDays(now, 2); 
      if (day === 0) return addDays(now, 1); 
      return now;
  });

  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | undefined>();
  const [selectedClients, setSelectedClients] = useState<ClientInRoute[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isFromPrediction, setIsFromPrediction] = useState(false);
  const [predictedDateStrings, setPredictedDateStrings] = useState<Set<string>>(new Set());

  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [dialogSearchTerm, setDialogSearchTerm] = useState('');
  const [dialogSelectedClients, setDialogSelectedClients] = useState<Client[]>([]);
  const [targetDateForAdd, setTargetDateForAdd] = useState<Date | null>(null);
  
  const [isRemovalDialogOpen, setIsRemovalDialogOpen] = useState(false);
  const [removalReason, setRemovalReason] = useState('');
  const [clientIndexToRemove, setClientIndexToRemove] = useState<number | null>(null);

  const [stagedRoutes, setStagedRoutes] = useState<StagedRoute[]>([]);
  const [resolvedSupervisor, setResolvedSupervisor] = useState<User | null>(null);
  const [isResolving, setIsResolving] = useState(true);

  const isFormLocked = stagedRoutes.length > 0;
  const isSellerRole = currentUser?.role === 'Usuario' || currentUser?.role === 'Telemercaderista';

  const activeSupervisors = useMemo(() => {
    return users.filter(u => u.role === 'Supervisor' || u.role === 'Administrador');
  }, [users]);

  useEffect(() => {
    const sid = currentUser?.supervisorId?.trim();
    if (!sid || !isSellerRole) {
      setIsResolving(false);
      return;
    }

    const resolveSupervisor = async () => {
      let found = users.find(u => u.id === sid || u.email === sid || u.name?.toLowerCase().trim() === sid.toLowerCase());
      if (found) {
        setResolvedSupervisor(found);
        setSelectedSupervisorId(found.id);
        setIsResolving(false);
        return;
      }
      setIsResolving(false);
    };
    resolveSupervisor();
  }, [currentUser?.supervisorId, users, isSellerRole]);

  useEffect(() => {
    const predictionDataStr = localStorage.getItem('predictionRoute');
    if (predictionDataStr) {
        try {
            const data = JSON.parse(predictionDataStr);
            const dateStrings = new Set<string>();
            const clientsFromPred: ClientInRoute[] = data.clients.map((c: any) => {
                const d = c.date ? new Date(c.date) : new Date();
                dateStrings.add(format(d, 'yyyy-MM-dd'));
                return { ...c, date: d, origin: 'predicted', status: 'Active' };
            });
            setRouteName(data.routeName || '');
            setSelectedClients(clientsFromPred);
            setIsFromPrediction(true);
            setPredictedDateStrings(dateStrings);
            localStorage.removeItem('predictionRoute');
        } catch (e) { console.error(e); }
    }
  }, []);

  const filteredDialogClients = useMemo(() => {
    const term = dialogSearchTerm.toLowerCase();
    return (clients || [])
      .filter(c => c.ejecutivo === currentUser?.name)
      .filter(c => c.nombre_cliente.toLowerCase().includes(term) || c.ruc.includes(term))
      .filter(c => !selectedClients.some(sc => sc.ruc === c.ruc && sc.status !== 'Eliminado'));
  }, [clients, dialogSearchTerm, selectedClients, currentUser]);

  const handleOpenAddDialog = (date: Date) => {
    if (isFormLocked) return;
    setTargetDateForAdd(date);
    setIsClientDialogOpen(true);
  };

  const handleOpenRemovalDialog = (index: number) => {
    if (isFormLocked) return;
    setClientIndexToRemove(index);
    setRemovalReason('');
    setIsRemovalDialogOpen(true);
  };

  const confirmRemoval = () => {
    if (clientIndexToRemove === null || !removalReason.trim()) return;
    setSelectedClients(prev => {
        const next = [...prev];
        if (next[clientIndexToRemove]) {
            next[clientIndexToRemove] = { ...next[clientIndexToRemove], status: 'Eliminado', removalObservation: removalReason };
        }
        return next;
    });
    setIsRemovalDialogOpen(false);
  };

  const handleMoveClient = (index: number, direction: 'up' | 'down') => {
    if (isFormLocked) return;
    setSelectedClients(prev => {
        const next = [...prev];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        if (swapIndex >= 0 && swapIndex < next.length) {
            const temp = next[index];
            next[index] = next[swapIndex];
            next[swapIndex] = temp;
        }
        return next;
    });
  };

  const handleAddClientsToSelected = () => {
    if (dialogSelectedClients.length === 0 || !targetDateForAdd) return;
    const newClients: ClientInRoute[] = dialogSelectedClients.map(c => ({
      ruc: c.ruc,
      nombre_comercial: c.nombre_comercial,
      date: targetDateForAdd,
      status: 'Activo',
      visitStatus: 'Pendiente'
    }));
    setSelectedClients(prev => [...prev, ...newClients]);
    setDialogSelectedClients([]);
    setDialogSearchTerm('');
    setIsClientDialogOpen(false);
  };

  const handleAddToStage = () => {
    const finalSupervisorId = selectedSupervisorId || resolvedSupervisor?.id;
    if (!routeName || !finalSupervisorId || selectedClients.length === 0) {
      toast({ title: 'Faltan datos', variant: 'destructive' });
      return;
    }
    const supervisor = users.find(u => u.id === finalSupervisorId) || resolvedSupervisor;
    setStagedRoutes(prev => [...prev, {
        tempId: Date.now(),
        routeName,
        date: routeDate || new Date(),
        clients: [...selectedClients],
        status: 'Planificada',
        supervisorId: finalSupervisorId!,
        supervisorName: supervisor?.name || 'Supervisor Asignado',
        createdBy: currentUser!.id,
    }]);
  }

  const handleSaveAllRoutes = async (sendForApproval: boolean) => {
    setIsSaving(true);
    try {
        const routesToSave = stagedRoutes.map(({ tempId, ...rest }) => ({
            ...rest,
            status: (sendForApproval ? 'Pendiente de Aprobación' : 'Planificada') as RoutePlan['status']
        }));

        await addRoutesBatch(routesToSave);
        
        if (sendForApproval) {
            routesToSave.forEach(r => {
                const supervisor = users.find(u => u.id === r.supervisorId);
                
                addNotification({
                    userId: r.supervisorId,
                    title: 'Nueva Ruta para Aprobación',
                    message: `${currentUser?.name} ha enviado una ruta para tu revisión.`,
                    link: `/dashboard/routes/team-routes`
                });

                if (supervisor?.email) {
                    fetch('/api/notifications/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: supervisor.email.toLowerCase(),
                            subject: `NUEVA RUTA PENDIENTE: ${r.routeName}`,
                            title: 'Revisión de Plan Semanal',
                            message: `El ejecutivo ${currentUser?.name} ha finalizado su planificación y requiere tu aprobación inmediata.`,
                            details: `Ruta: ${r.routeName} | Clientes: ${r.clients.filter(c => c.status !== 'Eliminado').length}`,
                            type: 'info',
                            eventKey: 'route_staged'
                        })
                    }).catch(e => console.error('Email trigger error:', e));
                }
            });
        }
        
        toast({ title: 'Rutas Guardadas', description: "Tu plan de ruta ha sido registrado correctamente." });
        await refetchData('routes');
        router.push('/dashboard/routes/management');
    } catch(e) { 
        toast({ title: 'Error al guardar', variant: 'destructive' }); 
    } finally { 
        setIsSaving(false); 
    }
  }

  const activeClientsWithIndex = useMemo(() => 
    selectedClients.map((c, i) => ({...c, originalIndex: i})).filter(c => c.status !== 'Eliminado')
  , [selectedClients]);

  const displayedDays = useMemo(() => {
    if (isFromPrediction) return Array.from(predictedDateStrings).sort().map(ds => new Date(ds + 'T00:00:00'));
    const base = routeDate || new Date();
    const monday = startOfWeek(base, { weekStartsOn: 1 });
    return Array.from({ length: 5 }).map((_, i) => addDays(monday, i));
  }, [isFromPrediction, predictedDateStrings, routeDate]);

  return (
    <>
      <PageHeader title="Planificación Semanal" description="Organiza tus paradas por día." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={cn("border-t-4 border-t-primary shadow-xl", isFormLocked && "opacity-60")}>
          <CardHeader>
            <CardTitle className="font-black text-slate-950 uppercase">Configuración de Ruta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase text-slate-950">Nombre del Plan</Label>
              <Input placeholder="Ej: Ruta Norte" value={routeName} onChange={(e) => setRouteName(e.target.value)} disabled={isFormLocked} className="font-black h-12" />
            </div>
            
            <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase text-slate-950">Aprobador Asignado</Label>
                {isSellerRole && (resolvedSupervisor || isResolving) ? (
                    <div className="relative">
                        <ShieldCheck className={cn("absolute left-3 top-3 h-4 w-4 z-10", isResolving ? "animate-pulse" : "text-green-600")} />
                        <Input value={isResolving ? "Validando supervisor..." : resolvedSupervisor?.name || "Pendiente"} className="pl-10 h-10 font-black bg-green-50" disabled />
                    </div>
                ) : (
                    <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId} disabled={isFormLocked}>
                        <SelectTrigger className="h-10 font-black"><Users className="mr-2 h-4 w-4 text-primary" /><SelectValue placeholder="Seleccionar supervisor" /></SelectTrigger>
                        <SelectContent>{activeSupervisors.map(s => (<SelectItem key={s.id} value={s.id} className="font-black">{s.name}</SelectItem>))}</SelectContent>
                    </Select>
                )}
            </div>
            
            <Separator />

            {!isFromPrediction && (
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                    <h3 className="text-xs font-black uppercase text-primary">Semana de Trabajo</h3>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="font-black" disabled={isFormLocked}>
                                <CalendarIcon className="mr-2 h-4 w-4" /> ELEGIR FECHA
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0"><Calendar mode="single" selected={routeDate} onSelect={setRouteDate} locale={es} /></PopoverContent>
                    </Popover>
                </div>
            )}

            <div className="space-y-4">
                {displayedDays.map((day) => {
                    const dayClients = activeClientsWithIndex.filter(c => isSameDay(ensureDate(c.date), day));
                    return (
                        <Collapsible key={day.toISOString()} defaultOpen={dayClients.length > 0} className="border-l-4 pl-4 py-2 border-primary/20 bg-slate-50/50 rounded-r-lg group">
                            <div className="flex w-full items-center justify-between p-2">
                                <CollapsibleTrigger asChild>
                                    <div className="flex items-center gap-3 cursor-pointer flex-1">
                                        <CalendarIcon className="h-4 w-4 text-primary" />
                                        <h4 className="font-black text-xs uppercase text-slate-950">{format(day, 'EEEE dd', { locale: es })}</h4>
                                        <Badge variant="secondary" className="font-black">{dayClients.length}</Badge>
                                        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                                    </div>
                                </CollapsibleTrigger>
                                <Button variant="ghost" size="sm" className="font-black text-primary" onClick={() => handleOpenAddDialog(day)} disabled={isFormLocked}>
                                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> AÑADIR
                                </Button>
                            </div>
                            <CollapsibleContent className="space-y-2 mt-2">
                                {dayClients.length > 0 ? (
                                    dayClients.map((client, groupIdx) => (
                                        <div key={`${client.ruc}-${client.originalIndex}`} className="p-3 bg-white border-2 rounded-xl flex justify-between items-center shadow-sm">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-black text-[11px] text-primary uppercase truncate">{client.nombre_comercial}</p>
                                                <p className="text-[9px] font-bold text-slate-500 uppercase">{client.ruc}</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <div className="flex flex-col gap-0.5">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveClient(client.originalIndex, 'up')} disabled={isFormLocked || groupIdx === 0}>
                                                        <ArrowUp className="h-3 w-3" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveClient(client.originalIndex, 'down')} disabled={isFormLocked || groupIdx === dayClients.length - 1}>
                                                        <ArrowDown className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => handleOpenRemovalDialog(client.originalIndex)} disabled={isFormLocked} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-4 text-center border border-dashed rounded-xl">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">Sin paradas asignadas</p>
                                    </div>
                                )}
                            </CollapsibleContent>
                        </Collapsible>
                    );
                })}
            </div>
          </CardContent>
           <CardFooter>
            <Button onClick={handleAddToStage} className="w-full h-12 font-black uppercase shadow-lg" disabled={activeClientsWithIndex.length === 0 || isFormLocked}>Guardar Cambios de la Ruta</Button>
          </CardFooter>
        </Card>
        
        <Card className="border-t-4 border-t-green-600 shadow-xl bg-white">
          <CardHeader><CardTitle className="font-black text-slate-950 uppercase">Rutas Listas para Enviar</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stagedRoutes.map(r => (
                <div key={r.tempId} className="p-4 flex justify-between items-center bg-slate-50 border-2 border-slate-100 rounded-2xl">
                    <div className="min-w-0 flex-1">
                        <p className="font-black text-primary uppercase text-xs truncate">{r.routeName}</p>
                        <p className="text-[9px] font-black text-slate-500 uppercase">{r.clients.length} CLIENTES CONFIGURADOS</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setStagedRoutes(prev => prev.filter(st => st.tempId !== r.tempId))} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
            ))}
          </CardContent>
          <CardFooter>
            {stagedRoutes.length > 0 && (
                <Button onClick={() => handleSaveAllRoutes(true)} className="w-full h-14 font-black bg-green-600 hover:bg-green-700 text-white text-lg shadow-2xl" disabled={isSaving}>
                    {isSaving ? <LoaderCircle className="animate-spin mr-2 h-6 w-6" /> : <><Send className="mr-2 h-5 w-5" /> CONFIRMAR Y ENVIAR AL SUPERVISOR</>}
                </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
        <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden">
            <DialogHeader className="p-6 pb-2"><DialogTitle className="text-2xl font-black text-primary uppercase">Buscador de Clientes</DialogTitle></DialogHeader>
            <div className="p-6 space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-950 font-black" />
                    <Input placeholder="Buscar por RUC o Nombre..." className="pl-10 h-12 border-2" value={dialogSearchTerm} onChange={(e) => setDialogSearchTerm(e.target.value)} />
                </div>
                <ScrollArea className="h-[40vh] pr-2">
                    <div className="space-y-3">
                        {filteredDialogClients.map((client) => (
                            <div key={client.ruc} className={cn("flex items-center space-x-4 p-4 rounded-xl border-2 transition-all cursor-pointer", dialogSelectedClients.some(s => s.ruc === client.ruc) ? "bg-primary/5 border-primary" : "bg-slate-50 border-transparent")} onClick={() => setDialogSelectedClients(prev => prev.some(s => s.ruc === client.ruc) ? prev.filter(c => c.ruc !== client.ruc) : [...prev, client])}>
                                <Checkbox checked={dialogSelectedClients.some(s => s.ruc === client.ruc)} className="h-5 w-5 border-primary" />
                                <div className="flex-1">
                                    <p className="text-sm font-black text-slate-950 uppercase">{client.nombre_comercial}</p>
                                    <p className="text-[9px] font-black text-slate-500 mt-1">{client.ruc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </div>
            <DialogFooter className="p-6 bg-slate-50 border-t flex items-center justify-between">
                <span className="text-xs font-black text-primary uppercase">{dialogSelectedClients.length} seleccionados</span>
                <div className="flex gap-2">
                    <DialogClose asChild><Button variant="ghost" className="font-black">CANCELAR</Button></DialogClose>
                    <Button onClick={handleAddClientsToSelected} disabled={dialogSelectedClients.length === 0} className="font-black shadow-lg">AÑADIR A RUTA</Button>
                </div>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRemovalDialogOpen} onOpenChange={setIsRemovalDialogOpen}>
        <DialogContent className="bg-white rounded-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase text-destructive">Justificación de Eliminación</DialogTitle></DialogHeader>
          <div className="py-4 space-y-2">
            <Label className="font-black uppercase text-[10px] text-slate-950">Observación obligatoria</Label>
            <Textarea value={removalReason} onChange={(e) => setRemovalReason(e.target.value)} placeholder="Ej: Cliente solicitó reprogramación..." className="font-black text-sm h-32 border-2" />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" className="font-black">CANCELAR</Button></DialogClose>
            <Button variant="destructive" onClick={confirmRemoval} disabled={!removalReason.trim()} className="font-black shadow-lg">ELIMINAR PARADA</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
