'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { updateLiveLocation, saveBreadcrumb } from '@/lib/firebase/firestore';

/**
 * Hook de Rastreo Profesional
 * Implementa filtros de eficiencia: Precisión < 30m y Movimiento > 30m.
 * Incluye lógica de "Heartbeat" para mantener el estado ONLINE incluso si el usuario está estacionario.
 */
export function useTracker() {
  const { user } = useAuth();
  const lastPosition = useRef<{ lat: number; lng: number } | null>(null);

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
    // No rastrear si el usuario no está logueado o es Auditor
    if (!user || user.role === 'Auditor') return;

    if (!navigator.geolocation) {
      return;
    }

    const sendUpdate = (lat: number, lng: number, accuracy: number, heading: number | null) => {
        updateLiveLocation(user.id, {
            lat,
            lng,
            accuracy,
            heading: heading || 0,
            userName: user.name
        }).catch(() => {
            // Firestore se encarga vía persistencia local si no hay red
        });
    };

    // 1. OBTENER POSICIÓN INICIAL INMEDIATA
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude: lat, longitude: lng, accuracy, heading } = position.coords;
            lastPosition.current = { lat, lng };
            sendUpdate(lat, lng, accuracy, heading);
        },
        null,
        { enableHighAccuracy: true }
    );

    // 2. MONITOREO DE MOVIMIENTO
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude: lat, longitude: lng, accuracy, heading } = position.coords;

        // Filtro: Ignorar puntos muy ruidosos
        if (accuracy > 40) return;

        let distance = 0;
        if (lastPosition.current) {
          distance = calculateDistance(
            lastPosition.current.lat,
            lastPosition.current.lng,
            lat,
            lng
          );
        }

        // Si se movió más de 30 metros o es la primera vez
        if (!lastPosition.current || distance > 30) {
          lastPosition.current = { lat, lng };
          sendUpdate(lat, lng, accuracy, heading);
          
          // Solo guardamos en historial si hubo movimiento real para no saturar la DB
          if (distance > 30) {
              saveBreadcrumb(user.id, { lat, lng }).catch(() => {});
          }
        }
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 15000,
      }
    );

    // 3. HEARTBEAT (LATIDO) CADA 3 MINUTOS
    // Esto asegura que en el panel de supervisión se vea ONLINE aunque esté quieto.
    const heartbeatInterval = setInterval(() => {
        if (lastPosition.current) {
            sendUpdate(lastPosition.current.lat, lastPosition.current.lng, 10, 0);
        } else {
            // Si no tenemos posición previa, intentamos forzar una captura
            navigator.geolocation.getCurrentPosition((pos) => {
                const { latitude, longitude, accuracy, heading } = pos.coords;
                lastPosition.current = { lat: latitude, lng: longitude };
                sendUpdate(latitude, longitude, accuracy, heading);
            });
        }
    }, 3 * 60 * 1000); 

    return () => {
        navigator.geolocation.clearWatch(watchId);
        clearInterval(heartbeatInterval);
    };
  }, [user]);

  return null;
}
