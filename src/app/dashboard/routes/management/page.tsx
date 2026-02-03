'use client';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Clock, Plus, Route, Search, GripVertical, Trash2, MapPin, LoaderCircle, LogIn, LogOut, Building2, CheckCircle, AlertTriangle, ChevronRight, Save, Phone, User, PlusCircle, Download } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { getClients, getRoutes, updateRoute } from '@/lib/firebase/firestore';
import type { Client, RoutePlan, ClientInRoute } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, isToday, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { MapView } from '@/components/map-view';
import { isFinite } from 'lodash';
import { Calendar } from '@/components/ui/calendar';
import { useAuth } from '@/hooks/use-auth';
import { PageHeader } from '@/components/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import * as XLSX from 'xlsx';
import { Timestamp, GeoPoint } from 'firebase/firestore';


type RouteClient = Client & ClientInRoute;

const generateTimeSlots = (startHour: number, endHour: number, interval: number, startMinute = 0) => {
    const slots = [];
    for (let hour = startHour; hour <= endHour; hour++) {
        for (let minute = (hour === startHour ? startMinute : 0); minute < 60; minute += interval) {
            if (hour === endHour && minute > 0) break;
            const time = new Date(1970, 0, 1, hour, minute);
            slots.push(format(time, 'HH:mm'));
        }
    }
    return slots;
};

const timeSlots = generateTimeSlots(8, 18, 30);


export default function RouteManagementPage() {
  const { user, clients: availableClients, routes: allRoutes, loading: authLoading, refetchData } = useAuth();
  
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>();
  const [isRouteStarted, setIsRouteStarted] = useState(false);
  const [isStarting, setIsStarting] = false;
  const [isRouteExpired, setIsRouteExpired] = useState(false);
  const [remainingTime, setRemainingTime] = useState({ hours: 0, minutes: 0, seconds: 0, expired: false });
  const [todayFormatted, setTodayFormatted] = useState('');
  
  const [currentRouteClientsFull, setCurrentRouteClientsFull] = useState<ClientInRoute[]>([]);
  
  const [gettingLocation, setGettingLocation] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: -1.8312, lng: -78.1834 });
  const [markerPosition, setMarkerPosition] = useState<{ lat: number; lng: number} | null>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [isClientMapOpen, setIsClientMapOpen] = useState(false);
  const [clientForMap, setClientForMap] = useState<Client | null>(null);
  const { toast } = useToast();
  
  const [activeClient, setActiveClient] = useState<RouteClient | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [visitType, setVisitType] = useState<'presencial' | 'telefonica' | undefined>();
  const [callObservation, setCallObservation] = useState('');

  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [dialogSearchTerm, setDialogSearchTerm] = useState('');

  const [confirmationDialogOpen, setConfirmationDialogOpen] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<'checkIn' | 'checkOut' | null>(null);
  const [currentTime, setCurrentTime] = useState('');

  const loading = authLoading;

  // Persistence keys
  const SELECTION_KEY = user ? `mgmt_selected_route_${user.id}` : null;
  const DRAFT_KEY = (rid: string, ruc: string) => user ? `mgmt_draft_${user.id}_${rid}_${ruc}` : null;

  const selectedRoute = useMemo(() => {
    if (!selectedRouteId) return undefined;
    return allRoutes.find(r => r.id === selectedRouteId);
  }, [selectedRouteId, allRoutes]);
  
  const toClientInRoutePayload = (uiClient: RouteClient): ClientInRoute => {
      const {id, ejecutivo, nombre_cliente, provincia, canton, direccion, latitud, longitud, ...rest} = uiClient;

      const firestoreClient: ClientInRoute = {
          ...rest,
          ruc: uiClient.ruc,
          nombre_comercial: uiClient.nombre_comercial,
          status: uiClient.status,
          visitStatus: uiClient.visitStatus,
          origin: uiClient.origin,
          valorVenta: parseFloat(String(uiClient.valorVenta)) || 0,
          valorCobro: parseFloat(String(uiClient.valorCobro)) || 0,
          devoluciones: parseFloat(String(uiClient.devoluciones)) || 0,
          promociones: parseFloat(String(uiClient.promociones)) || 0,
          medicacionFrecuente: parseFloat(String(uiClient.medicacionFrecuente)) || 0,
      };
      
      Object.keys(firestoreClient).forEach(keyStr => {
          const key = keyStr as keyof ClientInRoute;
          if (firestoreClient[key] === undefined || firestoreClient[key] === null) {
              delete firestoreClient[key];
          }
      });

      return firestoreClient;
  };
  
  useEffect(() => {
    setTodayFormatted(format(new Date(), "EEEE, d 'de' MMMM", { locale: es }));
  }, []);

  // Load saved route selection
  useEffect(() => {
    if (!authLoading && SELECTION_KEY) {
      const savedId = localStorage.getItem(SELECTION_KEY);
      if (savedId && allRoutes.some(r => r.id === savedId)) {
        handleRouteSelect(savedId);
      }
    }
  }, [authLoading, SELECTION_KEY, allRoutes]);

  useEffect(() => {
    if (selectedRoute) {
        setCurrentRouteClientsFull(selectedRoute.clients);
        if (selectedRoute.status === 'En Progreso' || selectedRoute.status === 'Incompleta') {
          const anyCompletedToday = selectedRoute.clients.some(c => {
              let cDate = c.date;
              if (cDate instanceof Timestamp) cDate = cDate.toDate();
              return cDate && isToday(cDate) && c.visitStatus === 'Completado';
          });
          if (anyCompletedToday || selectedRoute.status === 'En Progreso') {
              setIsRouteStarted(true);
          } else {
              setIsRouteStarted(false);
          }
        } else {
          setIsRouteStarted(false);
        }
    } else {
        setCurrentRouteClientsFull([]);
        setIsRouteStarted(false);
    }
  }, [selectedRoute]);
  
  const routeClients = useMemo(() => {
    return currentRouteClientsFull
        .filter(clientInRoute => {
            if (clientInRoute.status === 'Eliminado') return false;
            
            let clientDate = clientInRoute.date;
            if (clientDate instanceof Timestamp) {
                clientDate = clientDate.toDate();
            }
            
            return clientDate ? isToday(clientDate) : false;
        })
        .map(clientInRoute => {
            const clientDetails = availableClients.find(c => c.ruc === clientInRoute.ruc);
            return {
                ...(clientDetails || {}),
                ...clientInRoute,
                valorVenta: String(clientInRoute.valorVenta ?? ''),
                valorCobro: String(clientInRoute.valorCobro ?? ''),
                devoluciones: String(clientInRoute.devoluciones ?? ''),
                promociones: String(clientInRoute.promociones ?? ''),
                medicacionFrecuente: String(clientInRoute.medicacionFrecuente ?? ''),
            } as RouteClient;
        }).filter(c => c.id);
  }, [currentRouteClientsFull, availableClients]);


   useEffect(() => {
    const nextPendingClient = routeClients.find(c => c.visitStatus !== 'Completado');
    
    if (nextPendingClient) {
        // Only switch if current is completed or we don't have one
        if (!activeClient || activeClient.visitStatus === 'Completado' || activeClient.ruc !== nextPendingClient.ruc) {
            setActiveClient(nextPendingClient);
            
            // Load drafts for this client
            if (selectedRouteId) {
                const key = DRAFT_KEY(selectedRouteId, nextPendingClient.ruc);
                if (key) {
                    const savedDraft = localStorage.getItem(key);
                    if (savedDraft) {
                        try {
                            const draft = JSON.parse(savedDraft);
                            setVisitType(draft.visitType);
                            setCallObservation(draft.callObservation || '');
                            setActiveClient(prev => prev ? {
                                ...prev,
                                valorVenta: draft.valorVenta ?? prev.valorVenta,
                                valorCobro: draft.valorCobro ?? prev.valorCobro,
                                devoluciones: draft.devoluciones ?? prev.devoluciones,
                                promociones: draft.promociones ?? prev.promociones,
                                medicacionFrecuente: draft.medicacionFrecuente ?? prev.medicacionFrecuente,
                            } : null);
                        } catch (e) { console.error("Error parsing draft", e); }
                    } else {
                        setVisitType(undefined);
                        setCallObservation('');
                    }
                }
            }
        }
    } else {
        setActiveClient(null);
    }
  }, [routeClients, activeClient?.visitStatus, selectedRouteId]);

  // Save drafts
  useEffect(() => {
    if (activeClient && selectedRouteId && !activeClient.visitStatus) {
        const key = DRAFT_KEY(selectedRouteId, activeClient.ruc);
        if (key) {
            const draftData = {
                visitType,
                callObservation,
                valorVenta: activeClient.valorVenta,
                valorCobro: activeClient.valorCobro,
                devoluciones: activeClient.devoluciones,
                promociones: activeClient.promociones,
                medicacionFrecuente: activeClient.medicacionFrecuente,
            };
            localStorage.setItem(key, JSON.stringify(draftData));
        }
    }
  }, [activeClient, visitType, callObservation, selectedRouteId]);


  useEffect(() => {
    if (!selectedRoute || (selectedRoute.status !== 'En Progreso' && selectedRoute.status !== 'Incompleta')) {
        setIsRouteExpired(false);
        setRemainingTime({ hours: 0, minutes: 0, seconds: 0, expired: false });
        return;
    }

    const interval = setInterval(() => {
        const now = new Date();
        const expirationDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 30, 0);
        const diff = expirationDate.getTime() - now.getTime();

        if (diff <= 0) {
            setRemainingTime({ hours: 0, minutes: 0, seconds: 0, expired: true });
            setIsRouteExpired(true);
            
            if (selectedRoute.status === 'En Progreso') {
                (async () => {
                    try {
                        const hasPendingToday = currentRouteClientsFull.some(c => {
                            let cDate = c.date;
                            if (cDate instanceof Timestamp) cDate = cDate.toDate();
                            return c.status !== 'Eliminado' && c.visitStatus === 'Pendiente' && cDate && isToday(cDate);
                        });

                        if (hasPendingToday) {
                            await updateRoute(selectedRoute.id, { status: 'Incompleta' });
                            await refetchData('routes');
                            toast({
                              title: "Ruta Incompleta",
                              description: `La ruta "${selectedRoute.routeName}" ha sido marcada como incompleta por no finalizar los clientes de hoy.`,
                              variant: "destructive",
                            });
                        }
                    } catch (error) {
                        console.error("Failed to update route state at expiration:", error);
                    }
                })();
            }
            clearInterval(interval);
            return;
        }

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        setRemainingTime({ hours, minutes, seconds, expired: false });
        setIsRouteExpired(false);
    }, 1000);

    return () => clearInterval(interval);

  }, [selectedRoute, refetchData, toast, currentRouteClientsFull]);

  const handleClientValueChange = (ruc: string, field: keyof Omit<RouteClient, keyof Client>, value: string) => {
    setActiveClient(prev => {
        if (prev && prev.ruc === ruc) {
            return { ...prev, [field]: value };
        }
        return prev;
    });
  };

  const handleGetLocation = useCallback((forDialog: boolean = false) => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocalización no soportada",
        description: "Tu navegador no soporta la geolocalización.",
        variant: "destructive"
      });
      return;
    }

    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGettingLocation(false);
        const { latitude, longitude } = position.coords;
        const newPos = { lat: latitude, lng: longitude };
        setMapCenter(newPos);
        setMarkerPosition(newPos);
        if(!forDialog) {
          toast({
            title: "Ubicación Obtenida",
            description: `Lat: ${latitude.toFixed(4)}, Lon: ${longitude.toFixed(4)}`
          });
        }
      },
      (error) => {
        setGettingLocation(false);
        let description = "No se pudo obtener la ubicación.";
        if (error.code === error.PERMISSION_DENIED) {
            description = "Permiso de ubicación denegado. Actívalo en tu navegador.";
        }
        toast({
          title: "Error de Ubicación",
          description: description,
          variant: "destructive"
        });
      }
    );
  }, [toast]);
  
  const openConfirmationDialog = (action: 'checkIn' | 'checkOut') => {
    handleGetLocation(true);
    setCurrentTime(format(new Date(), 'HH:mm:ss'));
    setConfirmationAction(action);
    setConfirmationDialogOpen(true);
  };

  const handleConfirmAction = () => {
    if (confirmationAction === 'checkIn') {
        handleCheckIn();
    } else if (confirmationAction === 'checkOut') {
        handleConfirmCheckOut();
    }
    setConfirmationDialogOpen(false);
    setConfirmationAction(null);
  };

  const handleCheckIn = async () => {
    if (!selectedRoute || !activeClient) return;
    
    const time = format(new Date(), 'HH:mm:ss');
    const location = markerPosition ? new GeoPoint(markerPosition.lat, markerPosition.lng) : null;
    
    setIsSaving(true);
    try {
        const updatedFullList = currentRouteClientsFull.map(c => 
            c.ruc === activeClient.ruc 
            ? { ...c, checkInTime: time, checkInLocation: location }
            : c
        );

        await updateRoute(selectedRoute.id, { clients: updatedFullList });
        await refetchData('routes');
        setCurrentRouteClientsFull(updatedFullList);
        
        toast({ title: "Entrada Marcada", description: `Hora de entrada registrada a las ${time}` });
    } catch (error: any) {
        console.error("Error saving check-in:", error);
        toast({ title: "Error", description: "No se pudo guardar la entrada.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };


  const handleConfirmCheckOut = async () => {
    if (!selectedRoute || !activeClient) return;

    if (!visitType) {
        toast({
            title: "Acción Requerida",
            description: "Por favor, selecciona el tipo de visita (Presencial o Telefónica).",
            variant: "destructive"
        });
        return;
    }
    
    if (visitType === 'telefonica' && !callObservation) {
        toast({ title: "Observación Requerida", description: "Debes añadir un comentario para la gestión telefónica.", variant: "destructive" });
        return;
    }

    setIsSaving(true);
    try {
        const time = format(new Date(), 'HH:mm:ss');
        const location = markerPosition ? new GeoPoint(markerPosition.lat, markerPosition.lng) : null;

        const updatedFullList = currentRouteClientsFull.map(c => {
            if (c.ruc === activeClient.ruc) {
                const updatedClientData: Partial<ClientInRoute> = {
                    checkOutTime: time,
                    checkOutLocation: location,
                    visitStatus: 'Completado',
                    visitType: visitType,
                    valorVenta: parseFloat(activeClient.valorVenta) || 0,
                    valorCobro: parseFloat(activeClient.valorCobro) || 0,
                    devoluciones: parseFloat(activeClient.devoluciones) || 0,
                    promociones: parseFloat(activeClient.promociones) || 0,
                    medicacionFrecuente: parseFloat(activeClient.medicacionFrecuente) || 0,
                    callObservation: visitType === 'telefonica' ? callObservation : undefined,
                };
                
                Object.keys(updatedClientData).forEach(key => {
                    const typedKey = key as keyof typeof updatedClientData;
                    if (updatedClientData[typedKey] === undefined) {
                        delete updatedClientData[typedKey];
                    }
                });

                return { ...c, ...updatedClientData };
            }
            return c;
        });
        
        const allPlanClients = updatedFullList.filter(c => c.status !== 'Eliminado');
        const allPlanClientsCompleted = allPlanClients.length > 0 && allPlanClients.every(c => c.visitStatus === 'Completado');
        
        const todaysClients = updatedFullList.filter(c => c.status !== 'Eliminado' && c.date && isToday(c.date instanceof Timestamp ? c.date.toDate() : c.date));
        const allTodaysClientsCompleted = todaysClients.length > 0 && todaysClients.every(c => c.visitStatus === 'Completado');

        let newStatus = selectedRoute.status;
        if (allPlanClientsCompleted) {
            newStatus = 'Completada';
        } else if (allTodaysClientsCompleted) {
            newStatus = 'En Progreso';
        }
        
        await updateRoute(selectedRoute.id, { clients: updatedFullList, status: newStatus });
        await refetchData('routes');
        setCurrentRouteClientsFull(updatedFullList);
        
        // Clear local draft
        const key = DRAFT_KEY(selectedRoute.id, activeClient.ruc);
        if (key) localStorage.removeItem(key);

        if (allPlanClientsCompleted) {
            toast({ title: "¡Ruta Finalizada!", description: "Has gestionado todos los clientes de esta ruta." });
        } else if (allTodaysClientsCompleted) {
            toast({ title: "Día Completado", description: "Has gestionado todos los clientes de hoy. ¡Buen trabajo!" });
        } else {
            toast({ title: "Salida Confirmada", description: `Visita a ${activeClient.nombre_comercial} completada.` });
        }
        
    } catch(error: any) {
        console.error("Error updating route on checkout:", error);
        toast({ title: "Error", description: error.message || "No se pudo actualizar el estado de la visita.", variant: "destructive"});
    } finally {
        setIsSaving(false);
    }
  }
  
  const handleRouteSelect = (routeId: string) => {
      setSelectedRouteId(routeId);
      if (SELECTION_KEY) {
          localStorage.setItem(SELECTION_KEY, routeId);
      }
      const route = allRoutes.find(r => r.id === routeId);
       if (route?.status === 'En Progreso' || route?.status === 'Incompleta') {
           const anyCompletedToday = route.clients.some(c => {
               let cDate = c.date;
               if (cDate instanceof Timestamp) cDate = cDate.toDate();
               return cDate && isToday(cDate) && c.visitStatus === 'Completado';
           });
           if (anyCompletedToday || route.status === 'En Progreso') {
               setIsRouteStarted(true);
           } else {
               setIsRouteStarted(false);
           }
       } else {
           setIsRouteStarted(false);
       }
  }

  const handleStartRoute = async () => {
      if (!selectedRoute) return;
      setIsStarting(true);
      try {
          await updateRoute(selectedRoute.id, { status: 'En Progreso' });
          await refetchData('routes');
          setIsRouteStarted(true);
          toast({ title: "Ruta Iniciada", description: `La ruta "${selectedRoute.routeName}" ha comenzado.` });
      } catch (error) {
          console.error("Failed to start route:", error);
          toast({ title: "Error", description: "No se pudo iniciar la ruta.", variant: 'destructive' });
      } finally {
          setIsStarting(false);
      }
  }

    const handleAddClientToRoute = async (client: Client) => {
        if (!selectedRoute) return;

        const newRouteClient: ClientInRoute = {
            ruc: client.ruc,
            nombre_comercial: client.nombre_comercial,
            date: new Date(),
            visitStatus: 'Pendiente',
            origin: 'manual',
            status: 'Activo'
        };
        
        setIsSaving(true);
        try {
            const updatedClients = [...currentRouteClientsFull, newRouteClient];
            await updateRoute(selectedRoute.id, { clients: updatedClients });
            await refetchData('routes');
            setCurrentRouteClientsFull(updatedClients);

            toast({ title: 'Cliente Añadido', description: `${client.nombre_comercial} ha sido añadido a la ruta de hoy.` });
            setIsAddClientDialogOpen(false);
        } catch (error: any) {
            console.error("Error adding client to route:", error);
            toast({ title: "Error", description: "No se pudo añadir el cliente a la ruta.", variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    }
    
    const availableClientsForDialog = useMemo(() => {
        const currentRucs = new Set(routeClients.map(c => c.ruc));
        
        let clientsToFilter = availableClients;

        if (user?.role === 'Usuario') {
            clientsToFilter = availableClients.filter(c => 
                c.ejecutivo?.trim().toLowerCase() === user.name?.trim().toLowerCase()
            );
        }

        return clientsToFilter.filter(c => {
          if (currentRucs.has(c.ruc)) return false;
          
          const searchTermLower = dialogSearchTerm.toLowerCase();
          return (
            String(c.nombre_cliente).toLowerCase().includes(searchTermLower) ||
            String(c.nombre_comercial).toLowerCase().includes(searchTermLower) ||
            String(c.ruc).includes(searchTermLower)
          );
        });
    }, [availableClients, routeClients, dialogSearchTerm, user]);

  const getNumericValueClass = (value: string) => {
    const numericValue = parseFloat(value);
    if (isNaN(numericValue) || value === '') return '';
    if (numericValue < 100) return 'bg-red-100 border-red-300 text-red-900 focus-visible:ring-red-500';
    if (numericValue >= 100) return 'bg-green-100 border-green-300 text-green-900 focus-visible:ring-green-500';
    return '';
  };
  
  const handleViewClientOnMap = (client: Client) => {
    if (isFinite(client.latitud) && isFinite(client.longitud)) {
        setClientForMap(client);
        setIsClientMapOpen(true);
    } else {
        toast({ title: "Ubicación no válida", description: "Este cliente no tiene coordenadas válidas.", variant: "destructive" });
    }
  }

  const onDragEnd = async (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || !selectedRoute) return;

    const reorderedTodaysClients = Array.from(routeClients);
    const [movedItem] = reorderedTodaysClients.splice(source.index, 1);
    reorderedTodaysClients.splice(destination.index, 0, movedItem);

    const reorderedTodaysPayload = reorderedTodaysClients.map(c => toClientInRoutePayload(c));

    const todaysRucs = new Set(reorderedTodaysClients.map(c => c.ruc));
    const otherClientsPayload = currentRouteClientsFull
        .filter(c => !todaysRucs.has(c.ruc))
        .map(c => ({
            ...c,
            date: c.date instanceof Timestamp ? c.date.toDate() : c.date
        }));

    const insertionIndex = currentRouteClientsFull.findIndex(c => todaysRucs.has(c.ruc));

    const finalPayload = [...otherClientsPayload];
    if (insertionIndex !== -1) {
        finalPayload.splice(insertionIndex, 0, ...reorderedTodaysPayload);
    } else {
        finalPayload.push(...reorderedTodaysPayload);
    }
    
    setIsSaving(true);
    try {
        await updateRoute(selectedRoute.id, { clients: finalPayload });
        await refetchData('routes');
        setCurrentRouteClientsFull(finalPayload);
        toast({ title: "Orden de Ruta Actualizado" });
    } catch (error: any) {
        console.error("Failed to update route order:", error);
        toast({ title: "Error", description: "No se pudo guardar el nuevo orden.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleDownloadDailyReport = () => {
    if (!selectedRoute) return;

    const completedClientsToday = routeClients.filter(c => c.visitStatus === 'Completado' && c.date && isToday(c.date instanceof Timestamp ? c.date.toDate() : c.date));
    
    if (completedClientsToday.length === 0) {
        toast({ title: "Sin Datos", description: "No hay clientes gestionados hoy para generar un reporte.", variant: "destructive" });
        return;
    }

    const dataToExport = completedClientsToday.map(client => {
      const fullClient = availableClients.find(c => c.ruc === client.ruc);
      return {
        'RUC': client.ruc,
        'Nombre Comercial': client.nombre_comercial,
        'Nombre Cliente': fullClient?.nombre_cliente || '',
        'Tipo de Visita': client.visitType === 'presencial' ? 'Presencial' : 'Telefónica',
        'Observación Llamada': client.callObservation || '',
        'Valor Venta ($)': parseFloat(String(client.valorVenta)) || 0,
        'Valor Cobro ($)': parseFloat(String(client.valorCobro)) || 0,
        'Devoluciones ($)': parseFloat(String(client.devoluciones)) || 0,
        'Promociones ($)': parseFloat(String(client.promociones)) || 0,
        'Medicación Frecuente ($)': parseFloat(String(client.medicacionFrecuente)) || 0,
      }
    });
    
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Gestión Diaria");
    const dailyReportFilename = `reporte_gestion_diaria_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(workbook, dailyReportFilename);
    toast({ title: "Reporte del Día Generado", description: "El reporte de gestión de hoy se ha descargado." });
  };


  const hasDescuento = activeClient?.nombre_comercial?.toLowerCase().includes('descuento');
  const isFormDisabled = isRouteExpired || !activeClient?.checkInTime || !visitType;


  return (
    <>
    <PageHeader title="Gestión de Ruta" description="Selecciona, inicia y gestiona tus rutas diarias."/>
    
    {!isRouteStarted ? (
        <Card className="max-w-2xl mx-auto">
            <CardHeader>
                <CardTitle>Selecciona una Ruta para Empezar</CardTitle>
                <CardDescription>Elige una de tus rutas planificadas para poder iniciarla y gestionarla.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Ruta</Label>
                    <Select onValueChange={handleRouteSelect} value={selectedRouteId} disabled={loading}>
                        <SelectTrigger>
                            <Route className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Elije una ruta planificada para hoy" />
                        </SelectTrigger>
                        <SelectContent>
                            {loading && <SelectItem value="loading" disabled>Cargando rutas...</SelectItem>}
                            {allRoutes && allRoutes
                                .filter(r => {
                                    const hasClientsForToday = r.clients.some(c => {
                                        let cDate = c.date;
                                        if (cDate instanceof Timestamp) cDate = cDate.toDate();
                                        return cDate && isToday(cDate) && c.status !== 'Eliminado';
                                    });
                                    return (
                                        r.createdBy === user?.id &&
                                        ['Planificada', 'Incompleta', 'En Progreso'].includes(r.status) && 
                                        hasClientsForToday
                                    );
                                })
                                .map(route => {
                                    const todayClient = route.clients.find(c => {
                                        let cDate = c.date;
                                        if (cDate instanceof Timestamp) cDate = cDate.toDate();
                                        return cDate && isToday(cDate) && c.status !== 'Eliminado';
                                    });
                                    const displayDate = todayClient?.date 
                                        ? format(todayClient.date instanceof Timestamp ? todayClient.date.toDate() : todayClient.date, 'dd/MM/yyyy', { locale: es }) 
                                        : '';
                                    
                                    return (
                                        <SelectItem key={route.id} value={route.id}>
                                            {route.routeName} - {displayDate} ({route.status})
                                        </SelectItem>
                                    );
                                })}
                        </SelectContent>
                    </Select>
                </div>
                {selectedRoute && (
                    <Button onClick={handleStartRoute} disabled={isStarting || !['Planificada', 'Incompleta', 'En Progreso'].includes(selectedRoute.status)} className="w-full">
                        {isStarting && <LoaderCircle className="animate-spin mr-2" />}
                        {selectedRoute.status === 'En Progreso' ? 'Continuar Gestión' : 'Iniciar Ruta'}
                    </Button>
                )}
            </CardContent>
        </Card>
    ) : (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1 flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>{selectedRoute?.routeName}</CardTitle>
                            <CardDescription>
                                Ruta actualmente en progreso.
                                <br />
                                <span className="font-semibold text-primary">
                                    {todayFormatted}
                                </span>
                            </CardDescription>
                        </div>
                        {isRouteStarted && (
                            <div className="text-right">
                                <p className="text-sm font-medium text-muted-foreground">Tiempo Restante</p>
                                <div className={cn("text-lg font-bold font-mono", remainingTime.expired && "text-destructive")}>
                                    {remainingTime.expired 
                                        ? "Expirado" 
                                        : `${String(remainingTime.hours).padStart(2, '0')}:${String(remainingTime.minutes).padStart(2, '0')}:${String(remainingTime.seconds).padStart(2, '0')}`
                                    }
                                </div>
                            </div>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {selectedRoute && (
                       <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <Label>Clientes en Ruta ({routeClients.length})</Label>
                                {(!routeClients.every(c => c.visitStatus === 'Completado') && selectedRoute?.status !== 'Completada') && (
                                <Dialog open={isAddClientDialogOpen} onOpenChange={setIsAddClientDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="ghost" size="sm" disabled={isRouteExpired}>
                                            <PlusCircle className="mr-2 h-4 w-4"/>
                                            Añadir
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl">
                                        <DialogHeader>
                                            <DialogTitle>Añadir Cliente a la Ruta</DialogTitle>
                                            <DialogDescription>
                                                Busca y selecciona un cliente para añadirlo a tu ruta actual.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input 
                                                placeholder="Buscar por nombre, RUC..." 
                                                className="pl-8" 
                                                value={dialogSearchTerm}
                                                onChange={(e) => setDialogSearchTerm(e.target.value)}
                                            />
                                        </div>
                                        <ScrollArea className="h-72">
                                            <div className="space-y-2 p-1">
                                                {availableClientsForDialog.map(client => (
                                                <div key={client.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                                    <div className="flex items-center space-x-3">
                                                        <Label htmlFor={`client-${client.id}`} className="font-normal cursor-pointer">
                                                        <p className="font-medium">{client.nombre_comercial}</p>
                                                        <p className="text-xs text-muted-foreground">{client.ruc} - {client.nombre_cliente}</p>
                                                        </Label>
                                                    </div>
                                                    <Button size="sm" onClick={() => handleAddClientToRoute(client)}>
                                                        <Plus className="mr-2"/> Añadir
                                                    </Button>
                                                </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </DialogContent>
                                </Dialog>
                                )}
                            </div>
                            <DragDropContext onDragEnd={onDragEnd}>
                                <Droppable droppableId="clients">
                                {(provided) => (
                                    <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className="mt-2 space-y-2 max-h-[calc(100vh-20rem)] overflow-y-auto pr-2 rounded-md border p-2"
                                    >
                                    {routeClients.length > 0 ? routeClients.map((client, index) => (
                                        <Draggable key={client.ruc} draggableId={client.ruc} index={index} isDragDisabled={client.visitStatus === 'Completado'}>
                                        {(provided, snapshot) => (
                                            <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className={cn(
                                                "flex items-center justify-between text-sm p-2 bg-muted/50 rounded-md relative",
                                                activeClient?.ruc === client.ruc && "bg-primary/10 border-primary/50 border",
                                                client.visitStatus === 'Completado' && 'opacity-60',
                                                snapshot.isDragging && "shadow-lg"
                                            )}
                                            >
                                            <div className="flex items-center gap-3 flex-1">
                                                <div className={cn("cursor-grab", client.visitStatus === 'Completado' && 'cursor-not-allowed')}>
                                                  <GripVertical className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <span className={cn("font-semibold", activeClient?.ruc === client.ruc && "text-primary")}>{index + 1}.</span>
                                                <span className="truncate flex-1" title={client.nombre_comercial}>{client.nombre_comercial}</span>
                                            </div>
                                            <div className="flex items-center">
                                                {client.visitStatus === 'Completado' && <CheckCircle className="h-4 w-4 text-green-500 mr-2" />}
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {e.stopPropagation(); handleViewClientOnMap(client)}}>
                                                    <MapPin className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            {client.origin === 'manual' && <Badge className="absolute -top-2 -right-2 z-10">Nuevo</Badge>}
                                            </div>
                                        )}
                                        </Draggable>
                                    )) : <p className="text-sm text-muted-foreground text-center py-4">No hay clientes para gestionar hoy.</p>}
                                    {provided.placeholder}
                                    </div>
                                )}
                                </Droppable>
                            </DragDropContext>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-2">
             <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>{selectedRoute ? "Gestión de Cliente" : 'Gestión de Clientes'}</CardTitle>
                            <CardDescription>
                                {activeClient ? `Gestionando a ${activeClient.nombre_comercial}` : 'Selecciona un cliente de la lista para ver sus detalles.'}
                            </CardDescription>
                        </div>
                         {selectedRoute && <Badge variant={selectedRoute.status === 'Incompleta' ? 'destructive' : 'secondary'}>{selectedRoute.status}</Badge>}
                    </div>
                </CardHeader>
                <CardContent>
                     {isRouteExpired && !activeClient?.visitStatus && activeClient?.checkInTime && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Ruta {selectedRoute?.status === 'Incompleta' ? 'Incompleta' : 'Expirada'}</AlertTitle>
                            <AlertDescription>
                                El tiempo para gestionar esta ruta ha terminado (20:30). Ya no puedes realizar cambios.
                            </AlertDescription>
                        </Alert>
                    )}
                    {!selectedRoute ? (
                        <div className="flex items-center justify-center min-h-[60vh] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-8 text-center">
                            <div>
                                <p className="font-semibold text-lg">Sin Ruta Seleccionada</p>
                                <p className="text-muted-foreground">Por favor, elige una ruta para empezar a gestionar clientes.</p>
                            </div>
                        </div>
                    ) : !activeClient ? (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] rounded-lg border-2 border-dashed border-green-500/50 bg-green-500/10 p-8 text-center text-green-900">
                            <div>
                                <CheckCircle className="h-12 w-12 mx-auto mb-4" />
                                <p className="font-semibold text-xl">¡Día Completado!</p>
                                <p>Has gestionado todos los clientes de hoy. ¡Buen trabajo!</p>
                                <Button onClick={handleDownloadDailyReport} className="mt-4">
                                    <Download className="mr-2 h-4 w-4" />
                                    Generar Reporte del Día
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Card key={activeClient.id} className="p-4 bg-background">
                                <div className="flex items-start gap-4">
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-lg">{activeClient.nombre_comercial}</p>
                                                <p className="text-sm text-muted-foreground">{activeClient.direccion}</p>
                                            </div>
                                        </div>
                                        <Separator className="my-4" />

                                        <div className="space-y-6">
                                            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold text-lg">1</div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold">Marcar Entrada</h4>
                                                    <p className="text-sm text-muted-foreground">Registra tu hora de llegada al cliente.</p>
                                                </div>
                                                {activeClient.checkInTime ? (
                                                     <div className="text-center">
                                                        <p className="font-bold text-green-600">Entrada Marcada</p>
                                                        <p className="text-sm font-mono">{activeClient.checkInTime}</p>
                                                    </div>
                                                ) : (
                                                    <Button onClick={() => openConfirmationDialog('checkIn')} disabled={isRouteExpired || isSaving}>
                                                        <LogIn className="mr-2" />
                                                        Marcar Entrada
                                                    </Button>
                                                )}
                                            </div>

                                            <div className={cn("space-y-4 pl-14 transition-opacity", !activeClient.checkInTime && "opacity-50 pointer-events-none")}>
                                                 <div className="flex items-center gap-4">
                                                     <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold text-lg">2</div>
                                                     <div>
                                                        <h4 className="font-semibold">Tipo de Visita</h4>
                                                        <p className="text-sm text-muted-foreground">Selecciona si la visita es presencial o por llamada.</p>
                                                     </div>
                                                </div>
                                                <RadioGroup onValueChange={(value: any) => setVisitType(value)} value={visitType} className="flex gap-4 pl-14">
                                                    <Label htmlFor="presencial" className="flex items-center gap-2 cursor-pointer rounded-md border p-3 has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
                                                        <RadioGroupItem value="presencial" id="presencial" />
                                                        <User className="mr-1 h-4 w-4" />
                                                        Visita Presencial
                                                    </Label>
                                                    <Label htmlFor="telefonica" className="flex items-center gap-2 cursor-pointer rounded-md border p-3 has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
                                                        <RadioGroupItem value="telefonica" id="telefonica" />
                                                        <Phone className="mr-1 h-4 w-4" />
                                                        Llamada Telefónica
                                                    </Label>
                                                </RadioGroup>
                                                {visitType === 'telefonica' && (
                                                    <div className="pl-14">
                                                        <Label htmlFor="callObservation">Observación de la llamada (requerido)</Label>
                                                        <Textarea
                                                            id="callObservation"
                                                            value={callObservation}
                                                            onChange={(e) => setCallObservation(e.target.value)}
                                                            placeholder="Ej: Cliente solicitó gestionar por teléfono..."
                                                            disabled={isRouteExpired}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className={cn("space-y-4 transition-opacity", isFormDisabled && "opacity-50 pointer-events-none")}>
                                                <div className="flex items-center gap-4">
                                                     <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold text-lg">3</div>
                                                     <div>
                                                        <h4 className="font-semibold">Registrar Gestión</h4>
                                                        <p className="text-sm text-muted-foreground">Ingresa los valores de la visita.</p>
                                                     </div>
                                                </div>
                                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pl-14">
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`venta-${activeClient.ruc}`}>Valor de Venta ($)</Label>
                                                        <Input id={`venta-${activeClient.ruc}`} type="number" value={activeClient.valorVenta} onChange={(e) => handleClientValueChange(activeClient.ruc, 'valorVenta', e.target.value)} disabled={isFormDisabled} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`cobro-${activeClient.ruc}`}>Valor de Cobro ($)</Label>
                                                        <Input id={`cobro-${activeClient.ruc}`} type="number" value={activeClient.valorCobro} onChange={(e) => handleClientValueChange(activeClient.ruc, 'valorCobro', e.target.value)} disabled={isFormDisabled} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label htmlFor={`devoluciones-${activeClient.ruc}`}>Devoluciones ($)</Label>
                                                        <Input id={`devoluciones-${activeClient.ruc}`} type="number" value={activeClient.devoluciones} onChange={(e) => handleClientValueChange(activeClient.ruc, 'devoluciones', e.target.value)} disabled={isFormDisabled} />
                                                    </div>
                                                    {hasDescuento && (
                                                        <>
                                                            <div className="space-y-1">
                                                                <Label htmlFor={`promociones-${activeClient.ruc}`}>Promociones ($)</Label>
                                                                <Input id={`promociones-${activeClient.ruc}`} type="number" value={activeClient.promociones} onChange={(e) => handleClientValueChange(activeClient.ruc, 'promociones', e.target.value)} className={getNumericValueClass(activeClient.promociones)} disabled={isFormDisabled} />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <Label htmlFor={`medicacionFrecuente-${activeClient.ruc}`}>Medicación Frecuente ($)</Label>
                                                                <Input id={`medicacionFrecuente-${activeClient.ruc}`} type="number" value={activeClient.medicacionFrecuente} onChange={(e) => handleClientValueChange(activeClient.ruc, 'medicacionFrecuente', e.target.value)} className={getNumericValueClass(activeClient.medicacionFrecuente)} disabled={isFormDisabled} />
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className={cn("flex items-center gap-4 p-3 rounded-lg bg-muted/50 transition-opacity", isFormDisabled && "opacity-50 pointer-events-none")}>
                                                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold text-lg">4</div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold">Marcar Salida</h4>
                                                    <p className="text-sm text-muted-foreground">Finaliza y guarda la visita a este cliente.</p>
                                                </div>
                                                <Button onClick={() => openConfirmationDialog('checkOut')} disabled={isFormDisabled || isSaving}>
                                                    <LogOut className="mr-2" />
                                                    Marcar y Guardar Salida
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
    )}
    <Dialog open={isClientMapOpen} onOpenChange={setIsClientMapOpen}>
        <DialogContent className="max-w-xl h-[60vh] flex flex-col">
            <DialogHeader>
                <DialogTitle>Ubicación de {clientForMap?.nombre_comercial}</DialogTitle>
            </DialogHeader>
            <div className="flex-grow">
                {clientForMap && (
                    <MapView 
                        key={clientForMap.id}
                        clients={[clientForMap]}
                        containerClassName="h-full w-full"
                    />
                )}
            </div>
        </DialogContent>
    </Dialog>
     <Dialog open={confirmationDialogOpen} onOpenChange={setConfirmationDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
            <div className="h-48 w-full">
                 <MapView 
                    key={confirmationAction}
                    center={markerPosition || undefined}
                    markerPosition={markerPosition}
                    containerClassName="h-full w-full"
                />
            </div>
            <div className="p-6 space-y-4 text-center">
                <DialogTitle className="text-xl">
                   Se marcará evento de <br/>
                    <span className="font-bold text-2xl text-primary">
                        {confirmationAction === 'checkIn' ? 'Entrada a Cliente' : 'Salida de Cliente'}
                    </span>
                </DialogTitle>
                <DialogDescription className="text-base">
                    con fecha hoy a las <span className="font-semibold text-foreground">{currentTime}</span>
                    <br />
                    en la ubicación mostrada. ¿Desea continuar?
                </DialogDescription>
            </div>
            <DialogFooter className="bg-muted/50 p-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setConfirmationDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleConfirmAction} disabled={isSaving}>
                    {isSaving && <LoaderCircle className="animate-spin" />}
                    Confirmar
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
    </>
  );
}