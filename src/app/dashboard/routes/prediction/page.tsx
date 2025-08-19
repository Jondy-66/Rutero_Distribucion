
'use client';
import React, { useState, useMemo, useEffect } from "react";
import { getPredicciones } from "@/services/api";
import type { Prediction, RoutePlan, Client } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Search, Save, MapPin, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { addRoute } from "@/lib/firebase/firestore";
import { useRouter } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { MapView } from "@/components/map-view";
import * as XLSX from 'xlsx';

/**
 * Componente de la página de predicciones.
 * Permite al usuario solicitar y visualizar predicciones de visitas a clientes.
 * @returns {React.ReactElement} El componente de la página de predicciones.
 */
export default function PrediccionesPage() {
  const [fechaInicio, setFechaInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dias, setDias] = useState(7);
  const [predicciones, setPredicciones] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEjecutivo, setSelectedEjecutivo] = useState('todos');
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const { toast } = useToast();
  const { users, clients, user: currentUser } = useAuth();
  const router = useRouter();

  const isSupervisorOrAdmin = currentUser?.role === 'Administrador' || currentUser?.role === 'Supervisor';

  useEffect(() => {
    if (!isSupervisorOrAdmin && currentUser) {
      setSelectedEjecutivo(currentUser.name);
    } else {
      setSelectedEjecutivo('todos');
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
      const data = await getPredicciones({ fecha_inicio: fechaInicio, dias });
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
 
  const ejecutivos = useMemo(() => {
    const ejecutivoSet = new Set(predicciones.map(p => p.Ejecutivo));
    return ['todos', ...Array.from(ejecutivoSet)];
  }, [predicciones]);

  const filteredPredicciones = useMemo(() => {
    return predicciones.filter(p => {
      const matchesEjecutivo = selectedEjecutivo === 'todos' || p.Ejecutivo === selectedEjecutivo;
      const matchesSearch = isSupervisorOrAdmin ? p.Ejecutivo.toLowerCase().includes(searchTerm.toLowerCase()) : true;
      return matchesEjecutivo && matchesSearch;
    });
  }, [predicciones, selectedEjecutivo, searchTerm, isSupervisorOrAdmin]);

  const handleSavePredictionRoute = async () => {
    if (selectedEjecutivo === 'todos' || !currentUser) {
      toast({ title: 'Error', description: 'Por favor, selecciona un ejecutivo para guardar la ruta.', variant: 'destructive' });
      return;
    }
    if (filteredPredicciones.length === 0) {
        toast({ title: 'Error', description: 'No hay predicciones para guardar para este ejecutivo.', variant: 'destructive' });
        return;
    }

    setIsSaving(true);
    try {
        const executiveUser = users.find(u => u.name === selectedEjecutivo);
        if (!executiveUser) {
            throw new Error(`No se pudo encontrar al usuario ejecutivo: ${selectedEjecutivo}`);
        }
        
        let supervisor: typeof users[0] | undefined;
        if(executiveUser.role === 'Supervisor') {
            supervisor = executiveUser;
        } else if (executiveUser.supervisorId) {
            supervisor = users.find(u => u.id === executiveUser.supervisorId);
        }

        if (!supervisor) {
            throw new Error(`El ejecutivo ${selectedEjecutivo} no tiene un supervisor asignado.`);
        }

        const predictedClientsRucs = new Set(filteredPredicciones.map(p => p.RUC));
        const routeClients: Client[] = clients.filter(c => predictedClientsRucs.has(c.ruc));

        const routeDate = parseISO(filteredPredicciones[0].fecha_predicha);

        const newRoute: Omit<RoutePlan, 'id' | 'createdAt'> = {
            routeName: `Ruta Predicha para ${selectedEjecutivo} - ${format(routeDate, 'PPP', {locale: es})}`,
            date: Timestamp.fromDate(routeDate),
            clients: routeClients,
            status: 'Planificada',
            supervisorId: supervisor.id,
            supervisorName: supervisor.name,
            createdBy: currentUser.id,
            startTime: '08:00', // Valor predeterminado
            endTime: '17:00', // Valor predeterminado
        };

        await addRoute(newRoute);
        toast({ title: 'Ruta Guardada', description: `Se ha creado una nueva ruta para ${selectedEjecutivo}.`});
        router.push('/dashboard/routes');

    } catch (error: any) {
        console.error("Error saving prediction route:", error);
        toast({
            title: "Error al Guardar",
            description: error.message || "No se pudo guardar la ruta de predicción.",
            variant: "destructive"
        });
    } finally {
        setIsSaving(false);
    }
  }

  const handleViewOnMap = (prediction: Prediction) => {
    setSelectedLocation({ lat: prediction.LatitudTrz, lng: prediction.LongitudTrz });
    setIsMapOpen(true);
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

    const dataToExport = filteredPredicciones.map(p => ({
      'Ejecutivo': p.Ejecutivo,
      'RUC': p.RUC,
      'Fecha Predicha': format(parseISO(p.fecha_predicha), 'PPP', { locale: es }),
      'Probabilidad de Visita (%)': (p.probabilidad_visita * 100).toFixed(2),
      'Latitud': p.LatitudTrz,
      'Longitud': p.LongitudTrz,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Predicciones");
    XLSX.writeFile(workbook, "predicciones_de_visitas.xlsx");
    toast({ title: "Descarga Iniciada", description: "Tu reporte en Excel se está descargando." });
  };

  return (
    <>
      <PageHeader title="Predicciones de Visitas" description="Usa el modelo de IA para predecir las próximas visitas a clientes." />
      <div className="grid gap-6">
        <Card>
            <CardHeader>
                <CardTitle>Parámetros de Predicción</CardTitle>
                <CardDescription>Selecciona la fecha de inicio y el número de días para generar las predicciones.</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-3 gap-4">
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
                        onChange={(e) => setDias(Number(e.target.value))}
                        min="1"
                        disabled={loading}
                    />
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
                        <Select value={selectedEjecutivo} onValueChange={setSelectedEjecutivo}>
                            <SelectTrigger className="w-full sm:max-w-xs">
                                <SelectValue placeholder="Filtrar por ejecutivo" />
                            </SelectTrigger>
                            <SelectContent>
                                {ejecutivos.map(ejecutivo => (
                                    <SelectItem key={ejecutivo} value={ejecutivo}>
                                        {ejecutivo === 'todos' ? 'Todos los Ejecutivos' : ejecutivo}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ejecutivo</TableHead>
                                <TableHead>RUC</TableHead>
                                <TableHead>Fecha Predicha</TableHead>
                                <TableHead className="text-right">Probabilidad</TableHead>
                                <TableHead>Mapa</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto animate-spin text-primary" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredPredicciones.length > 0 ? (
                                filteredPredicciones.map((pred, i) => (
                                    <TableRow key={i}>
                                        <TableCell>{pred.Ejecutivo}</TableCell>
                                        <TableCell>{pred.RUC}</TableCell>
                                        <TableCell>{format(parseISO(pred.fecha_predicha), 'PPP', { locale: es })}</TableCell>
                                        <TableCell className="text-right">{(pred.probabilidad_visita * 100).toFixed(2)}%</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => handleViewOnMap(pred)} title="Ver en Mapa">
                                                <MapPin className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        No hay predicciones para mostrar.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter className="flex-col sm:flex-row gap-2 items-start sm:items-center">
                 <Button onClick={handleSavePredictionRoute} disabled={loading || isSaving || selectedEjecutivo === 'todos'}>
                    {(loading || isSaving) && <LoaderCircle className="animate-spin mr-2" />}
                    <Save className="mr-2 h-4 w-4" />
                    Guardar Ruta de Predicción
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
    </>
  );
}
