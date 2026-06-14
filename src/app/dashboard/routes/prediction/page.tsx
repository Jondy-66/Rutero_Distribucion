'use client';
import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getPredicciones } from "@/services/api";
import type { Prediction, RoutePlan, Client, ClientInRoute } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Search, Save, MapPin, Download, Route, Users, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid, isBefore, startOfDay, getDay, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { MapView } from "@/components/map-view";
import * as XLSX from 'xlsx';
import { isFinite } from "lodash";
import { cn } from "@/lib/utils";

export default function PrediccionesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { users, clients, user: currentUser } = useAuth();

  // Función para obtener la fecha inicial válida (si hoy es fin de semana, saltar al lunes)
  const getInitialValidDate = () => {
    const now = new Date();
    const day = getDay(now);
    if (day === 6) return format(addDays(now, 2), 'yyyy-MM-dd'); // Sábado -> Lunes
    if (day === 0) return format(addDays(now, 1), 'yyyy-MM-dd'); // Domingo -> Lunes
    return format(now, 'yyyy-MM-dd');
  };

  const [fechaInicio, setFechaInicio] = useState(getInitialValidDate());
  const [dias, setDias] = useState<number | ''>(7);
  
  const [predicciones, setPredicciones] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasAttempted, setHasAttempted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEjecutivo, setSelectedEjecutivo] = useState('todos');
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [clientsForMap, setClientsForMap] = useState<Client[]>([]);

  const isSupervisorOrAdmin = currentUser?.role === 'Administrador' || currentUser?.role === 'Supervisor';
  
  const availableEjecutivos = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'Usuario' || currentUser.role === 'Telemercaderista') return [currentUser];
    if (currentUser.role === 'Supervisor') {
        const managed = users.filter(u => u.supervisorId === currentUser.id);
        return [currentUser, ...managed];
    }
    return users.filter(u => u.role === 'Usuario' || u.role === 'Telemercaderista');
  }, [users, currentUser]);

  useEffect(() => {
    if (currentUser && !isSupervisorOrAdmin) setSelectedEjecutivo(currentUser.name);
  }, [isSupervisorOrAdmin, currentUser]);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;

    const selectedDate = parseISO(val);
    const today = startOfDay(new Date());

    // 1. Validar que no sea menor a hoy
    if (isBefore(startOfDay(selectedDate), today)) {
        toast({
            title: "Fecha Inválida",
            description: "La fecha de inicio no puede ser menor a la fecha de hoy.",
            variant: "destructive"
        });
        return;
    }

    // 2. Validar que no sea sábado (6) o domingo (0)
    const day = getDay(selectedDate);
    if (day === 6 || day === 0) {
        toast({
            title: "Día no Laboral",
            description: "La fecha de inicio no puede ser Sábado o Domingo.",
            variant: "destructive"
        });
        return;
    }

    setFechaInicio(val);
  };

  const obtenerPredicciones = async () => {
    // Re-validar antes de ejecutar por seguridad
    const selectedDate = parseISO(fechaInicio);
    const day = getDay(selectedDate);
    if (day === 6 || day === 0 || isBefore(startOfDay(selectedDate), startOfDay(new Date()))) {
        toast({ title: "Atención", description: "La fecha seleccionada no es válida para iniciar una predicción.", variant: "destructive" });
        return;
    }

    setLoading(true);
    setHasAttempted(true);
    setPredicciones([]); 
    try {
      const params: any = { dias: Number(dias) || 7, fecha_inicio: fechaInicio };
      if (selectedEjecutivo !== 'todos') params.ejecutivo = selectedEjecutivo;
      const data = await getPredicciones(params);
      setPredicciones(data);
      if (data.length === 0) {
          toast({ 
            title: "Sin Resultados", 
            description: "No se encontraron predicciones en este momento. Por favor, intenta de nuevo.",
            variant: "destructive"
          });
      }
    } catch (error: any) {
       toast({ title: "Error de API", description: error.message || "No se pudieron obtener las predicciones.", variant: "destructive" });
    }
    setLoading(false);
  };
 
  const filteredPredicciones = useMemo(() => {
    let list = predicciones.filter(p => {
        if (isSupervisorOrAdmin) {
             const execName = (p as any).Ejecutivo || (p as any).ejecutivo || '';
             return String(execName).toLowerCase().includes(searchTerm.toLowerCase());
        }
        return true;
    });

    list = list.filter(p => {
        const ruc = String((p as any).cliente_id || (p as any).RUC || (p as any).ruc || '').trim();
        const clientInCatalog = clients.find(c => String(c.ruc).trim() === ruc);
        if (clientInCatalog && clientInCatalog.status === 'inactive') {
            return false;
        }
        return true;
    });

    return list;
  }, [predicciones, searchTerm, isSupervisorOrAdmin, clients]);

  const handlePlanPredictionRoute = () => {
    try {
        if (selectedEjecutivo === 'todos') {
            toast({ title: 'Atención', description: 'Por favor, selecciona un ejecutivo.', variant: 'destructive' });
            return;
        }
        if (filteredPredicciones.length === 0) {
            toast({ title: 'Sin datos', description: 'Obtén predicciones primero.', variant: 'destructive' });
            return;
        }

        const round = (val: any) => Math.round((parseFloat(String(val || 0)) || 0) * 100) / 100;
        
        const executiveUser = availableEjecutivos.find(u => 
            u.name && u.name.trim().toLowerCase() === selectedEjecutivo.trim().toLowerCase()
        );
        
        const supervisorId = executiveUser?.supervisorId || (currentUser?.role === 'Supervisor' ? currentUser.id : undefined);
        
        const routeClients: ClientInRoute[] = [];
        for (const pred of filteredPredicciones) {
            const data: any = pred;
            const ruc = String(data.cliente_id || data.RUC || data.ruc || '').trim();
            if (!ruc) continue;
            
            const dateStr = String(data.fecha_predicha || data.fecha || '');
            let dateObj = parseISO(dateStr);
            if (!isValid(dateObj)) {
                dateObj = new Date(dateStr);
            }
            
            if (!isValid(dateObj)) continue;

            const clientInCatalog = clients.find(c => String(c.ruc).trim() === ruc);
            routeClients.push({
                ruc: ruc,
                nombre_comercial: clientInCatalog ? clientInCatalog.nombre_comercial : (data.Cliente || 'Cliente Predicho'),
                date: dateObj,
                valorVenta: round(data.ventas),
                valorCobro: round(data.cobros),
                promociones: round(data.promociones),
                origin: 'predicted',
                status: 'Activo',
                visitStatus: 'Pendiente'
            });
        }
        
        if (routeClients.length === 0) {
            toast({title: "Error de Datos", description: "No se encontraron clientes con información válida para procesar.", variant: "destructive"});
            return;
        }

        routeClients.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
        
        try {
            localStorage.setItem('predictionRoute', JSON.stringify({
                routeName: `Plan de Ruta - ${selectedEjecutivo}`,
                supervisorId: supervisorId,
                clients: routeClients.map(c => ({...c, date: c.date?.toISOString()})),
            }));
            router.push('/dashboard/routes/new');
        } catch (storageError) {
            toast({ title: "Error de Memoria", description: "La lista es demasiado grande para el navegador. Intente predecir menos días.", variant: "destructive" });
        }
    } catch (error: any) {
        console.error("Critical error in prediction planning:", error);
        toast({ 
            title: "Error Crítico", 
            description: error.message || "Ocurrió un fallo inesperado al preparar la planificación.", 
            variant: "destructive" 
        });
    }
  }

  const handleViewOnMap = (prediction: Prediction) => {
    if (isFinite(prediction.LatitudTrz) && isFinite(prediction.LongitudTrz)) {
      setSelectedLocation({ lat: prediction.LatitudTrz, lng: prediction.LongitudTrz });
      setIsMapOpen(true);
    } else {
      toast({ title: 'Sin ubicación', variant: 'destructive' });
    }
  };

  const handleViewOptimizedRoute = () => {
    const predictedRucs = new Set(filteredPredicciones.map(p => String((p as any).ruc || (p as any).RUC || (p as any).cliente_id || '').trim()));
    const clientsFromRucs = clients.filter(client => predictedRucs.has(String(client.ruc).trim()) && isFinite(client.latitud) && isFinite(client.longitud));
    if (clientsFromRucs.length === 0) return toast({ title: "Mapa vacío" });
    setClientsForMap(clientsFromRucs);
    setIsMapOpen(true); 
  };

  const handleDownloadExcel = () => {
    const dataToExport = filteredPredicciones.map(p => {
        const data: any = p;
        const clientId = data.cliente_id || data.RUC || data.ruc;
        return {
            'Ejecutivo': data.Ejecutivo || data.ejecutivo || '',
            'ID Cliente': clientId,
            'Probabilidad': (data.probabilidad_visita * 100).toFixed(2) + '%',
            'Ventas Est.': Math.round((parseFloat(data.ventas) || 0) * 100) / 100,
            'Cobros Est.': Math.round((parseFloat(data.cobros) || 0) * 100) / 100,
        };
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Predicciones");
    XLSX.writeFile(workbook, `predicciones_${selectedEjecutivo}.xlsx`);
  };
  
  const formatCurrency = (value: any) => {
    const num = Math.round((parseFloat(String(value || 0)) || 0) * 100) / 100;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  return (
    <>
      <PageHeader title="Predicciones de Visitas" description="IA para predecir visitas." />
      <div className="grid gap-6">
        <Card>
            <CardHeader><CardTitle>Parámetros</CardTitle></CardHeader>
            <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                        <Label>Ejecutivo</Label>
                        <Select value={selectedEjecutivo} onValueChange={setSelectedEjecutivo} disabled={!isSupervisorOrAdmin}>
                            <SelectTrigger><Users className="inline-block mr-2 h-4 w-4" /><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {isSupervisorOrAdmin && <SelectItem value="todos">Todos</SelectItem>}
                                {availableEjecutivos.map(e => (<SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Fecha Inicio</Label>
                        <Input 
                            type="date" 
                            value={fechaInicio} 
                            onChange={handleDateChange} 
                            min={todayStr}
                        />
                        <p className="text-[10px] text-muted-foreground font-bold uppercase mt-1">Lunes a Viernes únicamente.</p>
                    </div>
                    <div className="space-y-2"><Label>Días</Label><Input type="number" value={dias} onChange={(e) => setDias(e.target.value === '' ? '' : parseInt(e.target.value))} min="1" /></div>
                </div>
            </CardContent>
            <CardFooter><Button onClick={obtenerPredicciones} disabled={loading} className="w-full sm:w-auto font-bold">{loading ? "Generando..." : "Obtener Predicciones"}</Button></CardFooter>
        </Card>

        {hasAttempted && !loading && filteredPredicciones.length === 0 && (
            <div className="p-8 text-center bg-amber-50 border-2 border-dashed border-amber-200 rounded-[2rem] animate-in fade-in slide-in-from-top-4 shadow-sm">
                <AlertCircle className="mx-auto h-12 w-12 text-amber-500 mb-4" />
                <h3 className="font-black text-amber-900 uppercase text-lg">Sin resultados obtenidos</h3>
                <p className="text-amber-700 text-xs font-bold uppercase mt-2 max-w-md mx-auto leading-relaxed">
                    LA API NO HA DEVUELTO DATOS O TODOS LOS CLIENTES PREDICHOS ESTÁN <span className="text-amber-900 underline">INACTIVOS</span>. POR FAVOR, <span className="text-amber-900 underline underline-offset-2 decoration-2">INTÉNTALO DE NUEVO</span> PULSANDO EL BOTÓN.
                </p>
                <Button 
                    variant="outline" 
                    className="mt-6 font-black uppercase text-[10px] border-amber-300 text-amber-800 hover:bg-amber-100 hover:border-amber-400 transition-all rounded-xl" 
                    onClick={obtenerPredicciones}
                >
                    Intentar de nuevo ahora
                </Button>
            </div>
        )}

        <Card className={cn(hasAttempted && !loading && filteredPredicciones.length === 0 && "hidden")}>
            <CardHeader><CardTitle>Resultados</CardTitle></CardHeader>
            <CardContent>
                 <div className="border rounded-lg overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ejecutivo</TableHead>
                                <TableHead>ID Cliente</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead className="text-right">Probabilidad</TableHead>
                                <TableHead className="text-right">Ventas</TableHead>
                                <TableHead className="text-right">Cobros</TableHead>
                                <TableHead>Mapa</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={7} className="h-24 text-center"><LoaderCircle className="mx-auto animate-spin" /></TableCell></TableRow>
                            ) : filteredPredicciones.length > 0 ? (
                                filteredPredicciones.map((p: any, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="text-xs">{p.Ejecutivo || p.ejecutivo}</TableCell>
                                        <TableCell className="text-xs font-mono">{p.cliente_id || p.RUC || p.ruc}</TableCell>
                                        <TableCell className="text-xs font-bold uppercase">{clients.find(c => String(c.ruc).trim() === String(p.cliente_id || p.RUC || p.ruc).trim())?.nombre_comercial || p.Cliente || 'Nuevo'}</TableCell>
                                        <TableCell className="text-right font-black text-primary">{(p.probabilidad_visita * 100).toFixed(1)}%</TableCell>
                                        <TableCell className="text-right text-xs">{formatCurrency(p.ventas)}</TableCell>
                                        <TableCell className="text-right text-xs">{formatCurrency(p.cobros)}</TableCell>
                                        <TableCell><Button variant="ghost" size="icon" onClick={() => handleViewOnMap(p)}><MapPin className="h-4 w-4" /></Button></TableCell>
                                    </TableRow>
                                ))
                            ) : (<TableRow><TableCell colSpan={7} className="h-24 text-center">Sin resultados activos.</TableCell></TableRow>)}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-3">
                 <Button onClick={handlePlanPredictionRoute} disabled={loading || selectedEjecutivo === 'todos' || filteredPredicciones.length === 0} className="w-full sm:w-auto font-black"><Save className="mr-2 h-4 w-4" /> PLANIFICAR RUTA</Button>
                 <Button onClick={handleViewOptimizedRoute} variant="outline" disabled={loading || filteredPredicciones.length === 0} className="w-full sm:w-auto font-bold"><Route className="mr-2 h-4 w-4" /> VER EN MAPA</Button>
                 <Button onClick={handleDownloadExcel} variant="ghost" disabled={loading || filteredPredicciones.length === 0} className="w-full sm:w-auto font-bold"><Download className="mr-2 h-4 w-4" /> EXCEL</Button>
            </CardFooter>
        </Card>
      </div>
      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
            <DialogContent className="max-w-3xl h-[60vh] flex flex-col">
                <DialogHeader><DialogTitle>Ubicación</DialogTitle></DialogHeader>
                <div className="flex-grow rounded-xl overflow-hidden">{selectedLocation && <MapView center={selectedLocation} markerPosition={selectedLocation} containerClassName="h-full w-full" />}</div>
            </DialogContent>
        </Dialog>
    </>
  );
}
