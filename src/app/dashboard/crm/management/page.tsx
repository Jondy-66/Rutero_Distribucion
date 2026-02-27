
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Phone, Clock, Save, X, PhoneCall, CheckCircle, Ban, History, User } from 'lucide-react';
import { getMyCustomers, addCrmCall, updateCustomerMetrics } from '@/lib/firebase/firestore';
import type { Customer, CrmCall } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

function CrmManagementContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const customerId = searchParams.get('customerId');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Estados de la llamada
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'logging'>('idle');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [outcome, setOutcome] = useState<'sold' | 'no_answer' | 'callback'>('no_answer');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user && customerId) {
      getMyCustomers(user.id).then(data => {
        const found = data.find(c => c.id === customerId);
        setCustomer(found || null);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [user, customerId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === 'calling') {
      interval = setInterval(() => {
        setDuration(Math.floor((Date.now() - (startTime || 0)) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus, startTime]);

  const handleStartCall = () => {
    setStartTime(Date.now());
    setCallStatus('calling');
    setDuration(0);
  };

  const handleEndCall = () => {
    setCallStatus('logging');
  };

  const handleSaveCall = async () => {
    if (!customer || !user) return;
    setIsSaving(true);
    
    try {
      // Regla de Negocio: Calcular próxima fecha de llamada por Tier
      let daysToAdd = 60; // Bajo
      if (customer.tier === 'VIP') daysToAdd = 15;
      else if (customer.tier === 'Medio') daysToAdd = 30;
      
      const nextCallDate = addDays(new Date(), daysToAdd);

      const callData: Omit<CrmCall, 'id'> = {
        customer_id: customer.id,
        agent_id: user.id,
        duration: Math.floor(duration / 60),
        outcome,
        timestamp: new Date(),
        notes
      };

      await addCrmCall(callData);
      await updateCustomerMetrics(customer.id, { next_call_date: nextCallDate });
      
      toast({ title: "Gestión Guardada", description: `Próxima llamada programada en ${daysToAdd} días.` });
      router.push('/dashboard/crm/prediction');
    } catch (e) {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-8">Cargando cliente...</div>;
  if (!customer && customerId) return <div className="p-8">Cliente no encontrado.</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1 border-t-4 border-t-primary shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-4 mb-2">
            <div className="bg-primary/10 p-3 rounded-full"><User className="h-6 w-6 text-primary" /></div>
            <div>
              <CardTitle className="uppercase text-lg font-black">{customer?.name || "Sin selección"}</CardTitle>
              <Badge variant="outline" className="text-[10px] font-mono mt-1">{customer?.phone || "N/A"}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-[10px] font-black uppercase text-muted-foreground">Tier</p>
              <p className="text-sm font-bold text-primary">{customer?.tier || "Normal"}</p>
            </div>
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-[10px] font-black uppercase text-muted-foreground">Frecuencia</p>
              <p className="text-sm font-bold text-primary">{customer?.purchase_frequency_days || 0} días</p>
            </div>
          </div>
          <div className="p-3 border-2 border-primary/10 rounded-xl bg-primary/5">
            <p className="text-[10px] font-black uppercase text-primary mb-1">Ticket Promedio</p>
            <p className="text-2xl font-black">${customer?.average_ticket.toFixed(2)}</p>
          </div>
        </CardContent>
        <CardFooter>
          {!customerId ? (
            <Button className="w-full font-black uppercase" onClick={() => router.push('/dashboard/crm/prediction')}>
              SELECCIONAR DE LA COLA
            </Button>
          ) : callStatus === 'idle' ? (
            <Button size="lg" className="w-full font-black text-lg h-16 rounded-2xl shadow-xl" onClick={handleStartCall}>
              <PhoneCall className="mr-3 h-6 w-6" /> INICIAR LLAMADA
            </Button>
          ) : callStatus === 'calling' ? (
            <Button size="lg" variant="destructive" className="w-full font-black text-lg h-16 rounded-2xl animate-pulse" onClick={handleEndCall}>
              <Phone className="mr-3 h-6 w-6 rotate-[135deg]" /> FINALIZAR LLAMADA
            </Button>
          ) : (
            <div className="text-center w-full">
              <Badge variant="success" className="font-black px-4 py-1 uppercase">Llamada Terminada</Badge>
            </div>
          )}
        </CardFooter>
      </Card>

      <Card className="lg:col-span-2 shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Panel de Gestión</span>
            {callStatus !== 'idle' && (
              <div className="flex items-center gap-2 text-primary font-mono text-xl font-black">
                <Clock className="h-5 w-5" />
                {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}
              </div>
            )}
          </CardTitle>
          <CardDescription>Registra los detalles de la interacción telefónica.</CardDescription>
        </CardHeader>
        <CardContent className={callStatus === 'idle' ? "opacity-20 pointer-events-none" : ""}>
          <div className="space-y-8">
            <div className="space-y-4">
              <Label className="text-sm font-black uppercase tracking-tighter">Resultado de la Gestión</Label>
              <RadioGroup value={outcome} onValueChange={(v: any) => setOutcome(v)} className="grid grid-cols-3 gap-4">
                <Label className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${outcome === 'sold' ? "bg-green-50 border-green-600 ring-2 ring-green-100" : "bg-muted/20 border-transparent"}`}>
                  <RadioGroupItem value="sold" className="sr-only" />
                  <CheckCircle className={`h-8 w-8 ${outcome === 'sold' ? "text-green-600" : "text-muted-foreground"}`} />
                  <span className="text-[10px] font-black uppercase">Venta</span>
                </Label>
                <Label className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${outcome === 'no_answer' ? "bg-orange-50 border-orange-600 ring-2 ring-orange-100" : "bg-muted/20 border-transparent"}`}>
                  <RadioGroupItem value="no_answer" className="sr-only" />
                  <Ban className={`h-8 w-8 ${outcome === 'no_answer' ? "text-orange-600" : "text-muted-foreground"}`} />
                  <span className="text-[10px] font-black uppercase">No Contesta</span>
                </Label>
                <Label className={`flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all cursor-pointer ${outcome === 'callback' ? "bg-blue-50 border-blue-600 ring-2 ring-blue-100" : "bg-muted/20 border-transparent"}`}>
                  <RadioGroupItem value="callback" className="sr-only" />
                  <History className={`h-8 w-8 ${outcome === 'callback' ? "text-blue-600" : "text-muted-foreground"}`} />
                  <span className="text-[10px] font-black uppercase">Rellamar</span>
                </Label>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-black uppercase tracking-tighter">Observaciones</Label>
              <Textarea 
                placeholder="Escribe aquí el resumen de la conversación..." 
                className="h-32 text-base font-medium border-2 focus:border-primary"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 bg-slate-50 p-6">
          <Button variant="ghost" onClick={() => router.push('/dashboard/crm/prediction')} className="font-bold">CANCELAR</Button>
          <Button 
            className="px-10 font-black h-12 shadow-lg" 
            disabled={callStatus !== 'logging' || isSaving}
            onClick={handleSaveCall}
          >
            {isSaving ? "GUARDANDO..." : <><Save className="mr-2 h-5 w-5" /> GUARDAR GESTIÓN</>}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function CrmManagementPage() {
  return (
    <>
      <PageHeader
        title="Gestión de Llamadas"
        description="Panel activo para teleoperadores."
      />
      <Suspense fallback={<div>Cargando panel de gestión...</div>}>
        <CrmManagementContent />
      </Suspense>
    </>
  );
}
