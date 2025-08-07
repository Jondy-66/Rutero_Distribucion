/**
 * @fileoverview Esta es la página de inicio de la aplicación.
 * Su principal responsabilidad es redirigir al usuario según su estado de autenticación.
 */
'use client';
import { useAuth } from '@/hooks/use-auth';
import { redirect } from 'next/navigation';
import { Route } from 'lucide-react';

/**
 * Componente de la página de inicio.
 * Muestra una pantalla de carga mientras se verifica el estado de autenticación.
 * Si el usuario está autenticado, lo redirige al '/dashboard'.
 * Si no está autenticado, lo redirige a '/login'.
 * @returns {React.ReactElement | null} El componente de la página de inicio o una redirección.
 */
export default function Home() {
  // Hook para acceder al contexto de autenticación.
  const { user, loading } = useAuth();

  // Muestra una pantalla de carga mientras se verifica el estado del usuario.
  if (loading) {
    return (
        <div className="w-full min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="inline-block bg-primary text-primary-foreground p-4 rounded-full">
                    <Route className="h-10 w-10 animate-pulse" />
                </div>
                <p className="text-muted-foreground">Cargando Rutero...</p>
            </div>
      </div>
    );
  }

  // Si hay un usuario autenticado, redirige al panel de control.
  if (user) {
    return redirect('/dashboard');
  } 
  
  // Si no hay usuario, redirige a la página de inicio de sesión.
  return redirect('/login');
}
