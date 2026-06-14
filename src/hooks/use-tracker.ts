
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { updateLiveLocation, saveBreadcrumb } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';

/**
 * Hook de Rastreo Profesional con Resiliencia de Señal
 * Distingue entre permisos denegados (Bloqueo Estricto) y fallos de señal (Tolerancia).
 */
export function useTracker() {
  const { user } = useAuth();
  const { toast } = useToast();
  const lastPosition = useRef<{ lat: number; lng: number } | null>(null);
  
  // Estados para manejo inteligente de bloqueo
  const [gpsEnabled, setGpsEnabled] = useState<boolean>(true);
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);
  const [isSignalWeak, setIsSignalWeak] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dPhi = ((lat2 - lat1) * Math.PI) / 180;
    const dLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const sendUpdate = useCallback((lat: number, lng: number, accuracy: number, heading: number | null, isEnabled: boolean, isDenied: boolean, isWeak: boolean) => {
    if (!user) return;
    updateLiveLocation(user.id, {
        lat,
        lng,
        accuracy,
        heading: heading || 0,
        userName: user.name,
        gpsEnabled: isEnabled,
        isPermissionDenied: isDenied,
        isSignalWeak: isWeak
    }).catch(() => {});
  }, [user]);

  const handleGpsError = useCallback((error: GeolocationPositionError, isManual: boolean = false) => {
    if (!user) return;
    const isDenied = error.code === error.PERMISSION_DENIED;
    const isWeak = error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT;

    setIsPermissionDenied(isDenied);
    setIsSignalWeak(isWeak);
    setGpsEnabled(!isDenied && !isWeak);

    if (isManual && isDenied) {
        toast({
            title: "Acceso Bloqueado",
            description: "Por favor, permite el acceso a la ubicación en la configuración de tu navegador (clic en el candado junto a la URL).",
            variant: "destructive"
        });
    }

    // Reportar el estado a Firestore para el supervisor
    updateLiveLocation(user.id, {
        gpsEnabled: false,
        isPermissionDenied: isDenied,
        isSignalWeak: isWeak,
        userName: user.name
    }).catch(() => {});
  }, [user, toast]);

  /**
   * Función para disparar la petición de permiso y actualización inmediata.
   */
  const requestPermission = useCallback((isManual: boolean = false) => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    
    if (isManual) setIsChecking(true);
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            setIsChecking(false);
            setIsPermissionDenied(false);
            setIsSignalWeak(false);
            setGpsEnabled(true);
            
            const { latitude: lat, longitude: lng, accuracy, heading } = position.coords;
            lastPosition.current = { lat, lng };
            sendUpdate(lat, lng, accuracy, heading, true, false, false);
            
            if (isManual) {
                toast({ title: "Rastreo Activado", description: "Tu ubicación se está sincronizando correctamente." });
            }
        },
        (error) => {
            setIsChecking(false);
            handleGpsError(error, isManual);
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [handleGpsError, sendUpdate, toast]);

  useEffect(() => {
    if (!user || user.role === 'Auditor' || user.role === 'Administrador') return;

    // 1. CAPTURA INICIAL
    requestPermission();

    // 2. MONITOREO DE MOVIMIENTO Y SEÑAL
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setIsPermissionDenied(false);
        setIsSignalWeak(false);
        setGpsEnabled(true);
        
        const { latitude: lat, longitude: lng, accuracy, heading } = position.coords;
        if (accuracy > 100) return; // Filtro de ruido excesivo

        let distance = 0;
        if (lastPosition.current) {
          distance = calculateDistance(lastPosition.current.lat, lastPosition.current.lng, lat, lng);
        }

        if (!lastPosition.current || distance > 30) {
          lastPosition.current = { lat, lng };
          sendUpdate(lat, lng, accuracy, heading, true, false, false);
          if (distance > 30) saveBreadcrumb(user.id, { lat, lng }).catch(() => {});
        }
      },
      (err) => handleGpsError(err, false),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
    );

    // 3. HEARTBEAT RESILIENTE (CADA 3 MINUTOS)
    const heartbeatInterval = setInterval(() => {
        if (document.visibilityState === 'visible' && !isPermissionDenied) {
            requestPermission();
        }
    }, 3 * 60 * 1000);

    // 4. ACTUALIZACIÓN POR RE-ENTRADA (MÁXIMA PRIORIDAD)
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible' && !isPermissionDenied) requestPermission();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 5. MONITOR DE PERMISOS (CHROME/FIREFOX)
    if (typeof window !== 'undefined' && 'permissions' in navigator) {
        navigator.permissions.query({ name: 'geolocation' as any }).then((status) => {
            status.onchange = () => {
                if (status.state === 'denied') {
                    setIsPermissionDenied(true);
                    setGpsEnabled(false);
                } else if (status.state === 'granted') {
                    setIsPermissionDenied(false);
                    requestPermission();
                }
            };
        });
    }

    return () => {
        navigator.geolocation.clearWatch(watchId);
        clearInterval(heartbeatInterval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, handleGpsError, requestPermission, isPermissionDenied]);

  return { gpsEnabled, isPermissionDenied, isSignalWeak, isChecking, requestPermission };
}
