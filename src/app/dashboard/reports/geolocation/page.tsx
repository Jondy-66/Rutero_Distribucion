'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Download, Search, MapPin, Globe } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import * as XLSX from 'xlsx';

export default function GeolocationReportPage() {
  const { clients, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredClients = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return clients;

    return clients.filter(c => 
      (c.nombre_cliente || '').toLowerCase().includes(term) ||
      (c.nombre_comercial || '').toLowerCase().includes(term) ||
      (c.ruc || '').includes(term)
    );
  }, [clients, searchTerm]);

  const handleDownloadExcel = () => {
    if (filteredClients.length === 0) {
      toast({ title: "Sin Datos", description: "No hay clientes para exportar.", variant: "destructive" });
      return;
    }

    const dataToExport = filteredClients.map(c => ({
      'RUC': c.ruc,
      'Razón Social': c.nombre_cliente,
      'Nombre Comercial': c.nombre_comercial,
      'Provincia': c.provincia,
      'Cantón': c.canton,
      'Dirección': c.direccion,
      'Latitud': c.latitud,
      'Longitud': c.longitud
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Geolocalización Clientes");
    XLSX.writeFile(workbook, "reporte_geolocalizacion_clientes.xlsx");
    
    toast({ title: "Reporte Generado", description: "El archivo Excel se ha descargado correctamente." });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Reporte de Geolocalización"
        description="Consulta y descarga las coordenadas exactas de toda tu cartera de clientes."
      >
        <Button onClick={handleDownloadExcel} disabled={filteredClients.length === 0} className="font-black">
          <Download className="mr-2 h-4 w-4" />
          Exportar a Excel
        </Button>
      </PageHeader>

      <Card className="border-t-4 border-t-primary shadow-xl">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-black text-slate-950 uppercase flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Base de Coordenadas
              </CardTitle>
              <CardDescription className="font-bold text-[10px] text-slate-500 uppercase mt-1">
                Viendo {filteredClients.length} ubicaciones registradas.
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
          <div className="border-t">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black text-slate-950 uppercase text-[10px] h-12 pl-6">Cliente</TableHead>
                  <TableHead className="font-black text-slate-950 uppercase text-[10px]">RUC</TableHead>
                  <TableHead className="font-black text-slate-950 uppercase text-[10px]">Latitud</TableHead>
                  <TableHead className="font-black text-slate-950 uppercase text-[10px]">Longitud</TableHead>
                  <TableHead className="font-black text-slate-950 uppercase text-[10px] pr-6">Cantón / Provincia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="p-6"><Skeleton className="h-6 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredClients.length > 0 ? (
                  filteredClients.map((c) => (
                    <TableRow key={c.id} className="hover:bg-slate-50/50">
                      <TableCell className="pl-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-black text-xs uppercase text-slate-950 leading-tight">{c.nombre_comercial}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{c.nombre_cliente}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[11px] font-bold text-slate-600">{c.ruc}</TableCell>
                      <TableCell className="font-mono text-[11px] font-black text-primary">{c.latitud.toFixed(6)}</TableCell>
                      <TableCell className="font-mono text-[11px] font-black text-primary">{c.longitud.toFixed(6)}</TableCell>
                      <TableCell className="pr-6">
                        <span className="text-[10px] font-black uppercase text-slate-500">{c.canton} - {c.provincia}</span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-40 text-center">
                      <div className="flex flex-col items-center justify-center gap-3 opacity-30">
                        <Globe className="h-12 w-12" />
                        <span className="font-black uppercase text-xs">No se encontraron resultados para la búsqueda</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter className="bg-slate-50 border-t p-4">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Fin del listado de geolocalización</p>
        </CardFooter>
      </Card>
    </div>
  );
}
