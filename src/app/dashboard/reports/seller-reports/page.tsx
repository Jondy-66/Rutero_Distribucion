'use client';
import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { RoutePlan, ClientInRoute } from '@/lib/types';
import { Download, Users, MoreHorizontal, Eye, Calendar as CalendarIcon, ClipboardCheck, AlertCircle, CheckCircle2, Clock, MapPin, Phone, Building2 } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfMonth, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import * as XLSX from 'xlsx';
import { Timestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type DailyLog = {
    id: string;
    routeName: string;
    sellerId: string;
    sellerName: string;
    date: Date;
    totalClients: number;
    completedClients: number;
    status: 'Completado' | 'Incompleto' | 'Pendiente';
    originalRouteId: string;
    clients: ClientInRoute[];
};

function groupBy<T, K extends string | number | symbol>(list: T[], getKey: (item: T) => K) {
  return list.reduce((previous, currentItem) => {
    const group = getKey(currentItem);
    if (!previous[group]) previous[group] = [];
    previous[group].push(currentItem);
    return previous;
  }, {} as Record<K, T[]>);
}

export default function SellerReportsPage() {
  const { user: currentUser, users: allUsers, routes: allRoutes, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all');
  const [auditLog, setAuditLog] = useState<DailyLog | null>(null);
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfDay(new Date()),
  });

  const hasPerm = (id: string) => {
    if (!currentUser) return false;
    if (currentUser.role === 'Administrador') return true;
    if (currentUser.permissions && currentUser.permissions.length > 0) {
      return currentUser.permissions.includes(id);
    }
    const roleDefaults: Record<string, string[]> = {
      'Supervisor': ['dashboard', 'admin-dashboard', 'clients', 'map', 'reports', 'seller-reports', 'audit-detail', 'tracking', 'routes', 'recover-clients'],
      'Auditor': ['dashboard', 'admin-dashboard', 'clients', 'locations', 'map', 'reports', 'seller-reports', 'audit-detail', 'tracking', 'routes'],
    };
    return (roleDefaults[currentUser.role] || []).includes(id);
  };

  const managedSellers = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Administrador' || currentUser.role === 'Auditor') {
      return allUsers.filter(u => u.role !== 'Administrador');
    }
    if (currentUser.role === 'Supervisor') {
      return allUsers.filter(u => u.supervisorId === currentUser.id);
    }
    return [];
  }, [currentUser, allUsers]);

  const dailyReports = useMemo(() => {
    if (!currentUser || !allRoutes || !allUsers) return [];

    const managedSellerIds = managedSellers.map(s => s.id);
    const relevantStatuses: RoutePlan['status'][] = ['En Progreso', 'Completada', 'Planificada'];

    let routesToConsider = allRoutes.filter(route => 
        managedSellerIds.includes(route.createdBy) && relevantStatuses.includes(route.status)
    );
    
    if (selectedSellerId !== 'all') {
      routesToConsider = routesToConsider.filter(route => route.createdBy === selectedSellerId);
    }

    const logs: DailyLog[] = [];

    routesToConsider.forEach(route => {
        const clientsByDay = groupBy(
            route.clients.filter(c => c.status !== 'Eliminado'),
            c => {
                const d = c.date instanceof Timestamp ? c.date.toDate() : (c.date instanceof Date ? c.date : (c.date ? new Date(c.date) : null));
                return d ? format(d, 'yyyy-MM-dd') : 'no-date';
            }
        );

        Object.entries(clientsByDay).forEach(([dateStr, dailyClients]) => {
            if (dateStr === 'no-date') return;

            const logDate = new Date(dateStr + 'T00:00:00');

            if (dateRange?.from && logDate < startOfDay(dateRange.from)) return;
            if (dateRange?.to && logDate > endOfDay(dateRange.to)) return;

            const completedClients = dailyClients.filter(c => c.visitStatus === 'Completado').length;
            const today = startOfDay(new Date());
            
            let status: DailyLog['status'] = 'Pendiente';
            
            if (dailyClients.length > 0) {
                if (completedClients === dailyClients.length) {
                    status = 'Completado';
                } else if (isBefore(logDate, today)) {
                    status = 'Incompleto';
                } else if (completedClients > 0) {
                    status = 'Incompleto';
                }
            }
            
            if (logDate > today && status === 'Pendiente') return;

            logs.push({
                id: `${route.id}-${dateStr}`,
                routeName: route.routeName,
                sellerId: route.createdBy,
                sellerName: allUsers.find(u => u.id === route.createdBy)?.name || 'Desconocido',
                date: logDate,
                totalClients: dailyClients.length,
                completedClients: completedClients,
                status: status,
                originalRouteId: route.id,
                clients: dailyClients,
            });
        });
    });
    
    return logs.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [selectedSellerId, allRoutes, managedSellers, currentUser, dateRange, allUsers]);
  
  const handleDownloadExcel = () => {
    if (dailyReports.length === 0) {
        toast({ title: "Sin Datos", description: "No hay gestiones diarias para descargar.", variant: "destructive" });
        return;
    }

    const chronologicalReports = [...dailyReports].sort((a, b) => a.date.getTime() - b.date.getTime());
    const dataToExport = [];

    for (const dailyLog of chronologicalReports) {
        const sortedClients = [...dailyLog.clients].sort((a, b) => {
            const timeA = a.checkInTime || '99:99:99';
            const timeB = b.checkInTime || '99:99:99';
            return timeA.localeCompare(timeB);
        });

        for (const client of sortedClients) {
            const latIn = client.checkInLocation?.latitude ?? (client.checkInLocation as any)?.lat ?? (client.checkInLocation as any)?._lat ?? '';
            const lngIn = client.checkInLocation?.longitude ?? (client.checkInLocation as any)?.lng ?? (client.checkInLocation as any)?._long ?? '';
            const latOut = client.checkOutLocation?.latitude ?? (client.checkOutLocation as any)?.lat ?? (client.checkOutLocation as any)?._lat ?? '';
            const lngOut = client.checkOutLocation?.longitude ?? (client.checkOutLocation as any)?.lng ?? (client.checkOutLocation as any)?._long ?? '';

            dataToExport.push({
                'Vendedor': dailyLog.sellerName,
                'Ruta': dailyLog.routeName,
                'Fecha': format(dailyLog.date, 'dd/MM/yyyy'),
                'Estado Día': dailyLog.status,
                'RUC': client.ruc,
                'Cliente': client.nombre_comercial,
                'Sucursal': client.selectedBranch || 'Matriz',
                'Tipo Gestión': client.visitType === 'presencial' ? 'Presencial' : (client.visitType === 'telefonica' ? 'Telefónica' : 'N/A'),
                'Estado Gestión': client.visitStatus === 'Completado' ? 'OK' : 'PENDIENTE',
                'H. Entrada': client.checkInTime || 'N/A',
                'H. Salida': client.checkOutTime || 'N/A',
                'Latitud Entrada': latIn,
                'Longitud Entrada': lngIn,
                'Latitud Salida': latOut,
                'Longitud Salida': lngOut,
                'Venta ($)': client.valorVenta || 0,
                'Cobro ($)': client.valorCobro || 0,
                'Devol. ($)': client.devoluciones || 0,
                'Promociones ($)': client.promociones || 0,
                'Observación': client.visitObservation || client.callObservation || '',
                'Justificación Extra': client.reAdditionObservation || ''
            });
        }
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Auditoría Detallada");
    
    const seller = allUsers.find(u => u.id === selectedSellerId);
    const name = selectedSellerId === 'all' ? 'todos' : (seller?.name || 'vendedor').replace(/ /g, '_');
    
    XLSX.writeFile(workbook, `auditoria_fuerza_ventas_${name}.xlsx`);
    toast({ title: "Descarga Iniciada", description: "El reporte detallado se está procesando." });
};

  if (authLoading) {
    return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reportes de Vendedores"
        description="Auditoría de gestiones diarias de la fuerza de ventas."
      >
        <Button onClick={handleDownloadExcel} disabled={dailyReports.length === 0} className="font-black">
          <Download className="mr-2 h-4 w-4" />
          Exportar Auditoría Completa
        </Button>
      </PageHeader>
      
      <Card className="border-t-4 border-t-primary shadow-xl">
        <CardHeader>
          <CardTitle className="font-black text-slate-950 uppercase">Gestiones Diarias por Vendedor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
              <SelectTrigger className="w-full sm:max-w-xs h-12 border-2 font-black">
                <Users className="mr-2 h-4 w-4 text-primary" />
                <SelectValue placeholder="Seleccionar vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-black">Todos los Usuarios</SelectItem>
                {managedSellers.map(seller => (
                  <SelectItem key={seller.id} value={seller.id} className="font-black">{seller.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full sm:max-w-xs h-12 border-2 font-black justify-start">
                  <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>{format(dateRange.from, "dd LLL")} - {format(dateRange.to, "dd LLL")}</>
                    ) : format(dateRange.from, "dd LLL")
                  ) : "Rango de fechas"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={dateRange} onSelect={setDateRange} locale={es} numberOfMonths={2} />
              </PopoverContent>
            </Popover>
          </div>

          <div className="border-2 border-slate-100 rounded-2xl overflow-hidden shadow-inner">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black uppercase text-[10px]">Ruta</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Vendedor</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Fecha</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Progreso</TableHead>
                  <TableHead className="font-black uppercase text-[10px]">Estado</TableHead>
                  <TableHead className="text-right font-black uppercase text-[10px] pr-8">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyReports.length > 0 ? (
                  dailyReports.map((log) => (
                    <TableRow key={log.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-black text-xs uppercase">{log.routeName}</TableCell>
                      <TableCell className="font-black text-xs uppercase">{log.sellerName}</TableCell>
                      <TableCell className="font-black text-xs uppercase">{format(log.date, 'dd MMM yyyy', { locale: es })}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 w-24">
                          <span className="font-black text-primary text-[10px] uppercase">{log.completedClients} de {log.totalClients} OK</span>
                          <Progress value={(log.completedClients / log.totalClients) * 100} className="h-1" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.status === 'Completado' ? 'success' : 'destructive'} className="font-black text-[9px] uppercase border-none">
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right pr-8">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="rounded-full"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="text-[10px] uppercase font-black text-slate-500">Auditoría</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setAuditLog(log)} disabled={!hasPerm('audit-detail')} className="font-black text-xs uppercase">
                              <ClipboardCheck className="mr-2 h-4 w-4 text-primary" /> Ver Detalle
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/routes/${log.originalRouteId}`)} className="font-black text-xs uppercase">
                              <Eye className="mr-2 h-4 w-4" /> Ver Ruta Completa
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center font-black uppercase text-slate-400 text-xs">Sin registros para mostrar</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={!!auditLog} onOpenChange={() => setAuditLog(null)}>
        <SheetContent className="sm:max-w-2xl rounded-l-[2rem] p-0 flex flex-col h-full overflow-hidden">
          <SheetHeader className="p-8 bg-primary text-white shrink-0">
            <div className="flex justify-between items-start">
              <div>
                <SheetTitle className="text-2xl font-black uppercase text-white tracking-tighter">Detalle de Auditoría</SheetTitle>
                <SheetDescription className="text-white/80 font-bold uppercase text-[10px]">{auditLog?.sellerName} | {auditLog?.routeName}</SheetDescription>
              </div>
              <Badge className="bg-white text-primary font-black uppercase text-[10px]">{auditLog?.date ? format(auditLog.date, 'EEEE dd MMMM', { locale: es }) : ''}</Badge>
            </div>
            <div className="mt-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black uppercase">Efectividad de Jornada</span>
                <span className="text-xl font-black">{auditLog ? Math.round((auditLog.completedClients / auditLog.totalClients) * 100) : 0}%</span>
              </div>
              <Progress value={auditLog ? (auditLog.completedClients / auditLog.totalClients) * 100 : 0} className="h-2 bg-white/20 [&>div]:bg-white" />
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 p-6 lg:p-8">
            <div className="space-y-6">
              <h4 className="font-black text-xs uppercase text-slate-950 border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Cronograma de Visitas
              </h4>
              <div className="space-y-4">
                {auditLog?.clients.sort((a, b) => (a.checkInTime || '99:99').localeCompare(b.checkInTime || '99:99')).map((client, idx) => (
                  <div key={idx} className={cn("p-5 rounded-2xl border-2 transition-all", client.visitStatus === 'Completado' ? "bg-white border-slate-100 shadow-sm" : "bg-red-50/30 border-dashed border-red-200")}>
                    <div className="flex justify-between items-start mb-3">
                      <div className="min-w-0 flex-1">
                        <h5 className="font-black text-sm uppercase text-slate-950 truncate leading-tight">{client.nombre_comercial}</h5>
                        <p className="text-[9px] font-mono font-bold text-slate-400 mt-1 uppercase">RUC: {client.ruc}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={client.visitStatus === 'Completado' ? 'success' : 'destructive'} className="font-black text-[8px] uppercase">
                            {client.visitStatus === 'Completado' ? 'GESTIONADO' : 'PENDIENTE'}
                        </Badge>
                        {client.visitStatus === 'Completado' && client.visitType && (
                            <Badge variant="outline" className="font-black text-[7px] uppercase border-primary text-primary flex items-center gap-1">
                                {client.visitType === 'presencial' ? <MapPin className="h-2 w-2" /> : <Phone className="h-2 w-2" />}
                                {client.visitType === 'presencial' ? 'PRESENCIAL' : 'TELEFÓNICA'}
                            </Badge>
                        )}
                      </div>
                    </div>
                    {client.visitStatus === 'Completado' && (
                      <div className="grid grid-cols-2 gap-4 mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="col-span-2 space-y-1 mb-2 pb-2 border-b border-slate-200">
                            <p className="text-[8px] font-black uppercase text-slate-400">Sucursal de Gestión</p>
                            <div className="flex items-center gap-1.5 text-slate-900">
                                <Building2 className="h-3 w-3 text-primary" />
                                <span className="text-[10px] font-black uppercase">{client.selectedBranch || 'Matriz'}</span>
                            </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[8px] font-black uppercase text-slate-400">Entrada / Salida</p>
                          <p className="text-[11px] font-black text-slate-950 uppercase">{client.checkInTime || '--:--'} / {client.checkOutTime || '--:--'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[8px] font-black uppercase text-slate-400">Venta / Cobro / Devol.</p>
                          <p className="text-[11px] font-black text-primary uppercase">${client.valorVenta?.toFixed(2)} / ${client.valorCobro?.toFixed(2)} / ${client.devoluciones?.toFixed(2)}</p>
                        </div>
                        <div className="col-span-2 space-y-1 pt-2 border-t border-slate-200">
                          <p className="text-[8px] font-black uppercase text-slate-400">Observación</p>
                          <p className="text-[10px] font-bold text-slate-600 leading-tight italic">{client.visitObservation || client.callObservation || 'Sin comentario.'}</p>
                        </div>
                        {client.isReadded && (
                          <div className="col-span-2 space-y-1 pt-2 border-t border-dashed border-slate-200">
                            <p className="text-[8px] font-black uppercase text-orange-600">Motivo Adición Extra</p>
                            <p className="text-[10px] font-bold text-slate-600 italic">{client.reAdditionObservation || 'N/A'}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
          <div className="p-8 border-t bg-slate-50 shrink-0">
            <Button variant="outline" className="w-full h-12 font-black uppercase rounded-xl border-2" onClick={() => setAuditLog(null)}>Cerrar Auditoría</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
