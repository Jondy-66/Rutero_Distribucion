
'use client';

import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { ShieldCheck, MapPin, Activity } from 'lucide-react';

const SupervisorMap = dynamic(() => import('@/components/supervisor-map').then(m => m.SupervisorMap), {
    ssr: false,
    loading: () => <Skeleton className="h-[70vh] w-full rounded-2xl" />
});

export default function TrackingPage() {
    const { user } = useAuth();

    if (user?.role !== 'Administrador' && user?.role !== 'Supervisor' && user?.role !== 'Auditor') {
        return <PageHeader title="Acceso Denegado" description="Módulo exclusivo para supervisión." />;
    }

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Supervisión en Tiempo Real" 
                description="Monitoreo GPS, Geocercas e Histórico de Rutas."
            />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <Card className="lg:col-span-1 shadow-lg border-t-4 border-t-primary">
                    <CardHeader>
                        <CardTitle className="text-sm font-black uppercase flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            Controles
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-3 bg-muted/20 rounded-xl border-2 border-slate-100">
                            <p className="text-[10px] font-black uppercase text-slate-950">Modo de Mapa</p>
                            <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Usa los iconos del mapa para dibujar zonas de seguridad (Polygon/Square).</p>
                        </div>
                        <div className="p-3 bg-blue-50 rounded-xl border-2 border-blue-100">
                            <div className="flex items-center gap-2">
                                <Activity className="h-3 w-3 text-blue-600" />
                                <span className="text-[10px] font-black uppercase text-blue-800">Precisión Activa</span>
                            </div>
                            <p className="text-[9px] text-blue-600 font-bold uppercase mt-1">Filtro de eficiencia: Solo puntos con precisión menor a 20m son procesados.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="lg:col-span-3 shadow-2xl overflow-hidden">
                    <CardHeader className="bg-slate-50 border-b">
                        <CardTitle className="text-xs font-black uppercase flex items-center gap-2 text-slate-950">
                            <MapPin className="h-4 w-4 text-primary" />
                            Mapa de Operaciones
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 bg-white">
                        <SupervisorMap />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
