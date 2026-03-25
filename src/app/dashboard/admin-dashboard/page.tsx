
'use client';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
  Cell,
} from 'recharts';
import { Target, TrendingUp, Users, Wallet, Activity, Database } from 'lucide-react';
import Image from 'next/image';
import { useMemo } from 'react';
import { isWithinInterval, startOfWeek, endOfWeek, eachDayOfInterval, format, getDay, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';
import { Progress } from '@/components/ui/progress';


const portfolioData = [
  { name: 'Al Día', value: 74, fill: '#0088FE' },
  { name: 'Mora > 30 Días', value: 16, fill: '#FF8042' },
  { name: 'Gma. Fija', value: 10, fill: '#00C49F' },
];


const CircularProgress = ({ value, label, subLabel, colorClass = 'text-primary' }) => {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="relative h-32 w-32">
        <svg className="h-full w-full" viewBox="0 0 100 100">
          <circle
            className="stroke-current text-gray-200"
            strokeWidth="10"
            cx="50"
            cy="50"
            r="45"
            fill="transparent"
          />
          <circle
            className={`stroke-current ${colorClass}`}
            strokeWidth="10"
            strokeLinecap="round"
            cx="50"
            cy="50"
            r="45"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-3xl font-bold ${colorClass}`}>{value.toFixed(0)}%</span>
        </div>
      </div>
      <div className="mt-2">
        <p className="font-semibold text-card-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{subLabel}</p>
      </div>
    </div>
  );
};


export default function AdminDashboardPage() {
    const { users, routes, clients, loading } = useAuth();
    
    const weeklySalesData = useMemo(() => {
        const today = new Date();
        const start = startOfWeek(today, { weekStartsOn: 1 }); // Lunes
        const end = endOfWeek(today, { weekStartsOn: 1 });   // Domingo

        const weekDays = eachDayOfInterval({ start, end });

        const weekData = weekDays.map(day => ({
            name: format(day, 'E', { locale: es }).charAt(0).toUpperCase(),
            value: 0,
        }));
        
        const relevantRoutes = routes.filter(route => {
            const routeDate = route.date;
            return route.status === 'Completada' && routeDate && isWithinInterval(routeDate, { start, end });
        });

        relevantRoutes.forEach(route => {
            const routeDate = route.date;
            if(routeDate){
                const dayIndex = getDay(routeDate) === 0 ? 6 : getDay(routeDate) - 1; // Lunes = 0, Domingo = 6
                if (dayIndex >= 0 && dayIndex < 7) {
                    const totalSales = route.clients
                        .filter(c => c.visitStatus === 'Completado' && c.valorVenta)
                        .reduce((sum, c) => sum + (c.valorVenta || 0), 0);
                    weekData[dayIndex].value += totalSales;
                }
            }
        });
        
        return weekData;
    }, [routes]);

    const {
        salesGoalPercentage,
        salesSublabel,
        collectionEffectiveness,
        collectionSublabel,
        routeCompliance,
        routeSublabel
    } = useMemo(() => {
        const today = new Date();
        const monthStart = startOfMonth(today);
        const monthEnd = endOfMonth(today);

        const monthlyCompletedRoutes = routes.filter(r =>
            r.status === 'Completada' && r.date && isWithinInterval(r.date, { start: monthStart, end: monthEnd })
        );

        let totalSales = 0;
        let totalCollections = 0;
        monthlyCompletedRoutes.forEach(route => {
            route.clients.forEach(c => {
                if (c.visitStatus === 'Completado') {
                    totalSales += c.valorVenta || 0;
                    totalCollections += c.valorCobro || 0;
                }
            });
        });

        const salesGoal = 156000;
        const collectionGoal = 15000;

        const allProgrammedRoutes = routes.filter(r => r.status !== 'Rechazada');
        const allCompletedRoutes = allProgrammedRoutes.filter(r => r.status === 'Completada');

        return {
            salesGoalPercentage: salesGoal > 0 ? (totalSales / salesGoal) * 100 : 0,
            salesSublabel: `${totalSales.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} / ${salesGoal.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
            collectionEffectiveness: collectionGoal > 0 ? (totalCollections / collectionGoal) * 100 : 0,
            collectionSublabel: `Monto Recaudado: ${totalCollections.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
            routeCompliance: allProgrammedRoutes.length > 0 ? (allCompletedRoutes.length / allProgrammedRoutes.length) * 100 : 0,
            routeSublabel: `${allCompletedRoutes.length}/${allProgrammedRoutes.length} Rutas`
        };
    }, [routes]);


    const executiveData = useMemo(() => {
        const executiveStats: { [key: string]: { planned: number, visited: number } } = {};

        routes.forEach(route => {
            if (route.status === 'Completada') {
                const creatorId = route.createdBy;
                if (!executiveStats[creatorId]) {
                    executiveStats[creatorId] = { planned: 0, visited: 0 };
                }
                const plannedInRoute = route.clients.filter(c => c.status !== 'Eliminado').length;
                const visitedInRoute = route.clients.filter(c => c.visitStatus === 'Completado').length;
                
                executiveStats[creatorId].planned += plannedInRoute;
                executiveStats[creatorId].visited += visitedInRoute;
            }
        });

        const executivePerformance = Object.entries(executiveStats).map(([userId, stats]) => {
            const user = users.find(u => u.id === userId);
            const percentage = stats.planned > 0 ? (stats.visited / stats.planned) * 100 : 0;
            return {
                name: user ? user.name : `Usuario Desconocido`,
                shortName: user ? user.name.split(' ')[0] : 'Desconocido',
                value: percentage
            };
        });

        const sortedExecutives = executivePerformance.sort((a, b) => b.value - a.value).slice(0, 5);

        const colors = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c'];
        return sortedExecutives.map((exec, index) => ({ ...exec, fill: colors[index % colors.length] }));

    }, [routes, users]);

    const operativeSummaryData = useMemo(() => {
        const sellers = users.filter(u => u.role === 'Usuario' || u.role === 'Telemercaderista');
        return sellers.map(seller => {
            const sellerRoutes = routes.filter(r => r.createdBy === seller.id && r.status === 'Completada');
            let totalSales = 0;
            let visitedClientsCount = 0;
            let plannedClientsCount = 0;

            sellerRoutes.forEach(route => {
                const visitedInRoute = route.clients.filter(c => c.visitStatus === 'Completado');
                visitedClientsCount += visitedInRoute.length;
                plannedClientsCount += route.clients.filter(c => c.status !== 'Eliminado').length;
                totalSales += visitedInRoute.reduce((sum, c) => sum + (c.valorVenta || 0), 0);
            });
            
            return {
                executive: seller.name,
                ticketProm: visitedClientsCount > 0 ? (totalSales / visitedClientsCount) : 0,
                visitEffectiveness: plannedClientsCount > 0 ? (visitedClientsCount / plannedClientsCount) * 100 : 0,
                visitedClients: visitedClientsCount
            };
        });

    }, [users, routes]);


  return (
    <>
      <div className="relative w-full rounded-xl bg-card p-6 overflow-hidden mb-6 shadow-lg">
          <Image 
            src="https://i.ibb.co/gLWLM13M/rut-img1.png"
            data-ai-hint="business people celebrating"
            alt="Fuerza de ventas"
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary/60" />
          <div className="relative text-primary-foreground">
              <h1 className="text-4xl font-bold">FUERZA DE VENTAS & COBRANZA</h1>
              <p className="text-lg">KPIS SEMANALES</p>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target />
              Métricas Clave
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 justify-items-center">
            <CircularProgress value={salesGoalPercentage} label="META DE VENTAS" subLabel={salesSublabel} colorClass="text-blue-500" />
            <CircularProgress value={collectionEffectiveness} label="EFECTIVIDAD DE COBRO" subLabel={collectionSublabel} colorClass="text-orange-500" />
            <CircularProgress value={routeCompliance} label="RUTAS" subLabel={routeSublabel} colorClass="text-purple-500" />
            <CircularProgress value={routeCompliance} label="CUMPLIMIENTO" subLabel={routeSublabel} colorClass="text-indigo-500" />
          </CardContent>
        </Card>
      </div>
      
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users />Top 5 Ejecutivos - Cumplimiento</CardTitle>
            <CardDescription>Meta: 80%</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={executiveData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <XAxis dataKey="shortName" tick={{ fontSize: 10 }} interval={0} />
                <YAxis />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))'
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value, name, props) => [`${props.payload.name}: ${Number(value).toFixed(2)}%`, 'Cumplimiento']}
                />
                <Bar dataKey="value">
                  {executiveData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><TrendingUp />Histórico Semanal - Ventas</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={weeklySalesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <XAxis dataKey="name" />
                        <YAxis tickFormatter={(value) => `$${value/1000}k`}/>
                        <Tooltip 
                         contentStyle={{
                            backgroundColor: 'hsl(var(--background))', 
                            border: '1px solid hsl(var(--border))'
                          }}
                          itemStyle={{ color: 'hsl(var(--foreground))' }}
                          formatter={(value: number) => [new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value), 'Ventas']}
                        />
                        <Line type="monotone" dataKey="value" name="Ventas" stroke="hsl(var(--primary))" strokeWidth={2} activeDot={{ r: 8 }} />
                    </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-sm uppercase font-black"><Wallet />Cartera</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={150}>
                        <PieChart>
                            <Pie
                            data={portfolioData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={60}
                            fill="#8884d8"
                            dataKey="value"
                            >
                            {portfolioData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                            </Pie>
                            <Tooltip 
                            contentStyle={{
                                backgroundColor: 'hsl(var(--background))', 
                                border: '1px solid hsl(var(--border))'
                            }}
                            />
                        </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="bg-slate-950 text-white border-none">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-black uppercase flex items-center gap-2">
                            <Activity className="h-4 w-4 text-orange-400" />
                            Status de Cuota
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-black uppercase">
                                <span>Base de Datos</span>
                                <span>{((clients.length / 10000) * 100).toFixed(1)}%</span>
                            </div>
                            <Progress value={(clients.length / 10000) * 100} className="h-1.5 bg-slate-800" />
                        </div>
                        <div className="pt-2 border-t border-slate-800">
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Salud del Sistema</p>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[11px] font-black uppercase">Operativo</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
      </div>
      
      <div className="mt-6">
          <Card>
              <CardHeader>
                  <CardTitle>Resumen Operativo</CardTitle>
              </CardHeader>
              <CardContent>
                  <Table>
                      <TableHeader>
                          <TableRow>
                              <TableHead>Ejecutivo</TableHead>
                              <TableHead>Ticket Prom.</TableHead>
                              <TableHead>Efectividad de Visita</TableHead>
                              <TableHead>Clientes Visitados</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {operativeSummaryData.map((row, i) => (
                            <TableRow key={i}>
                                <TableCell>{row.executive}</TableCell>
                                <TableCell>{row.ticketProm.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</TableCell>
                                <TableCell>{row.visitEffectiveness.toFixed(2)}%</TableCell>
                                <TableCell>{row.visitedClients}</TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                  </Table>
              </CardContent>
          </Card>
      </div>
    </>
  );
}
