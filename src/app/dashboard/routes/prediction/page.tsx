
'use client';
import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPredicciones } from "@/services/api";
import type { Prediction, Client, ClientInRoute } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Search, Save, MapPin, Download, Users, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid, isBefore, startOfDay, getDay, addDays } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapView } from "@/components/map-view";

export default function PrediccionesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { users, clients, user: currentUser } = useAuth();

  const getInitialDate = () => {
    const now = new Date(), d = getDay(now);
    if (d === 6) return format(addDays(now, 2), 'yyyy-MM-dd');
    if (d === 0) return format(addDays(now, 1), 'yyyy-MM-dd');
    return format(now, 'yyyy-MM-dd');
  };

  const [fechaInicio, setFechaInicio] = useState(getInitialDate());
  const [dias, setDias] = useState<number | ''>(7);
  const [predicciones, setPredicciones] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEjecutivo, setSelectedEjecutivo] = useState('todos');
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);

  const isSupervisorOrAdmin = currentUser?.role === 'Administrador' || currentUser?.role === 'Supervisor';

  useEffect(() => {
    if (currentUser && !isSupervisorOrAdmin) setSelectedEjecutivo(currentUser.name);
  }, [isSupervisorOrAdmin, currentUser]);

  const obtenerPredicciones = async () => {
    setLoading(true);
    try {
      const params: any = { dias: Number(dias) || 7, fecha_inicio: fechaInicio };
      if (selectedEjecutivo !== 'todos') params.ejecutivo = selectedEjecutivo;
      const data = await getPredicciones(params);
      setPredicciones(data);
    } catch (error: any) {
       toast({ title: "Error", description: error.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const filteredPredicciones = useMemo(() => {
    return predicciones.filter(p => {
        const ruc = String(p.cliente_id || (p as any).RUC || (p as any).ruc || '').trim();
        const clientInCatalog = clients.find(c => String(c.ruc).trim() === ruc);
        
        // REGLA: Debe pertenecer al panel del usuario actual y estar activo
        if (!clientInCatalog || clientInCatalog.status === 'inactive') return false;
        
        // Si no es admin, solo sus propios clientes (ya filtrados en el AuthContext.clients)
        if (!isSupervisorOrAdmin) {
            return clientInCatalog.ejecutivo === currentUser?.name;
        }

        if (isSupervisorOrAdmin && searchTerm) {
            const exec = (p as any).Ejecutivo || (p as any).ejecutivo || '';
            return String(exec).toLowerCase().includes(searchTerm.toLowerCase());
        }
        return true;
    });
  }, [predicciones, searchTerm, isSupervisorOrAdmin, clients, currentUser]);

  const handlePlanRoute = () => {
    if (selectedEjecutivo === 'todos' && isSupervisorOrAdmin) {
        toast({ title: "Atención", description: "Selecciona un ejecutivo específico para planificar su ruta.", variant: "destructive" });
        return;
    }
    if (filteredPredicciones.length === 0) return;
    
    const routeClients: ClientInRoute[] = filteredPredicciones.map(p => {
        const ruc = String(p.cliente_id || (p as any).RUC || '').trim();
        const catalog = clients.find(c => String(c.ruc).trim() === ruc);
        return {
            ruc,
            nombre_comercial: catalog?.nombre_comercial || p.Cliente,
            date: parseISO(p.fecha_predicha || (p as any).fecha),
            valorVenta: p.ventas, valorCobro: p.cobros, status: 'Activo', visitStatus: 'Pendiente'
        } as any;
    });
    localStorage.setItem('predictionRoute', JSON.stringify({ routeName: `Plan IA - ${selectedEjecutivo}`, clients: routeClients.map(c => ({...c, date: c.date.toISOString()})) }));
    router.push('/dashboard/routes/new');
  };

  return (
    <>
      <PageHeader title="IA Predicción Ruta" description="Cálculo inteligente de visitas basado en probabilidad y panel autorizado." />
      <div className="grid gap-6">
        <Card className="border-t-4 border-t-primary shadow-xl rounded-3xl overflow-hidden"><CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="font-black uppercase text-primary tracking-tighter">Parámetros de Consulta</CardTitle></CardHeader><CardContent className="grid sm:grid-cols-3 gap-6 p-8">
            <div className="space-y-2"><Label className="font-black text-[10px] uppercase text-slate-500">Panel Ejecutivo</Label><Select value={selectedEjecutivo} onValueChange={setSelectedEjecutivo} disabled={!isSupervisorOrAdmin}><SelectTrigger className="h-12 border-2 font-black"><Users className="mr-2 h-4 w-4 text-primary" /><SelectValue /></SelectTrigger><SelectContent className="font-black">{isSupervisorOrAdmin && <SelectItem value="todos">Todos</SelectItem>}{users.filter(u => ['Usuario', 'Telemercaderista'].includes(u.role)).map(e => <SelectItem key={e.id} value={e.name} className="font-black">{e.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label className="font-black text-[10px] uppercase text-slate-500">Fecha de Inicio</Label><Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="h-12 border-2 font-black" /></div>
            <div className="space-y-2"><Label className="font-black text-[10px] uppercase text-slate-500">Días a Predecir</Label><Input type="number" value={dias} onChange={e => setDias(e.target.value === '' ? '' : parseInt(e.target.value))} className="h-12 border-2 font-black" /></div>
        </CardContent><CardFooter className="bg-slate-50 p-6 flex justify-end"><Button onClick={obtenerPredicciones} disabled={loading} className="font-black h-12 px-10 shadow-lg">{loading ? <><LoaderCircle className="animate-spin mr-2" /> Calculando...</> : "Obtener Predicciones"}</Button></CardFooter></Card>

        <Card className="border-t-4 border-t-primary shadow-xl rounded-3xl overflow-hidden"><CardHeader className="bg-slate-50 border-b p-6"><CardTitle className="font-black uppercase text-primary tracking-tighter">Resultados de IA</CardTitle><CardDescription className="text-[10px] font-bold uppercase">Solo visualizas clientes activos de tu panel.</CardDescription></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader className="bg-slate-100/50"><TableRow><TableHead className="font-black uppercase text-[10px] h-12 pl-8">Cliente Sugerido</TableHead><TableHead className="text-right font-black uppercase text-[10px]">Probabilidad</TableHead><TableHead className="text-right font-black uppercase text-[10px]">Venta Est.</TableHead><TableHead className="text-center font-black uppercase text-[10px] pr-8">Mapa</TableHead></TableRow></TableHeader><TableBody>
            {loading ? <TableRow><TableCell colSpan={4} className="text-center p-20"><LoaderCircle className="animate-spin mx-auto h-10 w-10 text-primary" /></TableCell></TableRow> : filteredPredicciones.length > 0 ? filteredPredicciones.map((p, i) => (
                <TableRow key={i} className="hover:bg-slate-50 transition-colors"><TableCell className="font-black text-xs uppercase pl-8 py-5">{p.Cliente}</TableCell><TableCell className="text-right font-black text-primary">{(p.probabilidad_visita * 100).toFixed(1)}%</TableCell><TableCell className="text-right font-mono text-xs font-bold">${p.ventas.toFixed(2)}</TableCell><TableCell className="text-center pr-8"><Button variant="ghost" size="icon" className="rounded-full hover:bg-primary/5" onClick={() => { setSelectedLocation({ lat: p.LatitudTrz, lng: p.LongitudTrz }); setIsMapOpen(true); }}><MapPin className="h-4 w-4 text-primary" /></Button></TableCell></TableRow>
            )) : <TableRow><TableCell colSpan={4} className="text-center py-20 opacity-30 uppercase font-black text-xs tracking-widest flex flex-col items-center gap-4"><AlertCircle className="h-10 w-10" /><span>Sin predicciones activas para tu catálogo</span></TableCell></TableRow>}
        </TableBody></Table></div></CardContent><CardFooter className="bg-slate-50 p-6 flex justify-end"><Button onClick={handlePlanRoute} disabled={filteredPredicciones.length === 0} className="font-black h-12 px-10 shadow-xl"><Save className="mr-2 h-4 w-4" /> PLANIFICAR RUTA</Button></CardFooter></Card>
      </div>
      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}><DialogContent className="max-w-3xl h-[60vh] rounded-3xl border-none shadow-2xl p-0 overflow-hidden">{selectedLocation && <MapView center={selectedLocation} markerPosition={selectedLocation} containerClassName="h-full w-full" />}</DialogContent></Dialog>
    </>
  );
}
