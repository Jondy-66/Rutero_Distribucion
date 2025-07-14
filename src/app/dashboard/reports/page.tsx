
'use client';
import { useState, useEffect } from 'react';
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
import { getRoutesBySupervisor } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { RoutePlan } from '@/lib/types';
import { Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [routes, setRoutes] = useState<RoutePlan[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);

  useEffect(() => {
    if (user?.role === 'Supervisor') {
        const fetchRoutes = async () => {
            setLoadingRoutes(true);
            try {
                const supervisorRoutes = await getRoutesBySupervisor(user.id);
                setRoutes(supervisorRoutes);
            } catch (error) {
                console.error("Failed to fetch routes for supervisor:", error);
                toast({
                    title: "Error al Cargar Rutas",
                    description: "No se pudieron cargar las rutas asignadas.",
                    variant: "destructive"
                });
            } finally {
                setLoadingRoutes(false);
            }
        };
        fetchRoutes();
    } else {
        setLoadingRoutes(false);
    }
  }, [user, toast]);

  const handleDownloadExcel = () => {
    // TODO: Implement actual data export
    const worksheet = XLSX.utils.json_to_sheet(routes.map(r => ({
        Nombre: r.routeName,
        Fecha: format(r.date, 'PPP', {locale: es}),
        Estado: r.status
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rutas");
    XLSX.writeFile(workbook, "reporte_rutas.xlsx");
    toast({ title: "Descarga iniciada", description: "Tu reporte en Excel se está descargando." });
  };

  const handleDownloadPdf = () => {
    // TODO: Implement actual data export
    const doc = new jsPDF();
    autoTable(doc, {
      head: [['Nombre', 'Fecha', 'Estado']],
      body: routes.map(r => [r.routeName, format(r.date, 'PPP', {locale: es}), r.status]),
    });
    doc.save('reporte_rutas.pdf');
    toast({ title: "Descarga iniciada", description: "Tu reporte en PDF se está descargando." });
  };
  
  if (user?.role !== 'Supervisor' && !loadingRoutes) {
    return (
        <div>
            <PageHeader
                title="Acceso Denegado"
                description="Esta página solo está disponible para supervisores."
            />
        </div>
    )
  }

  return (
    <>
      <PageHeader
        title="Reportes de Rutas"
        description="Visualiza y descarga los reportes de las rutas que tienes asignadas."
      >
        <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleDownloadExcel} disabled={loadingRoutes || routes.length === 0}>
                <Download className="mr-2" />
                Descargar Excel
            </Button>
            <Button variant="outline" onClick={handleDownloadPdf} disabled={loadingRoutes || routes.length === 0}>
                 <Download className="mr-2" />
                Descargar PDF
            </Button>
        </div>
      </PageHeader>
      
      <Card>
        <CardHeader>
            <CardTitle>Rutas Asignadas</CardTitle>
            <CardDescription>
                Un listado de todas las rutas que tienes asignadas.
            </CardDescription>
        </CardHeader>
        <CardContent>
             <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Nombre de Ruta</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Clientes</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loadingRoutes ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                                </TableRow>
                            ))
                        ) : routes.length > 0 ? (
                            routes.map((route) => (
                                <TableRow key={route.id}>
                                    <TableCell className="font-medium">{route.routeName}</TableCell>
                                    <TableCell>{format(route.date, 'PPP', { locale: es })}</TableCell>
                                    <TableCell>{route.status}</TableCell>
                                    <TableCell>{route.clients.length}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-24">
                                    No tienes rutas asignadas.
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

