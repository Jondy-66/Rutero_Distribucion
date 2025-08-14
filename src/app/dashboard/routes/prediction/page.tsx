
'use client';
import React, { useState, useMemo } from "react";
import { getPredicciones } from "@/services/api";
import type { Prediction } from "@/lib/types";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Componente de la página de predicciones.
 * Permite al usuario solicitar y visualizar predicciones de visitas a clientes.
 * @returns {React.ReactElement} El componente de la página de predicciones.
 */
export default function PrediccionesPage() {
  const [fechaInicio, setFechaInicio] = useState("2025-06-26");
  const [dias, setDias] = useState(7);
  const [predicciones, setPredicciones] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEjecutivo, setSelectedEjecutivo] = useState('todos');
  const { toast } = useToast();

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
      const matchesSearch = p.Ejecutivo.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesEjecutivo && matchesSearch;
    });
  }, [predicciones, selectedEjecutivo, searchTerm]);

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
                <CardDescription>Listado de visitas predichas y su probabilidad.</CardDescription>
            </CardHeader>
            <CardContent>
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
                 <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Ejecutivo</TableHead>
                                <TableHead>RUC</TableHead>
                                <TableHead>Fecha Predicha</TableHead>
                                <TableHead className="text-right">Probabilidad</TableHead>
                                <TableHead className="hidden sm:table-cell">Ubicación (Lat, Lng)</TableHead>
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
                                        <TableCell>{format(new Date(pred.fecha_predicha), 'PPP', { locale: es })}</TableCell>
                                        <TableCell className="text-right">{(pred.probabilidad_visita * 100).toFixed(2)}%</TableCell>
                                        <TableCell className="hidden sm:table-cell">{pred.LatitudTrz}, {pred.LongitudTrz}</TableCell>
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
        </Card>
      </div>
    </>
  );
}
