
'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { updateLiveLocation, saveBreadcrumb } from '@/lib/firebase/firestore';

/**
 * Hook de Rastreo Profesional
 * Implementa filtros de eficiencia: Precisión < 20m y Movimiento > 30m.
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
    if (!user || user.role === 'Auditor') return;

    if (!navigator.geolocation) {
      console.warn("Geolocalización no soportada");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude: lat, longitude: lng, accuracy, heading } = position.coords;

        // Filtro 1: Precisión mínima aceptable
        if (accuracy > 20) return;

        let distance = 0;
        if (lastPosition.current) {
          distance = calculateDistance(
            lastPosition.current.lat,
            lastPosition.current.lng,
            lat,
            lng
          );
        }

        // Filtro 2: Movimiento significativo (> 30 metros) o primera posición
        if (!lastPosition.current || distance > 30) {
          lastPosition.current = { lat, lng };

          // Actualizar posición en vivo
          updateLiveLocation(user.id, {
            lat,
            lng,
            accuracy,
            heading: heading || 0,
            userName: user.name
          });

          // Guardar en histórico (Breadcrumb)
          saveBreadcrumb(user.id, { lat, lng });
        }
      },
      (error) => console.error("Error tracker:", error),
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 5000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user]);

  return null;
}
