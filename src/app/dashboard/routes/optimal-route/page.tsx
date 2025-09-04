
'use client';

import React, { useState, useEffect, useMemo } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getRutaOptima } from "@/services/api";
import { LoaderCircle, Link as LinkIcon, MapPin, Waypoints, Route as RouteIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/use-auth";
import type { RoutePlan, Client } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { isFinite } from "lodash";

export default function RutaOptimaPage() {
  const [origen, setOrigen] = useState("");
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [ruta, setRuta] = useState<string[]>([]);
  const [mapsLink, setMapsLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const { toast } = useToast();
  const { clients, users, loading: authLoading } = useAuth();
  const [allRoutes, setAllRoutes] = useState<RoutePlan[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);

  // Cargar la API key desde las variables de entorno del cliente.
  useEffect(() => {
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
  
  // Cargar todas las rutas existentes
  useEffect(() => {
      const fetchRoutes = async () => {
          setLoadingRoutes(true);
          try {
              // Simulando una llamada a getRoutes. En un caso real, la obtendrías desde tu contexto o una llamada a firestore.
              const { getRoutes } = await import('@/lib/firebase/firestore');
              const routesData = await getRoutes();
              setAllRoutes(routesData);
          } catch(error) {
              console.error("Error fetching routes:", error);
              toast({title: "Error", description: "No se pudieron cargar las rutas."});
          } finally {
              setLoadingRoutes(false);
          }
      }
      fetchRoutes();
  }, [toast]);

  const handleWaypointsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Asume que los waypoints están separados por saltos de línea.
    const waypointsArray = e.target.value.split('\n').map(wp => wp.trim()).filter(wp => wp);
    setWaypoints(waypointsArray);
  };
  
  const handleRouteSelect = (routeId: string) => {
    setSelectedRouteId(routeId);
    const selectedRoute = allRoutes.find(r => r.id === routeId);

    if (selectedRoute && clients.length > 0) {
        const routeClientsWithCoords = selectedRoute.clients
            .map(rc => clients.find(c => c.ruc === rc.ruc))
            .filter((c): c is Client => !!c && isFinite(c.latitud) && isFinite(c.longitud));

        if (routeClientsWithCoords.length > 0) {
            const firstClient = routeClientsWithCoords[0];
            const remainingClients = routeClientsWithCoords.slice(1);
            
            setOrigen(`${firstClient.latitud},${firstClient.longitud}`);
            setWaypoints(remainingClients.map(c => `${c.latitud},${c.longitud}`));
            toast({title: "Ruta Cargada", description: `Se cargaron ${routeClientsWithCoords.length} ubicaciones.`});
        } else {
            setOrigen("");
            setWaypoints([]);
            toast({title: "Sin Ubicaciones", description: "La ruta seleccionada no tiene clientes con coordenadas válidas.", variant: "destructive"});
        }
    }
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
        <PageHeader title="Cálculo de Ruta Óptima" description="Selecciona una ruta existente o introduce un origen y paradas para calcular la ruta más eficiente." />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="flex flex-col gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Seleccionar Ruta Existente</CardTitle>
                        <CardDescription>Elige una ruta planificada para autocompletar el origen y las paradas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Label htmlFor="route-select">Ruta</Label>
                        <Select
                            value={selectedRouteId}
                            onValueChange={handleRouteSelect}
                            disabled={loadingRoutes || authLoading}
                        >
                            <SelectTrigger id="route-select">
                                <RouteIcon className="inline-block mr-2 h-4 w-4" />
                                <SelectValue placeholder="Seleccionar una ruta..." />
                            </SelectTrigger>
                            <SelectContent>
                                {loadingRoutes ? (
                                    <SelectItem value="loading" disabled>Cargando rutas...</SelectItem>
                                ) : (
                                    allRoutes.map(route => (
                                        <SelectItem key={route.id} value={route.id}>
                                            {route.routeName}
                                        </SelectItem>
                                    ))
                                )}
                            </SelectContent>
                        </Select>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Parámetros de la Ruta</CardTitle>
                        <CardDescription>Define el punto de partida y las paradas intermedias manualmente.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="origen">
                                <MapPin className="inline-block mr-2 h-4 w-4" />
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
                                <Waypoints className="inline-block mr-2 h-4 w-4" />
                                Waypoints (uno por línea)
                            </Label>
                            <Textarea
                                id="waypoints"
                                value={waypoints.join("\n")}
                                onChange={handleWaypointsChange}
                                placeholder="-0.1850,-78.4700\n-0.1900,-78.4600"
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
            </div>
            
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

