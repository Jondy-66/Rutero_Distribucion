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
import { deleteRoute, updateRoute } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { RoutePlan } from '@/lib/types';
import { MoreHorizontal, PlusCircle, CheckCircle2, AlertCircle, XCircle, Clock, Trash2, Users, CheckCircle, Info, Flag } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Timestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function RoutesListPage() {
  const { user, routes: allRoutesFromContext, loading: authLoading, dataLoading, refetchData } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Estados para Finalización Manual
  const [routeToFinalize, setRouteToFinalize] = useState<RoutePlan | null>(null);
  const [finalizeReason, setFinalizeReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const filteredRoutes = useMemo(() => {
    if (!user) return [];
    return allRoutesFromContext.filter(route => route.createdBy === user.id);
  }, [allRoutesFromContext, user]);

  const handleAction = (routeId: string) => {
    router.push(`/dashboard/routes/${routeId}`);
  };

  const handleDelete = async (routeId: string) => {
    try {
      await deleteRoute(routeId);
      toast({ title: "Éxito", description: "Ruta eliminada correctamente." });
      await refetchData('routes');
    } catch (error: any) {
      console.error("Failed to delete route:", error);
      toast({ title: "Error", description: "No se pudo eliminar la ruta.", variant: "destructive" });
    }
  };

  const handleMarkAsCompleted = async () => {
    if (!routeToFinalize) return;
    
    const allClientsCount = routeToFinalize.clients.filter(c => c.status !== 'Eliminado').length;
    const completedCount = routeToFinalize.clients.filter(c => c.status !== 'Eliminado' && c.visitStatus === 'Completado').length;
    const isActuallyComplete = completedCount === allClientsCount;

    if (!isActuallyComplete && !finalizeReason.trim()) {
        toast({ title: "Atención", description: "Indica el motivo del cierre incompleto.", variant: "destructive" });
        return;
    }

    setIsSaving(true);
    try {
      await updateRoute(routeToFinalize.id, { 
        status: isActuallyComplete ? 'Completada' : 'Incompleta', 
        statusReason: isActuallyComplete ? 'Finalizada por el usuario.' : finalizeReason 
      });
      toast({ title: "Plan Finalizado", description: isActuallyComplete ? "Ruta completada." : "Ruta cerrada como incompleta." });
      setRouteToFinalize(null);
      setFinalizeReason('');
      await refetchData('routes');
    } catch (error: any) {
      toast({ title: "Error", description: "No se pudo finalizar la ruta.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const getBadgeForStatus = (route: RoutePlan) => {
    const { status, statusReason } = route;
    switch (status) {
        case 'Planificada': return <Badge variant="secondary"><CheckCircle2 className="mr-1 h-3 w-3"/>{status}</Badge>;
        case 'En Progreso': return <Badge variant="default"><Clock className="mr-1 h-3 w-3"/>{status}</Badge>;
        case 'Completada': return <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3"/>{status}</Badge>;
        case 'Pendiente de Aprobación': return <Badge variant="outline" className="text-amber-600 border-amber-500"><AlertCircle className="mr-1 h-3 w-3"/>Pendiente</Badge>;
        case 'Rechazada': return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3"/>{status}</Badge>;
        case 'Incompleta': 
            return (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Badge variant="destructive" className="cursor-help">
                                <AlertCircle className="mr-1 h-3 w-3"/>{status}
                            </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="max-w-xs text-xs">{statusReason || "Ruta cerrada con visitas pendientes."}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        default: return <Badge variant="outline">{status}</Badge>;
    }
  }

  const getRouteDate = (route: RoutePlan) => {
    if (route.date) {
        const d = route.date instanceof Timestamp ? route.date.toDate() : (route.date instanceof Date ? route.date : new Date(route.date));
        return format(d, 'PPP', { locale: es });
    }
    return 'N/A';
  };

  const isLoading = authLoading || dataLoading;

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
             <div className="border rounded-lg overflow-x-auto">
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
                        {isLoading ? (
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
                                const canEdit = user?.id === route.createdBy && (route.status === 'Rechazada' || route.status === 'Planificada' || route.status === 'En Progreso');
                                const canAdminEdit = user?.role === 'Administrador' && route.status !== 'Completada';
                                const canDelete = user?.role === 'Administrador' || (user?.id === route.createdBy && route.status === 'Rechazada');
                                const canComplete = route.status === 'En Progreso';
                                
                                const clientCount = route.clients?.length || 0;

                                return (
                                <TableRow key={route.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex flex-col">
                                            <span>{route.routeName}</span>
                                            {route.status === 'Incompleta' && route.statusReason && (
                                                <span className="text-[10px] text-muted-foreground italic truncate max-w-[200px]">{route.statusReason}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>{getRouteDate(route)}</TableCell>
                                    <TableCell>{route.supervisorName}</TableCell>
                                    <TableCell>
                                        {getBadgeForStatus(route)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className={cn("flex items-center justify-center gap-1.5 font-bold", clientCount === 0 && "text-destructive animate-pulse")}>
                                            <Users className="h-4 w-4" />
                                            {clientCount}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <AlertDialog>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button aria-haspopup="true" size="icon" variant="ghost">
                                              <MoreHorizontal className="h-4 w-4" />
                                              <span className="sr-only">Menú</span>
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                            {(canEdit || canAdminEdit) && <DropdownMenuItem onClick={() => handleAction(route.id)}>Editar / Detalle</DropdownMenuItem>}
                                            
                                            {canComplete && (
                                                <DropdownMenuItem onClick={() => setRouteToFinalize(route)} className="font-bold text-green-600">
                                                    <Flag className="mr-2 h-4 w-4" />
                                                    Finalizar Plan (Cierre)
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
                                            <AlertDialogTitle>¿Eliminar ruta?</AlertDialogTitle>
                                            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(route.id)} className="bg-destructive">Eliminar</AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </TableCell>
                                </TableRow>
                                )
                            })
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center h-24">No hay rutas registradas.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </CardContent>
      </Card>

      {/* Diálogo de Cierre Manual */}
      <Dialog open={!!routeToFinalize} onOpenChange={(o) => !o && setRouteToFinalize(null)}>
        <DialogContent className="max-w-md rounded-3xl p-8">
            <DialogHeader>
                <DialogTitle className="text-2xl font-black text-primary uppercase">Cierre de Plan Semanal</DialogTitle>
                <DialogDescription className="font-bold text-[10px] uppercase mt-2">
                    Si el plan tiene visitas pendientes, se marcará como 'Incompleto' y deberás justificar por qué no se gestionaron.
                </DialogDescription>
            </DialogHeader>
            
            {routeToFinalize && routeToFinalize.clients.some(c => c.status !== 'Eliminado' && c.visitStatus === 'Pendiente') && (
                <div className="space-y-2 mt-4">
                    <Label className="text-[10px] font-black uppercase text-slate-500">Motivo del Cierre Incompleto (Obligatorio)</Label>
                    <Textarea 
                        className="h-32 border-2 rounded-2xl font-bold"
                        placeholder="Ej: Algunos locales estaban cerrados o no se alcanzó a visitar por logística..."
                        value={finalizeReason}
                        onChange={e => setFinalizeReason(e.target.value)}
                    />
                </div>
            )}

            <DialogFooter className="mt-8 gap-3 sm:flex-col">
                <Button 
                    className="w-full h-14 font-black text-lg rounded-2xl shadow-xl"
                    disabled={isSaving || (routeToFinalize?.clients.some(c => c.status !== 'Eliminado' && c.visitStatus === 'Pendiente') && !finalizeReason.trim())}
                    onClick={handleMarkAsCompleted}
                >
                    {isSaving ? <LoaderCircle className="animate-spin h-6 w-6" /> : "CONFIRMAR FINALIZACIÓN"}
                </Button>
                <DialogClose asChild>
                    <Button variant="ghost" className="w-full font-bold">CANCELAR</Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
