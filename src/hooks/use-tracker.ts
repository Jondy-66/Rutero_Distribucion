
'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { updateLiveLocation, saveBreadcrumb } from '@/lib/firebase/firestore';

/**
 * Hook de Rastreo Profesional Optimizado
 * Implementa Heartbeat de 2 minutos, detección de permisos y reporte de estado GPS.
 */
export function useTracker() {
  const { user } = useAuth();
  const lastPosition = useRef<{ lat: number; lng: number } | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState<boolean>(true);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Metros
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const dPhi = ((lat2 - lat1) * Math.PI) / 180;
    const dLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(dLambda / 2) * Math.sin(dLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  useEffect(() => {
    // Los Auditores y Administradores no necesitan ser rastreados
    if (!user || user.role === 'Auditor' || user.role === 'Administrador') return;

    if (!navigator.geolocation) {
      setGpsEnabled(false);
      return;
    }

    const sendUpdate = (lat: number, lng: number, accuracy: number, heading: number | null, isEnabled: boolean = true) => {
        updateLiveLocation(user.id, {
            lat,
            lng,
            accuracy,
            heading: heading || 0,
            userName: user.name,
            gpsEnabled: isEnabled
        }).catch(() => {
            // Firestore maneja la persistencia offline automáticamente
        });
    };

    const reportGpsDisabled = () => {
        setGpsEnabled(false);
        updateLiveLocation(user.id, {
            gpsEnabled: false,
            userName: user.name
        }).catch(() => {});
    };

    const triggerImmediateUpdate = () => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setGpsEnabled(true);
                const { latitude: lat, longitude: lng, accuracy, heading } = position.coords;
                lastPosition.current = { lat, lng };
                sendUpdate(lat, lng, accuracy, heading, true);
            },
            (error) => {
                console.error("GPS Error:", error.message);
                reportGpsDisabled();
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );
    };

    // 1. CAPTURA INICIAL
    triggerImmediateUpdate();

    // 2. MONITOREO DE MOVIMIENTO CONTINUO
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsEnabled(true);
        const { latitude: lat, longitude: lng, accuracy, heading } = position.coords;

        // Filtro de ruido: Ignorar si la precisión es muy mala (> 60m)
        if (accuracy > 60) return;

        let distance = 0;
        if (lastPosition.current) {
          distance = calculateDistance(
            lastPosition.current.lat,
            lastPosition.current.lng,
            lat,
            lng
          );
        }

        // Si hubo movimiento real (> 25 metros) o es el primer punto
        if (!lastPosition.current || distance > 25) {
          lastPosition.current = { lat, lng };
          sendUpdate(lat, lng, accuracy, heading, true);
          
          if (distance > 25) {
              saveBreadcrumb(user.id, { lat, lng }).catch(() => {});
          }
        }
      },
      (error) => {
          console.error("GPS Watch Error:", error.message);
          reportGpsDisabled();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 20000,
      }
    );

    // 3. HEARTBEAT ROBUSTO (CADA 2 MINUTOS)
    // Esto asegura que el estado sea "EN LÍNEA" constantemente mientras la app esté abierta
    const heartbeatInterval = setInterval(() => {
        if (lastPosition.current) {
            sendUpdate(lastPosition.current.lat, lastPosition.current.lng, 10, 0, true);
        } else {
            triggerImmediateUpdate();
        }
    }, 2 * 60 * 1000); 

    // 4. ACTUALIZACIÓN POR RE-ENTRADA (VISIBILITY CHANGE)
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            triggerImmediateUpdate();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
        navigator.geolocation.clearWatch(watchId);
        clearInterval(heartbeatInterval);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  return { gpsEnabled };
}
