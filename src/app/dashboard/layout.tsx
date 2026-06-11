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
import { Settings, LogOut, Route, MapPinOff, AlertCircle, Info, Satellite, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { handleSignOut } from '@/lib/firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useTracker } from '@/hooks/use-tracker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const { gpsEnabled, isPermissionDenied, isSignalWeak, requestPermission } = useTracker();

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
       <div className="w-full min-h-screen flex items-center justify-center bg-[#0B0F18]">
            <div className="flex flex-col items-center gap-4">
                <div className="inline-block bg-[#8CC81F] text-white p-4 rounded-full shadow-[0_0_20px_rgba(140,200,31,0.3)]">
                    <Route className="h-10 w-10 animate-pulse" />
                </div>
                <p className="text-[#8F98A8] font-bold uppercase text-xs tracking-widest">Iniciando Ecosistema...</p>
            </div>
      </div>
    );
  }

  const isSeller = user.role === 'Usuario' || user.role === 'Telemercaderista';

  return (
    <SidebarProvider>
      <Sidebar className="glass-sidebar border-none">
        <div className="flex flex-col h-full bg-transparent">
          {/* HEADER PREMIUM */}
          <SidebarHeader className="p-6 pb-2">
            <Link href="/dashboard" className="flex items-center gap-4 group">
              <div className="bg-[#8CC81F] text-white p-2.5 rounded-2xl shadow-[0_8px_20px_rgba(140,200,31,0.25)] transition-transform group-hover:scale-105">
                <Route className="h-6 w-6" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-black tracking-tighter text-[#F4F6FA] leading-none">
                  Rutero
                </h1>
                <span className="text-[10px] font-bold text-[#8F98A8] uppercase tracking-widest mt-1">Gestión comercial</span>
              </div>
            </Link>
          </SidebarHeader>

          {/* MENÚ DE NAVEGACIÓN */}
          <SidebarContent className="scrollbar-hide">
            <DashboardNav />
          </SidebarContent>

          {/* FOOTER PREMIUM */}
          <SidebarFooter className="p-4 gap-3">
            {/* TARJETA DE USUARIO */}
            <div className="p-4 bg-[#121722] rounded-2xl border border-white/5 shadow-inner">
                <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9 border-2 border-[#8CC81F]/20">
                        <AvatarImage src={user.avatar} />
                        <AvatarFallback className="bg-[#8CC81F] text-white font-bold text-xs uppercase">{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                        <p className="text-xs font-black text-[#F4F6FA] truncate">{user.name}</p>
                        <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[9px] font-bold text-[#8F98A8] uppercase truncate">{user.role}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* BOTÓN CONFIGURACIÓN */}
            <Link href="/dashboard/profile">
              <div className="flex items-center justify-between p-3 bg-[#121722]/50 hover:bg-[#121722] border border-white/5 rounded-xl transition-all group">
                <div className="flex items-center gap-3">
                    <Settings className="h-4 w-4 text-[#8CC81F]" />
                    <span className="text-[11px] font-bold text-[#F4F6FA] uppercase tracking-tighter">Configuración</span>
                </div>
                <ChevronRight className="h-3 w-3 text-[#8F98A8] group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>

            {/* BOTÓN CERRAR SESIÓN */}
            <Button 
                variant="ghost" 
                className="w-full justify-start gap-3 text-[#FF6B6B] hover:text-[#FF6B6B] hover:bg-[#FF6B6B]/10 h-11 px-4 rounded-xl font-bold text-[11px] uppercase tracking-tighter" 
                onClick={onSignOut}
            >
              <LogOut className="h-4 w-4" />
              Cerrar Sesión
            </Button>
          </SidebarFooter>
        </div>
      </Sidebar>
      
      <SidebarInset className="bg-[#F4F6FA]">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-4 sm:px-6">
            <SidebarTrigger className="lg:hidden text-[#0B0F18]" />
            <div className="flex-1">
                {isSeller && isSignalWeak && (
                    <div className="inline-flex items-center gap-2 text-orange-600 bg-orange-50 px-3 py-1.5 rounded-full border border-orange-200 animate-in fade-in zoom-in duration-300">
                        <Satellite className="h-3.5 w-3.5 animate-bounce" />
                        <span className="text-[9px] font-black uppercase tracking-widest">Modo Resiliente - GPS Intermitente</span>
                    </div>
                )}
            </div>
            <UserNav />
          </header>
          <main className="p-4 sm:p-8 relative">
            {/* BLOQUEO ESTRICTO GPS */}
            {isSeller && (isPermissionDenied || (!gpsEnabled && !isSignalWeak)) && (
                <div className="fixed inset-0 z-[100] bg-[#0B0F18]/95 backdrop-blur-2xl flex items-center justify-center p-6 text-center">
                    <Card className="max-w-md border-none bg-[#121722] shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-[3rem] overflow-hidden">
                        <CardHeader className="flex flex-col items-center gap-4 bg-[#8CC81F] text-white py-10">
                            <div className="bg-white/20 p-5 rounded-full backdrop-blur-md shadow-inner">
                                <AlertCircle className="h-14 w-12 text-white" />
                            </div>
                            <CardTitle className="text-3xl font-black uppercase tracking-tighter">Acceso Restringido</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6 p-10">
                            <p className="font-bold text-[#F4F6FA] uppercase text-sm leading-relaxed">
                                LA GEOLOCALIZACIÓN ES <span className="text-[#8CC81F] font-black underline">OBLIGATORIA</span> PARA TU ROL.
                            </p>
                            
                            <div className="bg-white/5 p-5 rounded-2xl border border-white/10 text-left space-y-3">
                                <p className="text-[10px] font-black text-[#8F98A8] uppercase flex items-center gap-2">
                                    <Info className="h-3.5 w-3.5 text-[#8CC81F]" /> Requisitos Técnicos:
                                </p>
                                <ul className="text-[10px] font-bold text-[#F4F6FA]/60 uppercase list-disc pl-5 space-y-2">
                                    <li>Activar permisos de ubicación en el navegador.</li>
                                    <li>Desactivar el "Modo Incógnito".</li>
                                    <li>Tener visión directa al cielo para señal satelital.</li>
                                </ul>
                            </div>

                            <Button onClick={() => requestPermission()} className="w-full h-14 bg-[#8CC81F] hover:bg-[#9AD326] text-white font-black uppercase shadow-[0_10px_20px_rgba(140,200,31,0.3)] text-lg rounded-2xl transition-all">
                                ACTIVAR RASTREO
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
