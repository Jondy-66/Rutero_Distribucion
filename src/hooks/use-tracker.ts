
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { updateLiveLocation, saveBreadcrumb } from '@/lib/firebase/firestore';

/**
 * Hook de Rastreo Profesional con Resiliencia de Señal
 * Distingue entre permisos denegados (Bloqueo Estricto) y fallos de señal (Tolerancia).
 */
export function useTracker() {
  const { user } = useAuth();
  const lastPosition = useRef<{ lat: number; lng: number } | null>(null);
  
  // Estados para manejo inteligente de bloqueo
  const [gpsEnabled, setGpsEnabled] = useState<boolean>(true);
  const [isPermissionDenied, setIsPermissionDenied] = useState<boolean>(false);
  const [isSignalWeak, setIsSignalWeak] = useState<boolean>(false);

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

  const handleGpsError = useCallback((error: GeolocationPositionError) => {
    if (!user) return;
    const isDenied = error.code === error.PERMISSION_DENIED;
    const isWeak = error.code === error.POSITION_UNAVAILABLE || error.code === error.TIMEOUT;

    setIsPermissionDenied(isDenied);
    setIsSignalWeak(isWeak);
    setGpsEnabled(!isDenied && !isWeak);

    // Reportar el estado a Firestore para el supervisor
    updateLiveLocation(user.id, {
        gpsEnabled: false,
        isPermissionDenied: isDenied,
        isSignalWeak: isWeak,
        userName: user.name
    }).catch(() => {});
  }, [user]);

  /**
   * Función para disparar la petición de permiso y actualización inmediata.
   */
  const requestPermission = useCallback(() => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            setIsPermissionDenied(false);
            setIsSignalWeak(false);
            setGpsEnabled(true);
            
            const { latitude: lat, longitude: lng, accuracy, heading } = position.coords;
            lastPosition.current = { lat, lng };
            sendUpdate(lat, lng, accuracy, heading, true, false, false);
        },
        handleGpsError,
        { enableHighAccuracy: true, timeout: 15000 }
    );
  }, [handleGpsError, sendUpdate]);

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
        if (accuracy > 80) return; // Filtro de ruido

        let distance = 0;
        if (lastPosition.current) {
          distance = calculateDistance(lastPosition.current.lat, lastPosition.current.lng, lat, lng);
        }

        if (!lastPosition.current || distance > 25) {
          lastPosition.current = { lat, lng };
          sendUpdate(lat, lng, accuracy, heading, true, false, false);
          if (distance > 25) saveBreadcrumb(user.id, { lat, lng }).catch(() => {});
        }
      },
      handleGpsError,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );

    // 3. HEARTBEAT RESILIENTE (CADA 2 MINUTOS)
    const heartbeatInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
            requestPermission();
        }
    }, 2 * 60 * 1000);

    // 4. ACTUALIZACIÓN POR RE-ENTRADA (MÁXIMA PRIORIDAD)
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') requestPermission();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 5. MONITOR DE PERMISOS (CHROME/FIREFOX)
    if ('permissions' in navigator) {
        navigator.permissions.query({ name: 'geolocation' }).then((status) => {
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
  }, [user, handleGpsError, requestPermission]);

  return { gpsEnabled, isPermissionDenied, isSignalWeak, requestPermission };
}
