
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Clock, Calendar, Power, Save, LoaderCircle, History, ShieldCheck, AlertCircle, Timer, Activity, Zap, Server, CheckCircle2, Wifi, Copy, ExternalLink, Terminal } from 'lucide-react';
import { format, differenceInMinutes, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

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
  const { user, clients } = useAuth();
  const { toast } = useToast();
  const [config, setCronConfig] = useState<CronConfig | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllData = async () => {
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

  useEffect(() => {
    fetchAllData();
  }, []);

  const systemHealth = useMemo(() => {
    if (logs.length === 0) return { status: 'Unknown', color: 'text-slate-400', label: 'Sin Datos', diff: 0 };
    
    const lastLog = logs[0];
    const lastDate = lastLog.timestamp instanceof Date ? lastLog.timestamp : new Date(lastLog.timestamp);
    
    if (!isValid(lastDate)) return { status: 'Error', color: 'text-red-500', label: 'Error de Fecha', diff: 0 };

    const diff = differenceInMinutes(new Date(), lastDate);
    
    if (diff <= 16) return { status: 'Healthy', color: 'text-green-500', label: 'Sincronizado (API Awake)', diff };
    if (diff <= 30) return { status: 'Warning', color: 'text-orange-500', label: 'API en Riesgo de Hibernación', diff };
    return { status: 'Critical', color: 'text-red-600', label: 'API Hibernada (Desconectada)', diff };
  }, [logs]);

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
      await fetchAllData();
    } catch (e) {
      toast({ title: "Error al guardar", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description: "Texto copiado al portapapeles." });
  };

  if (user?.role !== 'Administrador') {
    return <PageHeader title="Acceso Denegado" description="Solo administradores pueden gestionar los cron jobs." />;
  }

  if (loading) {
    return (
      <div className="p-20 text-center flex flex-col items-center gap-4">
        <LoaderCircle className="animate-spin h-12 w-12 text-primary" />
        <p className="font-black uppercase text-xs text-slate-950">Validando salud del sistema...</p>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Gestión de Cron Jobs" description="Controla los procesos automáticos de sincronización de IA." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* INDICADOR VISUAL DE SALUD */}
          <Card className="bg-slate-950 text-white border-none shadow-2xl overflow-hidden rounded-[2rem]">
            <CardHeader className="pb-2 border-b border-white/10">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-xs font-black uppercase flex items-center gap-2 tracking-widest">
                        <Activity className="h-4 w-4 text-primary" />
                        Status Global de Sincronización
                    </CardTitle>
                    <Badge variant="outline" className="border-white/20 text-white text-[9px] font-black uppercase">Real-Time</Badge>
                </div>
            </CardHeader>
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className={cn("h-16 w-16 rounded-full flex items-center justify-center bg-white/5 border-2", systemHealth.status === 'Healthy' ? "border-green-500/50" : "border-orange-500/50")}>
                            <Zap className={cn("h-8 w-8", systemHealth.color, systemHealth.status === 'Healthy' && "animate-pulse")} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-slate-500 tracking-tighter">Estado de API Render</p>
                            <h4 className={cn("text-lg font-black uppercase leading-tight", systemHealth.color)}>{systemHealth.label}</h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">Último Sync: {systemHealth.diff} min. ago</p>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
                            <span>Frecuencia de Sync</span>
                            <span>{config?.refreshIntervalMinutes} min</span>
                        </div>
                        <Progress value={Math.min(100, (14 / (config?.refreshIntervalMinutes || 14)) * 100)} className="h-1.5 bg-white/10" />
                    </div>
                </div>

                <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-4">
                    <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-blue-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Conectividad Firestore</span>
                    </div>
                    <div className="flex justify-between items-end">
                        <div className="space-y-1">
                            <p className="text-2xl font-black text-white">{clients.length}</p>
                            <p className="text-[8px] font-black uppercase text-slate-500">Documentos Activos</p>
                        </div>
                        <div className="text-right">
                            <Badge className="bg-green-600 font-black text-[9px] uppercase border-none">Online</Badge>
                        </div>
                    </div>
                    <Progress value={(clients.length / 10000) * 100} className="h-1 bg-white/5" />
                </div>
            </CardContent>
          </Card>

          {/* INSTRUCCIONES TÉCNICAS PARA EL USUARIO */}
          <Card className="border-2 border-primary/20 shadow-xl rounded-2xl overflow-hidden bg-slate-50">
            <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="text-sm font-black uppercase flex items-center gap-2 text-primary">
                    <Terminal className="h-4 w-4" />
                    Configuración del Disparador Externo
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase text-slate-500">
                    Copia estos datos en tu servicio de Cron (ej. cron-job.org) para evitar la hibernación.
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-slate-500">URL del Endpoint (Configurar cada 10-14 min)</Label>
                    <div className="flex gap-2">
                        <Input 
                            readOnly 
                            value={`${window.location.origin}/api/cron/refresh`} 
                            className="font-mono text-[10px] bg-white border-2" 
                        />
                        <Button size="icon" variant="outline" onClick={() => copyToClipboard(`${window.location.origin}/api/cron/refresh`)}>
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="text-[9px] font-black uppercase text-slate-500">Cabecera de Autorización (Header)</Label>
                    <div className="p-3 bg-slate-900 rounded-lg font-mono text-[10px] text-green-400 border-l-4 border-green-500 flex justify-between items-center">
                        <span>Authorization: Bearer [TU_SECRETO]</span>
                        <Badge variant="outline" className="text-green-400 border-green-400 text-[8px]">Header Requerido</Badge>
                    </div>
                </div>
                <div className="pt-2">
                    <Button variant="link" asChild className="p-0 h-auto text-[10px] font-black uppercase text-primary">
                        <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                            Ir a Cron-Job.org (Recomendado)
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </Button>
                </div>
            </CardContent>
          </Card>

          <Card className="shadow-xl border-t-4 border-t-primary rounded-2xl overflow-hidden">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-black uppercase text-slate-950 text-base">
                <Power className={config?.enabled ? "text-green-600" : "text-destructive"} />
                Configuración del Barrido Interno
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border-2 border-slate-100">
                <div className="space-y-0.5">
                  <Label className="text-sm font-black uppercase text-slate-950">Sincronización Maestra</Label>
                  <p className="text-[10px] font-black text-muted-foreground uppercase">Habilita pings automáticos y cierres de ruta semanales.</p>
                </div>
                <Switch checked={config?.enabled} onCheckedChange={(val) => setCronConfig(prev => prev ? { ...prev, enabled: val } : null)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 space-y-3">
                      <div className="flex items-center gap-2">
                          <Timer className="h-4 w-4 text-primary" />
                          <Label className="text-xs font-black uppercase text-slate-950">Frecuencia de Sync</Label>
                      </div>
                      <div className="flex items-center gap-2">
                          <Input 
                              type="number" 
                              min="5" 
                              max="14"
                              value={config?.refreshIntervalMinutes || 14} 
                              onChange={(e) => setCronConfig(prev => prev ? { ...prev, refreshIntervalMinutes: parseInt(e.target.value) || 14 } : null)}
                              className="font-black text-center h-10 border-2 text-primary text-lg"
                          />
                          <span className="text-[10px] font-black uppercase text-slate-500">Minutos</span>
                      </div>
                      <Alert className="py-2 px-3 bg-blue-50 border-blue-200">
                        <Zap className="h-3 w-3 text-blue-600" />
                        <AlertDescription className="text-[9px] font-bold text-blue-800 uppercase italic">CRÍTICO: NO EXCEDER 14 MIN PARA EVITAR SUSPENSIÓN DE RENDER.</AlertDescription>
                      </Alert>
                  </div>

                  <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border-2 border-slate-100 h-full">
                      <div className="space-y-0.5">
                          <Label className="text-xs font-black uppercase text-slate-950">Operación 24h</Label>
                          <p className="text-[10px] font-black text-muted-foreground uppercase">Ignorar horario laboral para sincronización.</p>
                      </div>
                      <Switch checked={config?.active24h} onCheckedChange={(val) => setCronConfig(prev => prev ? { ...prev, active24h: val } : null)} />
                  </div>
              </div>

              <div className="space-y-4">
                <Label className="text-xs font-black uppercase text-slate-950 tracking-widest flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Días de Actividad Programada
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {DAYS.map((day) => (
                    <div key={day.id} className="flex items-center space-x-2 p-3 rounded-xl border-2 border-slate-100 hover:border-primary/20 transition-colors bg-white">
                      <Checkbox 
                        id={`day-${day.id}`} 
                        checked={config?.scheduledDays?.includes(day.id)} 
                        onCheckedChange={() => handleToggleDay(day.id)}
                      />
                      <Label htmlFor={`day-${day.id}`} className="text-[11px] font-black uppercase cursor-pointer flex-1 text-slate-950">{day.label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-slate-50 p-6 rounded-b-xl flex justify-end">
              <Button onClick={handleSave} disabled={isSaving || !config} className="font-black px-12 h-12 shadow-lg uppercase text-xs tracking-tighter">
                {isSaving ? <LoaderCircle className="animate-spin mr-2" /> : <Save className="mr-2" />}
                Guardar y Validar Programación
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-lg border-t-4 border-t-primary rounded-2xl">
            <CardHeader className="pb-4">
              <CardTitle className="text-xs font-black uppercase flex items-center gap-2 text-slate-950">
                <History className="h-4 w-4 text-primary" />
                Historial de Barridos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {logs.slice(0, 8).map((log) => {
                    const logDate = log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp);
                    return (
                        <div key={log.id} className="p-4 rounded-xl border-2 border-slate-100 hover:bg-slate-50 transition-colors">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex gap-1.5">
                                    <Badge variant="success" className="text-[8px] font-black uppercase border-none bg-green-100 text-green-700 h-4">OK</Badge>
                                    {(log as any).keepAlive && (
                                        <Badge className="text-[8px] font-black uppercase bg-blue-600 text-white h-4 flex items-center gap-1">
                                            <Wifi className="h-2 w-2" /> Keep-Alive
                                        </Badge>
                                    )}
                                </div>
                                <span className="text-[9px] font-mono text-slate-950 font-black">
                                    {isValid(logDate) ? format(logDate, 'dd/MM HH:mm') : '--:--'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <p className="text-[10px] font-black uppercase text-slate-950">Procesados: <span className="text-primary">{log.processed}</span> Ejecutivos</p>
                                <CheckCircle2 className="h-3 w-3 text-green-600" />
                            </div>
                        </div>
                    );
                })}
                {logs.length === 0 && (
                  <div className="text-center py-10 flex flex-col items-center gap-3 opacity-30">
                      <Clock className="h-8 w-8" />
                      <p className="text-[10px] font-black uppercase text-muted-foreground">Sin registros de ejecución</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Alert className="border-amber-600 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800 font-black uppercase text-[10px]">Importante</AlertTitle>
            <AlertDescription className="text-amber-700 font-bold text-[9px] uppercase leading-tight">
              Asegúrate de que tu servicio de Cron externo esté configurado para llamar a /api/cron/refresh con el token de autorización Bearer correspondiente. La API de Render hibernerá si no recibe una llamada en menos de 15 minutos.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </>
  );
}
