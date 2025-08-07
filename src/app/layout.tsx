/**
 * @fileoverview Este es el layout raíz de la aplicación.
 * Envuelve todas las páginas y es el lugar ideal para incluir proveedores de contexto globales,
 * fuentes y estilos base.
 */

import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/contexts/auth-context';

/**
 * Metadatos de la aplicación para SEO y visualización en navegadores.
 */
export const metadata: Metadata = {
  title: 'Rutero',
  description: 'Planificación y Gestión Avanzada de Rutas',
};

/**
 * Componente RootLayout que define la estructura HTML base para toda la aplicación.
 * @param {object} props - Propiedades del componente.
 * @param {React.ReactNode} props.children - Los componentes hijos que serán renderizados dentro del layout.
 * @returns {React.ReactElement} El layout raíz de la aplicación.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* Precarga de las fuentes de Google Fonts para mejorar el rendimiento. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"></link>
      </head>
      <body className="font-body antialiased">
        {/* El AuthProvider envuelve toda la aplicación para proporcionar el estado de autenticación a todos los componentes. */}
        <AuthProvider>
            {children}
            {/* El Toaster es el componente que muestra las notificaciones (toasts) en toda la aplicación. */}
            <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
