
'use client';
import { useState, useEffect, useMemo, use } from 'react';
import { useRouter, notFound } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Calendar as CalendarIcon, LoaderCircle, ShieldCheck, XCircle, CheckCircle2 } from 'lucide-react';
import { getRoute, updateRoute, addNotification } from '@/lib/firebase/firestore';
import type { RoutePlan, ClientInRoute } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Timestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';

const ensureDate = (d: any): Date => {
  if (!d) return new Date();
  if (d instanceof Date) return d;
  if (d instanceof Timestamp) return d.toDate();
  const date = new Date(d);
  return isNaN(date.getTime()) ? new Date() : date;
};

export default function RouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: routeId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser, users, loading: authLoading, refetchData } = useAuth();

  const [route, setRoute] = useState<RoutePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    getRoute(routeId).then(data => { setRoute(data); setLoading(false); }).catch(() => notFound());
  }, [routeId]);

  const groupedClients = useMemo(() => {
    if (!route) return [];
    const groups: Record<string, ClientInRoute[]> = {};
    route.clients.filter(c => c.status !== 'Eliminado').forEach(c => {
        const dStr = format(ensureDate(c.date), 'yyyy-MM-dd');
        if (!groups[dStr]) groups[dStr] = [];
        groups[dStr].push(c);
    });
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [route]);

  const handleApprove = async () => {
    if (!route || !currentUser) return;
    setIsSaving(true);
    await updateRoute(routeId, { status: 'Planificada', supervisorObservation: 'Ruta aprobada.' });
    toast({ title: 'Ruta Aprobada' });
    router.push('/dashboard/routes/team-routes');
  };

  const handleReject = async () => {
    if (!route || !rejectionReason.trim()) return;
    setIsSaving(true);
    await updateRoute(routeId, { status: 'Rechazada', supervisorObservation: rejectionReason });
    toast({ title: 'Ruta Rechazada' });
    router.push('/dashboard/routes/team-routes');
  };

  if (loading || authLoading) return <div className="p-20"><Skeleton className="h-96 w-full" /></div>;
  if (!route) return notFound();

  const canApprove = route.status === 'Pendiente de Aprobación' && (currentUser?.role === 'Administrador' || currentUser?.id === route.supervisorId);

  return (
    <div className="flex flex-col space-y-6">
      <PageHeader title="Detalle de Planificación" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 border-t-4 border-t-primary shadow-lg"><CardHeader><CardTitle className="text-sm font-black uppercase">{route.routeName}</CardTitle></CardHeader><CardContent className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl"><p className="text-[8px] font-black text-slate-400 uppercase">Estado</p><Badge className="mt-1 font-black">{route.status}</Badge></div>
              <div className="p-3 bg-slate-50 rounded-xl"><p className="text-[8px] font-black text-slate-400 uppercase">Ejecutivo</p><p className="font-black text-xs uppercase">{users.find(u => u.id === route.createdBy)?.name || 'Desconocido'}</p></div>
          </CardContent></Card>

          <div className="lg:col-span-2 space-y-6">
              {groupedClients.map(([dateStr, clients]) => (
                  <Card key={dateStr} className="border-none shadow-xl overflow-hidden rounded-2xl">
                      <CardHeader className="bg-slate-50 border-b px-6 py-4 flex flex-row justify-between items-center">
                          <div className="flex items-center gap-3"><CalendarIcon className="text-primary h-5 w-5" /><h4 className="font-black text-xs uppercase">{format(new Date(dateStr + 'T00:00:00'), 'EEEE dd MMMM', { locale: es })}</h4></div>
                          <Badge variant="secondary" className="font-black">{clients.length} Visitas</Badge>
                      </CardHeader>
                      <CardContent className="p-0"><div className="divide-y divide-slate-100">
                          {clients.map((c, i) => (
                              <div key={i} className="p-4 flex justify-between items-center">
                                  <div><p className="font-black text-xs uppercase text-slate-950">{c.nombre_comercial}</p><p className="text-[9px] font-mono font-bold text-slate-400">RUC: {c.ruc}</p></div>
                                  <p className="font-black text-primary text-xs">${c.valorVenta?.toFixed(2)}</p>
                              </div>
                          ))}
                      </div></CardContent>
                  </Card>
              ))}
          </div>
      </div>
      {canApprove && (
          <div className="flex justify-end gap-3 p-6 bg-white border-t sticky bottom-0 z-10 shadow-2xl">
              <Button variant="destructive" onClick={() => setIsRejectDialogOpen(true)} className="font-black uppercase">Rechazar Plan</Button>
              <Button onClick={handleApprove} className="bg-green-600 hover:bg-green-700 font-black text-white px-10 shadow-lg"><ShieldCheck className="mr-2" /> APROBAR PLAN</Button>
          </div>
      )}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}><DialogContent className="rounded-3xl"><DialogHeader><DialogTitle className="font-black uppercase text-red-600">Rechazar Plan</DialogTitle><DialogDescription className="font-bold text-xs uppercase">Indica el motivo técnico del rechazo.</DialogDescription></DialogHeader><div className="py-4"><Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} placeholder="Ej: Ajustar valores de venta..." className="h-32 border-2" /></div><DialogFooter><Button variant="ghost" onClick={() => setIsRejectDialogOpen(false)} className="font-black">CANCELAR</Button><Button variant="destructive" onClick={handleReject} disabled={!rejectionReason.trim()} className="font-black uppercase shadow-xl">ENVIAR RECHAZO</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
