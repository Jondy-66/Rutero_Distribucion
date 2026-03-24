'use client';

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { getSystemLogs } from '@/lib/firebase/firestore';
import type { SystemLog } from '@/lib/types';
import { Database, Activity, Server, Clock, CheckCircle2, AlertCircle, RefreshCw, LoaderCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

export default function SystemUsagePage() {
  const { user, clients, users, routes, phoneContacts, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const data = await getSystemLogs();
      setLogs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchLogs();
    setIsRefreshing(false);
  };

  const firestoreStats = useMemo(() => {
    return [
      { label: 'Clientes', count: clients.length, limit: 10000, color: 'bg-blue-500' },
      { label: 'Usuarios', count: users.length, limit: 1000, color: 'bg-green-500' },
      { label: 'Rutas', count: routes.length, limit: 5000, color: 'bg-purple-500' },
      { label: 'Contactos CRM', count: phoneContacts.length, limit: 20000, color: 'bg-orange-500' },
    ];
  }, [clients, users, routes, phoneContacts]);

  if (user?.role !== 'Administrador' && user?.role !== 'Auditor') {
    return <PageHeader title="Acceso Restringido" description="Solo administradores y auditores pueden ver esta página." />;
  }

  return (
    <>
      <PageHeader title="Uso del Sistema & Cuotas" description="Monitoreo de actividad, base de datos y procesos automáticos.">
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing || loadingLogs}>
          {isRefreshing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Actualizar
        </Button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {firestoreStats.map((stat) => (
          <Card key={stat.label} className="shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-black uppercase text-slate-950">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-slate-950 mb-2">{stat.count.toLocaleString()}</div>
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-black uppercase text-slate-950">
                  <span>Capacidad Estimada</span>
                  <span>{((stat.count / stat.limit) * 100).toFixed(1)}%</span>
                </div>
                <Progress value={(stat.count / stat.limit) * 100} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 shadow-lg border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-black text-slate-950 uppercase tracking-tighter">
              <Activity className="h-5 w-5 text-primary" />
              Logs de Auditoría
            </CardTitle>
            <CardDescription className="text-slate-950 font-bold uppercase text-[10px]">Eventos registrados por el servidor.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-black uppercase text-[10px] text-slate-950">Evento</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-950">Fecha / Hora</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-950">Registros</TableHead>
                    <TableHead className="font-black uppercase text-[10px] text-slate-950">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingLogs ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : logs.length > 0 ? (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-black text-xs text-slate-950 uppercase">{log.type}</TableCell>
                        <TableCell className="text-xs font-black text-slate-950">{format(log.timestamp, 'dd/MM/yyyy HH:mm:ss', { locale: es })}</TableCell>
                        <TableCell className="font-black text-xs text-slate-950">{log.processed}</TableCell>
                        <TableCell>
                          <Badge variant="success" className="text-[9px] font-black uppercase border-none bg-green-100 text-green-700">
                            <CheckCircle2 className="mr-1 h-3 w-3" /> Exitoso
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-24 text-slate-950 font-black uppercase text-[10px]">Sin registros recientes.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-black text-slate-950 uppercase">
                <Server className="h-5 w-5 text-primary" />
                Infraestructura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl border border-green-100">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-green-600" />
                  <span className="text-xs font-black text-green-800 uppercase">Firestore DB</span>
                </div>
                <Badge className="bg-green-600 font-black border-none text-white">ONLINE</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <span className="text-xs font-black text-blue-800 uppercase">AI Predictions</span>
                </div>
                <Badge className="bg-blue-600 font-black border-none text-white">READY</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-orange-600" />
                  <span className="text-xs font-black text-orange-700 uppercase">Cron Jobs</span>
                </div>
                <span className="text-[10px] font-black text-orange-700">ACTIVO (24H)</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg bg-slate-950 text-white border-none">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-400" />
                Aviso de Cuotas
              </CardTitle>
            </CardHeader>
            <CardContent className="text-[10px] font-black text-slate-300 leading-relaxed uppercase">
              LA APLICACIÓN OPERA BAJO LÍMITES OPERATIVOS DE GOOGLE CLOUD. LAS IMPORTACIONES MASIVAS (MÁS DE 500 REGISTROS) DEBEN REALIZARSE EN HORARIOS DE BAJO TRÁFICO.
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
