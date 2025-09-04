
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
 * Llama a una ruta de API local que actúa como proxy para evitar problemas de CORS.
 * @param {GetPrediccionesParams} params - Los parámetros para la consulta de predicción.
 * @returns {Promise<Prediction[]>} Una promesa que se resuelve con un array de objetos de predicción.
 */
export async function getPredicciones({ fecha_inicio, dias }: GetPrediccionesParams): Promise<Prediction[]> {
  // Apunta a la ruta de API local que actúa como proxy.
  const url = new URL("/api/predicciones", window.location.origin);
  if (fecha_inicio) url.searchParams.append("fecha_inicio", fecha_inicio);
  if (dias) url.searchParams.append("dias", String(dias));
  
  const response = await fetch(url);
  
  if (!response.ok) {
    // Intenta parsear el error del cuerpo de la respuesta para dar más detalles.
    try {
        const errorBody = await response.json();
        throw new Error(errorBody.message || `Error en la API: ${response.statusText}`);
    } catch(e) {
        throw new Error(`Error en la API: ${response.statusText}`);
    }
  }
  
  return response.json();
}

/**
 * Parámetros para la función getRutaOptima.
 */
type GetRutaOptimaParams = {
  origen: string;
  waypoints: string[];
  api_key: string;
};

/**
 * Obtiene la ruta óptima desde el servicio externo.
 * @param {GetRutaOptimaParams} params - Los parámetros para el cálculo de la ruta.
 * @returns {Promise<any>} Una promesa que se resuelve con los datos de la ruta óptima.
 */
export async function getRutaOptima({ origen, waypoints, api_key }: GetRutaOptimaParams): Promise<any> {
  const url = new URL("/api/ruta-optima", window.location.origin);
  url.searchParams.append("origen", origen);
  url.searchParams.append("api_key", api_key);
  waypoints.forEach((wp) => url.searchParams.append("waypoints", wp.trim()));
 
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Error en la API: ${response.statusText}`);
  }
  return response.json();
}
