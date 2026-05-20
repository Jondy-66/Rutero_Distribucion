
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
import { Download, Users, MoreHorizontal, Eye, Calendar as CalendarIcon, ClipboardCheck, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
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

  const formatLoc = (loc: any) => {
    if (!loc) return 'N/A';
    if (typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
        return `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`;
    }
    return 'N/A';
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

    const groupBy = <T, K extends keyof any>(list: T[], getKey: (item: T) => K) =>
      list.reduce((previous, currentItem) => {
        const group = getKey(currentItem);
        if (!previous[group]) previous[group] = [];
        previous[group].push(currentItem);
        return previous;
      }, {} as Record<K, T[]>);

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
        toast({
            title: "Sin Datos",
            description: "No hay gestiones diarias para descargar con los filtros seleccionados.",
            variant: "destructive"
        });
        return;
    }

    const dataToExport = [];

    for (const dailyLog of dailyReports) {
        // Ordenar clientes por hora de ingreso para este log diario
        const sortedClients = [...dailyLog.clients].sort((a, b) => {
            const timeA = a.checkInTime || '99:99:99';
            const timeB = b.checkInTime || '99:99:99';
            return timeA.localeCompare(timeB);
        });

        for (const client of sortedClients) {
            dataToExport.push({
                'Vendedor': dailyLog.sellerName,
                'Nombre de Ruta': dailyLog.routeName,
                'Fecha de Gestión': format(dailyLog.date, 'PPP', { locale: es }),
                'Estado del Día': dailyLog.status,
                'RUC Cliente': client.ruc,
                'Nombre Cliente': client.nombre_comercial,
                'Estado de Gestión': client.visitStatus === 'Completado' ? 'GESTIONADO' : 'PENDIENTE / FALTÓ',
                'Hora de Check-in': client.checkInTime || 'N/A',
                'Ubicación Check-in': formatLoc(client.checkInLocation),
                'Hora de Check-out': client.checkOutTime || 'N/A',
                'Ubicación Check-out': formatLoc(client.checkOutLocation),
                'Tipo de Visita': client.visitType === 'presencial' ? 'Presencial' : (client.visitType === 'telefonica' ? 'Telefónica' : 'N/A'),
                'Observación Llamada': client.callObservation || '',
                'Valor Venta ($)': client.valorVenta || 0,
                'Valor Cobro ($)': client.valorCobro || 0,
                'Devoluciones ($)': client.devoluciones || 0,
                'Es Re-adición': client.isReadded ? 'SÍ' : 'NO',
                'Observación Re-adición': client.reAdditionObservation || ''
            });
        }
    }
    
    if (dataToExport.length === 0) {
        toast({
            title: "Sin Datos",
            description: "No se encontraron clientes para exportar.",
            variant: "destructive"
        });
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Auditoría de Gestiones");
    const sellerName = selectedSellerId === 'all' ? 'todos' : allUsers.find(u=>u.id === selectedSellerId)?.name.replace(/ /g, '_');
    XLSX.writeFile(workbook, `auditoria_vendedores_${sellerName}.xlsx`);
    toast({ title: "Descarga Iniciada", description: "El reporte de auditoría se está descargando ordenado por tiempo." });
};

  const handleViewDetails = (routeId: string) => {
    router.push(`/dashboard/routes/${routeId}`);
  };

  const openAudit = (log: DailyLog) => {
    setAuditLog(log);
  };

  if (authLoading) {
    return (
      <>
        <PageHeader title="Reportes de Vendedores" description="Cargando reportes..." />
        <Skeleton className="w-full h-96" />
      </>
    )
  }

  if (currentUser?.role !== 'Supervisor' && currentUser?.role !== 'Administrador' && currentUser?.role !== 'Auditor') {
    return (
      <PageHeader
        title="Acceso Denegado"
        description="Esta página solo está disponible para supervisores, auditores y administradores."
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Reportes de Vendedores"
        description="Visualiza y descarga los reportes de las gestiones diarias de toda la fuerza de ventas."
      >
        <Button onClick={handleDownloadExcel} disabled={authLoading || dailyReports.length === 0} className="font-black">
          <Download className="mr-2 h-4 w-4" />
          Descargar Auditoría Excel
        </Button>
      </PageHeader>
      
      <Card className="border-t-4 border-t-primary shadow-xl">
        <CardHeader>
            <CardTitle className="font-black text-slate-950 uppercase">Gestiones Diarias por Vendedor</CardTitle>
            <CardDescription className="font-bold text-[10px] text-slate-500 uppercase">
                Selecciona un vendedor y un rango de fechas para auditar el detalle de sus jornadas.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                 <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                    <SelectTrigger className="w-full sm:max-w-xs h-12 border-2 border-slate-200 font-black text-slate-950 rounded-xl">
                        <Users className="mr-2 h-4 w-4 text-primary" />
                        <SelectValue placeholder="Seleccionar vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="font-black text-slate-950">Todos los Usuarios</SelectItem>
                        {managedSellers.map(seller => (
                            <SelectItem key={seller.id} value={seller.id} className="font-black text-slate-950">{seller.name} ({seller.role})</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Popover>
                    <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={"outline"}
                        className={cn(
                        "w-full sm:max-w-xs justify-start text-left font-black h-12 border-2 border-slate-200 text-slate-950 rounded-xl",
                        !dateRange && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                        {dateRange?.from ? (
                        dateRange.to ? (
                            <>
                            {format(dateRange.from, "LLL dd", {locale: es})} - {format(dateRange.to, "LLL dd", {locale: es})}
                            </>
                        ) : (
                            format(dateRange.from, "LLL dd", {locale: es})
                        )
                        ) : (
                        <span>Elige un rango de fechas</span>
                        )}
                    </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={dateRange?.from}
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        locale={es}
                    />
                    </PopoverContent>
                </Popover>
            </div>
             <div className="border-2 border-slate-100 rounded-[1.5rem] overflow-hidden shadow-inner">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px] h-12">Ruta</TableHead>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Vendedor</TableHead>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Fecha</TableHead>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Progreso</TableHead>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Estado</TableHead>
                        <TableHead className="text-right font-black text-slate-950 uppercase text-[10px]">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {dailyReports.length > 0 ? (
                            dailyReports.map((log) => (
                                <TableRow key={log.id} className="hover:bg-slate-50/50">
                                    <TableCell className="font-black text-slate-950 text-xs uppercase">{log.routeName}</TableCell>
                                    <TableCell className="font-black text-slate-950 text-xs uppercase">{log.sellerName}</TableCell>
                                    <TableCell className="font-black text-slate-950 text-xs uppercase">{format(log.date, 'dd MMM yyyy', { locale: es })}</TableCell>
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
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-9 w-9 hover:bg-slate-100 rounded-full">
                                                    <MoreHorizontal className="h-5 w-5 text-slate-950" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-2xl border-none p-2">
                                                <DropdownMenuLabel className="font-black text-[10px] uppercase text-slate-500 mb-1">Auditoría</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => openAudit(log)} className="font-black text-xs uppercase text-slate-950 py-2.5 bg-primary/5 rounded-lg mb-1">
                                                    <ClipboardCheck className="mr-2 h-4 w-4 text-primary" />
                                                    Detalle de Auditoría
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem onClick={() => handleViewDetails(log.originalRouteId)} className="font-black text-xs uppercase text-slate-950 py-2.5 rounded-lg">
                                                    <Eye className="mr-2 h-4 w-4 text-slate-400" />
                                                    Ver Ruta Completa
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-32 font-black text-slate-400 uppercase text-xs">
                                    No hay gestiones diarias para auditar en este periodo.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>

      <Sheet open={!!auditLog} onOpenChange={() => setAuditLog(null)}>
          <SheetContent className="sm:max-w-2xl rounded-l-[2rem] border-none shadow-2xl p-0 flex flex-col h-full bg-white">
              <SheetHeader className="p-8 pb-4 bg-primary text-white">
                  <div className="flex justify-between items-start">
                    <div>
                        <SheetTitle className="text-2xl font-black uppercase text-white tracking-tighter">Detalle de Auditoría</SheetTitle>
                        <SheetDescription className="text-white/80 font-bold uppercase text-[10px]">
                            {auditLog?.sellerName} | {auditLog?.routeName}
                        </SheetDescription>
                    </div>
                    <Badge className="bg-white text-primary font-black uppercase text-[10px] px-3">{auditLog?.date ? format(auditLog.date, 'EEEE dd MMMM', { locale: es }) : ''}</Badge>
                  </div>
                  <div className="mt-6 p-4 bg-white/10 rounded-2xl border border-white/20">
                      <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-black uppercase tracking-widest">Efectividad de Jornada</span>
                          <span className="text-xl font-black">{auditLog ? Math.round((auditLog.completedClients / auditLog.totalClients) * 100) : 0}%</span>
                      </div>
                      <Progress value={auditLog ? (auditLog.completedClients / auditLog.totalClients) * 100 : 0} className="h-2 bg-white/20 [&>div]:bg-white" />
                  </div>
              </SheetHeader>

              <ScrollArea className="flex-1 p-6 lg:p-8">
                  <div className="space-y-6">
                      <h4 className="font-black text-xs uppercase text-slate-950 border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                          <Clock className="h-4 w-4 text-primary" />
                          Cronograma de Visitas (Orden de Ingreso)
                      </h4>
                      
                      <div className="space-y-4">
                        {auditLog?.clients.sort((a, b) => {
                            const timeA = a.checkInTime || '99:99:99';
                            const timeB = b.checkInTime || '99:99:99';
                            return timeA.localeCompare(timeB);
                        }).map((client, idx) => (
                            <div key={idx} className={cn(
                                "p-5 rounded-2xl border-2 transition-all",
                                client.visitStatus === 'Completado' ? "bg-white border-slate-100 shadow-sm" : "bg-red-50/30 border-dashed border-red-200"
                            )}>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="min-w-0 flex-1">
                                        <h5 className="font-black text-sm uppercase text-slate-950 truncate leading-tight">{client.nombre_comercial}</h5>
                                        <p className="text-[9px] font-mono font-bold text-slate-400 mt-1 uppercase">RUC: {client.ruc}</p>
                                    </div>
                                    <Badge variant={client.visitStatus === 'Completado' ? 'success' : 'destructive'} className="font-black text-[8px] uppercase">
                                        {client.visitStatus === 'Completado' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                                        {client.visitStatus === 'Completado' ? 'GESTIONADO' : 'FALTÓ GESTIÓN'}
                                    </Badge>
                                </div>

                                {client.visitStatus === 'Completado' ? (
                                    <div className="grid grid-cols-2 gap-4 mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">Entrada / Salida</p>
                                            <p className="text-[11px] font-black text-slate-950 uppercase">{client.checkInTime || '--:--'} / {client.checkOutTime || '--:--'}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">Venta / Cobro</p>
                                            <p className="text-[11px] font-black text-primary uppercase">${client.valorVenta?.toFixed(2)} / ${client.valorCobro?.toFixed(2)}</p>
                                        </div>
                                        <div className="col-span-2 space-y-1 pt-2 border-t border-slate-200">
                                            <p className="text-[8px] font-black uppercase text-slate-400 tracking-tighter">Observación de Visita</p>
                                            <p className="text-[10px] font-bold text-slate-600 leading-tight italic">
                                                {client.visitType === 'telefonica' ? `[TELEFÓNICA] ${client.callObservation}` : (client.visitObservation || 'Sin observaciones registradas.')}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="mt-2 p-3 bg-red-50/50 rounded-xl border border-red-100">
                                        <p className="text-[10px] font-black text-red-600 uppercase italic flex items-center gap-2">
                                            <AlertCircle className="h-3 w-3" />
                                            Parada no gestionada por el usuario.
                                        </p>
                                    </div>
                                )}
                            </div>
                        ))}
                      </div>
                  </div>
              </ScrollArea>
              
              <div className="p-8 border-t bg-slate-50">
                  <Button variant="outline" className="w-full h-12 font-black uppercase rounded-xl border-2" onClick={() => setAuditLog(null)}>
                      Cerrar Auditoría
                  </Button>
              </div>
          </SheetContent>
      </Sheet>
    </>
  );
}

