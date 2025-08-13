/**
 * @fileoverview Este archivo contiene funciones para interactuar con APIs externas,
 * como el servicio de predicción de rutas.
 */
import type { Prediction } from '@/lib/types';

/**
 * Parámetros para la función getPredicciones.
 */
type GetPrediccionesParams = {
  fecha_inicio?: string;
  dias?: number;
};

/**
 * Obtiene las predicciones de visitas desde la API externa de predicción de rutas.
 * @param {GetPrediccionesParams} params - Los parámetros para la consulta de predicción.
 * @returns {Promise<Prediction[]>} Una promesa que se resuelve con un array de objetos de predicción.
 */
export async function getPredicciones({ fecha_inicio, dias }: GetPrediccionesParams): Promise<Prediction[]> {
  const url = new URL("https://api-distribucion-rutas.onrender.com/predecir");
  if (fecha_inicio) url.searchParams.append("fecha_inicio", fecha_inicio);
  if (dias) url.searchParams.append("dias", String(dias));
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Error en la API: ${response.statusText}`);
  }
  
  return response.json();
}
