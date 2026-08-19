
'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { Send, LoaderCircle, Users, Mail, Bell, ShieldAlert, Settings, Copy, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export default function ManualNotificationsPage() {
  const { users, user: currentUser } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [targetType, setType] = useState<'user' | 'external'>('user');
  
  // Estado para envío manual
  const [formData, setFormData] = useState({
    to: '',
    subject: '',
    title: '',
    message: '',
    details: '',
    type: 'info' as 'info' | 'success' | 'alert',
    cc: ''
  });

  // Estado para configuración de copia automática
  const [ccConfig, setCcConfig] = useState({
    enabledCc: false,
    ccEmail: ''
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      const snap = await getDoc(doc(db, 'system_config', 'notifications'));
      if (snap.exists()) {
        const data = snap.data();
        setCcConfig({
            enabledCc: !!data.enabledCc,
            ccEmail: data.ccEmail || ''
        });
      }
    };
    fetchConfig();
  }, []);

  const handleSaveCcConfig = async () => {
    setIsSavingConfig(true);
    try {
        await setDoc(doc(db, 'system_config', 'notifications'), ccConfig, { merge: true });
        toast({ title: "Configuración Guardada", description: "La copia automática ha sido actualizada." });
    } catch (e) {
        toast({ title: "Error", description: "No se pudo guardar la configuración.", variant: "destructive" });
    } finally {
        setIsSavingConfig(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.to || !formData.subject || !formData.message) {
      toast({ title: "Campos Requeridos", description: "Completa el destinatario, asunto y mensaje.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        toast({ title: "Enviado", description: "La notificación ha sido entregada con éxito.", className: "bg-green-600 text-white font-black" });
        setFormData({ ...formData, subject: '', title: '', message: '', details: '', cc: '' });
      } else {
        throw new Error(result.message);
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    const selected = users.find(u => u.id === userId);
    if (selected) {
      setFormData({ ...formData, to: selected.email.toLowerCase() });
    }
  };

  if (currentUser?.role !== 'Administrador') {
      return <PageHeader title="Acceso Denegado" description="Solo administradores pueden realizar envíos." />;
  }

  return (
    <div className="flex flex-col gap-8 pb-10">
      <PageHeader 
        title="Enviar Notificación" 
        description="Gestión de comunicados y configuración de copias automáticas." 
      />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* COLUMNA IZQUIERDA: FORMULARIO DE ENVÍO */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSendNotification}>
            <Card className="border-t-4 border-t-primary shadow-2xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="bg-slate-50 border-b p-8">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-4 rounded-[1.2rem]">
                        <Bell className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <CardTitle className="font-black uppercase text-slate-950 text-xl tracking-tighter">Comunicado Oficial</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase text-slate-500">Configura el alcance y contenido del mensaje directo.</CardDescription>
                    </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-8 p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label className="font-black text-[10px] uppercase text-slate-500 tracking-widest pl-1">Tipo de Destinatario</Label>
                        <Select value={targetType} onValueChange={(v: any) => { setType(v); setFormData({...formData, to: ''}); }}>
                            <SelectTrigger className="h-12 border-2 font-black rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="user" className="font-black">Usuario del Sistema</SelectItem>
                                <SelectItem value="external" className="font-black">Correo Externo</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label className="font-black text-[10px] uppercase text-slate-500 tracking-widest pl-1">Prioridad Visual</Label>
                        <Select value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}>
                            <SelectTrigger className="h-12 border-2 font-black rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="info" className="font-black">Informativo (Azul)</SelectItem>
                                <SelectItem value="success" className="font-black">Éxito (Verde)</SelectItem>
                                <SelectItem value="alert" className="font-black">Alerta/Urgente (Rojo)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="to" className="font-black text-[10px] uppercase text-slate-500 tracking-widest pl-1">Destinatario Principal</Label>
                  {targetType === 'user' ? (
                      <Select onValueChange={handleUserSelect}>
                          <SelectTrigger className="h-12 border-2 font-black text-slate-950 rounded-xl">
                              <Users className="mr-2 h-4 w-4 text-primary" />
                              <SelectValue placeholder="Seleccionar usuario..." />
                          </SelectTrigger>
                          <SelectContent>
                              {users.map(u => (
                                  <SelectItem key={u.id} value={u.id} className="font-black">{u.name} ({u.role})</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  ) : (
                    <Input 
                      id="to" 
                      placeholder="correo@ejemplo.com" 
                      value={formData.to}
                      onChange={(e) => setFormData({ ...formData, to: e.target.value.toLowerCase() })}
                      className="font-black border-2 h-12 rounded-xl text-slate-950"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cc" className="font-black text-[10px] uppercase text-slate-500 tracking-widest pl-1">Enviar Copia a (CC) - Opcional</Label>
                  <Input 
                    id="cc" 
                    placeholder="Otro correo a informar..." 
                    value={formData.cc}
                    onChange={(e) => setFormData({ ...formData, cc: e.target.value.toLowerCase() })}
                    className="font-black border-2 h-12 rounded-xl text-slate-950"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="subject" className="font-black text-[10px] uppercase text-slate-500 tracking-widest pl-1">Asunto del Correo (Subject)</Label>
                  <Input 
                    id="subject" 
                    required 
                    placeholder="Ej: Mantenimiento Programado del Sistema"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="font-black border-2 h-12 rounded-xl text-slate-950"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title" className="font-black text-[10px] uppercase text-slate-500 tracking-widest pl-1">Título Interno del Mensaje</Label>
                  <Input 
                    id="title" 
                    placeholder="Ej: Atención: Actualización Crítica"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="font-black border-2 h-12 rounded-xl text-slate-950"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message" className="font-black text-[10px] uppercase text-slate-500 tracking-widest pl-1">Cuerpo del Mensaje</Label>
                  <Textarea 
                    id="message" 
                    required 
                    rows={4}
                    placeholder="Describe el motivo de la notificación..."
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="font-black border-2 rounded-2xl text-slate-950 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="details" className="font-black text-[10px] uppercase text-slate-500 tracking-widest pl-1">Cuadro de Detalles (Opcional)</Label>
                  <Textarea 
                    id="details" 
                    placeholder="Información técnica o resaltada..."
                    value={formData.details}
                    onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                    className="font-black border-2 rounded-2xl text-slate-950 text-sm bg-slate-50"
                  />
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 p-8 flex justify-end">
                <Button 
                    type="submit" 
                    disabled={loading} 
                    className="font-black px-12 h-14 rounded-2xl shadow-xl uppercase transition-all hover:scale-[1.02] tracking-tighter"
                >
                  {loading ? <LoaderCircle className="animate-spin mr-2 h-5 w-5" /> : <Send className="mr-2 h-5 w-5" />}
                  DESPACHAR NOTIFICACIÓN
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>

        {/* COLUMNA DERECHA: CONFIGURACIÓN DE COPIA AUTOMÁTICA */}
        <div className="space-y-8">
            <Card className="border-t-4 border-t-orange-500 shadow-xl rounded-[2rem] overflow-hidden bg-white">
                <CardHeader className="bg-orange-50/50 pb-6 border-b">
                    <div className="flex items-center gap-3">
                        <Settings className="h-5 w-5 text-orange-600" />
                        <CardTitle className="text-sm font-black uppercase text-slate-900 tracking-tight">Copia Automática (CC)</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="pt-8 space-y-6">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                        <div className="space-y-0.5">
                            <Label className="text-xs font-black uppercase text-slate-950">Activar Copia</Label>
                            <p className="text-[9px] font-bold text-slate-400 uppercase leading-none">Copia oculta a un auditor/admin.</p>
                        </div>
                        <Switch 
                            checked={ccConfig.enabledCc} 
                            onCheckedChange={(val) => setCcConfig({...ccConfig, enabledCc: val})} 
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="font-black text-[10px] uppercase text-slate-500 tracking-widest pl-1">Correo de Supervisión Global</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="auditoria@farmaenlace.com"
                                value={ccConfig.ccEmail}
                                onChange={(e) => setCcConfig({...ccConfig, ccEmail: e.target.value.toLowerCase()})}
                                className="pl-10 h-11 border-2 rounded-xl font-black text-slate-950"
                                disabled={!ccConfig.enabledCc}
                            />
                        </div>
                        <p className="text-[8px] font-bold text-slate-400 uppercase pl-1 leading-relaxed">
                            ESTE CORREO RECIBIRÁ UNA COPIA DE <span className="text-orange-600">TODOS</span> LOS CORREOS (APROBACIONES, RECHAZOS Y MANUALES).
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="bg-slate-50 p-6">
                    <Button 
                        onClick={handleSaveCcConfig} 
                        disabled={isSavingConfig}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black h-11 rounded-xl shadow-lg uppercase text-[10px]"
                    >
                        {isSavingConfig ? <LoaderCircle className="animate-spin mr-2 h-4 w-4" /> : <Settings className="mr-2 h-4 w-4" />}
                        Guardar Configuración
                    </Button>
                </CardFooter>
            </Card>

            <Card className="bg-slate-950 text-white border-none shadow-2xl rounded-[2rem] overflow-hidden">
                <CardHeader className="pb-4 border-b border-white/10">
                    <div className="flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5 text-primary" />
                        <CardTitle className="text-xs font-black uppercase text-slate-300 tracking-widest">Protocolo de Notificación</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <div className="flex gap-3">
                        <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><CheckCircle2 className="h-3 w-3 text-primary" /></div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">Las notificaciones automáticas están ligadas al flujo de aprobación de rutas.</p>
                    </div>
                    <div className="flex gap-3">
                        <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><CheckCircle2 className="h-3 w-3 text-primary" /></div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase leading-relaxed">Los correos son enviados desde el servidor seguro para evitar bloqueos de SPAM.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>
    </div>
  );
}
