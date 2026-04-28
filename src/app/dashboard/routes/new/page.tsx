'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Calendar as CalendarIcon, Users, LoaderCircle, Trash2, Search, AlertCircle, ShieldCheck, ChevronDown, Info } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';

const ensureDate = (d: any): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (d && typeof d.toDate === 'function') return d.toDate();
  const date = new Date(d);
  return isNaN(date.getTime()) ? new Date() : date;
};

type StagedRoute = Omit<RoutePlan, 'id' | 'createdAt'> & { tempId: number };

export default function NewUserPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser, users, clients, loading, refetchData } = useAuth();
  
  const [routeName, setRouteName] = useState('');
  
  // Lógica de fecha inteligente: Si es fin de semana, sugerir próximo lunes.
  const [routeDate, setRouteDate] = useState<Date | undefined>(() => {
      const now = new Date();
      const day = now.getDay();
      if (day === 6) return addDays(now, 2); // Sábado -> Lunes
      if (day === 0) return addDays(now, 1); // Domingo -> Lunes
      if (day === 5 && now.getHours() >= 19) return addDays(now, 3); // Viernes noche -> Lunes
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
  const [rucToToRemove, setRucToToRemove] = useState<string | null>(null);

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

      if (!loading) {
        try {
          const directUser = await getUser(sid);
          if (directUser) {
            setResolvedSupervisor(directUser);
            setSelectedSupervisorId(directUser.id);
          } else {
            const byName = users.find(u => u.name?.toLowerCase().includes(sid.toLowerCase()));
            setResolvedSupervisor(byName || null);
            if (byName) setSelectedSupervisorId(byName.id);
          }
        } catch (e) {
          setResolvedSupervisor(null);
        } finally {
          setIsResolving(false);
        }
      }
    };
    resolveSupervisor();
  }, [currentUser?.supervisorId, users, loading, isSellerRole]);

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
      .filter(c => c.nombre_cliente.toLowerCase().includes(term) || c.nombre_comercial.toLowerCase().includes(term) || c.ruc.includes(term))
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
    if (!rucToToRemove || !removalReason.trim()) return;
    setSelectedClients(prev => prev.map(c => c.ruc === rucToToRemove ? { ...c, status: 'Eliminado', removalObservation: removalReason } : c));
    setIsRemovalDialogOpen(false);
    setRucToToRemove(null);
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
  };

  const handleAddToStage = () => {
    const finalSupervisorId = selectedSupervisorId || resolvedSupervisor?.id;
    if (!routeName || !finalSupervisorId || selectedClients.filter(c => c.status !== 'Eliminado').length === 0) {
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
            for (const r of routesToSave) {
                await addNotification({
                    userId: r.supervisorId,
                    title: 'Nueva Ruta para Aprobación',
                    message: `${currentUser?.name} ha enviado la ruta "${r.routeName}" para tu revisión.`,
                    link: `/dashboard/routes/team-routes`
                });
            }
        }
        toast({ title: 'Rutas Guardadas' });
        await refetchData('routes');
        router.push('/dashboard/routes');
    } catch(e) { toast({ title: 'Error', variant: 'destructive' }); } finally { setIsSaving(false); }
  }

  const activeClientsWithIndex = useMemo(() => 
    selectedClients.map((c, i) => ({...c, originalIndex: i})).filter(c => c.status !== 'Eliminado').map((c, i) => ({...c, globalIndex: i}))
  , [selectedClients]);

  const displayedDays = useMemo(() => {
    if (isFromPrediction) return Array.from(predictedDateStrings).sort().map(ds => new Date(ds + 'T00:00:00'));
    const base = routeDate || new Date();
    const monday = startOfWeek(base, { weekStartsOn: 1 });
    return Array.from({ length: 5 }).map((_, i) => addDays(monday, i));
  }, [isFromPrediction, predictedDateStrings, routeDate]);

  return (
    <>
      <PageHeader title="Planificación Semanal" description="Organiza tus paradas para los próximos 5 días hábiles." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={cn("border-t-4 border-t-primary shadow-xl", isFormLocked && "opacity-60")}>
          <CardHeader>
            <CardTitle className="font-black text-slate-950 uppercase">Configuración de Ruta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="font-black text-[10px] uppercase text-slate-950">Nombre Identificador</Label>
              <Input placeholder="Ej: Ruta Norte Semana 15" value={routeName} onChange={(e) => setRouteName(e.target.value)} disabled={isFormLocked} className="font-black h-12 text-slate-950" />
            </div>
            
            <div className="space-y-2">
                <Label className="font-black text-[10px] uppercase text-slate-950">Aprobador Asignado</Label>
                {isSellerRole && (resolvedSupervisor || isResolving) ? (
                    <div className="relative">
                        <ShieldCheck className={cn("absolute left-3 top-3 h-4 w-4 z-10", isResolving ? "animate-pulse text-muted-foreground" : "text-green-600")} />
                        <Input value={isResolving ? "Validando..." : resolvedSupervisor?.name || "Pendiente"} className="pl-10 h-10 font-black bg-green-50 text-green-900 border-green-200" disabled />
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
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <h3 className="text-xs font-black uppercase text-primary">Semana de Trabajo</h3>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="font-black h-8" disabled={isFormLocked}>
                                <CalendarIcon className="mr-2 h-4 w-4" /> ELEGIR FECHA
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0"><Calendar mode="single" selected={routeDate} onSelect={setRouteDate} locale={es} /></PopoverContent>
                    </Popover>
                </div>
            )}

            <div className="space-y-4">
                <Alert className="bg-primary/5 border-primary/20 py-2">
                    <Info className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-[10px] font-bold text-primary uppercase">
                        Haz clic en los encabezados de cada día para expandir o contraer la lista de paradas.
                    </AlertDescription>
                </Alert>

                {displayedDays.map((day) => {
                    const dayClients = activeClientsWithIndex.filter(c => isSameDay(ensureDate(c.date), day));
                    return (
                        <Collapsible key={day.toISOString()} defaultOpen={dayClients.length > 0} className="border-l-4 pl-4 py-2 border-primary/20 bg-slate-50/50 rounded-r-lg group">
                            <div className="flex w-full items-center justify-between p-2">
                                <CollapsibleTrigger asChild>
                                    <div className="flex items-center gap-3 cursor-pointer flex-1 select-none">
                                        <CalendarIcon className="h-4 w-4 text-primary" />
                                        <div className="flex flex-col">
                                            <h4 className="font-black text-xs uppercase text-slate-950">{format(day, 'EEEE dd', { locale: es })}</h4>
                                            <span className="text-[8px] font-black text-muted-foreground uppercase group-data-[state=open]:hidden">Ver paradas</span>
                                            <span className="text-[8px] font-black text-muted-foreground uppercase group-data-[state=closed]:hidden">Contraer</span>
                                        </div>
                                        <Badge variant="secondary" className="font-black h-5">{dayClients.length}</Badge>
                                        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform duration-300 group-data-[state=open]:rotate-180" />
                                    </div>
                                </CollapsibleTrigger>
                                <Button variant="ghost" size="sm" className="font-black text-primary hover:bg-primary/10 h-7" onClick={() => handleOpenAddDialog(day)} disabled={isFormLocked}>
                                    <PlusCircle className="mr-1 h-3.5 w-3.5" /> AÑADIR
                                </Button>
                            </div>
                            <CollapsibleContent className="space-y-2 mt-2 data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                                {dayClients.length > 0 ? (
                                    dayClients.map((client) => (
                                        <div key={client.ruc} className="p-3 bg-white border-2 rounded-xl flex justify-between items-center shadow-sm">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-black text-[11px] text-primary uppercase truncate">{client.nombre_comercial}</p>
                                                <p className="text-[9px] font-bold text-slate-500 uppercase">{client.ruc}</p>
                                            </div>
                                            <Button variant="ghost" size="icon" onClick={() => handleOpenRemovalDialog(client.ruc)} disabled={isFormLocked} className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
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
            <Button onClick={handleAddToStage} className="w-full h-12 font-black uppercase shadow-lg" disabled={activeClientsWithIndex.length === 0 || isFormLocked || (!selectedSupervisorId && !resolvedSupervisor)}>Añadir a la Lista</Button>
          </CardFooter>
        </Card>
        
        <Card className="border-t-4 border-t-green-600 shadow-xl bg-white">
          <CardHeader><CardTitle className="font-black text-slate-950 uppercase">Rutas en Cola</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {stagedRoutes.map(r => (
                <div key={r.tempId} className="p-4 flex justify-between items-center bg-slate-50 border-2 border-slate-100 rounded-2xl">
                    <div className="min-w-0 flex-1">
                        <p className="font-black text-primary uppercase text-xs truncate">{r.routeName}</p>
                        <p className="text-[9px] font-black text-slate-500 uppercase">
                            {r.clients.filter(c => c.status !== 'Eliminado').length} CLIENTES | RESPONSABLE: {r.supervisorName}
                        </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setStagedRoutes(prev => prev.filter(st => st.tempId !== r.tempId))} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
            ))}
            {stagedRoutes.length === 0 && <div className="text-center py-10 font-black text-slate-300 uppercase text-xs">Sin rutas en cola</div>}
          </CardContent>
          <CardFooter>
            {stagedRoutes.length > 0 && (
                <Button onClick={() => handleSaveAllRoutes(true)} className="w-full h-14 font-black bg-green-600 hover:bg-green-700 text-white text-lg shadow-2xl transition-transform hover:scale-[1.02]" disabled={isSaving}>
                    {isSaving ? <LoaderCircle className="animate-spin mr-2 h-6 w-6" /> : 'CONFIRMAR Y ENVIAR'}
                </Button>
            )}
          </CardFooter>
        </Card>
      </div>

      <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[600px] p-0 overflow-hidden bg-white rounded-2xl">
            <DialogHeader className="p-6 pb-2"><DialogTitle className="text-2xl font-black text-primary uppercase">Catálogo de Clientes</DialogTitle></DialogHeader>
            <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-950 font-black" />
                    <Input placeholder="Buscar por RUC o Nombre..." className="pl-10 h-12 border-2 border-slate-200 font-black text-slate-950" value={dialogSearchTerm} onChange={(e) => setDialogSearchTerm(e.target.value)} />
                </div>
                <ScrollArea className="h-[50vh] pr-2">
                    <div className="space-y-3">
                        {filteredDialogClients.map((client) => {
                            const isSelected = dialogSelectedClients.some(c => c.ruc === client.ruc);
                            return (
                                <div key={client.ruc} className={cn("flex items-center space-x-4 p-4 rounded-xl border-2 transition-all cursor-pointer", isSelected ? "bg-primary/5 border-primary" : "bg-slate-50 border-transparent hover:border-slate-200")} onClick={() => isSelected ? setDialogSelectedClients(prev => prev.filter(c => c.ruc !== client.ruc)) : setDialogSelectedClients(prev => [...prev, client])}>
                                    <Checkbox checked={isSelected} className="h-5 w-5 border-primary" />
                                    <div className="flex-1">
                                        <p className="text-sm font-black text-slate-950 uppercase">{client.nombre_comercial}</p>
                                        <p className="text-[9px] font-black text-slate-500 mt-1">{client.ruc}</p>
                                    </div>
                                </div>
                            );
                        })}
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
          <DialogHeader><DialogTitle className="font-black uppercase text-destructive">Indicar motivo de eliminación</DialogTitle></DialogHeader>
          <div className="py-4 space-y-2">
            <Label className="font-black uppercase text-[10px] text-slate-950">Observación obligatoria</Label>
            <Textarea value={removalReason} onChange={(e) => setRemovalReason(e.target.value)} placeholder="Ej: Local cerrado, cliente cambió cita..." className="font-black text-sm h-32 border-2 text-slate-950" />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" className="font-black">CANCELAR</Button></DialogClose>
            <Button variant="destructive" onClick={confirmRemoval} disabled={!removalReason.trim()} className="font-black shadow-lg">ELIMINAR CLIENTE</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
