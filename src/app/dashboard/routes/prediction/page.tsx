
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
import { LoaderCircle, Search, Save, MapPin, Download, Route, Users, LocateFixed } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { MapView } from "@/components/map-view";
import * as XLSX from 'xlsx';
import { isFinite } from "lodash";

/**
 * Componente de la página de predicciones.
 * Permite al usuario solicitar y visualizar predicciones de visitas a clientes.
 * @returns {React.ReactElement} El componente de la página de predicciones.
 */
export default function PrediccionesPage() {
  const router = useRouter();
  const [fechaInicio, setFechaInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dias, setDias] = useState<number | ''>(7);
  const [latBase, setLatBase] = useState("");
  const [lonBase, setLonBase] = useState("");
  const [maxKm, setMaxKm] = useState<number | ''>(10);
  
  const [predicciones, setPredicciones] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEjecutivo, setSelectedEjecutivo] = useState('todos');
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isRouteMapOpen, setIsRouteMapOpen] = useState(false);
  const [clientsForMap, setClientsForMap] = useState<Client[]>([]);
  const { toast } = useToast();
  const { users, clients, user: currentUser } = useAuth();

  const isSupervisorOrAdmin = currentUser?.role === 'Administrador' || currentUser?.role === 'Supervisor';
  
  const availableEjecutivos = useMemo(() => {
    if (!currentUser) return [];
    
    if (currentUser.role === 'Usuario' || currentUser.role === 'Telemercaderista') {
        return [currentUser];
    }

    if (currentUser.role === 'Supervisor') {
        const managed = users.filter(u => u.supervisorId === currentUser.id);
        return [currentUser, ...managed];
    }

    return users.filter(u => u.role === 'Usuario' || u.role === 'Telemercaderista');
  }, [users, currentUser]);

  useEffect(() => {
    if (currentUser && !isSupervisorOrAdmin) {
      setSelectedEjecutivo(currentUser.name);
    }
  }, [isSupervisorOrAdmin, currentUser]);

  const obtenerPredicciones = async () => {
    setLoading(true);
    setPredicciones([]); 
    try {
      const params: Parameters<typeof getPredicciones>[0] = { 
          dias: Number(dias) || 7,
          fecha_inicio: fechaInicio,
      };

      if (latBase) params.lat_base = latBase;
      if (lonBase) params.lon_base = lonBase;
      if (maxKm) params.max_km = Number(maxKm);

      if (selectedEjecutivo !== 'todos') {
        params.ejecutivo = selectedEjecutivo;
      }
      
      const data = await getPredicciones(params);
      setPredicciones(data);

       if (data.length === 0) {
        toast({
          title: "Sin Resultados",
          description: "No se encontraron predicciones para los parámetros seleccionados.",
        });
      }
    } catch (error: any) {
      console.error(error);
       toast({
        title: "Error de API",
        description: error.message || "No se pudieron obtener las predicciones.",
        variant: "destructive",
      });
    }
    setLoading(false);
  };
 
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
        toast({ title: "Geolocalización no soportada", description: "Tu navegador no permite obtener la ubicación.", variant: "destructive" });
        return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
        (position) => {
            setLatBase(String(position.coords.latitude));
            setLonBase(String(position.coords.longitude));
            toast({ title: "Ubicación Obtenida", description: "Latitud y Longitud actualizadas." });
            setLoading(false);
        },
        (error) => {
            toast({ title: "Error de Ubicación", description: "No se pudo obtener la ubicación.", variant: "destructive" });
            setLoading(false);
        }
    );
  };

  const filteredPredicciones = useMemo(() => {
    return predicciones.filter(p => {
        if (isSupervisorOrAdmin) {
             const execName = (p as any).Ejecutivo || (p as any).ejecutivo || '';
             if (execName && typeof execName === 'string') {
                return execName.toLowerCase().includes(searchTerm.toLowerCase());
            }
            return false;
        }
        return true;
    });
  }, [predicciones, searchTerm, isSupervisorOrAdmin]);

  const handlePlanPredictionRoute = () => {
    try {
        if (selectedEjecutivo === 'todos') {
            toast({ title: 'Atención', description: 'Por favor, selecciona un ejecutivo específico para planificar.', variant: 'destructive' });
            return;
        }
        if (filteredPredicciones.length === 0) {
            toast({ title: 'Sin datos', description: 'Haz clic en "Obtener Predicciones" antes de planificar.', variant: 'destructive' });
            return;
        }

        const executiveUser = availableEjecutivos.find(u => u.name.trim().toLowerCase() === selectedEjecutivo.trim().toLowerCase());
        if (!executiveUser) {
            toast({ title: 'Error', description: `No se encontró el perfil de ${selectedEjecutivo}.`, variant: 'destructive' });
            return;
        }

        // Obtener el ID del supervisor asignado
        const supervisorId = executiveUser.supervisorId || (currentUser?.role === 'Supervisor' && executiveUser.id !== currentUser.id ? currentUser.id : undefined);
        
        const routeClients: ClientInRoute[] = [];
        
        for (const pred of filteredPredicciones) {
            const data: any = pred;
            const rucRaw = data.cliente_id || data.RUC || data.ruc || data.ID_Cliente || data.ID_CLIENTE;
            const ruc = String(rucRaw || '').trim();
            if (!ruc) continue;

            const rawDate = data.fecha_predicha || data.fecha || data.FECHA;
            if (!rawDate) continue;

            const dateObj = parseISO(String(rawDate));
            if (!isValid(dateObj)) continue;

            const clientInCatalog = clients.find(c => c.ruc.trim() === ruc);

            routeClients.push({
                ruc: ruc,
                nombre_comercial: clientInCatalog ? clientInCatalog.nombre_comercial : (data.Cliente || data.nombre_comercial || 'Cliente Predicho'),
                date: dateObj,
                valorVenta: parseFloat(String(data.ventas || data.VENTAS || 0)) || 0,
                valorCobro: parseFloat(String(data.cobros || data.COBROS || 0)) || 0,
                promociones: parseFloat(String(data.promociones || 0)) || 0,
                origin: 'predicted',
                status: 'Activo',
                visitStatus: 'Pendiente'
            });
        }
        
        if (routeClients.length === 0) {
            toast({title: "Error de Datos", description: "Los datos de la predicción no tienen un formato válido.", variant: "destructive"});
            return;
        }

        routeClients.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));
        const firstDate = routeClients[0].date;
        
        const predictionData = {
            routeName: `Plan de Ruta - ${selectedEjecutivo}`,
            supervisorId: supervisorId,
            clients: routeClients.map(c => ({...c, date: c.date?.toISOString()})),
        };
        
        localStorage.setItem('predictionRoute', JSON.stringify(predictionData));
        toast({ title: "Preparando Ruta", description: "Redirigiendo al planificador..." });
        router.push('/dashboard/routes/new');
    } catch (error: any) {
        console.error("Error en planificación:", error);
        toast({ title: "Error Crítico", description: "Ocurrió un error al procesar la lista.", variant: "destructive" });
    }
  }

  const handleViewOnMap = (prediction: Prediction) => {
    if (isFinite(prediction.LatitudTrz) && isFinite(prediction.LongitudTrz)) {
      setSelectedLocation({ lat: prediction.LatitudTrz, lng: prediction.LongitudTrz });
      setIsMapOpen(true);
    } else {
      toast({ title: 'Sin ubicación', description: 'Este cliente no tiene coordenadas registradas.', variant: 'destructive' });
    }
  };

  const handleViewOptimizedRoute = () => {
    if (filteredPredicciones.length === 0) return;
    
    const predictedRucs = new Set(filteredPredicciones.map(p => String((p as any).ruc || (p as any).RUC || (p as any).cliente_id || (p as any).ID_Cliente).trim()));
    const clientsFromRucs = clients.filter(client => predictedRucs.has(client.ruc.trim()) && isFinite(client.latitud) && isFinite(client.longitud));

    if (clientsFromRucs.length === 0) {
      toast({ title: "Mapa vacío", description: "No hay clientes con coordenadas válidas para mostrar." });
      return;
    }

    setClientsForMap(clientsFromRucs);
    setIsRouteMapOpen(true);
  };

  const handleDownloadExcel = () => {
    if (filteredPredicciones.length === 0) return;

    const dataToExport = filteredPredicciones.map(p => {
        const data: any = p;
        const clientId = data.cliente_id || data.RUC || data.ruc || data.ID_Cliente;
        const client = clients.find(c => c.ruc === clientId);
        return {
            'Ejecutivo': data.Ejecutivo || data.ejecutivo || '',
            'ID Cliente': clientId,
            'Cliente': client ? client.nombre_comercial : data.Cliente || 'No encontrado',
            'Fecha Predicha': data.fecha_predicha ? format(parseISO(data.fecha_predicha), 'PPP', { locale: es }) : 'N/A',
            'Probabilidad': (data.probabilidad_visita * 100).toFixed(2) + '%',
            'Ventas Est.': data.ventas || 0,
            'Cobros Est.': data.cobros || 0,
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Predicciones");
    XLSX.writeFile(workbook, `predicciones_${selectedEjecutivo}.xlsx`);
  };
  
   const formatCurrency = (value: any) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : (typeof value === 'number' ? value : 0);
    if (isNaN(numValue)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(numValue);
  };

  return (
    <>
      <PageHeader title="Predicciones de Visitas" description="Usa el modelo de IA para predecir las próximas visitas a clientes." />
      <div className="grid gap-6">
        <Card>
            <CardHeader>
                <CardTitle>Parámetros de Predicción</CardTitle>
                <CardDescription>Configura los filtros para generar las visitas sugeridas.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="ejecutivo">Ejecutivo</Label>
                        <Select value={selectedEjecutivo} onValueChange={setSelectedEjecutivo} disabled={!isSupervisorOrAdmin}>
                            <SelectTrigger id="ejecutivo">
                                <Users className="inline-block mr-2 h-4 w-4" />
                                <SelectValue placeholder="Seleccionar ejecutivo" />
                            </SelectTrigger>
                            <SelectContent>
                                {isSupervisorOrAdmin && <SelectItem value="todos">Todos los Ejecutivos</SelectItem>}
                                {availableEjecutivos.map(ejecutivo => (
                                    <SelectItem key={ejecutivo.id} value={ejecutivo.name}>
                                        {ejecutivo.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fecha-inicio">Fecha de Inicio</Label>
                        <Input
                            id="fecha-inicio"
                            type="date"
                            value={fechaInicio}
                            onChange={(e) => setFechaInicio(e.target.value)}
                            disabled={loading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="dias">Días a Predecir</Label>
                        <Input
                            id="dias"
                            type="number"
                            value={dias}
                            onChange={(e) => setDias(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                            min="1"
                            disabled={loading}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="maxKm">Radio Máximo (km)</Label>
                        <Input id="maxKm" type="number" value={maxKm} onChange={(e) => setMaxKm(e.target.value === '' ? '' : Number(e.target.value))} disabled={loading} />
                    </div>
                </div>
                 <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 items-end">
                    <div className="space-y-2">
                        <Label htmlFor="latBase">Latitud Base (Opcional)</Label>
                        <Input id="latBase" value={latBase} onChange={(e) => setLatBase(e.target.value)} disabled={loading} placeholder="-0.180653" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="lonBase">Longitud Base (Opcional)</Label>
                        <Input id="lonBase" value={lonBase} onChange={(e) => setLonBase(e.target.value)} disabled={loading} placeholder="-78.469498" />
                    </div>
                    <div className="space-y-2">
                        <Button onClick={handleGetLocation} variant="outline" disabled={loading} className="w-full">
                            <LocateFixed className="mr-2 h-4 w-4" />
                            Mi Ubicación
                        </Button>
                    </div>
                 </div>
            </CardContent>
            <CardFooter>
                <Button onClick={obtenerPredicciones} disabled={loading} className="w-full sm:w-auto font-bold">
                    {loading && <LoaderCircle className="animate-spin mr-2" />}
                    {loading ? "Generando..." : "Obtener Predicciones"}
                </Button>
            </CardFooter>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Resultados de la Predicción</CardTitle>
                 <CardDescription>Listado de visitas sugeridas por probabilidad de éxito.</CardDescription>
            </CardHeader>
            <CardContent>
                {isSupervisorOrAdmin && (
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Filtrar resultados..." 
                                className="w-full pl-8" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                )}
                 <div className="border rounded-lg overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ejecutivo</TableHead>
                                <TableHead>ID Cliente</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Fecha Predicha</TableHead>
                                <TableHead className="text-right">Probabilidad</TableHead>
                                <TableHead className="text-right">Ventas</TableHead>
                                <TableHead className="text-right">Cobros</TableHead>
                                <TableHead>Mapa</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto animate-spin text-primary" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredPredicciones.length > 0 ? (
                                filteredPredicciones.map((pred: any, i) => {
                                    const clientId = pred.cliente_id || pred.RUC || pred.ruc || pred.ID_Cliente || pred.ID_CLIENTE;
                                    const client = clients.find(c => c.ruc === clientId);
                                    const execName = pred.Ejecutivo || pred.ejecutivo || 'N/A';
                                    return (
                                        <TableRow key={i}>
                                            <TableCell className="text-xs font-medium">{execName}</TableCell>
                                            <TableCell className="text-xs font-mono">{clientId}</TableCell>
                                            <TableCell className="text-xs font-bold uppercase">{client ? client.nombre_comercial : (pred.Cliente || 'Nuevo Cliente')}</TableCell>
                                            <TableCell className="text-xs">{pred.fecha_predicha ? format(parseISO(pred.fecha_predicha), 'dd/MM/yyyy', { locale: es }) : 'N/A'}</TableCell>
                                            <TableCell className="text-right font-black text-primary">{(pred.probabilidad_visita * 100).toFixed(1)}%</TableCell>
                                            <TableCell className="text-right text-xs">{formatCurrency(pred.ventas)}</TableCell>
                                            <TableCell className="text-right text-xs">{formatCurrency(pred.cobros)}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => handleViewOnMap(pred)}>
                                                    <MapPin className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                        No hay predicciones para mostrar.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-3">
                 <Button onClick={handlePlanPredictionRoute} disabled={loading || isSaving || selectedEjecutivo === 'todos'} className="w-full sm:w-auto font-black bg-primary">
                    {(loading || isSaving) && <LoaderCircle className="animate-spin mr-2" />}
                    <Save className="mr-2 h-4 w-4" />
                    PLANIFICAR RUTA
                </Button>
                 <Button onClick={handleViewOptimizedRoute} variant="outline" disabled={loading || filteredPredicciones.length === 0} className="w-full sm:w-auto font-bold">
                    <Route className="mr-2 h-4 w-4" />
                    VER EN MAPA
                </Button>
                <Button onClick={handleDownloadExcel} variant="ghost" disabled={loading || filteredPredicciones.length === 0} className="w-full sm:w-auto font-bold">
                    <Download className="mr-2 h-4 w-4" />
                    EXCEL
                </Button>
            </CardFooter>
        </Card>
      </div>
      
      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
            <DialogContent className="max-w-3xl h-[60vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Ubicación de Visita</DialogTitle>
                </DialogHeader>
                <div className="flex-grow rounded-xl overflow-hidden">
                    {selectedLocation && (
                        <MapView 
                            key={Date.now()}
                            center={selectedLocation}
                            markerPosition={selectedLocation}
                            containerClassName="h-full w-full"
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>

        <Dialog open={isRouteMapOpen} onOpenChange={setIsRouteMapOpen}>
            <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Ruta Optimizada</DialogTitle>
                     <DialogDescription>Mapa interactivo con todos los clientes predichos.</DialogDescription>
                </DialogHeader>
                <div className="flex-grow rounded-xl overflow-hidden border">
                    <MapView 
                        clients={clientsForMap}
                        containerClassName="h-full w-full"
                        showDirections={true}
                    />
                </div>
            </DialogContent>
        </Dialog>
    </>
  );
}
