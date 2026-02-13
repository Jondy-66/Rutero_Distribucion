
'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Calendar as CalendarIcon, Users, ChevronsUpDown, LoaderCircle, Clock, Trash2, Save, Search, Send } from 'lucide-react';
import { addRoutesBatch, addNotification } from '@/lib/firebase/firestore';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogHeader, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
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
  const [calendarOpen, setCalendarOpen] = useState<{ [key: string]: boolean }>({});
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [dialogSearchTerm, setDialogSearchTerm] = useState('');
  const [dialogSelectedClients, setDialogSelectedClients] = useState<Client[]>([]);
  const [stagedRoutes, setStagedRoutes] = useState<StagedRoute[]>([]);
  
  const [clientToRemove, setClientToRemove] = useState<ClientInRoute | null>(null);
  const [removalObservation, setRemovalObservation] = useState('');

  const [currentAddDate, setCurrentAddDate] = useState<Date | null>(null);
  const [isAddClientToDateDialogOpen, setIsAddClientToDateDialogOpen] = useState(false);
  const [addDialogSelectedClients, setAddDialogSelectedClients] = useState<Client[]>([]);
  const [addDialogSearchTerm, setAddDialogSearchTerm] = useState('');

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

  const handleAddToStage = () => {
    if (!routeName || !selectedSupervisorId || selectedClients.filter(c => c.status !== 'Eliminado').length === 0) {
      toast({ title: 'Faltan datos', variant: 'destructive' });
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
  }

  const handleSaveAllRoutes = async (sendForApproval: boolean) => {
    setIsSaving(true);
    try {
        const routesToSave = stagedRoutes.map(({ tempId, ...rest }) => ({
            ...rest,
            status: (sendForApproval ? 'Pendiente de Aprobación' : 'Planificada') as RoutePlan['status']
        }));
        await addRoutesBatch(routesToSave);
        toast({ title: 'Rutas Guardadas' });
        await refetchData('routes');
        router.push('/dashboard/routes');
    } catch(e) { console.error(e); } finally { setIsSaving(false); }
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
          <CardHeader><CardTitle>Detalles de la Ruta</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la Ruta</Label>
              <Input value={routeName} onChange={(e) => setRouteName(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label>Supervisor</Label>
                <Select value={selectedSupervisorId} onValueChange={setSelectedSupervisorId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>{supervisors.map(s => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}</SelectContent>
                </Select>
            </div>
            
            <Separator />

            <div className="space-y-4">
                {groupedClients.map(([date, clientsInGroup]) => (
                    <Collapsible key={date} defaultOpen className="border-l-2 pl-4 py-2 border-slate-200">
                        <CollapsibleTrigger asChild>
                            <div className="flex w-full items-center justify-between p-2 cursor-pointer hover:bg-muted/50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                                    <h4 className="font-semibold">
                                        {date === 'Sin Fecha' ? 'Sin Fecha' : format(new Date(date + 'T00:00:00'), 'EEEE, dd \'de\' MMMM', { locale: es })}
                                    </h4>
                                    <Badge variant="secondary">{clientsInGroup.length}</Badge>
                                </div>
                            </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 p-2">
                            {clientsInGroup.map((client) => (
                                <Card key={client.ruc} className="p-4 relative">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{client.globalIndex + 1}. {client.nombre_comercial}</p>
                                            <p className="text-xs text-muted-foreground">{client.ruc}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" onClick={() => setSelectedClients(prev => prev.map(c => c.ruc === client.ruc ? {...c, status: 'Eliminado'} : c))}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                                        <div className="space-y-2">
                                            <Label>Fecha</Label>
                                            <Popover open={calendarOpen[client.ruc]} onOpenChange={(o) => setCalendarOpen(prev => ({...prev, [client.ruc]: o}))}>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" className="w-full justify-start">
                                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                                        {client.date ? format(ensureDate(client.date), 'PPP', {locale: es}) : 'Elige fecha'}
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
            </div>
          </CardContent>
           <CardFooter>
            <Button onClick={handleAddToStage} className="w-full">Añadir a la Lista</Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader><CardTitle>Rutas en Lista</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {stagedRoutes.map(r => (
                <Card key={r.tempId} className="p-4 flex justify-between items-center">
                    <div><p className="font-bold">{r.routeName}</p><p className="text-xs">{r.clients.filter(c => c.status !== 'Eliminado').length} clientes</p></div>
                    <Button variant="ghost" onClick={() => setStagedRoutes(prev => prev.filter(st => st.tempId !== r.tempId))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </Card>
            ))}
          </CardContent>
          <CardFooter>
            {stagedRoutes.length > 0 && <Button onClick={() => handleSaveAllRoutes(true)} className="w-full" disabled={isSaving}>{isSaving ? 'Guardando...' : 'Guardar y Enviar'}</Button>}
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
