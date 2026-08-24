'use client';
import { useState, useEffect, useMemo, use } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar as CalendarIcon, Users, LoaderCircle, Trash2, ShieldCheck, CheckCircle, XCircle, Clock, MapPin, Phone } from 'lucide-react';
import { getRoute, updateRoute, addNotification } from '@/lib/firebase/firestore';
import type { User, RoutePlan, ClientInRoute } from '@/lib/types';
import { format, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';

const ensureDate = (d: any): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (d && typeof d.toDate === 'function') return d.toDate();
  if (d && typeof d.seconds === 'number') return new Date(d.seconds * 1000);
  const date = new Date(d);
  return isNaN(date.getTime()) ? new Date() : date;
};

export default function EditRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: routeId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser, users, loading: authLoading, refetchData } = useAuth();

  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [clientsInRoute, setClientsInRoute] = useState<ClientInRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const canApprove = useMemo(() => {
     if (!currentUser || !route) return false;
     const isPending = route.status === 'Pendiente de Aprobación';
     const isAuthAdmin = currentUser.role === 'Administrador';
     const isMyRouteAsSupervisor = currentUser.id === route.supervisorId;
     return isPending && (isAuthAdmin || isMyRouteAsSupervisor);
  }, [currentUser, route]);

  useEffect(() => {
    const fetchRouteData = async () => {
      setLoading(true);
      try {
        const routeData = await getRoute(routeId);
        if (routeData) {
          setRoute(routeData);
          setClientsInRoute(routeData.clients || []);
        } else {
          notFound();
        }
      } catch (error) {
        toast({ title: "Error", description: "No se pudo cargar la ruta.", variant: "destructive" });
        notFound();
      } finally {
        setLoading(false);
      }
    };
    if (routeId) fetchRouteData();
  }, [routeId, toast]);

  const groupedClients = useMemo(() => {
    const active = clientsInRoute.filter(c => c.status !== 'Eliminado');
    const groups: Record<string, ClientInRoute[]> = {};
    
    active.forEach(client => {
        const date = ensureDate(client.date);
        const dateStr = format(date, 'yyyy-MM-dd');
        if (!groups[dateStr]) groups[dateStr] = [];
        groups[dateStr].push(client);
    });
    
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [clientsInRoute]);

  const handleApprove = async () => {
    if (!route || !currentUser) return;
    setIsSaving(true);
    try {
      await updateRoute(routeId, { 
        status: 'Planificada',
        supervisorObservation: 'Ruta aprobada.'
      });
      
      const creator = users.find(u => u.id === route.createdBy);

      addNotification({
        userId: route.createdBy,
        title: 'Ruta Aprobada',
        message: `Tu ruta "${route.routeName}" ha sido aprobada.`,
        link: `/dashboard/routes/${routeId}`
      });

      fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              to: creator?.email.toLowerCase(),
              subject: `RUTA APROBADA: ${route.routeName}`,
              title: '¡Plan Aprobado!',
              message: `Tu supervisor (${currentUser.name}) ha revisado y aprobado tu plan de ruta.`,
              type: 'success',
              eventKey: 'route_approved'
          })
      }).catch(e => console.error(e));

      await refetchData('routes');
      toast({ title: 'Éxito', description: 'La ruta ha sido aprobada.' });
      router.push('/dashboard/routes/team-routes');
    } catch (error) {
      toast({ title: 'Error al aprobar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!route || !currentUser || !rejectionReason.trim()) {
        toast({ title: "Motivo requerido", variant: "destructive" });
        return;
    }
    setIsSaving(true);
    try {
      await updateRoute(routeId, { 
        status: 'Rechazada',
        supervisorObservation: rejectionReason
      });

      const creator = users.find(u => u.id === route.createdBy);

      addNotification({
        userId: route.createdBy,
        title: 'Ruta Rechazada',
        message: `Tu ruta "${route.routeName}" ha sido rechazada.`,
        link: `/dashboard/routes/${routeId}`
      });

      fetch('/api/notifications/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              to: creator?.email.toLowerCase(),
              subject: `ATENCIÓN: RUTA RECHAZADA - ${route.routeName}`,
              title: 'Ajustes Requeridos en Plan de Ruta',
              message: `Tu plan de ruta ha sido rechazado por el supervisor.`,
              details: rejectionReason,
              type: 'alert',
              eventKey: 'route_rejected'
          })
      }).catch(e => console.error(e));

      await refetchData('routes');
      toast({ title: 'Ruta Rechazada' });
      setIsRejectDialogOpen(false);
      router.push('/dashboard/routes/team-routes');
    } catch (error) {
      toast({ title: 'Error al rechazar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || authLoading) return <div className="p-8"><Skeleton className="h-96 w-full" /></div>;
  if (!route) return notFound();
  
  return (
    <div className="flex flex-col space-y-6">
      <PageHeader title="Detalle de Plan de Ruta" description="Revisión cronológica de paradas." />

      <div className="space-y-6">
        {canApprove && (
            <Alert className="border-amber-500 bg-amber-50 shadow-md">
                <ShieldCheck className="h-5 w-5 text-amber-600" />
                <AlertTitle className="text-amber-800 font-black uppercase">Ruta en Espera de Aprobación</AlertTitle>
                <AlertDescription className="text-amber-700 font-bold text-xs uppercase">
                    REVISA LAS PARADAS POR DÍA ANTES DE APROBAR EL PLAN.
                </AlertDescription>
            </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
                <Card className="border-t-4 border-t-primary shadow-lg">
                    <CardHeader><CardTitle className="font-black uppercase text-slate-950 text-sm">Información General</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <Label className="font-black text-[8px] uppercase text-slate-400">Nombre del Plan</Label>
                            <p className="font-black text-slate-950 uppercase">{route.routeName}</p>
                        </div>
                        <div className="space-y-1">
                            <Label className="font-black text-[8px] uppercase text-slate-400">Estado Actual</Label>
                            <div>{route.status === 'Pendiente de Aprobación' ? <Badge variant="outline" className="border-amber-500 text-amber-600 font-black uppercase">Pendiente</Badge> : <Badge className="font-black uppercase">{route.status}</Badge>}</div>
                        </div>
                        <div className="space-y-1">
                            <Label className="font-black text-[8px] uppercase text-slate-400">Vendedor</Label>
                            <p className="font-black text-primary uppercase text-xs">{users.find(u => u.id === route.createdBy)?.name || 'Desconocido'}</p>
                        </div>
                    </CardContent>
                </Card>

                {route.supervisorObservation && (
                    <Card className="border-t-4 border-t-red-500 bg-red-50/30">
                        <CardHeader><CardTitle className="font-black uppercase text-red-600 text-[10px]">Observación de Auditoría</CardTitle></CardHeader>
                        <CardContent><p className="text-xs font-bold text-slate-700 italic">"{route.supervisorObservation}"</p></CardContent>
                    </Card>
                )}
            </div>

            <div className="lg:col-span-2 space-y-6">
                <h3 className="font-black text-slate-950 uppercase text-lg flex items-center gap-2">
                    <CalendarIcon className="h-5 w-5 text-primary" />
                    Cronograma de Visitas
                </h3>
                
                {groupedClients.map(([dateStr, clients]) => (
                    <Card key={dateStr} className="border-none shadow-xl overflow-hidden rounded-2xl bg-white">
                        <CardHeader className="bg-slate-50 border-b px-6 py-4 flex flex-row justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="bg-primary text-white p-2 rounded-lg"><CalendarIcon className="h-4 w-4" /></div>
                                <h4 className="font-black text-xs uppercase text-slate-950">
                                    {format(new Date(dateStr + 'T00:00:00'), 'EEEE dd MMMM', { locale: es })}
                                </h4>
                            </div>
                            <Badge variant="secondary" className="font-black">{clients.length} Paradas</Badge>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {clients.map((client, idx) => (
                                    <div key={idx} className="p-5 flex justify-between items-center hover:bg-slate-50 transition-colors">
                                        <div className="flex gap-4 items-center">
                                            <div className="text-slate-300 font-black text-lg">{(idx + 1).toString().padStart(2, '0')}</div>
                                            <div className="min-w-0">
                                                <p className="font-black text-xs text-slate-950 uppercase truncate leading-tight">{client.nombre_comercial}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[9px] font-mono font-bold text-slate-400">RUC: {client.ruc}</span>
                                                    {client.visitStatus === 'Completado' && <Badge variant="success" className="h-4 text-[8px] uppercase">Gestionado</Badge>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-black text-primary uppercase">${client.valorVenta?.toFixed(2) || '0.00'}</p>
                                            <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">Venta Est.</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>

        <div className="flex justify-end gap-3 p-6 bg-white sticky bottom-0 border-t z-10 rounded-b-2xl shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
            <Button variant="ghost" onClick={() => router.back()} className="font-black uppercase text-xs"><ArrowLeft className="mr-2 h-4 w-4" /> Volver</Button>
            {canApprove && (
                <>
                <Button variant="destructive" onClick={() => setIsRejectDialogOpen(true)} disabled={isSaving} className="font-black px-6 shadow-lg">RECHAZAR PLAN</Button>
                <Button onClick={handleApprove} disabled={isSaving} className="bg-green-600 hover:bg-green-700 font-black text-white px-10 shadow-lg">
                    {isSaving ? <LoaderCircle className="animate-spin mr-2" /> : <ShieldCheck className="mr-2" />}
                    APROBAR PLAN SEMANAL
                </Button>
                </>
            )}
        </div>
      </div>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden max-w-md">
          <DialogHeader className="bg-red-600 p-8 text-white">
              <DialogTitle className="text-2xl font-black uppercase flex items-center gap-3">
                  <XCircle className="h-7 w-7" /> Rechazar Plan
              </DialogTitle>
              <DialogDescription className="text-white/80 font-bold uppercase text-[10px]">Indica el motivo técnico para que el vendedor lo corrija.</DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-4">
            <Label className="font-black uppercase text-[10px] text-slate-500">Observación Obligatoria</Label>
            <Textarea 
                value={rejectionReason} 
                onChange={(e) => setRejectionReason(e.target.value)} 
                placeholder="Ej: Valores de venta inconsistentes o paradas fuera de zona..." 
                className="h-32 font-medium border-2 focus:border-red-500" 
            />
          </div>
          <DialogFooter className="p-8 pt-0 gap-2">
            <DialogClose asChild><Button variant="ghost" className="font-black uppercase">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleReject} disabled={isSaving || !rejectionReason.trim()} className="font-black uppercase px-8 h-12 shadow-xl">CONFIRMAR RECHAZO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
