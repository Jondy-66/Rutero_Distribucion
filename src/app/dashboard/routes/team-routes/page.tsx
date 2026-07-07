
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
import { deleteRoute, updateRoute, updateUser } from '@/lib/firebase/firestore';
import { db } from '@/lib/firebase/config';
import { writeBatch, doc, Timestamp, getDoc } from 'firebase/firestore';
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
  ShieldCheck,
  CalendarDays
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export default function TeamRoutesPage() {
  const { user, users, routes: globalRoutes, loading: authLoading, dataLoading, refetchData } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<string>('all');
  const [selectedRouteIds, setSelectedRouteIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [isRescuing, setIsRescuing] = useState<string | null>(null);

  // Estados para extensión de horario
  const [isExtendClosingDialogOpen, setIsExtendClosingDialogOpen] = useState(false);
  const [extendingRouteId, setExtendingRouteId] = useState<string | null>(null);
  const [extensionType, setExtensionType] = useState<'route' | 'weekly'>('route');
  const [newClosingTime, setNewClosingTime] = useState('21:00');
  const [isExtending, setIsExtending] = useState(false);

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

  const handleRescueRouteData = async (routeId: string) => {
    setIsRescuing(routeId);
    try {
        const routeRef = doc(db, 'routes', routeId);
        const snap = await getDoc(routeRef);
        
        if (!snap.exists()) {
            toast({ title: "Error", description: "La ruta no existe en el servidor.", variant: "destructive" });
            return;
        }

        const freshData = snap.data() as RoutePlan;
        const clients = freshData.clients || [];

        const repairedClients = clients.map(c => {
            const hasRealData = !!c.checkOutTime;
            return {
                ...c,
                visitStatus: hasRealData ? 'Completado' : 'Pendiente',
                status: c.status === 'Eliminado' ? 'Eliminado' : 'Activo',
                valorVenta: Number(c.valorVenta) || 0,
                valorCobro: Number(c.valorCobro) || 0,
                devoluciones: Number(c.devoluciones) || 0,
            };
        });

        const isNowFinished = repairedClients.filter(r => r.status !== 'Eliminado').every(r => r.visitStatus === 'Completado');

        updateRoute(routeId, { 
            clients: repairedClients,
            status: freshData.status === 'Completada' ? 'Completada' : (isNowFinished ? 'Completada' : 'En Progreso')
        })
        .then(() => {
            toast({ 
                title: "MANTENIMIENTO FINALIZADO", 
                description: `Se han depurado los estados de gestión basados en evidencia real.`,
                className: "bg-green-600 text-white font-black"
            });
            refetchData('routes');
        })
        .catch(async (error) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: routeRef.path,
                operation: 'update',
                requestResourceData: { clients: repairedClients }
            }));
        })
        .finally(() => {
            setIsRescuing(null);
        });

    } catch (error) {
        console.error("Rescue process error:", error);
        toast({ title: "Error en Rescate", description: "Ocurrió un fallo al intentar acceder a los datos.", variant: "destructive" });
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

  const handleExtendClosing = async () => {
    if (!extendingRouteId) return;
    setIsExtending(true);
    try {
        const route = filteredRoutes.find(r => r.id === extendingRouteId);
        if (!route) throw new Error("Ruta no encontrada");

        if (extensionType === 'weekly') {
            // Extender de Lunes a Viernes para el Usuario (Permanente)
            await updateUser(route.createdBy, {
                extendedClosingTime: newClosingTime,
                extendedClosingDays: [1, 2, 3, 4, 5]
            });
            toast({ 
                title: "CONFIGURACIÓN SEMANAL GUARDADA", 
                description: `El usuario ahora tiene cierre a las ${newClosingTime} de Lunes a Viernes.`,
                className: "bg-blue-600 text-white font-black"
            });
        } else {
            // Extender solo la Ruta Actual
            await updateRoute(extendingRouteId, { extendedClosingTime: newClosingTime });
            toast({ 
                title: "CIERRE EXTENDIDO (SOLO HOY)", 
                description: `Esta jornada específica se bloqueará a las ${newClosingTime}.`,
                className: "bg-orange-600 text-white font-black"
            });
        }

        setIsExtendClosingDialogOpen(false);
        setExtendingRouteId(null);
        await refetchData('routes');
        await refetchData('users');
    } catch (error) {
        toast({ title: "Error", description: "No se pudo procesar la extensión.", variant: "destructive" });
    } finally {
        setIsExtending(false);
    }
  };
  
  const toggleRouteSelection = (routeId: string) => {
      setSelectedRouteIds(prev => 
        prev.includes(routeId) ? prev.filter(id => id !== routeId) : [...prev, id]
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
                                        <div className="flex flex-col gap-1">
                                            {getBadgeForStatus(route.status)}
                                            {route.extendedClosingTime && (
                                                <span className="text-[8px] font-black text-orange-600 uppercase flex items-center gap-0.5">
                                                    <Clock className="h-2 w-2" /> Ruta hoy: {route.extendedClosingTime}
                                                </span>
                                            )}
                                        </div>
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
                                                            onClick={() => handleRescueRouteData(route.id)} 
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

                                                    {isAdminRole && (
                                                        <DropdownMenuItem 
                                                            onClick={() => {
                                                                setExtendingRouteId(route.id);
                                                                setNewClosingTime(route.extendedClosingTime || '21:00');
                                                                setIsExtendClosingDialogOpen(true);
                                                            }} 
                                                            className="font-black text-xs uppercase text-orange-600 py-2.5 bg-orange-50 rounded-lg mt-1"
                                                        >
                                                            <Clock className="mr-2 h-4 w-4" />
                                                            Extender Cierre
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

      <Dialog open={isExtendClosingDialogOpen} onOpenChange={setIsExtendClosingDialogOpen}>
          <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl">
              <DialogHeader>
                  <DialogTitle className="font-black uppercase text-slate-950 text-xl">Configurar Extensión Horaria</DialogTitle>
                  <DialogDescription className="text-xs font-bold uppercase text-slate-500">
                      Define el alcance y la hora máxima permitida para este usuario.
                  </DialogDescription>
              </DialogHeader>
              <div className="py-6 space-y-6">
                  <div className="space-y-3">
                      <Label className="font-black uppercase text-[10px] text-slate-500">Alcance de la Extensión</Label>
                      <RadioGroup value={extensionType} onValueChange={(v: any) => setExtensionType(v)} className="grid grid-cols-2 gap-4">
                          <Label className={cn(
                              "flex flex-col items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all",
                              extensionType === 'route' ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "bg-slate-50"
                          )}>
                              <RadioGroupItem value="route" className="sr-only" />
                              <RouteIcon className="h-6 w-6" />
                              <span className="text-[10px] font-black uppercase">Solo esta Ruta</span>
                          </Label>
                          <Label className={cn(
                              "flex flex-col items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all",
                              extensionType === 'weekly' ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "bg-slate-50"
                          )}>
                              <RadioGroupItem value="weekly" className="sr-only" />
                              <CalendarDays className="h-6 w-6" />
                              <span className="text-[10px] font-black uppercase">Semana L-V</span>
                          </Label>
                      </RadioGroup>
                  </div>

                  <div className="space-y-2">
                      <Label htmlFor="closing-time" className="font-black uppercase text-[10px] text-slate-500">Nueva Hora Máxima (24h)</Label>
                      <Input 
                        id="closing-time" 
                        type="time" 
                        value={newClosingTime} 
                        onChange={(e) => setNewClosingTime(e.target.value)} 
                        className="h-12 border-2 border-slate-200 font-black text-primary text-2xl rounded-xl text-center"
                      />
                      <p className="text-[9px] font-bold text-slate-400 uppercase italic text-center">Hora de bloqueo definitiva</p>
                  </div>
              </div>
              <DialogFooter className="gap-2">
                  <DialogClose asChild><Button variant="ghost" className="font-black uppercase">Cancelar</Button></DialogClose>
                  <Button 
                    onClick={handleExtendClosing} 
                    disabled={isExtending}
                    className="font-black h-11 px-8 uppercase shadow-lg bg-orange-600 hover:bg-orange-700"
                  >
                      {isExtending ? <LoaderCircle className="animate-spin mr-2 h-4 w-4" /> : <Clock className="mr-2 h-4 w-4" />}
                      {extensionType === 'weekly' ? 'Aplicar Semanalmente' : 'Extender hoy'}
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <div className="mt-8 p-6 bg-amber-50 rounded-3xl border-2 border-dashed border-amber-200">
          <div className="flex gap-4">
              <LifeBuoy className="h-8 w-8 text-amber-600 shrink-0" />
              <div>
                  <h4 className="font-black text-amber-900 uppercase text-sm">¿Perdiste datos de gestión?</h4>
                  <p className="text-amber-700 text-xs font-bold uppercase mt-1 leading-relaxed">
                      Si un vendedor indica que terminó su jornada pero no visualizas los "OK", usa la opción 
                      <span className="font-black underline mx-1">Rescatar Gestiones</span> en el menú de la ruta. 
                      Esto forzará la sincronización y validará cada visita individualmente basándose en evidencia real (check-out u observaciones).
                  </p>
              </div>
          </div>
      </div>
    </>
  );
}
