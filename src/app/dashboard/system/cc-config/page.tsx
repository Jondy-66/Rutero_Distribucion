'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Mail, Settings, LoaderCircle, ShieldCheck, CheckCircle2, Plus, Trash2, BellRing, ClipboardCheck, XCircle } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const NOTIFICATION_EVENTS = [
    { id: 'route_staged', label: 'Nuevos Planes de Ruta', description: 'Copia cuando un vendedor envía su semana.', icon: BellRing },
    { id: 'route_approved', label: 'Aprobaciones de Ruta', description: 'Copia cuando el plan es aprobado.', icon: CheckCircle2 },
    { id: 'route_rejected', label: 'Rechazos de Ruta', description: 'Copia cuando el plan es rechazado.', icon: XCircle },
    { id: 'manual', label: 'Notificaciones Manuales', description: 'Copia de envíos desde el panel admin.', icon: ClipboardCheck },
];

export default function CcConfigPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [enabledCc, setEnabledCc] = useState(false);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [ccEvents, setCcEvents] = useState<Record<string, boolean>>({
      route_staged: true,
      route_approved: true,
      route_rejected: true,
      manual: true
  });

  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'system_config', 'notifications'));
        if (snap.exists()) {
          const data = snap.data();
          setEnabledCc(!!data.enabledCc);
          setCcEmails(data.ccEmails || (data.ccEmail ? [data.ccEmail] : []));
          setCcEvents(data.ccEvents || {
              route_staged: true,
              route_approved: true,
              route_rejected: true,
              manual: true
          });
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  const handleAddEmail = () => {
    const email = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (!email || !emailRegex.test(email)) {
        toast({ title: "Email Inválido", variant: "destructive" });
        return;
    }
    
    if (ccEmails.includes(email)) {
        toast({ title: "Email ya registrado", variant: "destructive" });
        return;
    }

    setCcEmails([...ccEmails, email]);
    setNewEmail('');
  };

  const handleRemoveEmail = (index: number) => {
    setCcEmails(ccEmails.filter((_, i) => i !== index));
  };

  const handleToggleEvent = (id: string, val: boolean) => {
      setCcEvents(prev => ({ ...prev, [id]: val }));
  };

  const handleSaveCcConfig = async () => {
    if (enabledCc && ccEmails.length === 0) {
        toast({ title: "Sin destinatarios", description: "Debes ingresar al menos un correo si la copia está activa.", variant: "destructive" });
        return;
    }

    setIsSaving(true);
    try {
        await setDoc(doc(db, 'system_config', 'notifications'), {
            enabledCc,
            ccEmails,
            ccEvents
        }, { merge: true });
        
        toast({ 
            title: "Configuración Guardada", 
            description: "La política de supervisión ha sido actualizada.",
            className: "bg-green-600 text-white font-black"
        });
    } catch (e) {
        toast({ title: "Error", description: "No se pudo guardar la configuración.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };

  if (currentUser?.role !== 'Administrador') {
      return <PageHeader title="Acceso Denegado" description="Solo administradores pueden configurar auditorías globales." />;
  }

  if (loading) {
    return (
        <div className="p-20 text-center">
            <LoaderCircle className="animate-spin h-10 w-10 text-primary mx-auto" />
            <p className="mt-4 font-black uppercase text-xs text-slate-400">Cargando protocolo...</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader 
        title="Protocolo de Auditoría (CC)" 
        description="Selecciona qué eventos deseas supervisar y a qué correos enviar las copias." 
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
            <Card className="border-t-4 border-t-orange-500 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
                <CardHeader className="bg-orange-50/50 p-8 border-b">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="bg-orange-100 p-4 rounded-[1.2rem]">
                                <Settings className="h-6 w-6 text-orange-600" />
                            </div>
                            <div>
                                <CardTitle className="text-xl font-black uppercase text-slate-900 tracking-tighter">Eventos de Supervisión</CardTitle>
                                <CardDescription className="text-[10px] font-bold uppercase text-slate-500">Activa los procesos que requieren copia automática.</CardDescription>
                            </div>
                        </div>
                        <Switch 
                            checked={enabledCc} 
                            onCheckedChange={setEnabledCc} 
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4 transition-all", !enabledCc && "opacity-40 pointer-events-none grayscale")}>
                        {NOTIFICATION_EVENTS.map((event) => (
                            <div key={event.id} className="flex items-start gap-4 p-4 rounded-2xl border-2 border-slate-100 bg-slate-50/50 hover:bg-white transition-colors group">
                                <Checkbox 
                                    id={event.id}
                                    checked={ccEvents[event.id] || false}
                                    onCheckedChange={(v) => handleToggleEvent(event.id, !!v)}
                                    className="mt-1"
                                />
                                <Label htmlFor={event.id} className="flex-1 cursor-pointer">
                                    <div className="flex items-center gap-2 mb-1">
                                        <event.icon className="h-3.5 w-3.5 text-primary" />
                                        <span className="font-black uppercase text-xs text-slate-950">{event.label}</span>
                                    </div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase leading-tight">{event.description}</p>
                                </Label>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card className={cn("border-t-4 border-t-primary shadow-2xl rounded-[2.5rem] overflow-hidden bg-white transition-all", !enabledCc && "opacity-40 pointer-events-none")}>
                <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-lg font-black uppercase text-slate-950">Lista de Destinatarios CC</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase text-slate-500">Agrega múltiples correos para recibir las alertas.</CardDescription>
                </CardHeader>
                <CardContent className="p-8 pt-0 space-y-6">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Mail className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                            <Input 
                                placeholder="auditor@farmaenlace.com"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                className="pl-12 h-14 border-2 rounded-2xl font-black text-slate-950"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                            />
                        </div>
                        <Button 
                            type="button"
                            onClick={handleAddEmail} 
                            className="h-14 w-14 rounded-2xl shadow-lg"
                        >
                            <Plus className="h-6 w-6" />
                        </Button>
                    </div>

                    <div className="space-y-3">
                        {ccEmails.map((email, idx) => (
                            <div key={idx} className="flex items-center justify-between p-4 bg-primary/5 border-2 border-primary/10 rounded-2xl group animate-in slide-in-from-left-2">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center font-black text-[10px] text-white uppercase">
                                        {email.charAt(0)}
                                    </div>
                                    <span className="font-black text-slate-950 text-sm">{email}</span>
                                </div>
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    onClick={() => handleRemoveEmail(idx)}
                                    className="text-red-500 hover:bg-red-50 rounded-xl"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        {ccEmails.length === 0 && (
                            <div className="text-center py-10 border-2 border-dashed rounded-[2rem] opacity-30">
                                <Mail className="h-10 w-10 mx-auto mb-2" />
                                <p className="text-[10px] font-black uppercase">Sin correos configurados</p>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="bg-slate-50 p-8 flex justify-end">
                    <Button 
                        onClick={handleSaveCcConfig} 
                        disabled={isSaving}
                        className="font-black px-12 h-14 rounded-2xl shadow-xl uppercase transition-all hover:scale-[1.02]"
                    >
                        {isSaving ? <LoaderCircle className="animate-spin mr-2 h-5 w-5" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
                        ACTUALIZAR PROTOCOLO CC
                    </Button>
                </CardFooter>
            </Card>
        </div>

        <div className="space-y-6">
            <Card className="bg-slate-950 text-white border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-8 pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        <CardTitle className="text-xs font-black uppercase text-slate-300 tracking-widest">Información Técnica</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="flex gap-4">
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><CheckCircle2 className="h-4 w-4 text-primary" /></div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">Las copias automáticas se envían de forma simultánea a todos los destinatarios configurados.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><CheckCircle2 className="h-4 w-4 text-primary" /></div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">Si desactivas un check (ej: Aprobaciones), esas notificaciones ya no generarán copias automáticas.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><CheckCircle2 className="h-4 w-4 text-primary" /></div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">El sistema valida que los correos tengan un formato corporativo válido antes de enviarlos.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
