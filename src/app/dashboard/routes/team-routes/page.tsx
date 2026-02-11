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
import { getRoutes, deleteRoute, updateRoute } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { RoutePlan } from '@/lib/types';
import { MoreHorizontal, Trash2, CheckCircle2, AlertCircle, XCircle, Clock, PlayCircle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
} from '@/components/ui/alert-dialog';
import { Timestamp } from 'firebase/firestore';

export default function TeamRoutesPage() {
  const { user, users, loading: authLoading, refetchData } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [allRoutes, setAllRoutes] = useState<RoutePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string>('all');
  
   const fetchRoutesData = async () => {
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
    if (user && (user.role === 'Administrador' || user.role === 'Supervisor')) {
      fetchRoutesData();
    } else if(!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, toast]);

  const managedUsers = useMemo(() => {
    if (!user) return [];
    if (user.role === 'Administrador') {
      return users.filter(u => u.role === 'Usuario' || u.role === 'Telemercaderista');
    }
    if (user.role === 'Supervisor') {
      return users.filter(u => u.supervisorId === user.id);
    }
    return [];
  }, [users, user]);

  const filteredRoutes = useMemo(() => {
    if (!user) return [];
    let routesToFilter: RoutePlan[] = [];
    if (user.role === 'Administrador') {
        routesToFilter = allRoutes.filter(route => route.createdBy !== user.id);
    } else if (user.role === 'Supervisor') {
        const managedUserIds = managedUsers.map(u => u.id);
        routesToFilter = allRoutes.filter(route => managedUserIds.includes(route.createdBy));
    }
    if (selectedUser !== 'all') {
        routesToFilter = routesToFilter.filter(route => route.createdBy === selectedUser);
    }
    return routesToFilter;
  }, [allRoutes, user, managedUsers, selectedUser]);
  
  const getCreatorName = (creatorId: string) => {
      const creator = users.find(u => u.id === creatorId);
      return creator?.name || 'Desconocido';
  }

  const handleAction = (routeId: string) => {
    router.push(`/dashboard/routes/${routeId}`);
  };

  const handleReactivate = async (routeId: string) => {
    try {
        await updateRoute(routeId, { status: 'En Progreso' });
        toast({ title: 'Éxito', description: 'Ruta reactivada correctamente (En Progreso).' });
        fetchRoutesData(); 
        await refetchData('routes'); 
    } catch (error: any) {
        console.error('Failed to reactivate route:', error);
        toast({ title: 'Error', description: 'No se pudo reactivar la ruta.', variant: 'destructive' });
    }
  };

  const handleForceComplete = async (routeId: string) => {
    try {
        await updateRoute(routeId, { status: 'Completada' });
        toast({ title: 'Éxito', description: 'Ruta marcada como completada correctamente.' });
        fetchRoutesData(); 
        await refetchData('routes'); 
    } catch (error: any) {
        console.error('Failed to complete route:', error);
        toast({ title: 'Error', description: 'No se pudo completar la ruta.', variant: 'destructive' });
    }
  };

  const handleDelete = async (routeId: string) => {
    try {
        await deleteRoute(routeId);
        toast({ title: 'Éxito', description: 'Ruta eliminada correctamente.' });
        fetchRoutesData(); 
    } catch (error: any) {
        console.error('Failed to delete route:', error);
        toast({ title: 'Error', description: 'No se pudo eliminar la ruta.', variant: 'destructive' });
    }
  };
  
  const getBadgeForStatus = (status: RoutePlan['status']) => {
    switch (status) {
        case 'Planificada': return <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3"/>{status}</Badge>;
        case 'En Progreso': return <Badge variant="default"><Clock className="mr-1 h-3 w-3"/>{status}</Badge>;
        case 'Completada': return <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3"/>{status}</Badge>;
        case 'Pendiente de Aprobación': return <Badge variant="outline" className="text-amber-600 border-amber-500"><AlertCircle className="mr-1 h-3 w-3"/>Pendiente</Badge>;
        case 'Rechazada': return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3"/>{status}</Badge>;
        case 'Incompleta': return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3"/>{status}</Badge>;
        default: return <Badge variant="outline">{status}</Badge>;
    }
  }

  const getRouteDate = (route: RoutePlan) => {
    if (route.date) {
      const date = route.date;
      if (date instanceof Timestamp) {
        return format(date.toDate(), 'PPP', { locale: es });
      }
      if (date instanceof Date && !isNaN(date.getTime())) {
          return format(date, 'PPP', { locale: es });
      }
    }
    return 'N/A';
  };

  if (authLoading) {
      return <PageHeader title="Rutas de Equipo" description="Cargando..." />
  }

  if (user?.role !== 'Administrador' && user?.role !== 'Supervisor') {
      return (
          <PageHeader title="Acceso Denegado" description="Esta página solo está disponible para supervisores y administradores." />
      );
  }

  return (
    <>
      <PageHeader
        title="Rutas de Equipo"
        description="Revisa, aprueba o rechaza las rutas planificadas por tu equipo."
      >
      </PageHeader>
      
      <Card>
        <CardHeader>
            <CardTitle>Rutas Enviadas para Aprobación</CardTitle>
            <CardDescription>
                Un listado de todas las rutas enviadas por los usuarios que gestionas.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="mb-4">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="w-full sm:max-w-xs">
                        <SelectValue placeholder="Filtrar por usuario" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los Usuarios</SelectItem>
                        {managedUsers.map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             <div className="border rounded-lg">
                <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Nombre de Ruta</TableHead>
                        <TableHead>Creado por</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Clientes</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                                    <TableCell><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredRoutes.length > 0 ? (
                            filteredRoutes.map((route, index) => {
                                const canReview = (user?.role === 'Supervisor' || user?.role === 'Administrador') && route.status === 'Pendiente de Aprobación';
                                const canDelete = user?.role === 'Administrador';
                                const canReactivate = user?.role === 'Administrador' && (route.status === 'Incompleta' || route.status === 'Completada' || route.status === 'Rechazada');
                                const canForceComplete = user?.role === 'Administrador' && (route.status === 'En Progreso' || route.status === 'Incompleta');
                               
                                return (
                                <TableRow key={route.id}>
                                    <TableCell className="font-medium">{index + 1}</TableCell>
                                    <TableCell className="font-medium">{route.routeName}</TableCell>
                                    <TableCell>{getCreatorName(route.createdBy)}</TableCell>
                                    <TableCell>{getRouteDate(route)}</TableCell>
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
                                                    <DropdownMenuItem onClick={() => handleAction(route.id)}>
                                                        {canReview ? "Revisar" : "Ver Detalles"}
                                                    </DropdownMenuItem>
                                                    
                                                    {canReactivate && (
                                                        <DropdownMenuItem onClick={() => handleReactivate(route.id)}>
                                                            <PlayCircle className="mr-2 h-4 w-4 text-green-600" />
                                                            Volver a En Progreso
                                                        </DropdownMenuItem>
                                                    )}

                                                    {canForceComplete && (
                                                        <DropdownMenuItem onClick={() => handleForceComplete(route.id)}>
                                                            <CheckCircle className="mr-2 h-4 w-4 text-blue-600" />
                                                            Finalizar (Completada)
                                                        </DropdownMenuItem>
                                                    )}

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
                                <TableCell colSpan={7} className="text-center h-24">
                                    No hay rutas de equipo para mostrar.
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