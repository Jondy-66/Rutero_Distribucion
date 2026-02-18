
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Calendar as CalendarIcon, Users, LoaderCircle, Trash2, Search } from 'lucide-react';
import { addRoutesBatch } from '@/lib/firebase/firestore';
import type { Client, User, RoutePlan, ClientInRoute } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

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
  const [calendarOpen, setCalendarOpen] = useState<{ [key: string]: boolean }>({});
  
  // States for the "Add Client" Dialog
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [dialogSearchTerm, setDialogSearchTerm] = useState('');
  const [dialogSelectedClients, setDialogSelectedClients] = useState<Client[]>([]);
  
  const [stagedRoutes, setStagedRoutes] = useState<StagedRoute[]>([]);

  useEffect(() => {
    if (users) setSupervisors(users.filter(u => u.role === 'Supervisor'));
    if (currentUser?.supervisorId) setSelectedSupervisorId(currentUser.supervisorId);
    
    const predictionDataStr = localStorage.getItem('predictionRoute');
    if (predictionDataStr) {
        try {
            const data = JSON.parse(predictionDataStr);
            const clientsFromPred: ClientInRoute[] = data.clients.map((c: any) => ({
                ...c,
                date: c.date ? new Date(c.date) : new Date(),
                origin: 'predicted',
                status: 'Activo'
            }));
            setRouteName(data.routeName || '');
            if (clientsFromPred[0]?.date) setRouteDate(clientsFromPred[0].date);
            setSelectedClients(clientsFromPred);
            localStorage.removeItem('predictionRoute');
        } catch (e) { console.error(e); }
    }
  }, [users, currentUser]);

  const handleClientDetailChange = (ruc: string, field: keyof ClientInRoute, value: any) => {
    setSelectedClients(prev => prev.map(c => c.ruc === ruc ? { ...c, [field]: value } : c));
  };

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

  const handleAddClientsToSelected = () => {
    if (dialogSelectedClients.length === 0) return;
    
    const newClients: ClientInRoute[] = dialogSelectedClients.map(c => ({
      ruc: c.ruc,
      nombre_comercial: c.nombre_comercial,
      date: routeDate || new Date(),
      status: 'Activo',
      origin: 'manual',
      visitStatus: 'Pendiente'
    }));
    
    setSelectedClients(prev => [...prev, ...newClients]);
    setDialogSelectedClients([]);
    setDialogSearchTerm('');
    setIsClientDialogOpen(false);
    toast({ title: `${newClients.length} clientes añadidos` });
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
    setRouteName('');
    setSelectedClients([]);
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

  const groupedClients = useMemo(() => {
    const groups: { [date: string]: typeof activeClientsWithIndex } = {};
    activeClientsWithIndex.forEach(client => {
        const dateObj = ensureDate(client.date);
        const key = dateObj && !isNaN(dateObj.getTime()) ? format(dateObj, 'yyyy-MM-dd') : 'Sin Fecha';
        if (!groups[key]) groups[key] = [];
        groups[key].push(client);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [activeClientsWithIndex]);

  return (
    <>
      <PageHeader title="Planificación de Rutas" description="Crea y guarda planes de ruta de 5 días." />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Detalles de la Ruta</CardTitle>
            <CardDescription>Configura los clientes y fechas para tu nuevo plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la Ruta</Label>
              <Input placeholder="Ej: Ruta Norte Semana 08" value={routeName} onChange={(e) => setRouteName(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Supervisor</Label>
                <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar supervisor" /></SelectTrigger>
                    <SelectContent>{supervisors.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                </Select>
            </div>
            
            <Separator />

            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold uppercase tracking-tight">Cronograma de Visitas</h3>
                <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="font-bold">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Añadir Clientes
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl bg-white rounded-2xl p-0 overflow-hidden">
                        <DialogHeader className="p-6 pb-2">
                            <DialogTitle className="text-2xl font-black text-[#011688] uppercase">Buscar Clientes</DialogTitle>
                            <DialogDescription className="font-bold text-muted-foreground uppercase text-xs">Añade clientes de tu cartera a la planificación actual.</DialogDescription>
                        </DialogHeader>
                        <div className="p-6 space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="RUC, Nombre o Comercial..."
                                    className="pl-10 h-12 border-2 border-[#011688]/20 focus:border-[#011688] rounded-xl font-bold"
                                    value={dialogSearchTerm}
                                    onChange={(e) => setDialogSearchTerm(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="h-[350px] pr-2">
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
                                <Button variant="ghost" onClick={() => setIsClientDialogOpen(false)} className="font-bold">CANCELAR</Button>
                                <Button onClick={handleAddClientsToSelected} disabled={dialogSelectedClients.length === 0} className="font-bold bg-[#011688] px-8">AÑADIR</Button>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="space-y-4">
                {groupedClients.map(([date, clientsInGroup]) => (
                    <Collapsible key={date} defaultOpen className="border-l-4 pl-4 py-2 border-[#011688]/20 bg-slate-50/50 rounded-r-lg">
                        <CollapsibleTrigger asChild>
                            <div className="flex w-full items-center justify-between p-2 cursor-pointer hover:bg-slate-100 rounded-lg transition-all">
                                <div className="flex items-center gap-3">
                                    <CalendarIcon className="h-5 w-5 text-[#011688]" />
                                    <h4 className="font-black text-sm uppercase">
                                        {date === 'Sin Fecha' ? 'Sin Fecha' : format(new Date(date + 'T00:00:00'), 'EEEE, dd \'de\' MMMM', { locale: es })}
                                    </h4>
                                    <Badge variant="secondary" className="font-black">{clientsInGroup.length}</Badge>
                                </div>
                            </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 p-2 mt-2">
                            {clientsInGroup.map((client) => (
                                <Card key={client.ruc} className="p-4 relative hover:shadow-md transition-shadow border-l-2 border-l-[#011688]/10">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-black text-sm text-[#011688] uppercase">{client.globalIndex + 1}. {client.nombre_comercial}</p>
                                            <p className="text-[10px] font-mono text-muted-foreground">{client.ruc}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => setSelectedClients(prev => prev.map(c => c.ruc === client.ruc ? {...c, status: 'Eliminado'} : c))}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] font-black uppercase">Cambiar Fecha</Label>
                                            <Popover open={calendarOpen[client.ruc]} onOpenChange={(o) => setCalendarOpen(prev => ({...prev, [client.ruc]: o}))}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-full justify-start h-9 text-xs font-bold">
                                                        <CalendarIcon className="mr-2 h-3 w-3" />
                                                        {client.date ? format(ensureDate(client.date), 'dd/MM/yyyy') : 'Elegir'}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="p-0">
                                                    <Calendar mode="single" selected={ensureDate(client.date)} onSelect={(d) => handleClientDetailChange(client.ruc, 'date', d)} locale={es} />
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </CollapsibleContent>
                    </Collapsible>
                ))}
                {groupedClients.length === 0 && (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed">
                        <Users className="mx-auto h-8 w-8 text-muted-foreground/40 mb-2" />
                        <p className="text-xs font-bold text-muted-foreground uppercase">No hay clientes en esta ruta diaria</p>
                        <p className="text-[10px] text-muted-foreground/60 uppercase">Usa el botón "Añadir Clientes" para empezar</p>
                    </div>
                )}
            </div>
          </CardContent>
           <CardFooter>
            <Button onClick={handleAddToStage} className="w-full h-12 font-black uppercase tracking-tighter" disabled={activeClientsWithIndex.length === 0}>
                Añadir a la Lista de Rutas
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Rutas en Lista</CardTitle>
            <CardDescription>Rutas pendientes por ser guardadas en la base de datos.</CardDescription>
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
    </>
  );
}
