'use client';

import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Search, 
  Plus, 
  X, 
  Calendar as CalendarIcon, 
  User as UserIcon, 
  TrendingUp, 
  Clock, 
  Target, 
  PhoneCall, 
  MapPin,
  Save,
  Send,
  Zap
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import type { Customer, User } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
];

type PlannedCall = {
  time: string;
  customer: Customer | null;
};

export default function CrmPlanningPage() {
  const { user, users, clients, phoneContacts } = useAuth();
  const { toast } = useToast();
  
  // Estados de Filtro Banco de Clientes
  const [searchTerm, setSearchTerm] = useState('');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  
  // Estados de Planificación
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedAgentId, setSelectedAgentId] = useState<string>(user?.id || '');
  const [plannedCalls, setPlannedCalls] = useState<PlannedCall[]>(
    TIME_SLOTS.map(time => ({ time, customer: null }))
  );

  const isAdmin = user?.role === 'Administrador' || user?.role === 'Supervisor';
  
  const managedAgents = useMemo(() => {
    if (!isAdmin) return [user];
    return users.filter(u => u.role === 'Usuario' || u.role === 'Telemercaderista' || u.id === user?.id);
  }, [users, user, isAdmin]);

  // Simulación de Clientes Banco de Datos
  const customerBank = useMemo(() => {
    return phoneContacts.map((contact, idx) => ({
      id: contact.id,
      name: contact.nombre_comercial,
      legalName: contact.nombre_cliente,
      zone: contact.ciudad || 'Zona Centro',
      daysSinceContact: Math.floor(Math.random() * 50),
      averageTicket: Math.floor(Math.random() * 5000) + 200,
      priority: idx % 3 === 0 ? 'Alta' : (idx % 2 === 0 ? 'Media' : 'Baja'),
      status: idx % 5 === 0 ? 'inactive' : 'active',
      phone: contact.telefono1,
      contactPerson: 'Lic. ' + contact.nombre_vendedor.split(' ')[0]
    })).filter(c => {
      const matchSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.legalName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchZone = zoneFilter === 'all' || c.zone === zoneFilter;
      return matchSearch && matchZone;
    });
  }, [phoneContacts, searchTerm, zoneFilter]);

  const stats = useMemo(() => {
    const planned = plannedCalls.filter(p => p.customer !== null);
    const highPriority = planned.filter(p => (p.customer as any)?.priority === 'Alta').length;
    const totalTicket = planned.reduce((sum, p) => sum + ((p.customer as any)?.averageTicket || 0), 0);
    return {
      count: planned.length,
      highPriority,
      totalTicket,
      duration: planned.length * 15 
    };
  }, [plannedCalls]);

  const handleAddClientToRoute = (customer: any) => {
    const firstFreeSlot = plannedCalls.findIndex(p => p.customer === null);
    if (firstFreeSlot === -1) {
      toast({ title: "Sin espacio", description: "No hay franjas horarias disponibles para hoy.", variant: "destructive" });
      return;
    }

    const isAlreadyPlanned = plannedCalls.some(p => p.customer?.id === customer.id);
    if (isAlreadyPlanned) {
      toast({ title: "Cliente ya asignado", description: "Este cliente ya está en la ruta de hoy." });
      return;
    }

    const nextCalls = [...plannedCalls];
    nextCalls[firstFreeSlot] = { ...nextCalls[firstFreeSlot], customer };
    setPlannedCalls(nextCalls);
    toast({ title: "Añadido", description: `${customer.name} asignado a las ${nextCalls[firstFreeSlot].time}` });
  };

  const handleRemoveClient = (time: string) => {
    setPlannedCalls(prev => prev.map(p => p.time === time ? { ...p, customer: null } : p));
  };

  const handleSaveRoute = () => {
    toast({ title: "Ruta Guardada", description: "La planificación ha sido almacenada localmente." });
  };

  return (
    <div className="flex flex-col gap-6 max-w-full overflow-hidden">
      <PageHeader 
        title="Planificación de Telemercadeo" 
        description="Organiza la cola de llamadas diaria de forma estratégica."
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* BANCO DE CLIENTES (SIDEBAR) */}
        <Card className="lg:col-span-1 bg-[#F4F6FA] border-2 border-slate-200 shadow-xl rounded-3xl flex flex-col h-[85vh]">
          <CardHeader className="p-6 pb-4">
            <CardTitle className="text-slate-950 font-black uppercase text-sm flex justify-between items-center">
              <span>Banco de Clientes</span>
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5">
                {customerBank.length} disponibles
              </Badge>
            </CardTitle>
            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Buscar cliente..." 
                  className="pl-9 h-10 bg-white border-slate-200 text-slate-950 text-xs rounded-xl focus:ring-2 focus:ring-primary/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Select value={zoneFilter} onValueChange={setZoneFilter}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 text-[10px] text-slate-600 font-bold uppercase rounded-lg">
                    <SelectValue placeholder="Zona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las zonas</SelectItem>
                    <SelectItem value="Quito">Quito</SelectItem>
                    <SelectItem value="Guayaquil">Guayaquil</SelectItem>
                    <SelectItem value="Cuenca">Cuenca</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 text-[10px] text-slate-600 font-bold uppercase rounded-lg">
                    <SelectValue placeholder="Prioridad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Prioridad</SelectItem>
                    <SelectItem value="Alta">Alta</SelectItem>
                    <SelectItem value="Media">Media</SelectItem>
                    <SelectItem value="Baja">Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ordenar por:</span>
                <div className="flex gap-2">
                   <button className="text-[8px] font-black text-primary uppercase hover:underline">Días sin contacto</button>
                   <button className="text-[8px] font-black text-slate-400 uppercase hover:text-primary transition-colors">Ticket</button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full px-6">
              <div className="space-y-4 pb-6">
                {customerBank.map((customer) => (
                  <div key={customer.id} className="group relative bg-white p-4 rounded-2xl border-2 border-slate-100 hover:border-primary/30 transition-all shadow-sm">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black text-slate-950 uppercase leading-tight">{customer.name}</h4>
                          {customer.status === 'inactive' && <Badge className="bg-slate-200 text-slate-500 text-[8px] h-4 uppercase border-none">Inactivo</Badge>}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <MapPin className="h-3 w-3 text-primary" />
                          <span className="text-[9px] font-bold uppercase">{customer.zone} • {customer.daysSinceContact}d sin contacto</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge className={cn(
                          "text-[8px] font-black uppercase border-none shadow-none",
                          customer.priority === 'Alta' ? "bg-red-100 text-red-600" : 
                          customer.priority === 'Media' ? "bg-orange-100 text-orange-600" : "bg-slate-100 text-slate-500"
                        )}>
                          {customer.priority}
                        </Badge>
                        <p className="text-xs font-black text-primary mt-1">${customer.averageTicket.toLocaleString()}</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full mt-3 h-9 bg-primary/5 text-primary hover:bg-primary/10 font-black text-[9px] uppercase rounded-xl border-2 border-primary/10"
                      onClick={() => handleAddClientToRoute(customer)}
                    >
                      <Plus className="mr-1 h-3 w-3" /> Añadir a ruta del día
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* CONTENIDO PRINCIPAL - RUTA DEL DÍA */}
        <div className="lg:col-span-3 space-y-6">
          <Card className="bg-[#F4F6FA] border-2 border-slate-200 shadow-2xl rounded-[2.5rem] overflow-hidden">
            <CardHeader className="bg-slate-100/50 px-8 py-6 border-b-2 border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <h2 className="text-slate-950 text-xl font-black uppercase tracking-tighter">Ruta del Día</h2>
                  <p className="text-slate-500 text-[10px] font-bold uppercase">{stats.count} llamadas planificadas</p>
                </div>
                
                <div className="h-10 w-[1px] bg-slate-200 hidden md:block" />

                <div className="flex gap-4">
                   <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-10 px-3 bg-white text-slate-950 font-black text-xs rounded-xl border-2 border-slate-200 hover:bg-slate-50">
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Fecha'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-2 shadow-2xl">
                      <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} locale={es} />
                    </PopoverContent>
                  </Popover>

                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger className="h-10 w-[180px] bg-white border-2 border-slate-200 text-slate-950 font-black text-xs rounded-xl">
                      <UserIcon className="mr-2 h-4 w-4 text-primary" />
                      <SelectValue placeholder="Agente" />
                    </SelectTrigger>
                    <SelectContent className="font-black">
                      {managedAgents.map(a => <SelectItem key={a?.id} value={a?.id || ''} className="font-black uppercase text-[10px]">{a?.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Badge className="bg-red-50 text-red-600 border-2 border-red-100 px-3 h-8 font-black text-[10px] uppercase shadow-none">
                  Alta: {stats.highPriority}
                </Badge>
                <Badge className="bg-primary/5 text-primary border-2 border-primary/10 px-3 h-8 font-black text-[10px] uppercase shadow-none">
                  ${stats.totalTicket.toLocaleString()} estimado
                </Badge>
                <Badge className="bg-blue-50 text-blue-600 border-2 border-blue-100 px-3 h-8 font-black text-[10px] uppercase shadow-none">
                  <Clock className="mr-1.5 h-3 w-3" /> {stats.duration}m est.
                </Badge>
              </div>

              <div className="flex gap-2">
                  <Button variant="ghost" className="text-slate-600 hover:bg-slate-200 font-black uppercase text-[10px]" onClick={handleSaveRoute}>
                    <Save className="mr-2 h-4 w-4" /> Guardar ruta
                  </Button>
                  <Button className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] rounded-xl px-6 shadow-xl" onClick={() => toast({ title: "Agenda Enviada" })}>
                    <Send className="mr-2 h-4 w-4" /> Enviar a Agenda
                  </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 bg-white">
              <Table>
                <TableHeader className="bg-slate-50 border-b-2 border-slate-100">
                  <TableRow className="border-slate-100 hover:bg-transparent">
                    <TableHead className="text-slate-400 font-black uppercase text-[9px] pl-10 h-14">Hora</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[9px]">Cliente</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[9px]">Zona</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[9px]">Contacto</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[9px]">Prioridad</TableHead>
                    <TableHead className="text-slate-400 font-black uppercase text-[9px]">Ticket</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plannedCalls.map((slot) => (
                    <TableRow key={slot.time} className="border-slate-50 hover:bg-slate-50/50 transition-colors group">
                      <TableCell className="pl-10 py-5">
                        <span className="text-slate-950 font-black text-xs">{slot.time}</span>
                      </TableCell>
                      <TableCell>
                        {slot.customer ? (
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                              <PhoneCall className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-slate-950 font-black text-xs uppercase leading-none">{slot.customer.name}</p>
                              <Badge className="mt-1.5 h-3.5 bg-primary/5 text-primary text-[7px] uppercase font-black border-primary/20 shadow-none">Match</Badge>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-300 font-bold text-[10px] uppercase tracking-widest italic">Espacio disponible...</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {slot.customer && <span className="text-slate-500 font-bold text-[10px] uppercase">{(slot.customer as any).zone}</span>}
                      </TableCell>
                      <TableCell>
                        {slot.customer && (
                          <div className="flex flex-col">
                            <span className="text-slate-950 font-black text-[10px] uppercase">{(slot.customer as any).contactPerson}</span>
                            <span className="text-slate-400 font-mono text-[9px]">{(slot.customer as any).phone}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {slot.customer && (
                           <Badge variant="outline" className={cn(
                             "text-[8px] font-black uppercase border-2 shadow-none",
                             (slot.customer as any).priority === 'Alta' ? "border-red-200 text-red-600 bg-red-50" : "border-slate-100 text-slate-400"
                           )}>
                             {(slot.customer as any).priority}
                           </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {slot.customer && <span className="text-primary font-black text-xs">${(slot.customer as any).averageTicket.toLocaleString()}</span>}
                      </TableCell>
                      <TableCell className="pr-10">
                        {slot.customer && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all h-8 w-8"
                            onClick={() => handleRemoveClient(slot.time)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* FRANJAS DISPONIBLES */}
          <div className="space-y-4">
            <h3 className="text-slate-950 text-xs font-black uppercase tracking-widest flex items-center gap-2 pl-2">
              <Zap className="h-4 w-4 text-primary" />
              {plannedCalls.filter(p => !p.customer).length} Franjas Disponibles
            </h3>
            <div className="flex flex-wrap gap-2">
              {plannedCalls.filter(p => !p.customer).map(p => (
                <Badge key={p.time} variant="outline" className="bg-white border-slate-200 text-slate-500 font-mono text-[10px] py-1.5 px-4 hover:border-primary/50 cursor-pointer transition-all shadow-sm">
                  {p.time}
                </Badge>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
