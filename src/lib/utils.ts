/**
 * @fileoverview Proporciona funciones de utilidad para la aplicación.
 */

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Combina múltiples nombres de clase de Tailwind CSS de forma segura.
 * Utiliza `clsx` para manejar clases condicionales y `tailwind-merge` para
 * resolver conflictos de clases de Tailwind de manera inteligente.
 * 
 * @param {...ClassValue[]} inputs - Una lista de nombres de clase o objetos de clase condicionales.
 * @returns {string} Una cadena de texto con los nombres de clase finales.
 * 
 * @example
 * cn("p-4", "font-bold", { "bg-red-500": isError });
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
