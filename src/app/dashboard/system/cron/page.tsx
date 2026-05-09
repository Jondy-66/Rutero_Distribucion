
'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { getCronConfig, updateCronConfig, getSystemLogs } from '@/lib/firebase/firestore';
import type { CronConfig, SystemLog } from '@/lib/types';
import { Clock, Calendar, Power, Save, LoaderCircle, History, ShieldCheck, AlertCircle, Timer, Activity, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const DAYS = [
  { id: 1, label: 'Lunes' },
  { id: 2, label: 'Martes' },
  { id: 3, label: 'Miércoles' },
  { id: 4, label: 'Jueves' },
  { id: 5, label: 'Viernes' },
  { id: 6, label: 'Sábado' },
  { id: 0, label: 'Domingo' },
];

export default function CronJobsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [config, setCronConfig] = useState<CronConfig | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [configData, logsData] = await Promise.all([
          getCronConfig(),
          getSystemLogs()
        ]);
        setCronConfig(configData);
        setLogs(logsData.filter(l => l.type === 'CRON_REFRESH'));
      } catch (e: any) {
        console.error("Error loading Cron Jobs data:", e);
        setError("No se pudieron cargar los datos del sistema. Verifica tus permisos.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleToggleDay = (dayId: number) => {
    if (!config) return;
    const current = config.scheduledDays || [];
    const next = current.includes(dayId)
      ? current.filter(d => d !== dayId)
      : [...current, dayId];
    setCronConfig({ ...config, scheduledDays: next });
  };

  const handleSave = async () => {
    if (!config) return;
    setIsSaving(true);
    try {
      await updateCronConfig(config);
      toast({ title: "Configuración Actualizada", description: "Los parámetros del cron job han sido guardados." });
    } catch (e) {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (user?.role !== 'Administrador') {
    return <PageHeader title="Acceso Denegado" description="Solo administradores pueden gestionar los cron jobs." />;
  }

  if (loading) {
    return (
      <div className="p-20 text-center flex flex-col items-center gap-4">
        <LoaderCircle className="animate-spin h-12 w-12 text-primary" />
        <p className="font-black uppercase text-xs text-slate-950">Cargando configuración del sistema...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-10 max-w-lg mx-auto">
        <Card className="border-destructive bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <AlertCircle /> ERROR DE ACCESO
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-slate-950 uppercase text-xs">{error}</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => window.location.reload()} variant="outline" className="w-full font-black">REINTENTAR</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Gestión de Cron Jobs" description="Controla los procesos automáticos de sincronización de IA." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Alert className="bg-primary/5 border-primary/20 rounded-2xl shadow-sm">
            <Zap className="h-5 w-5 text-primary" />
            <AlertTitle className="font-black uppercase text-xs">Objetivo: Anti-Hibernación de API</AlertTitle>
            <AlertDescription className="text-[10px] font-bold uppercase text-slate-600 leading-tight">
              Para evitar que la API de Render entre en modo de suspensión (hibernación), se recomienda un intervalo de <span className="text-primary font-black">14 MINUTOS</span>. Esto mantendrá el servidor activo 24/7.
            </AlertDescription>
          </Alert>

          <Card className="shadow-xl border-t-4 border-t-primary rounded-2xl overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-black uppercase text-slate-950">
                <Power className={config?.enabled ? "text-green-600" : "text-destructive"} />
                Configuración de Ejecución
              </CardTitle>
              <CardDescription className="font-black text-[10px] uppercase text-slate-950">Define cuándo y cómo debe activarse el refresco de datos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border-2 border-slate-100">
                <div className="space-y-0.5">
                  <Label className="text-sm font-black uppercase text-slate-950">Estado Maestro</Label>
                  <p className="text-[10px] font-black text-muted-foreground uppercase">Habilita o deshabilita todos los procesos automáticos.</p>
                </div>
                <Switch checked={config?.enabled} onCheckedChange={(val) => setCronConfig(prev => prev ? { ...prev, enabled: val } : null)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/20 rounded-2xl border-2 border-slate-100 space-y-3">
                      <div className="flex items-center gap-2">
                          <Timer className="h-4 w-4 text-primary" />
                          <Label className="text-sm font-black uppercase text-slate-950">Intervalo de Refresco</Label>
                      </div>
                      <div className="flex items-center gap-2">
                          <Input 
                              type="number" 
                              min="5" 
                              value={config?.refreshIntervalMinutes || 60} 
                              onChange={(e) => setCronConfig(prev => prev ? { ...prev, refreshIntervalMinutes: parseInt(e.target.value) || 60 } : null)}
                              className="font-black text-center h-10 border-2"
                          />
                          <span className="text-[10px] font-black uppercase text-slate-500">Minutos</span>
                      </div>
                      <p className="text-[9px] font-bold text-muted-foreground uppercase italic">Ideal Keep-Alive: 14 min.</p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border-2 border-slate-100">
                      <div className="space-y-0.5">
                          <Label className="text-sm font-black uppercase text-slate-950">Modo 24 Horas</Label>
                          <p className="text-[10px] font-black text-muted-foreground uppercase">Mantiene el servicio activo sin importar el horario laboral.</p>
                      </div>
                      <Switch checked={config?.active24h} onCheckedChange={(val) => setCronConfig(prev => prev ? { ...prev, active24h: val } : null)} />
                  </div>
              </div>

              <div className="space-y-4">
                <Label className="text-xs font-black uppercase text-slate-950 tracking-widest flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Días de Operación
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DAYS.map((day) => (
                    <div key={day.id} className="flex items-center space-x-2 p-3 rounded-xl border-2 border-slate-100 hover:border-primary/20 transition-colors bg-white">
                      <Checkbox 
                        id={`day-${day.id}`} 
                        checked={config?.scheduledDays?.includes(day.id)} 
                        onSelect={() => handleToggleDay(day.id)}
                        onCheckedChange={() => handleToggleDay(day.id)}
                      />
                      <Label htmlFor={`day-${day.id}`} className="text-[11px] font-black uppercase cursor-pointer flex-1 text-slate-950">{day.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 p-6 rounded-b-xl flex justify-end">
              <Button onClick={handleSave} disabled={isSaving || !config} className="font-black px-10 h-12 shadow-lg">
                {isSaving ? <LoaderCircle className="animate-spin mr-2" /> : <Save className="mr-2" />}
                GUARDAR PROGRAMACIÓN
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-lg border-none bg-slate-950 text-white rounded-2xl">
            <CardHeader>
              <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Seguridad Operativa
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[10px] font-black text-slate-300 uppercase leading-relaxed">
              EL SISTEMA VALIDA ESTA CONFIGURACIÓN ANTES DE CADA LLAMADA A LA API DE RENDER. SI EL CRON NO ESTÁ PROGRAMADO PARA EL DÍA DE HOY O SI EL INTERVALO DE TIEMPO NO SE HA CUMPLIDO, LA SOLICITUD SERÁ RECHAZADA.
            </CardContent>
          </Card>

          <Card className="shadow-lg border-t-4 border-t-primary rounded-2xl">
            <CardHeader>
              <CardTitle className="text-xs font-black uppercase flex items-center gap-2 text-slate-950">
                <History className="h-4 w-4 text-primary" />
                Últimos Barridos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {logs.slice(0, 5).map((log) => (
                  <div key={log.id} className="p-3 border-b border-slate-100 last:border-0">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex gap-1">
                        <Badge variant="success" className="text-[8px] font-black uppercase border-none bg-green-100 text-green-700">OK</Badge>
                        {(log as any).keepAlive && <Badge className="text-[8px] font-black uppercase bg-blue-600">KeepAlive</Badge>}
                      </div>
                      <span className="text-[9px] font-mono text-slate-950 font-black">
                        {log.timestamp ? format(log.timestamp as Date, 'dd/MM HH:mm') : '--/-- --:--'}
                      </span>
                    </div>
                    <p className="text-[10px] font-black uppercase text-slate-950">
                      Procesados: {log.processed} ejecutivos
                    </p>
                  </div>
                ))}
                {logs.length === 0 && (
                  <p className="text-center py-4 text-[10px] font-black text-muted-foreground uppercase">Sin registros recientes</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
