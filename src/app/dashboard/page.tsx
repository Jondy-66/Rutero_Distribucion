
'use client';

import { useEffect, useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Briefcase, Route, Users, BarChart, Clock, TrendingUp } from 'lucide-react';
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
import { isToday, startOfWeek, endOfWeek, eachDayOfInterval, format, getDay, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';


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
      const expirationDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 30, 0); // 20:30 del día de hoy
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

  const weeklyActivityData = useMemo(() => {
    const today = new Date();
    const start = startOfWeek(today, { weekStartsOn: 1 }); // Lunes
    const end = endOfWeek(today, { weekStartsOn: 1 });   // Domingo

    const weekDays = eachDayOfInterval({ start, end });

    const weekData = weekDays.map(day => ({
        name: format(day, 'E', { locale: es }).charAt(0).toUpperCase() + format(day, 'E', { locale: es }).slice(1,3),
        routes: 0,
        sales: 0,
    }));

    const relevantRoutes = routes.filter(route => {
        const routeDate = route.date;
        const isOwnerOrAdmin = user?.role === 'Administrador' || route.createdBy === user?.id;
        return (
            isOwnerOrAdmin &&
            route.status === 'Completada' &&
            routeDate &&
            isWithinInterval(routeDate, { start, end })
        );
    });

    relevantRoutes.forEach(route => {
        const routeDate = route.date;
        if (routeDate) {
            const dayIndex = getDay(routeDate) === 0 ? 6 : getDay(routeDate) - 1; // Lunes = 0, Domingo = 6
            if (dayIndex >= 0 && dayIndex < 7) {
                weekData[dayIndex].routes += 1;
                const totalSales = route.clients
                    .filter(c => c.visitStatus === 'Completado' && c.valorVenta)
                    .reduce((sum, c) => sum + (c.valorVenta || 0), 0);
                weekData[dayIndex].sales += totalSales;
            }
        }
    });
    
    return weekData;
  }, [routes, user]);
  
  const performanceData = useMemo(() => {
    const completedRoutes = routes.filter(r => r.status === 'Completada');
    if (completedRoutes.length === 0) {
        return { level: 'Sin datos', message: 'No hay rutas completadas para analizar.' };
    }

    let totalPlanned = 0;
    let totalVisited = 0;

    completedRoutes.forEach(route => {
        const plannedInRoute = route.clients.filter(c => c.status !== 'Eliminado').length;
        const visitedInRoute = route.clients.filter(c => c.visitStatus === 'Completado').length;
        totalPlanned += plannedInRoute;
        totalVisited += visitedInRoute;
    });

    if (totalPlanned === 0) {
         return { level: 'Sin datos', message: 'Las rutas completadas no tienen clientes planificados.' };
    }

    const percentage = (totalVisited / totalPlanned) * 100;

    if (percentage > 95) return { level: 'Excelente', message: 'Has superado el 95% de efectividad.' };
    if (percentage >= 80) return { level: 'Bueno', message: 'Más del 80% de visitas completadas.' };
    if (percentage >= 60) return { level: 'Regular', message: 'Entre 60% y 79% de visitas completadas.' };
    return { level: 'Bajo', message: 'Menos del 60% de efectividad.' };

  }, [routes]);


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
                   <p className="text-xs text-muted-foreground">Para finalizar la ruta de hoy (20:30)</p>
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
            <CardTitle className="text-sm font-medium">Rendimiento General</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData.level}</div>
            <p className="text-xs text-muted-foreground">{performanceData.message}</p>
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
              <RechartsBarChart data={weeklyActivityData}>
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
                  formatter={(value, name) => {
                    if (name === 'sales') {
                      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value as number);
                    }
                    return value;
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
