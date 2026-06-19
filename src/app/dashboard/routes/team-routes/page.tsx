'use client';
import { useState, useMemo } from 'react';
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
import { deleteRoute, updateRoute } from '@/lib/firebase/firestore';
import { db } from '@/lib/firebase/config';
import { writeBatch, doc, Timestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { RoutePlan } from '@/lib/types';
import { 
  MoreHorizontal, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Clock, 
  RefreshCw, 
  CheckCircle, 
  PlayCircle, 
  Users as UsersIcon, 
  Route as RouteIcon, 
  LoaderCircle,
  LifeBuoy,
  ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
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
import { cn } from '@/lib/utils';

export default function TeamRoutesPage() {
  const { user, users, routes: globalRoutes, loading: authLoading, dataLoading, refetchData } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isRescuing, setIsRescuing] = useState<string | null>(null);

  const isAdminRole = user?.role === 'Administrador';

  const managedUsersForSelect = useMemo(() => {
    if (!user) return [];
    if (user.role === 'Administrador') {
      return users.filter(u => u.id !== user.id);
    }
    if (user.role === 'Supervisor') {
      return users.filter(u => u.supervisorId === user.id);
    }
    return [];
  }, [users, user]);

  const filteredRoutes = useMemo(() => {
    if (!user || !globalRoutes) return [];
    
    let routesToFilter: RoutePlan[] = [];
    
    if (user.role === 'Administrador') {
        routesToFilter = [...globalRoutes];
    } else if (user.role === 'Supervisor') {
        const managedUserIds = managedUsersForSelect.map(u => u.id);
        routesToFilter = globalRoutes.filter(route => 
            route.supervisorId === user.id || managedUserIds.includes(route.createdBy)
        );
    }

    if (selectedUser !== 'all') {
        routesToFilter = routesToFilter.filter(route => route.createdBy === selectedUser);
    }

    return [...routesToFilter].sort((a, b) => {
        const getPriority = (status: string) => {
            if (status === 'En Progreso') return 1;
            if (status === 'Pendiente de Aprobación') return 2;
            if (status === 'Planificada') return 3;
            if (status === 'Completada') return 4;
            if (status === 'Rechazada') return 5;
            return 6;
        };

        const priorityDiff = getPriority(a.status) - getPriority(b.status);
        if (priorityDiff !== 0) return priorityDiff;

        const getMillis = (ts: any) => {
            if (ts instanceof Timestamp) return ts.toMillis();
            if (ts?.seconds) return ts.seconds * 1000 + (ts.nanoseconds / 1000000 || 0);
            if (ts instanceof Date) return ts.getTime();
            if (typeof ts === 'string') return new Date(ts).getTime();
            return 0;
        };

        const dateA = getMillis(a.date || a.createdAt);
        const dateB = getMillis(b.date || b.createdAt);

        return dateB - dateA;
    });
  }, [globalRoutes, user, managedUsersForSelect, selectedUser]);
  
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
        await refetchData('routes');
    } catch (error: any) {
        console.error('Failed to delete route:', error);
        toast({ title: 'Error', description: 'No se pudo eliminar la ruta.', variant: 'destructive' });
    }
  };

  /**
   * FUNCIÓN CRÍTICA: RESCATE DE DATOS DE GESTIÓN
   * Restaura la integridad de la lista de clientes si se perdieron los estados OK.
   */
  const handleRescueRouteData = async (route: RoutePlan) => {
    setIsRescuing(route.id);
    try {
        // Sanitización forzada: Aseguramos que el array de clientes sea íntegro
        const repairedClients = route.clients.map(c => ({
            ...c,
            // Si el cliente tiene tiempos o valores pero el status es incorrecto, lo re-activamos
            visitStatus: (c.checkInTime || c.valorVenta > 0 || c.valorCobro > 0) ? 'Completado' : (c.visitStatus || 'Pendiente'),
            status: c.status === 'Eliminado' ? 'Eliminado' : 'Activo',
            // Aseguramos valores numéricos
            valorVenta: Number(c.valorVenta) || 0,
            valorCobro: Number(c.valorCobro) || 0,
            devoluciones: Number(c.devoluciones) || 0,
        }));

        await updateRoute(route.id, { 
            clients: repairedClients,
            status: route.status === 'Completada' ? 'Completada' : (repairedClients.every(c => c.visitStatus === 'Completado' || c.status === 'Eliminado') ? 'Completada' : 'En Progreso')
        });

        toast({ 
            title: "RESCATE EXITOSO", 
            description: `Se han validado y restaurado ${repairedClients.length} registros de gestión.`,
            className: "bg-green-600 text-white font-black"
        });
        await refetchData('routes');
    } catch (error) {
        console.error("Rescue failed:", error);
        toast({ title: "Error en Rescate", variant: "destructive" });
    } finally {
        setIsRescuing(null);
    }
  };

  const handleFinalize = async (routeId: string) => {
    try {
      await updateRoute(routeId, { status: 'Completada' });
      toast({ title: "Ruta Finalizada", description: "La ruta ha sido marcada como completada manualmente." });
      await refetchData('routes');
    } catch (error: any) {
      console.error("Failed to finalize route:", error);
      toast({ title: "Error", description: "No se pudo finalizar la ruta.", variant: "destructive" });
    }
  };

  const handleBulkFinalize = async () => {
    if (selectedRouteIds.length === 0) return;
    
    setIsBulkProcessing(true);
    try {
        const batch = writeBatch(db);
        selectedRouteIds.forEach(id => {
            const routeRef = doc(db, 'routes', id);
            batch.update(routeRef, { status: 'Completada' });
        });
        
        await batch.commit();
        toast({ 
            title: "Operación Masiva Exitosa", 
            description: `Se han finalizado ${selectedRouteIds.length} rutas correctamente.` 
        });
        setSelectedRouteIds([]);
        await refetchData('routes');
    } catch (error) {
        console.error("Bulk finalize error:", error);
        toast({ title: "Error", description: "No se pudieron finalizar las rutas seleccionadas.", variant: "destructive" });
    } finally {
        setIsBulkProcessing(false);
    }
  };

  const handleReactivate = async (routeId: string) => {
    try {
      await updateRoute(routeId, { status: 'En Progreso' });
      toast({ title: "Éxito", description: "La ruta ha sido reactivada a En Progreso." });
      await refetchData('routes');
    } catch (error: any) {
      console.error("Failed to reactivate route:", error);
      toast({ title: "Error", description: "No se pudo reactivar la ruta.", variant: "destructive" });
    }
  };
  
  const toggleRouteSelection = (routeId: string) => {
      setSelectedRouteIds(prev => 
        prev.includes(routeId) ? prev.filter(id => id !== routeId) : [...prev, routeId]
      );
  };

  const toggleAllVisible = () => {
      if (selectedRouteIds.length === filteredRoutes.length) {
          setSelectedRouteIds([]);
      } else {
          setSelectedRouteIds(filteredRoutes.map(r => r.id));
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
      try {
          return format(new Date(date as any), 'PPP', { locale: es });
      } catch (e) {
          return 'N/A';
      }
    }
    return 'N/A';
  };

  const isLoading = authLoading || (dataLoading && globalRoutes.length === 0);

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
        description="Revisa, aprueba o restaura gestiones planificadas por tu equipo."
      />
      
      <Card className="border-t-4 border-t-primary shadow-xl">
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="font-black text-slate-950 uppercase">Panel de Control de Equipo</CardTitle>
                    <CardDescription className="font-bold text-[10px] text-slate-500 uppercase">
                        Viendo {filteredRoutes.length} rutas registradas en el sistema.
                    </CardDescription>
                </div>
                {isAdminRole && selectedRouteIds.length > 0 && (
                    <Button 
                        onClick={handleBulkFinalize} 
                        disabled={isBulkProcessing}
                        className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] h-10 px-6 rounded-xl shadow-lg animate-in fade-in slide-in-from-right-4"
                    >
                        {isBulkProcessing ? <LoaderCircle className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Finalizar {selectedRouteIds.length} Seleccionadas
                    </Button>
                )}
            </div>
        </CardHeader>
        <CardContent>
            <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger className="w-full sm:max-w-xs h-11 border-2 border-slate-200 font-black text-slate-950 rounded-xl bg-white shadow-sm">
                        <UsersIcon className="mr-2 h-4 w-4 text-primary" />
                        <SelectValue placeholder="Filtrar por usuario" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="font-black">Todos los Usuarios</SelectItem>
                        {managedUsersForSelect.map(u => (
                            <SelectItem key={u.id} value={u.id} className="font-black">{u.name} ({u.role})</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {isAdminRole && selectedRouteIds.length > 0 && (
                    <span className="text-[10px] font-black uppercase text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/20">
                        {selectedRouteIds.length} rutas listas para cierre masivo
                    </span>
                )}
            </div>

             <div className="border-2 border-slate-100 rounded-2xl overflow-hidden shadow-inner bg-white">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                        {isAdminRole && (
                            <TableHead className="w-12 text-center h-12">
                                <Checkbox 
                                    checked={selectedRouteIds.length === filteredRoutes.length && filteredRoutes.length > 0}
                                    onCheckedChange={toggleAllVisible}
                                    className="border-primary"
                                />
                            </TableHead>
                        )}
                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">#</TableHead>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Nombre de Ruta</TableHead>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Creado por</TableHead>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Fecha</TableHead>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Estado</TableHead>
                        <TableHead className="font-black text-slate-950 uppercase text-[10px] text-center">Clientes</TableHead>
                        <TableHead className="text-right font-black text-slate-950 uppercase text-[10px] pr-6">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <TableRow key={i}>
                                    {isAdminRole && <TableCell><Skeleton className="h-4 w-4" /></TableCell>}
                                    <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                                    <TableCell className="pr-6"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                                </TableRow>
                            ))
                        ) : filteredRoutes.length > 0 ? (
                            filteredRoutes.map((route, index) => {
                                const canReview = (user?.role === 'Supervisor' || isAdminRole) && route.status === 'Pendiente de Aprobación';
                                const canDelete = isAdminRole;
                                const canReactivate = isAdminRole && (route.status === 'Completada' || route.status === 'Rechazada');
                                const canManageLive = isAdminRole && (route.status === 'En Progreso' || route.status === 'Planificada');
                                const canFinalize = isAdminRole && (route.status === 'En Progreso' || route.status === 'Planificada');
                                const canRescue = isAdminRole || user?.role === 'Supervisor';
                               
                                return (
                                <TableRow key={route.id} className={cn(
                                    "hover:bg-slate-50/50 transition-colors",
                                    selectedRouteIds.includes(route.id) && "bg-primary/5"
                                )}>
                                    {isAdminRole && (
                                        <TableCell className="text-center">
                                            <Checkbox 
                                                checked={selectedRouteIds.includes(route.id)}
                                                onCheckedChange={() => toggleRouteSelection(route.id)}
                                                className="border-primary"
                                                disabled={route.status === 'Completada'}
                                            />
                                        </TableCell>
                                    )}
                                    <TableCell className="font-black text-slate-950 text-xs">{index + 1}</TableCell>
                                    <TableCell className="font-black text-slate-950 text-xs uppercase">{route.routeName}</TableCell>
                                    <TableCell className="font-black text-primary text-xs uppercase">{getCreatorName(route.createdBy)}</TableCell>
                                    <TableCell className="font-black text-slate-950 text-xs uppercase">{getRouteDate(route)}</TableCell>
                                    <TableCell>
                                        {getBadgeForStatus(route.status)}
                                    </TableCell>
                                    <TableCell className="text-center font-black text-slate-950">{route.clients?.length || 0}</TableCell>
                                    <TableCell className="text-right pr-6">
                                        <AlertDialog>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button aria-haspopup="true" size="icon" variant="ghost" className="rounded-full hover:bg-slate-100">
                                                        <MoreHorizontal className="h-4 w-4 text-slate-950" />
                                                        <span className="sr-only">Alternar menú</span>
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-60 rounded-xl shadow-2xl border-none p-2">
                                                    <DropdownMenuLabel className="font-black text-[10px] uppercase text-slate-500 mb-1">Operaciones de Gestión</DropdownMenuLabel>
                                                    
                                                    {canRescue && (
                                                        <DropdownMenuItem 
                                                            onClick={() => handleRescueRouteData(route)} 
                                                            disabled={isRescuing === route.id}
                                                            className="font-black text-xs uppercase text-green-700 py-2.5 bg-green-50 rounded-lg mb-1"
                                                        >
                                                            {isRescuing === route.id ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                                            Rescatar Gestiones (Mantenimiento)
                                                        </DropdownMenuItem>
                                                    )}

                                                    <DropdownMenuItem onClick={() => handleAction(route.id)} className={cn("font-black text-xs uppercase py-2.5 rounded-lg", canReview && "bg-amber-50 text-amber-700")}>
                                                        {canReview ? "REVISAR PARA APROBACIÓN" : "Ver Detalles de Ruta"}
                                                    </DropdownMenuItem>
                                                    
                                                    {canManageLive && (
                                                        <DropdownMenuItem onClick={() => handleManageLive(route.id)} className="font-black text-xs uppercase text-primary py-2.5 bg-primary/5 rounded-lg">
                                                            <PlayCircle className="mr-2 h-4 w-4" />
                                                            Gestionar Jornada
                                                        </DropdownMenuItem>
                                                    )}

                                                    <DropdownMenuSeparator />

                                                    {canFinalize && (
                                                        <DropdownMenuItem onClick={() => handleFinalize(route.id)} className="font-black text-xs uppercase text-blue-600 py-2.5 rounded-lg">
                                                            <CheckCircle className="mr-2 h-4 w-4" />
                                                            Finalizar Ruta Manual
                                                        </DropdownMenuItem>
                                                    )}

                                                    {canReactivate && (
                                                        <DropdownMenuItem onClick={() => handleReactivate(route.id)} className="font-black text-xs uppercase py-2.5 rounded-lg">
                                                            <RefreshCw className="mr-2 h-4 w-4" />
                                                            Reactivar (En Progreso)
                                                        </DropdownMenuItem>
                                                    )}

                                                    {canDelete && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem className="text-red-600 font-black text-xs uppercase py-2.5 rounded-lg hover:bg-red-50">
                                                                    <Trash2 className="mr-2 h-4 w-4" />
                                                                    Eliminar Definitivamente
                                                                </DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <AlertDialogContent className="rounded-2xl border-none shadow-2xl bg-white">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="font-black text-slate-950 uppercase text-xl">¿Confirmar eliminación?</AlertDialogTitle>
                                                    <AlertDialogDescription className="font-bold text-xs uppercase text-slate-500 leading-relaxed">
                                                        Esta acción borrará permanentemente la ruta y todas sus gestiones asociadas. No hay recuperación tras este paso.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="gap-2">
                                                    <AlertDialogCancel className="font-black uppercase border-2 h-11">Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(route.id)} className="bg-destructive hover:bg-destructive/90 font-black uppercase h-11 shadow-lg border-none text-white">ELIMINAR RUTA</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                                )
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={isAdminRole ? 8 : 7} className="text-center h-32 font-black text-slate-950 uppercase text-xs">
                                    <div className="flex flex-col items-center gap-2 opacity-30">
                                        <RouteIcon className="h-8 w-8" />
                                        <span>Sin rutas de equipo disponibles</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>

      <div className="mt-8 p-6 bg-amber-50 rounded-3xl border-2 border-dashed border-amber-200">
          <div className="flex gap-4">
              <LifeBuoy className="h-8 w-8 text-amber-600 shrink-0" />
              <div>
                  <h4 className="font-black text-amber-900 uppercase text-sm">¿Perdiste datos de gestión?</h4>
                  <p className="text-amber-700 text-xs font-bold uppercase mt-1 leading-relaxed">
                      Si un vendedor indica que terminó su jornada pero no visualizas los "OK", usa la opción 
                      <span className="font-black underline mx-1">Rescatar Gestiones</span> en el menú de la ruta. 
                      Esto forzará la sincronización y validará cada visita individualmente.
                  </p>
              </div>
          </div>
      </div>
    </>
  );
}
