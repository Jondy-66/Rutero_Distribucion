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
import { Download, Users, MoreHorizontal, Eye, Calendar as CalendarIcon } from 'lucide-react';
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
} from '@/components/ui/dropdown-menu';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
  
  // Rango de fechas por defecto: Mes Actual
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfDay(new Date()),
  });

  const managedSellers = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Administrador') {
      return allUsers.filter(u => u.role === 'Usuario' || u.role === 'Telemercaderista');
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
    const relevantStatuses: RoutePlan['status'][] = ['En Progreso', 'Completada', 'Incompleta', 'Planificada'];

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
                    // Si el día ya pasó y no se completaron todos, es Incompleto
                    status = 'Incompleto';
                } else if (completedClients > 0) {
                    // Si es hoy y lleva algunos clientes, está en progreso (Incompleto temporalmente)
                    status = 'Incompleto';
                }
            }
            
            // No mostrar días futuros si están pendientes
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
        if (dailyLog.clients && dailyLog.clients.length > 0) {
            for (const client of dailyLog.clients) {
                if (client.visitStatus === 'Completado') {
                    dataToExport.push({
                        'Vendedor': dailyLog.sellerName,
                        'Nombre de Ruta': dailyLog.routeName,
                        'Fecha de Gestión': format(dailyLog.date, 'PPP', { locale: es }),
                        'RUC Cliente': client.ruc,
                        'Nombre Cliente': client.nombre_comercial,
                        'Hora de Check-in': client.checkInTime || 'N/A',
                        'Hora de Check-out': client.checkOutTime || 'N/A',
                        'Tipo de Visita': client.visitType === 'presencial' ? 'Presencial' : 'Telefónica',
                        'Observación Llamada': client.callObservation || '',
                        'Valor Venta ($)': client.valorVenta || 0,
                        'Valor Cobro ($)': client.valorCobro || 0,
                        'Devoluciones ($)': client.devoluciones || 0,
                        'Promociones ($)': client.promociones || 0,
                        'Medicación Frecuente ($)': client.medicacionFrecuente || 0,
                    });
                }
            }
        }
    }
    
    if (dataToExport.length === 0) {
        toast({
            title: "Sin Datos",
            description: "No hay visitas completadas en los días seleccionados para exportar.",
            variant: "destructive"
        });
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle de Gestiones");
    const sellerName = selectedSellerId === 'all' ? 'todos' : allUsers.find(u=>u.id === selectedSellerId)?.name.replace(/ /g, '_');
    XLSX.writeFile(workbook, `reporte_gestiones_vendedores_${sellerName}.xlsx`);
    toast({ title: "Descarga Iniciada", description: "Tu reporte detallado en Excel se está descargando." });
};

  const handleViewDetails = (routeId: string) => {
    router.push(`/dashboard/routes/${routeId}`);
  };

  if (authLoading) {
    return (
      <>
        <PageHeader title="Reportes de Vendedores" description="Cargando reportes..." />
        <Skeleton className="w-full h-96" />
      </>
    )
  }

  if (currentUser?.role !== 'Supervisor' && currentUser?.role !== 'Administrador') {
    return (
      <PageHeader
        title="Acceso Denegado"
        description="Esta página solo está disponible para supervisores y administradores."
      />
    )
  }

  return (
    <>
      <PageHeader
        title="Reportes de Vendedores"
        description="Visualiza y descarga los reportes de las gestiones diarias por los vendedores a tu cargo."
      >
        <Button onClick={handleDownloadExcel} disabled={authLoading || dailyReports.length === 0}>
          <Download className="mr-2" />
          Descargar Excel
        </Button>
      </PageHeader>
      
      <Card>
        <CardHeader>
            <CardTitle>Gestiones Diarias por Vendedor</CardTitle>
            <CardDescription>
                Selecciona un vendedor y un rango de fechas para ver el detalle de sus jornadas de trabajo.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
                 <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                    <SelectTrigger className="w-full sm:max-w-xs">
                        <Users className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Seleccionar vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los Vendedores</SelectItem>
                        {managedSellers.map(seller => (
                            <SelectItem key={seller.id} value={seller.id}>{seller.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          id="date"
                          variant={"outline"}
                          className={cn(
                            "w-[300px] justify-start text-left font-normal",
                            !dateRange && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange?.from ? (
                            dateRange.to ? (
                              <>
                                {format(dateRange.from, "LLL dd, y", {locale: es})} -{" "}
                                {format(dateRange.to, "LLL dd, y", {locale: es})}
                              </>
                            ) : (
                              format(dateRange.from, "LLL dd, y", {locale: es})
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
            </div>
             <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Nombre de Ruta</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Progreso</TableHead>
                        <TableHead>Estado del Día</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {authLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : dailyReports.length > 0 ? (
                            dailyReports.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell className="font-medium">{log.routeName}</TableCell>
                                    <TableCell>{log.sellerName}</TableCell>
                                    <TableCell>{format(log.date, 'PPP', { locale: es })}</TableCell>
                                    <TableCell>{`${log.completedClients} de ${log.totalClients}`}</TableCell>
                                    <TableCell>
                                        <Badge variant={log.status === 'Completado' ? 'success' : 'destructive'}>
                                            {log.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => handleViewDetails(log.originalRouteId)}>
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    Ver Ruta Original
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24">
                                    No hay gestiones diarias para mostrar con los filtros seleccionados.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
    </Card>
    </>
  );
}
