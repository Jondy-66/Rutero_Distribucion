
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
        // Un supervisor puede predecir para sí mismo y para los que tiene asignados
        const managed = users.filter(u => u.supervisorId === currentUser.id);
        return [currentUser, ...managed];
    }

    // Administrador ve a todos los ejecutivos de campo
    return users.filter(u => u.role === 'Usuario' || u.role === 'Telemercaderista');
  }, [users, currentUser]);

  useEffect(() => {
    if (currentUser && !isSupervisorOrAdmin) {
      setSelectedEjecutivo(currentUser.name);
    }
  }, [isSupervisorOrAdmin, currentUser]);

  /**
   * Maneja la solicitud de predicciones a la API.
   * Actualiza el estado con los resultados o muestra un error.
   */
  const obtenerPredicciones = async () => {
    setLoading(true);
    setPredicciones([]); // Limpiar predicciones anteriores
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
        description: error.message || "No se pudieron obtener las predicciones. Inténtalo de nuevo más tarde.",
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
            toast({ title: "Error de Ubicación", description: "No se pudo obtener la ubicación. " + error.message, variant: "destructive" });
            setLoading(false);
        }
    );
  };

  const filteredPredicciones = useMemo(() => {
    return predicciones.filter(p => {
        if (isSupervisorOrAdmin) {
             if (p.Ejecutivo && typeof p.Ejecutivo === 'string') {
                return p.Ejecutivo.toLowerCase().includes(searchTerm.toLowerCase());
            }
            return false;
        }
        return true; // No filtrar por búsqueda si no es admin/supervisor
    });
  }, [predicciones, searchTerm, isSupervisorOrAdmin]);


  const handlePlanPredictionRoute = () => {
    try {
        if (selectedEjecutivo === 'todos') {
            toast({ title: 'Error', description: 'Por favor, selecciona un ejecutivo para planificar la ruta.', variant: 'destructive' });
            return;
        }
        if (filteredPredicciones.length === 0) {
            toast({ title: 'Error', description: 'No hay predicciones para planificar. Haz clic en "Obtener Predicciones" primero.', variant: 'destructive' });
            return;
        }

        const executiveUser = availableEjecutivos.find(u => u.name.trim().toLowerCase() === selectedEjecutivo.trim().toLowerCase());
        
        if (!executiveUser) {
            toast({ title: 'Error', description: `No se pudo identificar al ejecutivo: ${selectedEjecutivo}`, variant: 'destructive' });
            return;
        }

        const supervisorId = executiveUser.supervisorId || (currentUser?.role === 'Supervisor' && executiveUser.id !== currentUser.id ? currentUser.id : undefined);

        const routeClients: ClientInRoute[] = [];
        
        // Filtrar predicciones que pertenezcan al ejecutivo seleccionado (doble seguridad)
        const predictionsToProcess = filteredPredicciones.filter(p => 
            selectedEjecutivo === 'todos' || 
            (p as any).Ejecutivo?.trim().toLowerCase() === selectedEjecutivo.trim().toLowerCase() ||
            (p as any).ejecutivo?.trim().toLowerCase() === selectedEjecutivo.trim().toLowerCase()
        );

        for (const prediction of predictionsToProcess) {
            // Usar el mismo orden de campos de ID que en la tabla para consistencia
            const rucRaw = (prediction as any).cliente_id || (prediction as any).RUC || (prediction as any).ruc || (prediction as any).ID_Cliente;
            const ruc = String(rucRaw || '').trim();
            
            if (!ruc) continue;

            const client = clients.find(c => 
                c.ruc.trim().toLowerCase() === ruc.toLowerCase() ||
                c.ruc.trim().replace(/^0+/, '') === ruc.replace(/^0+/, '')
            );
            
            // Usar parseISO para mayor robustez en el parsing de fechas, tal como se hace en la tabla
            if (prediction.fecha_predicha) {
                const dateObj = parseISO(prediction.fecha_predicha);
                
                if (isValid(dateObj)) {
                    routeClients.push({
                        ruc: client ? client.ruc : ruc,
                        nombre_comercial: client ? client.nombre_comercial : ((prediction as any).Cliente || (prediction as any).nombre_comercial || 'Cliente Predicho'),
                        date: dateObj,
                        valorVenta: parseFloat(String(prediction.ventas)) || 0,
                        valorCobro: parseFloat(String(prediction.cobros)) || 0,
                        promociones: parseFloat(String(prediction.promociones)) || 0,
                        origin: 'predicted',
                        status: 'Activo',
                        visitStatus: 'Pendiente'
                    });
                }
            }
        }
        
        if (routeClients.length === 0) {
            toast({title: "Sin clientes válidos", description: "No se encontraron predicciones con fechas o datos válidos en la predicción para vincular con el catálogo.", variant: "destructive"});
            return;
        }

        routeClients.sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0));

        const firstClientDate = routeClients[0].date;
        const routeName = `Ruta Predicha para ${selectedEjecutivo} - ${format(firstClientDate!, 'PPP', {locale: es})}`;
        
        const predictionData = {
            routeName,
            supervisorId: supervisorId,
            clients: routeClients.map(c => ({...c, date: c.date?.toISOString()})),
        };
        
        localStorage.setItem('predictionRoute', JSON.stringify(predictionData));
        toast({ title: "Preparando Planificación", description: "Redirigiendo al editor de rutas..." });
        router.push('/dashboard/routes/new');
    } catch (error: any) {
        console.error("Error en handlePlanPredictionRoute:", error);
        toast({ title: "Error al Procesar", description: "Ocurrió un error inesperado al preparar la ruta.", variant: "destructive" });
    }
  }

  const handleViewOnMap = (prediction: Prediction) => {
    if (isFinite(prediction.LatitudTrz) && isFinite(prediction.LongitudTrz)) {
      setSelectedLocation({ lat: prediction.LatitudTrz, lng: prediction.LongitudTrz });
      setIsMapOpen(true);
    } else {
      toast({ title: 'Ubicación no válida', description: 'Las coordenadas para esta predicción no son válidas.', variant: 'destructive' });
    }
  };

  const handleViewOptimizedRoute = () => {
    if (filteredPredicciones.length === 0) {
      toast({ title: "Sin datos", description: "No hay predicciones para mostrar en el mapa." });
      return;
    }
    
    const predictedRucs = new Set(filteredPredicciones.map(p => String((p as any).ruc || (p as any).RUC || (p as any).cliente_id || (p as any).ID_Cliente).trim()));

    const clientsFromRucs = clients
      .filter(client => predictedRucs.has(client.ruc.trim()) && isFinite(client.latitud) && isFinite(client.longitud));

    if (clientsFromRucs.length === 0) {
      toast({ title: "Sin ubicaciones válidas", description: "Ninguno de los clientes predichos tiene coordenadas válidas registradas." });
      return;
    }

    setClientsForMap(clientsFromRucs);
    setIsRouteMapOpen(true);
  };

  const handleDownloadExcel = () => {
    if (filteredPredicciones.length === 0) {
        toast({
            title: "Sin Datos",
            description: "No hay predicciones para descargar.",
            variant: "destructive"
        });
        return;
    }

    const dataToExport = filteredPredicciones.map(p => {
        const clientId = (p as any).cliente_id || (p as any).RUC || (p as any).ruc || (p as any).ID_Cliente;
        const client = clients.find(c => c.ruc === clientId);
        return {
            'ID Cliente': clientId,
            'Cliente': client ? client.nombre_comercial : (p as any).Cliente || 'No encontrado',
            'Fecha Predicha': p.fecha_predicha ? format(parseISO(p.fecha_predicha), 'PPP', { locale: es }) : 'N/A',
            'Probabilidad': (p.probabilidad_visita * 100).toFixed(2) + '%',
            'Ventas': p.ventas || 0,
            'Cobros': p.cobros || 0,
            'Promociones': p.promociones || 0,
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Predicciones");
    XLSX.writeFile(workbook, "predicciones_de_visitas.xlsx");
    toast({ title: "Descarga Iniciada", description: "Tu reporte en Excel se está descargando." });
};
  
   const formatCurrency = (value: number | string | undefined | null) => {
    if (value === undefined || value === null) return '$0.00';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) return '$0.00';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(numValue);
  };


  return (
    <>
      <PageHeader title="Predicciones de Visitas" description="Usa el modelo de IA para predecir las próximas visitas a clientes." />
      <div className="grid gap-6">
        <Card>
            <CardHeader>
                <CardTitle>Parámetros de Predicción</CardTitle>
                <CardDescription>Selecciona los parámetros para generar las predicciones.</CardDescription>
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
                        <Button onClick={handleGetLocation} variant="outline" disabled={loading}>
                            <LocateFixed className="mr-2 h-4 w-4" />
                            Obtener mi Ubicación
                        </Button>
                    </div>
                 </div>
            </CardContent>
            <CardFooter>
                <Button onClick={obtenerPredicciones} disabled={loading}>
                    {loading && <LoaderCircle className="animate-spin mr-2" />}
                    {loading ? "Cargando..." : "Obtener Predicciones"}
                </Button>
            </CardFooter>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Resultados de la Predicción</CardTitle>
                 <CardDescription>
                    {isSupervisorOrAdmin 
                        ? 'Listado de visitas predichas y su probabilidad.' 
                        : 'Este es el listado de tus visitas predichas y su probabilidad.'
                    }
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isSupervisorOrAdmin && (
                    <div className="flex flex-col sm:flex-row gap-4 mb-4">
                        <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="Buscar por ejecutivo..." 
                                className="w-full pl-8" 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                )}
                 <div className="border rounded-lg">
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
                                <TableHead className="text-right">Promociones</TableHead>
                                <TableHead>Mapa</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto animate-spin text-primary" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredPredicciones.length > 0 ? (
                                filteredPredicciones.map((pred: any, i) => {
                                    const clientId = pred.cliente_id || pred.RUC || pred.ruc || pred.ID_Cliente;
                                    const client = clients.find(c => c.ruc === clientId);
                                    return (
                                        <TableRow key={i}>
                                            <TableCell>{pred.Ejecutivo}</TableCell>
                                            <TableCell>{clientId}</TableCell>
                                            <TableCell>{client ? client.nombre_comercial : (pred.Cliente || 'No encontrado')}</TableCell>
                                            <TableCell>{pred.fecha_predicha ? format(parseISO(pred.fecha_predicha), 'PPP', { locale: es }) : 'N/A'}</TableCell>
                                            <TableCell className="text-right">{(pred.probabilidad_visita * 100).toFixed(2)}%</TableCell>
                                            <TableCell className="text-right">{formatCurrency(pred.ventas)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(pred.cobros)}</TableCell>
                                            <TableCell className="text-right">{formatCurrency(pred.promociones)}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => handleViewOnMap(pred)} title="Ver en Mapa">
                                                    <MapPin className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center">
                                        No hay predicciones para mostrar.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter className="flex-col sm:flex-row gap-2 items-start sm:items-center">
                 <Button onClick={handlePlanPredictionRoute} disabled={loading || isSaving || selectedEjecutivo === 'todos'}>
                    {(loading || isSaving) && <LoaderCircle className="animate-spin mr-2" />}
                    <Save className="mr-2 h-4 w-4" />
                    Planificar Ruta con Predicción
                </Button>
                 <Button onClick={handleViewOptimizedRoute} variant="outline" disabled={loading || filteredPredicciones.length === 0}>
                    <Route className="mr-2 h-4 w-4" />
                    Ver Ruta en Mapa
                </Button>
                <Button onClick={handleDownloadExcel} variant="outline" disabled={loading || filteredPredicciones.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar Excel
                </Button>
            </CardFooter>
        </Card>
      </div>
      <Dialog open={isMapOpen} onOpenChange={setIsMapOpen}>
            <DialogContent className="max-w-3xl h-[60vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Ubicación de la Predicción</DialogTitle>
                     <DialogDescription>
                        Esta es la ubicación (Lat: {selectedLocation?.lat.toFixed(4)}, Lon: {selectedLocation?.lng.toFixed(4)}) para la visita predicha.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow">
                    {selectedLocation && (
                        <MapView 
                            key={Date.now()} // Force re-render
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
                    <DialogTitle>Ruta Optimizada de Predicciones</DialogTitle>
                     <DialogDescription>
                        Esta es la ruta óptima sugerida que conecta todos los clientes de la predicción actual.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex-grow">
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
