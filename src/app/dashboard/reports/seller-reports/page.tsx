
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
import type { RoutePlan } from '@/lib/types';
import { Download, Users, MoreHorizontal, Eye } from 'lucide-react';
import { format } from 'date-fns';
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

export default function SellerReportsPage() {
  const { user: currentUser, users: allUsers, routes: allRoutes, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all');

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

  const filteredRoutes = useMemo(() => {
    if (!currentUser || !allRoutes) return [];
    
    const managedSellerIds = managedSellers.map(s => s.id);

    let routesToConsider = allRoutes.filter(route => 
        managedSellerIds.includes(route.createdBy) && route.status === 'Completada'
    );
    
    if (selectedSellerId !== 'all') {
      routesToConsider = routesToConsider.filter(route => route.createdBy === selectedSellerId);
    }
    
    return routesToConsider;
  }, [selectedSellerId, allRoutes, managedSellers, currentUser]);
  
  const handleDownloadExcel = () => {
    if (filteredRoutes.length === 0) {
        toast({
            title: "Sin Datos",
            description: "No hay rutas completadas para descargar.",
            variant: "destructive"
        });
        return;
    }

    const dataToExport = [];

    for (const route of filteredRoutes) {
        const seller = allUsers.find(u => u.id === route.createdBy);
        const routeDate = route.date instanceof Timestamp ? route.date.toDate() : route.date;

        if (route.clients && route.clients.length > 0) {
            for (const client of route.clients) {
                if (client.visitStatus === 'Completado') {
                    dataToExport.push({
                        'Vendedor': seller?.name || 'Desconocido',
                        'Nombre de Ruta': route.routeName,
                        'Fecha de Ruta': format(routeDate, 'PPP', { locale: es }),
                        'RUC Cliente': client.ruc,
                        'Nombre Cliente': client.nombre_comercial,
                        'Hora de Check-in': client.checkInTime || 'N/A',
                        'Ubicación de Check-in': client.checkInLocation ? `${client.checkInLocation.latitude}, ${client.checkInLocation.longitude}` : 'N/A',
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
            description: "No hay visitas completadas en las rutas seleccionadas para exportar.",
            variant: "destructive"
        });
        return;
    }

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Detalle de Rutas");
    XLSX.writeFile(workbook, `reporte_detallado_vendedores_${selectedSellerId === 'all' ? 'todos' : allUsers.find(u=>u.id === selectedSellerId)?.name.replace(' ', '_')}.xlsx`);
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
        description="Visualiza y descarga los reportes de rutas completadas por los vendedores a tu cargo."
      >
        <Button onClick={handleDownloadExcel} disabled={authLoading || filteredRoutes.length === 0}>
          <Download className="mr-2" />
          Descargar Excel
        </Button>
      </PageHeader>
      
      <Card>
        <CardHeader>
            <CardTitle>Rutas Completadas por Vendedor</CardTitle>
            <CardDescription>
                Selecciona un vendedor para ver sus rutas completadas.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="mb-4">
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
            </div>
             <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Nombre de Ruta</TableHead>
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Clientes</TableHead>
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
                                    <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredRoutes.length > 0 ? (
                            filteredRoutes.map((route) => {
                                const routeDate = route.date instanceof Timestamp ? route.date.toDate() : route.date;
                                return (
                                <TableRow key={route.id}>
                                    <TableCell className="font-medium">{route.routeName}</TableCell>
                                    <TableCell>{allUsers.find(u => u.id === route.createdBy)?.name || 'Desconocido'}</TableCell>
                                    <TableCell>{format(routeDate, 'PPP', { locale: es })}</TableCell>
                                    <TableCell>{route.clients.length}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => handleViewDetails(route.id)}>
                                                    <Eye className="mr-2 h-4 w-4" />
                                                    Ver Detalles
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )})
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center h-24">
                                    No hay rutas completadas para mostrar.
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
