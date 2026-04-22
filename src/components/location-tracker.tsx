
'use client';

import { useTracker } from '@/hooks/use-tracker';

/**
 * Componente invisible que activa el rastreo global si el usuario está autenticado.
 */
export function LocationTracker() {
  useTracker();
  return null;
}
