
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
import type { RoutePlan, User } from '@/lib/types';
import { Download, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import * as XLSX from 'xlsx';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Timestamp } from 'firebase/firestore';

export default function MyCompletedRoutesPage() {
  const { user: currentUser, routes: allRoutes, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  });

  const filteredRoutes = useMemo(() => {
    if (!currentUser || !allRoutes) return [];
    
    let userRoutes = allRoutes.filter(route => 
        route.createdBy === currentUser.id && route.status === 'Completada'
    );
    
    if (dateRange?.from) {
      const fromDate = startOfDay(dateRange.from);
      userRoutes = userRoutes.filter(route => {
        const routeDate = route.date instanceof Timestamp ? route.date.toDate() : route.date;
        return routeDate >= fromDate;
      });
    }
     if (dateRange?.to) {
      const toDate = endOfDay(dateRange.to);
      userRoutes = userRoutes.filter(route => {
        const routeDate = route.date instanceof Timestamp ? route.date.toDate() : route.date;
        return routeDate <= toDate;
      });
    }
    
    return userRoutes;
  }, [dateRange, allRoutes, currentUser]);
  
  const handleDownloadExcel = () => {
    if (filteredRoutes.length === 0) {
      toast({
        title: "Sin Datos",
        description: "No hay rutas completadas en el rango de fechas seleccionado.",
        variant: "destructive"
      });
      return;
    }

    const dataToExport = filteredRoutes.map(route => {
      const routeDate = route.date instanceof Timestamp ? route.date.toDate() : route.date;
      return {
        'Nombre de Ruta': route.routeName,
        'Fecha de Ruta': format(routeDate, 'PPP', { locale: es }),
        'Clientes en Ruta': route.clients.length,
        'Estado': route.status,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rutas Completadas");
    XLSX.writeFile(workbook, `reporte_rutas_completadas.xlsx`);
    toast({ title: "Descarga Iniciada", description: "Tu reporte en Excel se está descargando." });
  };

  if (authLoading) {
    return (
      <>
        <PageHeader title="Mis Rutas Completadas" description="Cargando reportes..." />
        <Skeleton className="w-full h-96" />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Mis Rutas Completadas"
        description="Visualiza y descarga el reporte de tus rutas completadas."
      >
        <Button onClick={handleDownloadExcel} disabled={authLoading || filteredRoutes.length === 0}>
          <Download className="mr-2" />
          Descargar Excel
        </Button>
      </PageHeader>
      
      <Card>
        <CardHeader>
            <CardTitle>Rutas Completadas</CardTitle>
            <CardDescription>
                Selecciona un rango de fechas para ver tus rutas completadas.
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
                        <TableHead>Fecha</TableHead>
                        <TableHead>Clientes</TableHead>
                        <TableHead>Estado</TableHead>
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
                                </TableRow>
                            ))
                        ) : filteredRoutes.length > 0 ? (
                            filteredRoutes.map((route) => (
                                <TableRow key={route.id}>
                                    <TableCell className="font-medium">{route.routeName}</TableCell>
                                    <TableCell>{format(route.date, 'PPP', { locale: es })}</TableCell>
                                    <TableCell>{route.clients.length}</TableCell>
                                    <TableCell>{route.status}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24">
                                    No hay rutas completadas para el rango de fechas seleccionado.
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
