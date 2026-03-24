
'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { getCronConfig, updateCronConfig, getSystemLogs } from '@/lib/firebase/firestore';
import type { CronConfig, SystemLog } from '@/lib/types';
import { Clock, Calendar, Power, Save, RefreshCw, LoaderCircle, History, Activity, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [configData, logsData] = await Promise.all([
          getCronConfig(),
          getSystemLogs()
        ]);
        setCronConfig(configData);
        setLogs(logsData.filter(l => l.type === 'CRON_REFRESH'));
      } catch (e) {
        console.error(e);
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

  if (loading || !config) return <div className="p-20 text-center"><LoaderCircle className="animate-spin mx-auto" /></div>;

  return (
    <>
      <PageHeader title="Gestión de Cron Jobs" description="Controla los procesos automáticos de sincronización de IA." />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-xl border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-black uppercase text-slate-950">
              <Power className={config.enabled ? "text-green-600" : "text-destructive"} />
              Configuración de Ejecución
            </CardTitle>
            <CardDescription className="font-bold text-[10px] uppercase text-slate-950">Define cuándo y cómo debe activarse el refresco de datos.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border-2 border-slate-100">
              <div className="space-y-0.5">
                <Label className="text-sm font-black uppercase text-slate-950">Estado Maestro</Label>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Habilita o deshabilita todos los procesos automáticos.</p>
              </div>
              <Switch checked={config.enabled} onCheckedChange={(val) => setCronConfig({ ...config, enabled: val })} />
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border-2 border-slate-100">
              <div className="space-y-0.5">
                <Label className="text-sm font-black uppercase text-slate-950">Modo 24 Horas</Label>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Mantiene el servicio activo de forma continua sin importar el horario.</p>
              </div>
              <Switch checked={config.active24h} onCheckedChange={(val) => setCronConfig({ ...config, active24h: val })} />
            </div>

            <div className="space-y-4">
              <Label className="text-xs font-black uppercase text-slate-950 tracking-widest flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Días de Operación
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DAYS.map((day) => (
                  <div key={day.id} className="flex items-center space-x-2 p-3 rounded-xl border-2 border-slate-100 hover:border-primary/20 transition-colors">
                    <Checkbox 
                      id={`day-${day.id}`} 
                      checked={config.scheduledDays.includes(day.id)} 
                      onCheckedChange={() => handleToggleDay(day.id)}
                    />
                    <Label htmlFor={`day-${day.id}`} className="text-[11px] font-black uppercase cursor-pointer flex-1">{day.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="bg-slate-50 p-6 rounded-b-xl flex justify-end">
            <Button onClick={handleSave} disabled={isSaving} className="font-black px-10 h-12 shadow-lg">
              {isSaving ? <LoaderCircle className="animate-spin mr-2" /> : <Save className="mr-2" />}
              GUARDAR PROGRAMACIÓN
            </Button>
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-lg border-none bg-slate-950 text-white">
            <CardHeader>
              <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Seguridad Operativa
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[10px] font-bold text-slate-300 uppercase leading-relaxed">
              EL SISTEMA VALIDA ESTA CONFIGURACIÓN ANTES DE CADA LLAMADA A LA API DE RENDER. SI EL CRON NO ESTÁ PROGRAMADO PARA EL DÍA DE HOY, LA SOLICITUD SERÁ RECHAZADA POR EL SERVIDOR BFF.
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                Últimos Barridos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {logs.slice(0, 5).map((log) => (
                  <div key={log.id} className="p-3 border-b border-slate-100 last:border-0">
                    <div className="flex justify-between items-center mb-1">
                      <Badge variant="success" className="text-[8px] font-black uppercase">Exitoso</Badge>
                      <span className="text-[9px] font-mono text-muted-foreground">
                        {format(log.timestamp as Date, 'dd/MM HH:mm')}
                      </span>
                    </div>
                    <p className="text-[10px] font-black uppercase text-slate-950">
                      Procesados: {log.processed} ejecutivos
                    </p>
                  </div>
                ))}
                {logs.length === 0 && (
                  <p className="text-center py-4 text-[10px] font-bold text-muted-foreground uppercase">Sin registros recientes</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
