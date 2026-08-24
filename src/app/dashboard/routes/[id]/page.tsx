'use client';
import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar as CalendarIcon, Users, LoaderCircle, Trash2, ThumbsDown, ShieldCheck, CheckCircle, XCircle } from 'lucide-react';
import { getRoute, updateRoute, addNotification } from '@/lib/firebase/firestore';
import type { User, RoutePlan, ClientInRoute } from '@/lib/types';
import { format } from 'date-fns';
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

const ensureDate = (d: any): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (d && typeof d.toDate === 'function') return d.toDate();
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
  const [supervisors, setSupervisors] = useState<User[]>([]);

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
  
  useEffect(() => {
      if (users) setSupervisors(users.filter(u => u.role === 'Supervisor' || u.role === 'Administrador'));
  }, [users]);

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

      if (creator?.email) {
          fetch('/api/notifications/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  to: creator.email.toLowerCase(),
                  subject: `RUTA APROBADA: ${route.routeName}`,
                  title: '¡Plan Aprobado!',
                  message: `Tu supervisor (${currentUser.name}) ha revisado y aprobado tu plan de ruta.`,
                  type: 'success',
                  eventKey: 'route_approved'
              })
          }).catch(e => console.error(e));
      }

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

      if (creator?.email) {
          fetch('/api/notifications/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  to: creator.email.toLowerCase(),
                  subject: `ATENCIÓN: RUTA RECHAZADA - ${route.routeName}`,
                  title: 'Ajustes Requeridos en Plan de Ruta',
                  message: `Tu plan de ruta ha sido rechazado por el supervisor.`,
                  details: rejectionReason,
                  type: 'alert',
                  eventKey: 'route_rejected'
              })
          }).catch(e => console.error(e));
      }

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
      <PageHeader title="Revisión de Plan de Ruta" description="Detalles y aprobación." />

      <div className="space-y-6">
        {canApprove && (
            <Alert className="border-amber-500 bg-amber-50 shadow-md">
                <ShieldCheck className="h-5 w-5 text-amber-600" />
                <AlertTitle className="text-amber-800 font-black uppercase">Ruta en Espera de Aprobación</AlertTitle>
                <AlertDescription className="text-amber-700 font-bold text-xs">
                    REVISA LAS PARADAS Y VALORES ANTES DE APROBAR EL PLAN.
                </AlertDescription>
            </Alert>
        )}

        <Card>
          <CardHeader><CardTitle className="font-black uppercase text-slate-950">Información General</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-bold uppercase text-[10px]">Nombre</Label>
              <Input value={route.routeName} disabled className="font-black" />
            </div>
            <div className="space-y-2">
              <Label className="font-bold uppercase text-[10px]">Estado</Label>
              <Badge variant="outline" className="h-10 w-full flex items-center justify-center font-black uppercase">{route.status}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-black uppercase text-slate-950">Clientes en Ruta</CardTitle></CardHeader>
          <CardContent className="space-y-3">
              {clientsInRoute.filter(c => c.status !== 'Eliminado').map((client, idx) => (
                  <div key={idx} className="p-4 border-2 rounded-xl flex justify-between items-center">
                      <div>
                          <p className="font-black text-primary uppercase text-xs">{client.nombre_comercial}</p>
                          <p className="text-[9px] font-bold text-slate-500 uppercase">{format(ensureDate(client.date), 'dd/MM/yyyy')}</p>
                      </div>
                      <Badge variant="secondary" className="font-black text-[10px]">${client.valorVenta || 0}</Badge>
                  </div>
              ))}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 p-4 bg-background sticky bottom-0 border-t z-10">
          {canApprove && (
            <>
              <Button variant="destructive" onClick={() => setIsRejectDialogOpen(true)} disabled={isSaving} className="font-black">RECHAZAR PLAN</Button>
              <Button onClick={handleApprove} disabled={isSaving} className="bg-green-600 hover:bg-green-700 font-black text-white px-8">APROBAR PLAN DE RUTA</Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle className="font-black uppercase text-red-600">Rechazar Plan</DialogTitle></DialogHeader>
          <div className="py-6">
            <Label className="font-black uppercase text-[10px]">Observación (Obligatorio)</Label>
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Motivo del rechazo..." className="mt-2 h-32" />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" className="font-black">Cancelar</Button></DialogClose>
            <Button variant="destructive" onClick={handleReject} disabled={isSaving || !rejectionReason.trim()} className="font-black">CONFIRMAR RECHAZO</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
