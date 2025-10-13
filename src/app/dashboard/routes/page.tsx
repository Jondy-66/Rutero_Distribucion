

'use client';
import { useState, useEffect, useMemo } from 'react';
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
import { MoreHorizontal, PlusCircle, CheckCircle2, AlertCircle, XCircle, Clock, Trash2 } from 'lucide-react';
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
  const { user, users } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [allRoutes, setAllRoutes] = useState<RoutePlan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const routesData = await getRoutes();
      setAllRoutes(routesData);
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
  }, [user]);

  const filteredRoutes = useMemo(() => {
    if (!user) return [];
    // Esta página ahora solo muestra las rutas creadas por el usuario actual.
    return allRoutes.filter(route => route.createdBy === user.id);
  }, [allRoutes, user]);

  const handleAction = (routeId: string) => {
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

  const getBadgeForStatus = (status: RoutePlan['status']) => {
    switch (status) {
        case 'Planificada': return <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3"/>{status}</Badge>;
        case 'En Progreso': return <Badge variant="default"><Clock className="mr-1 h-3 w-3"/>{status}</Badge>;
        case 'Completada': return <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3"/>{status}</Badge>;
        case 'Pendiente de Aprobación': return <Badge variant="outline" className="text-amber-600 border-amber-500"><AlertCircle className="mr-1 h-3 w-3"/>Pendiente</Badge>;
        case 'Rechazada': return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3"/>{status}</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
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
        title="Mis Rutas"
        description="Visualiza y gestiona las rutas que has planificado."
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
            <CardTitle>Rutas Planificadas por Mí</CardTitle>
            <CardDescription>
                Un listado de todas las rutas que has creado.
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
                        ) : filteredRoutes.length > 0 ? (
                            filteredRoutes.map((route) => {
                                const canReview = (user?.role === 'Supervisor' || user?.role === 'Administrador') && route.status === 'Pendiente de Aprobación';
                                const canEdit = user?.id === route.createdBy && route.status !== 'Pendiente de Aprobación' && route.status !== 'Rechazada' && route.status !== 'En Progreso';
                                const canAdminEdit = user?.role === 'Administrador' && route.status !== 'Completada' && route.status !== 'En Progreso';
                                const canViewDetails = !canReview && !canEdit && !canAdminEdit;
                                const canDelete = user?.role === 'Administrador' || (user?.id === route.createdBy && route.status !== 'En Progreso');

                                return (
                                <TableRow key={route.id}>
                                    <TableCell className="font-medium">{route.routeName}</TableCell>
                                    <TableCell>{getRouteDate(route)}</TableCell>
                                    <TableCell>{route.supervisorName}</TableCell>
                                    <TableCell>
                                        {getBadgeForStatus(route.status)}
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
                                            {canReview && <DropdownMenuItem onClick={() => handleAction(route.id)}>Revisar</DropdownMenuItem>}
                                            {(canEdit || canAdminEdit) && <DropdownMenuItem onClick={() => handleAction(route.id)}>Editar</DropdownMenuItem>}
                                            {canViewDetails && <DropdownMenuItem onClick={() => handleAction(route.id)}>Ver Detalles</DropdownMenuItem>}
                                            {canDelete && (
                                                <>
                                                    <DropdownMenuSeparator />
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem className="text-red-600">
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Eliminar
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                </>
                                            )}
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
                                )
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24">
                                    No has creado ninguna ruta.
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
