
'use client';

import { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Briefcase, Route, Users, BarChart, Clock } from 'lucide-react';
import {
  Bar,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { isToday } from 'date-fns';

const data = [
  { name: 'Lun', routes: 4, sales: 2400 },
  { name: 'Mar', routes: 3, sales: 1398 },
  { name: 'Mié', routes: 5, sales: 9800 },
  { name: 'Jue', routes: 2, sales: 3908 },
  { name: 'Vie', routes: 6, sales: 4800 },
  { name: 'Sáb', routes: 1, sales: 3800 },
];


export default function DashboardPage() {
  const { user, clients, users, routes, loading } = useAuth();
  
  const clientCount = useMemo(() => {
    if (user?.role === 'Usuario') {
      return clients.filter(client => client.ejecutivo === user.name).length;
    }
    return clients.length;
  }, [clients, user]);

  const userCount = useMemo(() => users.length, [users]);

  const canSeeUserCount = user?.role === 'Administrador' || user?.role === 'Supervisor';

  const activeRoute = useMemo(() => {
    return routes.find(r => r.createdBy === user?.id && r.status === 'En Progreso' && r.date && isToday(r.date));
  }, [routes, user]);

  const [remainingTime, setRemainingTime] = useState({ hours: 0, minutes: 0, seconds: 0, expired: false });
  
  useEffect(() => {
    if (!activeRoute) return;

    const interval = setInterval(() => {
      const now = new Date();
      const expirationDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0); // 18:00 del día de hoy
      const diff = expirationDate.getTime() - now.getTime();

      if (diff <= 0) {
        setRemainingTime({ hours: 0, minutes: 0, seconds: 0, expired: true });
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setRemainingTime({ hours, minutes, seconds, expired: false });

    }, 1000);

    return () => clearInterval(interval);

  }, [activeRoute]);


  const activeClientsInRoute = useMemo(() => {
      if (!activeRoute) return [];
      return activeRoute.clients.filter(c => c.status !== 'Eliminado');
  }, [activeRoute]);


  const progress = useMemo(() => {
    if (!activeRoute) return 0;
    const completedClients = activeClientsInRoute.filter(c => c.visitStatus === 'Completado').length;
    const totalClients = activeClientsInRoute.length;
    if (totalClients === 0) return 0;
    return (completedClients / totalClients) * 100;
  }, [activeRoute, activeClientsInRoute]);

  const completedCount = useMemo(() => {
      if (!activeRoute) return 0;
      return activeClientsInRoute.filter(c => c.visitStatus === 'Completado').length;
  }, [activeRoute, activeClientsInRoute]);


  return (
    <>
      <PageHeader title="Panel de Control" description="Aquí tienes un resumen de tus operaciones." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Totales</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{clientCount}</div>}
            <p className="text-xs text-muted-foreground">
              {user?.role === 'Usuario' ? 'Clientes asignados a ti' : 'Clientes registrados en el sistema'}
            </p>
          </CardContent>
        </Card>
        {activeRoute ? (
            <>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium truncate" title={activeRoute.routeName}>Ruta en Progreso</CardTitle>
                    <Route className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{completedCount} de {activeClientsInRoute.length}</div>
                    <p className="text-xs text-muted-foreground mb-2">clientes gestionados</p>
                    <Progress value={progress} aria-label={`${progress.toFixed(0)}% completado`} />
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tiempo Restante</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                   <div className={cn("text-2xl font-bold", remainingTime.expired && "text-destructive")}>
                       {remainingTime.expired 
                           ? "Expirado" 
                           : `${String(remainingTime.hours).padStart(2, '0')}:${String(remainingTime.minutes).padStart(2, '0')}:${String(remainingTime.seconds).padStart(2, '0')}`
                       }
                   </div>
                   <p className="text-xs text-muted-foreground">Para finalizar la ruta de hoy (18:00)</p>
                </CardContent>
            </Card>
            </>
        ) : (
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rutas Planificadas</CardTitle>
                <Route className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{routes.filter(r => r.status === 'Planificada' && r.createdBy === user?.id).length}</div>}
                <p className="text-xs text-muted-foreground">Rutas listas para iniciar</p>
              </CardContent>
            </Card>
        )}
        {canSeeUserCount && !activeRoute && ( // Ocultamos si hay ruta activa para dar espacio
            <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuarios Activos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-8 w-1/2" /> : <div className="text-2xl font-bold">{userCount}</div>}
                <p className="text-xs text-muted-foreground">Usuarios en el sistema</p>
            </CardContent>
            </Card>
        )}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rendimiento</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Bueno</div>
            <p className="text-xs text-muted-foreground">Cumpliendo todos los objetivos</p>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Actividad Semanal</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <RechartsBarChart data={data}>
                <XAxis
                  dataKey="name"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `$${value/1000}k`}
                />
                <Tooltip 
                  cursor={{fill: 'hsl(var(--accent)/0.1)'}}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)'
                  }}
                />
                <Legend />
                <Bar dataKey="sales" fill="hsl(var(--primary))" name="Ventas" radius={[4, 4, 0, 0]} />
                <Bar dataKey="routes" fill="hsl(var(--accent))" name="Rutas" radius={[4, 4, 0, 0]} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
