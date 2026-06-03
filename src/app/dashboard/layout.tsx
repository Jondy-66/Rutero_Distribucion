
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { DashboardNav } from '@/components/dashboard-nav';
import { UserNav } from '@/components/user-nav';
import { Button } from '@/components/ui/button';
import { Settings, LogOut, Route, MapPinOff, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { handleSignOut } from '@/lib/firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { LocationTracker } from '@/components/location-tracker';
import { useTracker } from '@/hooks/use-tracker';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  // Activar tracker y obtener estado de permisos
  const { gpsEnabled } = useTracker();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);
  
  const onSignOut = async () => {
    await handleSignOut();
    toast({ title: 'Has cerrado sesión exitosamente.' });
    router.push('/login');
  };

  if (loading || !user) {
    return (
       <div className="w-full min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="inline-block bg-primary text-primary-foreground p-4 rounded-full">
                    <Route className="h-10 w-10 animate-pulse" />
                </div>
                <p className="text-muted-foreground">Cargando panel...</p>
            </div>
      </div>
    );
  }

  const isSeller = user.role === 'Usuario' || user.role === 'Telemercaderista';

  return (
    <SidebarProvider>
      <Sidebar>
        <div className="flex flex-col h-full">
          <SidebarHeader className="p-4">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground p-2 rounded-lg">
                <Route className="h-6 w-6" />
              </div>
              <h1 className="text-xl font-semibold font-headline text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                Rutero
              </h1>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <DashboardNav />
          </SidebarContent>
          <SidebarFooter>
            <Link href="/dashboard/profile">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Settings className="h-5 w-5" />
                <span className="group-data-[collapsible=icon]:hidden">Configuración</span>
              </Button>
            </Link>
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={onSignOut}>
              <LogOut className="h-5 w-5" />
              <span className="group-data-[collapsible=icon]:hidden">Cerrar Sesión</span>
            </Button>
          </SidebarFooter>
        </div>
      </Sidebar>
      <SidebarInset>
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-lg px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <SidebarTrigger className="sm:hidden" />
            <div className="flex-1">
                {isSeller && !gpsEnabled && (
                    <div className="flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-200 animate-pulse">
                        <MapPinOff className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase">¡GPS OBLIGATORIO DESACTIVADO!</span>
                    </div>
                )}
            </div>
            <UserNav />
          </header>
          <main className="p-4 sm:p-6 relative">
            {isSeller && !gpsEnabled && (
                <div className="absolute inset-0 z-50 bg-background/90 backdrop-blur-md flex items-center justify-center p-6 text-center">
                    <Card className="max-w-md border-2 border-orange-500 shadow-2xl rounded-[2rem]">
                        <CardHeader className="flex flex-col items-center gap-4">
                            <div className="bg-orange-100 p-4 rounded-full">
                                <AlertCircle className="h-12 w-12 text-orange-600" />
                            </div>
                            <CardTitle className="text-2xl font-black uppercase text-slate-950">Acceso Restringido</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="font-bold text-slate-600 uppercase text-xs leading-relaxed">
                                LA GEOLOCALIZACIÓN ES UN REQUISITO <span className="text-orange-600 font-black">OBLIGATORIO</span> PARA OPERAR EN RUTERO.
                            </p>
                            <p className="text-[10px] font-medium text-slate-500 uppercase">
                                Por favor, habilita los permisos de ubicación en la configuración de tu navegador y dispositivo para continuar.
                            </p>
                            <Button onClick={() => window.location.reload()} className="w-full h-12 font-black uppercase shadow-lg mt-4">
                                REINTENTAR AHORA
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}
            {children}
          </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
