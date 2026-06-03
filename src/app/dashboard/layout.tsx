
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
import { Settings, LogOut, Route, MapPinOff, AlertCircle, Info } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { handleSignOut } from '@/lib/firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useTracker } from '@/hooks/use-tracker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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

  // Los roles operativos (Vendedor y Telemercaderista) tienen GPS obligatorio
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
                        <span className="text-[10px] font-black uppercase">GPS OBLIGATORIO DESACTIVADO</span>
                    </div>
                )}
            </div>
            <UserNav />
          </header>
          <main className="p-4 sm:p-6 relative">
            {isSeller && !gpsEnabled && (
                <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex items-center justify-center p-6 text-center">
                    <Card className="max-w-md border-2 border-primary shadow-2xl rounded-[2.5rem] overflow-hidden">
                        <CardHeader className="flex flex-col items-center gap-4 bg-primary text-white py-8">
                            <div className="bg-white/20 p-4 rounded-full">
                                <AlertCircle className="h-12 w-12 text-white" />
                            </div>
                            <CardTitle className="text-2xl font-black uppercase tracking-tighter">Acceso Bloqueado</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 p-8">
                            <p className="font-bold text-slate-800 uppercase text-sm leading-relaxed">
                                LA GEOLOCALIZACIÓN ES UN REQUISITO <span className="text-primary font-black underline">OBLIGATORIO</span> PARA OPERAR EN EL RUTERO.
                            </p>
                            
                            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left space-y-3">
                                <div className="flex items-start gap-2">
                                    <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                    <p className="text-[10px] font-black text-slate-600 uppercase">Cómo habilitar:</p>
                                </div>
                                <ul className="text-[9px] font-bold text-slate-500 uppercase list-disc pl-4 space-y-1">
                                    <li>Pulsa el botón "REINTENTAR" y acepta el permiso.</li>
                                    <li>Si lo bloqueaste: ve a la configuración de tu navegador (Chrome/Safari) y habilita "Ubicación" para este sitio.</li>
                                    <li>Asegúrate de que el GPS de tu celular esté encendido.</li>
                                </ul>
                            </div>

                            <Button onClick={() => window.location.reload()} className="w-full h-14 font-black uppercase shadow-xl text-lg rounded-2xl group">
                                REINTENTAR ACTIVACIÓN
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
