'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Mail, Settings, LoaderCircle, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function CcConfigPage() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [ccConfig, setCcConfig] = useState({
    enabledCc: false,
    ccEmail: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'system_config', 'notifications'));
        if (snap.exists()) {
          const data = snap.data();
          setCcConfig({
              enabledCc: !!data.enabledCc,
              ccEmail: data.ccEmail || ''
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

  const handleSaveCcConfig = async () => {
    if (ccConfig.enabledCc && !ccConfig.ccEmail) {
        toast({ title: "Email Requerido", description: "Debes ingresar un correo si la copia está activa.", variant: "destructive" });
        return;
    }

    setIsSaving(true);
    try {
        await setDoc(doc(db, 'system_config', 'notifications'), ccConfig, { merge: true });
        toast({ 
            title: "Configuración Guardada", 
            description: "La copia automática ha sido actualizada con éxito.",
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
            <p className="mt-4 font-black uppercase text-xs text-slate-400">Cargando configuración...</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader 
        title="Copia de Auditoría (CC)" 
        description="Configura el correo global que supervisa todas las notificaciones del sistema." 
      />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
            <Card className="border-t-4 border-t-orange-500 shadow-2xl rounded-[2.5rem] overflow-hidden bg-white">
                <CardHeader className="bg-orange-50/50 p-8 border-b">
                    <div className="flex items-center gap-4">
                        <div className="bg-orange-100 p-4 rounded-[1.2rem]">
                            <Settings className="h-6 w-6 text-orange-600" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-black uppercase text-slate-900 tracking-tighter">Supervisión Automática</CardTitle>
                            <CardDescription className="text-[10px] font-bold uppercase text-slate-500">Activa la recepción de copias de la API de Notificaciones.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-8">
                    <div className="flex items-center justify-between p-6 bg-slate-50 rounded-[1.5rem] border-2 border-slate-100">
                        <div className="space-y-1">
                            <Label className="text-sm font-black uppercase text-slate-950">Estado de la Copia (CC)</Label>
                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Habilitar auditoría externa para cada envío.</p>
                        </div>
                        <Switch 
                            checked={ccConfig.enabledCc} 
                            onCheckedChange={(val) => setCcConfig({...ccConfig, enabledCc: val})} 
                        />
                    </div>

                    <div className="space-y-3">
                        <Label className="font-black text-[10px] uppercase text-slate-500 tracking-widest pl-1">Correo de Supervisión Global</Label>
                        <div className="relative">
                            <Mail className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                            <Input 
                                placeholder="auditoria@farmaenlace.com"
                                value={ccConfig.ccEmail}
                                onChange={(e) => setCcConfig({...ccConfig, ccEmail: e.target.value.toLowerCase()})}
                                className="pl-12 h-14 border-2 rounded-2xl font-black text-slate-950 text-lg focus:ring-4 focus:ring-orange-100"
                                disabled={!ccConfig.enabledCc}
                            />
                        </div>
                        <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 mt-4">
                            <p className="text-[9px] font-black text-orange-800 uppercase leading-relaxed flex items-start gap-2">
                                <ShieldCheck className="h-3 w-3 shrink-0 mt-0.5" />
                                ESTE CORREO RECIBIRÁ UNA COPIA EXACTA DE TODOS LOS MENSAJES DISPARADOS POR LA API (APROBACIONES, RECHAZOS Y MANUALES).
                            </p>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="bg-slate-50 p-8 flex justify-end">
                    <Button 
                        onClick={handleSaveCcConfig} 
                        disabled={isSaving}
                        className="font-black px-12 h-14 rounded-2xl shadow-xl uppercase transition-all hover:scale-[1.02] bg-orange-600 hover:bg-orange-700"
                    >
                        {isSaving ? <LoaderCircle className="animate-spin mr-2 h-5 w-5" /> : <Settings className="mr-2 h-5 w-5" />}
                        GUARDAR CONFIGURACIÓN CC
                    </Button>
                </CardFooter>
            </Card>
        </div>

        <div className="space-y-6">
            <Card className="bg-slate-950 text-white border-none shadow-2xl rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-8 pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        <CardTitle className="text-xs font-black uppercase text-slate-300 tracking-widest">Protocolo de Auditoría</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="flex gap-4">
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><CheckCircle2 className="h-4 w-4 text-primary" /></div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">Las copias se envían de forma automática mediante la API Route de notificaciones.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><CheckCircle2 className="h-4 w-4 text-primary" /></div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">No es necesario reiniciar el servidor para que los cambios surtan efecto.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><CheckCircle2 className="h-4 w-4 text-primary" /></div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">Asegúrate de que el correo de auditoría sea una dirección válida y activa.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
