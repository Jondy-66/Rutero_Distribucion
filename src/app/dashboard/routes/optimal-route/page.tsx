
'use client';

import React, { useState, useEffect } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getRutaOptima } from "@/services/api";
import { LoaderCircle, Link as LinkIcon, MapPin, Waypoints } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

export default function RutaOptimaPage() {
  const [origen, setOrigen] = useState("-0.1807,-78.4678");
  const [waypoints, setWaypoints] = useState<string[]>([
    "-0.1850,-78.4700",
    "-0.1900,-78.4600",
    "-0.1750,-78.4550",
  ]);
  const [apiKey, setApiKey] = useState("");
  const [ruta, setRuta] = useState<string[]>([]);
  const [mapsLink, setMapsLink] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  useEffect(() => {
    // Cargar la API key desde las variables de entorno del cliente.
    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (googleMapsApiKey) {
      setApiKey(googleMapsApiKey);
    } else {
        toast({
            title: "Configuración Incompleta",
            description: "La API Key de Google Maps no está configurada.",
            variant: "destructive"
        })
    }
  }, [toast]);
  
  const handleWaypointsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Asume que los waypoints están separados por saltos de línea.
    const waypointsArray = e.target.value.split('\n').map(wp => wp.trim()).filter(wp => wp);
    setWaypoints(waypointsArray);
  };

  const obtenerRuta = async () => {
    if (!origen) {
        toast({ title: "Falta el Origen", description: "Por favor, introduce un punto de origen.", variant: "destructive" });
        return;
    }
    if (waypoints.length === 0) {
        toast({ title: "Faltan Waypoints", description: "Por favor, introduce al menos un waypoint.", variant: "destructive" });
        return;
    }
     if (!apiKey) {
        toast({ title: "Falta API Key", description: "La API Key de Google Maps es necesaria.", variant: "destructive" });
        return;
    }
    
    setLoading(true);
    setRuta([]);
    setMapsLink("");
    try {
      const data = await getRutaOptima({ origen, waypoints, api_key: apiKey });
      setRuta(data.ruta_optima || []);
      setMapsLink(data.maps_link || "");
      if(data.ruta_optima && data.ruta_optima.length > 0) {
        toast({ title: "Éxito", description: "Se ha calculado la ruta óptima."});
      } else {
        toast({ title: "Sin resultados", description: data.error || "No se pudo obtener una ruta con los datos proporcionados.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error al Calcular", description: error.message || "No se pudo obtener la ruta.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
 
  return (
    <>
        <PageHeader title="Cálculo de Ruta Óptima" description="Introduce un origen y una lista de paradas para calcular la ruta más eficiente." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Parámetros de la Ruta</CardTitle>
                    <CardDescription>Define el punto de partida y las paradas intermedias.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="origen">
                            <MapPin className="inline-block mr-2" />
                            Origen (lat,lng)
                        </Label>
                        <Input
                            id="origen"
                            type="text"
                            value={origen}
                            onChange={(e) => setOrigen(e.target.value)}
                            placeholder="-0.1807,-78.4678"
                            disabled={loading}
                        />
                    </div>
            
                    <div className="space-y-2">
                        <Label htmlFor="waypoints">
                            <Waypoints className="inline-block mr-2" />
                            Waypoints (uno por línea)
                        </Label>
                        <Textarea
                            id="waypoints"
                            value={waypoints.join("\n")}
                            onChange={handleWaypointsChange}
                            placeholder="-0.1850,-78.4700\n-0.1900,-78.4600\n-0.1750,-78.4550"
                            rows={5}
                            disabled={loading}
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={obtenerRuta} disabled={loading || !apiKey}>
                        {loading && <LoaderCircle className="animate-spin mr-2" />}
                        Obtener Ruta Óptima
                    </Button>
                </CardFooter>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Resultados</CardTitle>
                    <CardDescription>Este es el orden optimizado de tus paradas y el enlace a Google Maps.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center items-center h-40">
                             <LoaderCircle className="animate-spin text-primary h-8 w-8" />
                        </div>
                    ) : ruta.length > 0 ? (
                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold mb-2">Orden de Waypoints Optimizado:</h3>
                                <div className="space-y-2 rounded-md border p-4 max-h-60 overflow-y-auto">
                                    {ruta.map((wp, i) => (
                                        <p key={i} className="font-mono text-sm p-2 bg-muted rounded-md">{i + 1}. {wp}</p>
                                    ))}
                                </div>
                            </div>
                            <Separator />
                            {mapsLink && (
                                <Button asChild>
                                    <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="w-full">
                                        <LinkIcon className="mr-2" />
                                        Ver Ruta en Google Maps
                                    </a>
                                </Button>
                            )}
                        </div>
                    ) : (
                         <div className="flex justify-center items-center h-40 text-muted-foreground text-center">
                            <p>Los resultados aparecerán aquí.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    </>
  );
}
