
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
import * as XLSX from 'xlsx';
import { isFinite } from "lodash";
import { cn } from "@/lib/utils";

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
        // Filtrar por panel propio y estado activo
        if (!clientInCatalog || clientInCatalog.status === 'inactive') return false;
        if (isSupervisorOrAdmin && searchTerm) {
            const exec = (p as any).Ejecutivo || (p as any).ejecutivo || '';
            return String(exec).toLowerCase().includes(searchTerm.toLowerCase());
        }
        return true;
    });
  }, [predicciones, searchTerm, isSupervisorOrAdmin, clients]);

  const handlePlanRoute = () => {
    if (selectedEjecutivo === 'todos' || filteredPredicciones.length === 0) return;
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
      <PageHeader title="Predicciones IA" description="Cálculo inteligente de visitas." />
      <div className="grid gap-6">
        <Card><CardHeader><CardTitle>Parámetros</CardTitle></CardHeader><CardContent className="grid sm:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Ejecutivo</Label><Select value={selectedEjecutivo} onValueChange={setSelectedEjecutivo} disabled={!isSupervisorOrAdmin}><SelectTrigger><Users className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent>{isSupervisorOrAdmin && <SelectItem value="todos">Todos</SelectItem>}{users.filter(u => ['Usuario', 'Telemercaderista'].includes(u.role)).map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Fecha Inicio</Label><Input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} /></div>
            <div className="space-y-2"><Label>Días</Label><Input type="number" value={dias} onChange={e => setDias(e.target.value === '' ? '' : parseInt(e.target.value))} /></div>
        </CardContent><CardFooter><Button onClick={obtenerPredicciones} disabled={loading} className="font-black">{loading ? "Calculando..." : "Obtener Predicciones"}</Button></CardFooter></Card>

        <Card><CardHeader><CardTitle>Resultados</CardTitle></CardHeader><CardContent><div className="border rounded-xl overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Cliente</TableHead><TableHead className="text-right">Probabilidad</TableHead><TableHead className="text-right">Venta Est.</TableHead><TableHead>Mapa</TableHead></TableRow></TableHeader><TableBody>
            {loading ? <TableRow><TableCell colSpan={4} className="text-center p-10"><LoaderCircle className="animate-spin mx-auto" /></TableCell></TableRow> : filteredPredicciones.length > 0 ? filteredPredicciones.map((p, i) => (
                <TableRow key={i}><TableCell className="font-black text-xs uppercase">{p.Cliente}</TableCell><TableCell className="text-right font-black text-primary">{(p.probabilidad_visita * 100).toFixed(1)}%</TableCell><TableCell className="text-right font-mono text-xs">${p.ventas.toFixed(2)}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={() => { setSelectedLocation({ lat: p.LatitudTrz, lng: p.LongitudTrz }); setIsMapOpen(true); }}><MapPin className="h-4 w-4" /></Button></TableCell></TableRow>
            )) : <TableRow><TableCell colSpan={4} className="text-center py-10 opacity-30 uppercase font-black text-xs">Sin resultados activos para tu panel</TableCell></TableRow>}
        </TableBody></Table></div></CardContent><CardFooter><Button onClick={handlePlanRoute} disabled={filteredPredicciones.length === 0} className="font-black"><Save className="mr-2 h-4 w-4" /> PLANIFICAR RUTA</Button></CardFooter></Card>
      </div>
      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}><DialogContent className="max-w-3xl h-[60vh]">{selectedLocation && <MapView center={selectedLocation} markerPosition={selectedLocation} containerClassName="h-full w-full rounded-2xl" />}</DialogContent></Dialog>
    </>
  );
}
