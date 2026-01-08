
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
import { Target, TrendingUp, Users } from 'lucide-react';
import Image from 'next/image';
import { useMemo } from 'react';
import { isWithinInterval, startOfWeek, endOfWeek, eachDayOfInterval, format, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';


const executiveData = [
  { name: 'Ana López (99%)', value: 240, fill: '#8884d8' },
  { name: 'Jana Pérez (96%)', value: 139, fill: '#83a6ed' },
  { name: 'Sofía Roig (88%)', value: 290, fill: '#8dd1e1' },
  { name: 'Carlos Mora (79%)', value: 200, fill: '#82ca9d' },
  { name: 'Lorem Gil (69%)', value: 278, fill: '#a4de6c' },
];

const portfolioData = [
  { name: 'Al Día', value: 74, fill: '#0088FE' },
  { name: 'Mora > 30 Días', value: 16, fill: '#FF8042' },
  { name: 'Gma. Fija', value: 10, fill: '#00C49F' },
];

const operativeSummaryData = [
  { executive: 'Juan Pérez', ticketProm: '$250', tasa: '$340', vos: '20%', carlomversion: '15%' },
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
          <span className={`text-3xl font-bold ${colorClass}`}>{value}%</span>
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
    const { user, routes, loading } = useAuth();
    
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


  return (
    <>
      <div className="relative w-full rounded-xl bg-card p-6 overflow-hidden mb-6 shadow-lg">
          <Image 
            src="https://i.ibb.co/gLWLM1M/rut-img1.png"
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
            <CircularProgress value={85} label="META DE VENTAS" subLabel="132,580 / 156,000" colorClass="text-blue-500" />
            <CircularProgress value={92} label="EFECTIVIDAD DE COBRO" subLabel="Monto Recaudado: $12,580" colorClass="text-orange-500" />
            <CircularProgress value={95} label="RUTAS" subLabel="17/30 Rutas" colorClass="text-purple-500" />
            <CircularProgress value={95} label="CUMPLIMIENTO" subLabel="19/30 Rutas" colorClass="text-indigo-500" />
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
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                <YAxis />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))'
                  }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
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

            <Card>
                <CardHeader>
                    <CardTitle>Estado de Cartera</CardTitle>
                </CardHeader>
                <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                        <Pie
                        data={portfolioData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
                              <TableHead>Tasa</TableHead>
                              <TableHead>VOS</TableHead>
                              <TableHead>Carlomversión</TableHead>
                          </TableRow>
                      </TableHeader>
                      <TableBody>
                          {operativeSummaryData.map((row, i) => (
                            <TableRow key={i}>
                                <TableCell>{row.executive}</TableCell>
                                <TableCell>{row.ticketProm}</TableCell>
                                <TableCell>{row.tasa}</TableCell>
                                <TableCell>{row.vos}</TableCell>
                                <TableCell>{row.carlomversion}</TableCell>
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
