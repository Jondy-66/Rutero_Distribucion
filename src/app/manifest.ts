import type { MetadataRoute } from 'next';

/**
 * @fileoverview Configuración del manifiesto de la PWA para Rutero.
 * Define cómo se comporta la aplicación al ser instalada en un dispositivo.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rutero | Distribución',
    short_name: 'Rutero',
    description: 'Planificación y Gestión Avanzada de Rutas - Farmaenlace',
    start_url: '/',
    display: 'standalone',
    background_color: '#f3f4f9',
    theme_color: '#011688',
    icons: [
      {
        src: 'https://i.ibb.co/bMC7XpjC/logo-distribucion1.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: 'https://i.ibb.co/bMC7XpjC/logo-distribucion1.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
