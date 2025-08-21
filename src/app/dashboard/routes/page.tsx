
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { getRoutes, deleteRoute } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { RoutePlan } from '@/lib/types';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function RoutesListPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [routes, setRoutes] = useState<RoutePlan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const routesData = await getRoutes();
      setRoutes(routesData);
    } catch (error: any) {
      console.error("Failed to fetch routes:", error);
      toast({
        title: "Error al Cargar Rutas",
        description: "No se pudieron cargar las rutas planificadas.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
        fetchRoutes();
    }
  }, [user, toast]);

  const handleEdit = (routeId: string) => {
    router.push(`/dashboard/routes/${routeId}`);
  };

  const handleDelete = async (routeId: string) => {
    try {
      await deleteRoute(routeId);
      toast({ title: "Éxito", description: "Ruta eliminada correctamente." });
      fetchRoutes(); // Refresh the list
    } catch (error: any) {
      console.error("Failed to delete route:", error);
      toast({ title: "Error", description: "No se pudo eliminar la ruta.", variant: "destructive" });
    }
  };

  const getBadgeVariantForStatus = (status: RoutePlan['status']) => {
    switch (status) {
        case 'Planificada': return 'secondary';
        case 'En Progreso': return 'default';
        case 'Completada': return 'success';
        default: return 'outline';
    }
  }

  const getRouteDate = (route: RoutePlan) => {
    if (route.clients && route.clients.length > 0 && route.clients[0].date) {
      return format(route.clients[0].date, 'PPP', { locale: es });
    }
    return 'N/A';
  };

  return (
    <>
      <PageHeader
        title="Lista de Rutas"
        description="Visualiza y gestiona todas las rutas planificadas."
      >
        <Link href="/dashboard/routes/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Planificar Nueva Ruta
          </Button>
        </Link>
      </PageHeader>
      
      <Card>
        <CardHeader>
            <CardTitle>Rutas Planificadas</CardTitle>
            <CardDescription>
                Un listado de todas las rutas del sistema.
            </CardDescription>
        </CardHeader>
        <CardContent>
             <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Nombre de Ruta</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Supervisor</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Clientes</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : routes.length > 0 ? (
                            routes.map((route) => (
                                <TableRow key={route.id}>
                                    <TableCell className="font-medium">{route.routeName}</TableCell>
                                    <TableCell>{getRouteDate(route)}</TableCell>
                                    <TableCell>{route.supervisorName}</TableCell>
                                    <TableCell>
                                        <Badge variant={getBadgeVariantForStatus(route.status)}>
                                            {route.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-center">{route.clients.length}</TableCell>
                                    <TableCell className="text-right">
                                      <AlertDialog>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                              <MoreHorizontal className="h-4 w-4" />
                                              <span className="sr-only">Alternar menú</span>
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => handleEdit(route.id)}>Editar</DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <AlertDialogTrigger asChild>
                                              <DropdownMenuItem className="text-red-600">Eliminar</DropdownMenuItem>
                                            </AlertDialogTrigger>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Esta acción no se puede deshacer. Esto eliminará permanentemente la ruta.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(route.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24">
                                    No hay rutas planificadas.
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

    