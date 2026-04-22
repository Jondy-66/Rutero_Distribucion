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
import { MoreHorizontal, Trash2, CheckCircle2, AlertCircle, XCircle, Clock, RefreshCw, CheckCircle, PlayCircle, Users as UsersIcon, Route as RouteIcon } from 'lucide-react';
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
  const { user, users, loading: authLoading } = useAuth();
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
  }, [user, authLoading]);

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

  const handleManageLive = (routeId: string) => {
    router.push(`/dashboard/routes/management?routeId=${routeId}`);
  };

  const handleDelete = async (routeId: string) => {
    try {
        await deleteRoute(routeId);
        toast({ title: "Éxito", description: "Ruta eliminada correctamente." });
        fetchRoutesData(); 
    } catch (error: any) {
        console.error('Failed to delete route:', error);
        toast({ title: 'Error', description: 'No se pudo eliminar la ruta.', variant: 'destructive' });
    }
  };

  const handleFinalize = async (routeId: string) => {
    try {
      await updateRoute(routeId, { status: 'Completada' });
      toast({ title: "Ruta Finalizada", description: "La ruta ha sido marcada como completada manualmente." });
      fetchRoutesData();
    } catch (error: any) {
      console.error("Failed to finalize route:", error);
      toast({ title: "Error", description: "No se pudo finalizar la ruta.", variant: "destructive" });
    }
  };

  const handleReactivate = async (routeId: string) => {
    try {
      await updateRoute(routeId, { status: 'En Progreso' });
      toast({ title: "Éxito", description: "La ruta ha sido reactivada a En Progreso." });
      fetchRoutesData();
    } catch (error: any) {
      console.error("Failed to reactivate route:", error);
      toast({ title: "Error", description: "No se pudo reactivar la ruta.", variant: "destructive" });
    }
  };
  
  const getBadgeForStatus = (status: string) => {
    switch (status) {
        case 'Planificada': return <Badge variant="secondary" className="font-black border-none uppercase text-[9px]"><CheckCircle2 className="mr-1 h-3 w-3"/>{status}</Badge>;
        case 'En Progreso': return <Badge variant="default" className="font-black border-none uppercase text-[9px]"><Clock className="mr-1 h-3 w-3"/>{status}</Badge>;
        case 'Completada': return <Badge variant="success" className="font-black border-none uppercase text-[9px]"><CheckCircle2 className="mr-1 h-3 w-3"/>{status}</Badge>;
        case 'Pendiente de Aprobación': return <Badge variant="outline" className="text-amber-600 border-amber-500 font-black uppercase text-[9px]"><AlertCircle className="mr-1 h-3 w-3"/>Pendiente</Badge>;
        case 'Rechazada': return <Badge variant="destructive" className="font-black border-none uppercase text-[9px]"><XCircle className="mr-1 h-3 w-3"/>{status}</Badge>;
        default: return <Badge variant="outline" className="font-black uppercase text-[9px]">{status}</Badge>;
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
      />
      
      <Card className="border-t-4 border-t-primary shadow-xl">
        <CardHeader>
            <CardTitle className="font-black text-slate-950 uppercase">Rutas Enviadas para Aprobación</CardTitle>
            <CardDescription className="font-bold text-[10px] text-slate-500 uppercase">
                Un listado de todas las rutas enviadas por los usuarios que gestionas.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="mb-6">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="w-full sm:max-w-xs h-11 border-2 border-slate-200 font-black text-slate-950 rounded-xl bg-white shadow-sm">
                        <UsersIcon className="mr-2 h-4 w-4 text-primary" />
                        <SelectValue placeholder="Filtrar por usuario" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="font-black">Todos los Usuarios</SelectItem>
                        {managedUsers.map(u => (
                            <SelectItem key={u.id} value={u.id} className="font-black">{u.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             <div className="border-2 border-slate-100 rounded-2xl overflow-hidden shadow-inner bg-white">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px] h-12">#</TableHead>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Nombre de Ruta</TableHead>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Creado por</TableHead>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Fecha</TableHead>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Estado</TableHead>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Clientes</TableHead>
                        <TableHead className="text-right font-black text-slate-950 uppercase text-[10px]">Acciones</TableHead>
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
                                const isAdminRole = user?.role === 'Administrador';
                                const canReview = (user?.role === 'Supervisor' || isAdminRole) && route.status === 'Pendiente de Aprobación';
                                const canDelete = isAdminRole;
                                const canReactivate = isAdminRole && (route.status === 'Completada' || route.status === 'Rechazada');
                                const canManageLive = isAdminRole && (route.status === 'En Progreso' || route.status === 'Planificada');
                                const canFinalize = isAdminRole && (route.status === 'En Progreso' || route.status === 'Planificada');
                               
                                return (
                                <TableRow key={route.id} className="hover:bg-slate-50/50">
                                    <TableCell className="font-black text-slate-950 text-xs">{index + 1}</TableCell>
                                    <TableCell className="font-black text-slate-950 text-xs uppercase">{route.routeName}</TableCell>
                                    <TableCell className="font-black text-primary text-xs uppercase">{getCreatorName(route.createdBy)}</TableCell>
                                    <TableCell className="font-black text-slate-950 text-xs uppercase">{getRouteDate(route)}</TableCell>
                                    <TableCell>
                                        {getBadgeForStatus(route.status)}
                                    </TableCell>
                                    <TableCell className="text-center font-black text-slate-950">{route.clients?.length || 0}</TableCell>
                                    <TableCell className="text-right">
                                        <AlertDialog>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost" className="rounded-full hover:bg-slate-100">
                                                        <MoreHorizontal className="h-4 w-4 text-slate-950" />
                                                        <span className="sr-only">Alternar menú</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-60 rounded-xl shadow-2xl border-none">
                                                    <DropdownMenuLabel className="font-black text-[10px] uppercase text-slate-500">Acciones Directas</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => handleAction(route.id)} className="font-black text-xs uppercase py-2.5">
                                                        {canReview ? "Revisar y Aprobar" : "Ver Detalles"}
                                                    </DropdownMenuItem>
                                                    
                                                    {canManageLive && (
                                                        <DropdownMenuItem onClick={() => handleManageLive(route.id)} className="font-black text-xs uppercase text-primary py-2.5 bg-primary/5">
                                                            <PlayCircle className="mr-2 h-4 w-4" />
                                                            Gestionar Jornada
                                                        </DropdownMenuItem>
                                                    )}

                                                    {canFinalize && (
                                                        <DropdownMenuItem onClick={() => handleFinalize(route.id)} className="font-black text-xs uppercase text-blue-600 py-2.5">
                                                            <CheckCircle className="mr-2 h-4 w-4" />
                                                            Finalizar Ruta
                                                        </DropdownMenuItem>
                                                    )}

                                                    {canReactivate && (
                                                        <DropdownMenuItem onClick={() => handleReactivate(route.id)} className="font-black text-xs uppercase py-2.5">
                                                            <RefreshCw className="mr-2 h-4 w-4" />
                                                            Reactivar (En Progreso)
                                                        </DropdownMenuItem>
                                                    )}

                                                    {canDelete && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem className="text-red-600 font-black text-xs uppercase py-2.5">
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Eliminar Ruta
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <AlertDialogContent className="rounded-2xl border-none shadow-2xl bg-white">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="font-black text-slate-950 uppercase text-xl">¿Eliminar esta ruta?</AlertDialogTitle>
                                                    <AlertDialogDescription className="font-bold text-xs uppercase text-slate-500 leading-relaxed">
                                                        Esta acción no se puede deshacer. Todos los registros asociados a esta planificación se perderán permanentemente.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="gap-2">
                                                    <AlertDialogCancel className="font-black uppercase border-2 h-11">Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(route.id)} className="bg-destructive hover:bg-destructive/90 font-black uppercase h-11 shadow-lg border-none text-white">ELIMINAR DEFINITIVAMENTE</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                                )
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center h-32 font-black text-slate-950 uppercase text-xs">
                                    <div className="flex flex-col items-center gap-2 opacity-30">
                                        <RouteIcon className="h-8 w-8" />
                                        <span>No hay rutas de equipo para mostrar</span>
                                    </div>
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
