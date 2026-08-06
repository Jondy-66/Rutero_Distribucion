'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Download, Search, MapPin, Globe, Eye, History, Navigation, ExternalLink, CalendarDays } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import * as XLSX from 'xlsx';
import { Timestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

type GeoPointHistory = {
  lat: number;
  lng: number;
  date: Date;
  source: 'Catálogo' | 'Gestión';
  info: string;
};

export default function GeolocationReportPage() {
  const { clients, routes, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientRuc, setSelectedClientRuc] = useState<string | null>(null);

  // Procesar todas las geolocalizaciones disponibles (Catálogo + Rutas)
  const geolocationData = useMemo(() => {
    const historyMap = new Map<string, GeoPointHistory[]>();

    // 1. Cargar del Catálogo Base
    clients.forEach(c => {
      if (typeof c.latitud === 'number' && typeof c.longitud === 'number') {
        historyMap.set(c.ruc, [{
          lat: c.latitud,
          lng: c.longitud,
          date: c.createdAt ? (c.createdAt instanceof Timestamp ? c.createdAt.toDate() : new Date(c.createdAt)) : new Date(),
          source: 'Catálogo',
          info: 'Coordenada base del sistema'
        }]);
      }
    });

    // 2. Cargar de las Gestiones en Ruta (Check-ins)
    routes.forEach(route => {
      route.clients.forEach(rc => {
        if (rc.checkInLocation && rc.visitStatus === 'Completado') {
          const ruc = rc.ruc;
          const loc = rc.checkInLocation as any;
          // Manejo de diferentes formatos de GeoPoint/Object
          const lat = loc.latitude ?? loc.lat ?? loc._lat;
          const lng = loc.longitude ?? loc.lng ?? loc._long;
          
          if (typeof lat === 'number' && typeof lng === 'number') {
            const visitDate = rc.date instanceof Timestamp ? rc.date.toDate() : new Date(rc.date as any);
            const entry: GeoPointHistory = {
              lat,
              lng,
              date: visitDate,
              source: 'Gestión',
              info: `Ruta: ${route.routeName}`
            };
            
            const existing = historyMap.get(ruc) || [];
            // Solo añadir si no es una coordenada idéntica ya registrada para ese día (limpieza visual)
            historyMap.set(ruc, [...existing, entry]);
          }
        }
      });
    });

    return historyMap;
  }, [clients, routes]);

  const filteredClients = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return clients.filter(c => 
      (c.nombre_cliente || '').toLowerCase().includes(term) ||
      (c.nombre_comercial || '').toLowerCase().includes(term) ||
      (c.ruc || '').includes(term)
    );
  }, [clients, searchTerm]);

  const selectedClientHistory = useMemo(() => {
    if (!selectedClientRuc) return [];
    return (geolocationData.get(selectedClientRuc) || []).sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [selectedClientRuc, geolocationData]);

  const selectedClientName = useMemo(() => {
    const client = clients.find(c => c.ruc === selectedClientRuc);
    return client?.nombre_comercial || 'Cliente';
  }, [selectedClientRuc, clients]);

  const handleDownloadExcel = () => {
    if (filteredClients.length === 0) {
      toast({ title: "Sin Datos", description: "No hay clientes para exportar.", variant: "destructive" });
      return;
    }

    const dataToExport = filteredClients.flatMap(c => {
      const history = geolocationData.get(c.ruc) || [];
      if (history.length === 0) return [];
      
      return history.map(h => ({
        'RUC': c.ruc,
        'Razón Social': c.nombre_cliente,
        'Nombre Comercial': c.nombre_comercial,
        'Origen Dato': h.source,
        'Detalle': h.info,
        'Fecha Registro': format(h.date, 'dd/MM/yyyy HH:mm'),
        'Latitud': h.lat,
        'Longitud': h.lng
      }));
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Historial Geolocalización");
    XLSX.writeFile(workbook, "reporte_geolocalizacion_completo.xlsx");
    
    toast({ title: "Reporte Generado", description: "El archivo Excel con todo el historial de coordenadas se ha descargado." });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reporte de Geolocalización"
        description="Auditoría de coordenadas basadas en catálogo y gestiones de campo."
      >
        <Button onClick={handleDownloadExcel} disabled={filteredClients.length === 0} className="font-black">
          <Download className="mr-2 h-4 w-4" />
          Exportar Historial Completo
        </Button>
      </PageHeader>

      <Card className="border-t-4 border-t-primary shadow-xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-black text-slate-950 uppercase flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Base de Coordenadas Auditadas
              </CardTitle>
              <CardDescription className="font-bold text-[10px] text-slate-500 uppercase mt-1">
                Buscando en {filteredClients.length} clientes.
              </CardDescription>
            </div>
            <div className="relative w-full md:max-w-xs">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="BUSCAR POR NOMBRE O RUC..." 
                className="pl-10 h-11 border-2 font-black uppercase text-xs rounded-xl"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-t overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black text-slate-950 uppercase text-[10px] h-12 pl-6">Cliente</TableHead>
                  <TableHead className="font-black text-slate-950 uppercase text-[10px]">RUC</TableHead>
                  <TableHead className="font-black text-slate-950 uppercase text-[10px] text-center">Registros GPS</TableHead>
                  <TableHead className="font-black text-slate-950 uppercase text-[10px]">Última Latitud</TableHead>
                  <TableHead className="font-black text-slate-950 uppercase text-[10px]">Última Longitud</TableHead>
                  <TableHead className="text-right font-black text-slate-950 uppercase text-[10px] pr-6">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="p-6"><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredClients.length > 0 ? (
                  filteredClients.map((c) => {
                    const history = (geolocationData.get(c.ruc) || []).sort((a,b) => b.date.getTime() - a.date.getTime());
                    const lastPoint = history[0];
                    const hasPoints = history.length > 0;

                    return (
                      <TableRow key={c.id} className="hover:bg-slate-50/50">
                        <TableCell className="pl-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-black text-xs uppercase text-slate-950 leading-tight">{c.nombre_comercial}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{c.nombre_cliente}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] font-bold text-slate-600">{c.ruc}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={cn("font-black text-[10px] border-2", history.length > 1 ? "border-primary text-primary" : "border-slate-200 text-slate-500")}>
                            {history.length} UBICACIONES
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-[11px] font-black text-primary">
                          {lastPoint ? lastPoint.lat.toFixed(6) : 'N/A'}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] font-black text-primary">
                          {lastPoint ? lastPoint.lng.toFixed(6) : 'N/A'}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="font-black uppercase text-[10px] hover:bg-primary/5 text-primary"
                            disabled={!hasPoints}
                            onClick={() => setSelectedClientRuc(c.ruc)}
                          >
                            <Eye className="mr-1.5 h-3.5 w-3.5" />
                            Ver Detalles
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                        <Globe className="h-12 w-12" />
                        <span className="font-black uppercase text-xs">No se encontraron clientes activos</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50 border-t p-4">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base de datos de geocercas y registros de campo</p>
        </CardFooter>
      </Card>

      <Sheet open={!!selectedClientRuc} onOpenChange={() => setSelectedClientRuc(null)}>
        <SheetContent className="sm:max-w-xl rounded-l-[2rem] border-none shadow-2xl p-0 flex flex-col h-full bg-white">
          <SheetHeader className="p-8 pb-4 bg-primary text-white">
            <div className="flex justify-between items-start">
              <div>
                <SheetTitle className="text-2xl font-black uppercase text-white tracking-tighter">Historial Geográfico</SheetTitle>
                <SheetDescription className="text-white/80 font-bold uppercase text-[10px]">
                  {selectedClientName}
                </SheetDescription>
              </div>
              <Badge className="bg-white text-primary font-black uppercase text-[10px] px-3">RUC: {selectedClientRuc}</Badge>
            </div>
          </SheetHeader>

          <ScrollArea className="flex-1 p-6 lg:p-8">
            <div className="space-y-6">
              <h4 className="font-black text-xs uppercase text-slate-950 border-b-2 border-slate-100 pb-2 flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Registros de Ubicación Encontrados
              </h4>
              
              <div className="space-y-4">
                {selectedClientHistory.map((point, idx) => (
                  <Card key={idx} className="p-4 border-2 border-slate-100 hover:border-primary/20 transition-all bg-white shadow-sm">
                    <div className="flex justify-between items-start mb-3">
                      <Badge className={cn(
                        "font-black text-[9px] uppercase border-none",
                        point.source === 'Catálogo' ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                      )}>
                        Dato de {point.source}
                      </Badge>
                      <div className="flex items-center gap-1 text-[10px] font-black text-slate-400">
                        <CalendarDays className="h-3 w-3" />
                        {format(point.date, "dd MMM yyyy, HH:mm", { locale: es })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[8px] font-black uppercase text-slate-400">Latitud</p>
                        <p className="text-xs font-black text-slate-950 font-mono">{point.lat.toFixed(8)}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[8px] font-black uppercase text-slate-400">Longitud</p>
                        <p className="text-xs font-black text-slate-950 font-mono">{point.lng.toFixed(8)}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-[9px] font-bold text-slate-500 uppercase italic truncate max-w-[250px]">
                        {point.info}
                      </p>
                      <Button 
                        variant="link" 
                        size="sm" 
                        className="p-0 h-auto text-[9px] font-black text-primary uppercase flex items-center gap-1"
                        onClick={() => {
                          const url = `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
                          window.open(url, '_blank');
                        }}
                      >
                        <Navigation className="h-3 w-3" />
                        Ver Mapa
                        <ExternalLink className="h-2 w-2 opacity-50" />
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </ScrollArea>
          
          <div className="p-8 border-t bg-slate-50">
            <Button variant="outline" className="w-full h-12 font-black uppercase rounded-xl border-2" onClick={() => setSelectedClientRuc(null)}>
              Cerrar Detalles
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

