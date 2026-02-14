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
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { RoutePlan } from '@/lib/types';
import { Download, Calendar as CalendarIcon, MoreHorizontal } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import * as XLSX from 'xlsx';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function MyCompletedRoutesPage() {
  const { user: currentUser, routes: allRoutes, loading: authLoading, clients: allSystemClients } = useAuth();
  const { toast } = useToast();
  
  // Por defecto mostrar desde el inicio del mes para asegurar visibilidad de rutas recientes
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfDay(new Date()),
  });

  const filteredRoutes = useMemo(() => {
    if (!currentUser || !allRoutes) return [];
    
    let userRoutes = allRoutes.filter(route => 
        route.createdBy === currentUser.id
    );
    
    if (dateRange?.from) {
      const fromDate = startOfDay(dateRange.from);
      userRoutes = userRoutes.filter(route => {
        const routeDate = route.date instanceof Timestamp ? route.date.toDate() : (route.date instanceof Date ? route.date : new Date(route.date));
        return routeDate >= fromDate;
      });
    }
     if (dateRange?.to) {
      const toDate = endOfDay(dateRange.to);
      userRoutes = userRoutes.filter(route => {
        const routeDate = route.date instanceof Timestamp ? route.date.toDate() : (route.date instanceof Date ? route.date : new Date(route.date));
        return routeDate <= toDate;
      });
    }
    
    return userRoutes;
  }, [dateRange, allRoutes, currentUser]);
  
  const handleDownloadSummaryExcel = () => {
    if (filteredRoutes.length === 0) {
      toast({
        title: "Sin Datos",
        description: "No hay rutas en el rango de fechas seleccionado.",
        variant: "destructive"
      });
      return;
    }

    const dataToExport = filteredRoutes.map(route => {
      const routeDate = route.date instanceof Timestamp ? route.date.toDate() : (route.date instanceof Date ? route.date : new Date(route.date));
      return {
        'Nombre de Ruta': route.routeName,
        'Fecha de Ruta': format(routeDate, 'PPP', { locale: es }),
        'Clientes en Ruta': route.clients.length,
        'Estado': route.status,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Historial de Rutas");
    XLSX.writeFile(workbook, `reporte_historial_rutas.xlsx`);
    toast({ title: "Descarga Iniciada", description: "Tu reporte en Excel se está descargando." });
  };

  const handleDownloadDetailedExcel = (route: RoutePlan) => {
    if (!route || !route.clients || route.clients.length === 0) {
      toast({ title: "Sin Datos", description: "Esta ruta no tiene clientes para exportar.", variant: "destructive" });
      return;
    }

    const dataToExport = route.clients
      .filter(client => client.status !== 'Eliminado' && client.visitStatus === 'Completado')
      .map(client => {
        const clientDetails = allSystemClients.find(c => c.ruc === client.ruc);
        const visitDate = client.date instanceof Timestamp ? client.date.toDate() : (client.date instanceof Date ? client.date : (client.date ? new Date(client.date) : null));
        return {
          'Fecha de Visita': visitDate ? format(visitDate, 'PPP', { locale: es }) : 'N/A',
          'RUC Cliente': client.ruc,
          'Nombre Cliente': clientDetails?.nombre_comercial || client.nombre_comercial,
          'Hora de Check-in': client.checkInTime || 'N/A',
          'Hora de Check-out': client.checkOutTime || 'N/A',
          'Tipo de Visita': client.visitType === 'presencial' ? 'Presencial' : 'Telefónica',
          'Observación Llamada': client.callObservation || '',
          'Valor Venta ($)': client.valorVenta || 0,
          'Valor Cobro ($)': client.valorCobro || 0,
          'Devoluciones ($)': client.devoluciones || 0,
          'Promociones ($)': client.promociones || 0,
          'Medicación Frecuente ($)': client.medicacionFrecuente || 0,
        };
      });

    if (dataToExport.length === 0) {
        toast({ title: "Sin Datos", description: "No hay clientes gestionados en esta ruta para exportar.", variant: "destructive" });
        return;
    }
    
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle Ruta");
    XLSX.writeFile(workbook, `reporte_detallado_${route.routeName.replace(/ /g, '_')}.xlsx`);
    toast({ title: "Descarga Iniciada", description: "Tu reporte detallado en Excel se está descargando." });
  };

  if (authLoading) {
    return (
      <>
        <PageHeader title="Historial de Mis Rutas" description="Cargando reportes..." />
        <Skeleton className="w-full h-96" />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Historial de Mis Rutas"
        description="Visualiza y descarga el reporte de todas tus rutas."
      >
        <Button onClick={handleDownloadSummaryExcel} disabled={authLoading || filteredRoutes.length === 0}>
          <Download className="mr-2" />
          Descargar Resumen
        </Button>
      </PageHeader>
      
      <Card>
        <CardHeader>
            <CardTitle>Historial de Rutas</CardTitle>
            <CardDescription>
                Selecciona un rango de fechas para ver todas tus rutas.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="mb-4">
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
             <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Nombre de Ruta</TableHead>
                        <TableHead>Fecha Base</TableHead>
                        <TableHead>Clientes</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {authLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredRoutes.length > 0 ? (
                            filteredRoutes.map((route) => {
                                const routeDate = route.date instanceof Timestamp ? route.date.toDate() : (route.date instanceof Date ? route.date : new Date(route.date));
                                return (
                                <TableRow key={route.id}>
                                    <TableCell className="font-medium">{route.routeName}</TableCell>
                                    <TableCell>{format(routeDate, 'PPP', { locale: es })}</TableCell>
                                    <TableCell>{route.clients.length}</TableCell>
                                    <TableCell>
                                      <Badge variant={
                                        route.status === 'Completada' ? 'success' :
                                        (route.status === 'Rechazada' || route.status === 'Incompleta') ? 'destructive' :
                                        'secondary'
                                      }>
                                        {route.status}
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
                                                <DropdownMenuItem onClick={() => handleDownloadDetailedExcel(route)}>
                                                    <Download className="mr-2 h-4 w-4" />
                                                    Descargar Detalle
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )})
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                    No hay rutas para el rango de fechas seleccionado.
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
