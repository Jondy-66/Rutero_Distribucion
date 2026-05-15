/**
 * @fileoverview Este es el layout raíz de la aplicación.
 * Envuelve todas las páginas y es el lugar ideal para incluir proveedores de contexto globales,
 * fuentes y estilos base. Optimizado para PWA.
 */

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/contexts/auth-context';

/**
 * Configuración del viewport para una experiencia PWA óptima.
 */
export const viewport: Viewport = {
  themeColor: '#011688',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/**
 * Metadatos de la aplicación para SEO, visualización en navegadores y PWA.
 */
export const metadata: Metadata = {
  title: 'Rutero | Distribución',
  description: 'Planificación y Gestión Avanzada de Rutas',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rutero',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: 'https://i.ibb.co/bMC7XpjC/logo-distribucion1.png',
    shortcut: 'https://i.ibb.co/bMC7XpjC/logo-distribucion1.png',
    apple: 'https://i.ibb.co/bMC7XpjC/logo-distribucion1.png',
  },
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
        
        {/* Meta tags adicionales para compatibilidad con móviles */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Rutero" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
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
