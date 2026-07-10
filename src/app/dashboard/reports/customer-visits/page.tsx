
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
import { Download, Users, Calendar as CalendarIcon, Search, History, CheckCircle2 } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import * as XLSX from 'xlsx';
import { Timestamp } from 'firebase/firestore';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type VisitDetail = {
    date: Date;
    dayName: string;
    routeName: string;
};

type CustomerVisitSummary = {
    ruc: string;
    name: string;
    executive: string;
    frequency: number;
    visits: VisitDetail[];
};

export default function CustomerVisitsPage() {
  const { user: currentUser, users: allUsers, routes: allRoutes, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfDay(new Date()),
  });

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

  const customerVisits = useMemo(() => {
    if (!allRoutes || !allUsers) return [];

    const visitMap = new Map<string, CustomerVisitSummary>();
    const managedSellerIds = managedSellers.map(s => s.id);

    allRoutes.forEach(route => {
        // Solo considerar rutas de vendedores bajo el mando del usuario actual
        if (!managedSellerIds.includes(route.createdBy)) return;
        if (selectedSellerId !== 'all' && route.createdBy !== selectedSellerId) return;

        route.clients.forEach(client => {
            if (client.status === 'Eliminado' || client.visitStatus !== 'Completado') return;

            const visitDate = client.date instanceof Timestamp 
                ? client.date.toDate() 
                : (client.date instanceof Date ? client.date : new Date(client.date as any));

            if (dateRange?.from && visitDate < startOfDay(dateRange.from)) return;
            if (dateRange?.to && visitDate > endOfDay(dateRange.to)) return;

            const key = `${client.ruc}-${route.createdBy}`;
            if (!visitMap.has(key)) {
                visitMap.set(key, {
                    ruc: client.ruc,
                    name: client.nombre_comercial,
                    executive: allUsers.find(u => u.id === route.createdBy)?.name || 'Desconocido',
                    frequency: 0,
                    visits: []
                });
            }

            const summary = visitMap.get(key)!;
            summary.frequency += 1;
            summary.visits.push({
                date: visitDate,
                dayName: format(visitDate, 'EEEE', { locale: es }),
                routeName: route.routeName
            });
        });
    });

    const results = Array.from(visitMap.values());

    // Filtrar por término de búsqueda
    return results.filter(item => {
        const term = searchTerm.toLowerCase();
        return item.ruc.includes(term) || item.name.toLowerCase().includes(term);
    }).sort((a, b) => b.frequency - a.frequency);
  }, [allRoutes, allUsers, managedSellers, selectedSellerId, dateRange, searchTerm]);

  const handleDownloadExcel = () => {
    if (customerVisits.length === 0) {
        toast({ title: "Sin Datos", description: "No hay visitas para exportar.", variant: "destructive" });
        return;
    }

    const dataToExport = customerVisits.flatMap(item => 
        item.visits.map(v => ({
            'RUC': item.ruc,
            'Cliente': item.name,
            'Ejecutivo': item.executive,
            'Frecuencia Total': item.frequency,
            'Fecha de Visita': format(v.date, 'dd/MM/yyyy'),
            'Día de la Semana': v.dayName.toUpperCase(),
            'Ruta Origen': v.routeName
        }))
    );

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Frecuencia de Visitas");
    XLSX.writeFile(workbook, `frecuencia_visitas_clientes.xlsx`);
    toast({ title: "Reporte Generado", description: "La descarga del Excel ha comenzado." });
  };

  if (authLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-10 w-1/4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Visita Clientes (Frecuencia)"
        description="Analiza cuántas veces y qué días son visitados tus clientes."
      >
        <Button onClick={handleDownloadExcel} disabled={customerVisits.length === 0} className="font-black">
          <Download className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
      </PageHeader>
      
      <div className="space-y-6">
        <Card className="border-t-4 border-t-primary shadow-xl">
            <CardHeader>
                <CardTitle className="font-black uppercase text-slate-950">Filtros de Auditoría</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label className="font-black uppercase text-[10px] text-slate-500">Ejecutivo</Label>
                        <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                            <SelectTrigger className="h-12 border-2 font-black">
                                <Users className="mr-2 h-4 w-4 text-primary" />
                                <SelectValue placeholder="Todos los ejecutivos" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all" className="font-black">Todos los Usuarios</SelectItem>
                                {managedSellers.map(s => (
                                    <SelectItem key={s.id} value={s.id} className="font-black">{s.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="font-black uppercase text-[10px] text-slate-500">Rango de Fechas</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="w-full h-12 border-2 font-black justify-start">
                                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>{format(dateRange.from, "dd LLL")} - {format(dateRange.to, "dd LLL")}</>
                                        ) : format(dateRange.from, "dd LLL")
                                    ) : "Seleccionar rango"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="range" selected={dateRange} onSelect={setDateRange} locale={es} numberOfMonths={2} />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="space-y-2">
                        <Label className="font-black uppercase text-[10px] text-slate-500">Buscador</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="RUC o Nombre..." 
                                className="pl-10 h-12 border-2 font-black"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="shadow-2xl border-none rounded-[2rem] overflow-hidden">
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="font-black text-slate-950 uppercase text-[10px] h-14 pl-8">Cliente / RUC</TableHead>
                            <TableHead className="font-black text-slate-950 uppercase text-[10px]">Ejecutivo</TableHead>
                            <TableHead className="font-black text-slate-950 uppercase text-[10px] text-center">Frecuencia</TableHead>
                            <TableHead className="font-black text-slate-950 uppercase text-[10px] pr-8">Detalle de Visitas (Día y Fecha)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {customerVisits.length > 0 ? (
                            customerVisits.map((item) => (
                                <TableRow key={`${item.ruc}-${item.executive}`} className="hover:bg-slate-50 transition-colors">
                                    <TableCell className="pl-8 py-6">
                                        <div className="flex flex-col">
                                            <span className="font-black text-xs uppercase text-slate-950 leading-tight">{item.name}</span>
                                            <span className="text-[10px] font-mono font-bold text-slate-400 mt-1 uppercase">RUC: {item.ruc}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-black text-primary text-xs uppercase">
                                        {item.executive}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge className="bg-primary/10 text-primary border-primary/20 font-black px-3 py-1">
                                            {item.frequency} Visitas
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="pr-8">
                                        <div className="flex flex-wrap gap-2 max-w-md">
                                            {item.visits.sort((a, b) => b.date.getTime() - a.date.getTime()).map((v, idx) => (
                                                <div key={idx} className="flex flex-col items-center bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                                                    <span className="text-[8px] font-black uppercase text-slate-500 leading-none">{v.dayName}</span>
                                                    <span className="text-[10px] font-black text-slate-950 mt-0.5">{format(v.date, 'dd/MM/yyyy')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="h-40 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                                        <History className="h-12 w-12" />
                                        <span className="font-black uppercase text-xs">No se encontraron registros de visitas</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter className="bg-slate-50 border-t p-6">
                <p className="text-[10px] font-black text-slate-500 uppercase">Mostrando {customerVisits.length} clientes auditados en el periodo.</p>
            </CardFooter>
        </Card>
      </div>
    </>
  );
}
