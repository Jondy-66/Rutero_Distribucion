
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { User, Settings, LogOut, Bell, CheckCheck, Wifi, WifiOff } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { handleSignOut } from '@/lib/firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { Notification } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export function UserNav() {
  const { user, notifications, unreadCount, markNotificationAsRead, markAllNotificationsAsRead } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Verificar estado inicial
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  const onSignOut = async () => {
    await handleSignOut();
    toast({ title: 'Has cerrado sesión exitosamente.' });
    router.push('/login');
  };

  if (!user) {
    return null;
  }
  
  const handleNotificationClick = (notification: Notification) => {
    markNotificationAsRead(notification.id);
    router.push(notification.link);
  }
  
  const fallback = user.name ? user.name.split(' ').map(n => n[0]).join('') : 'U';

  return (
    <div className="flex items-center gap-2 sm:gap-4">
      {/* Indicador de Conexión */}
      <div 
        title={isOnline ? "Conexión activa" : "Sin conexión a internet"}
        className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-bold uppercase transition-all duration-300",
          isOnline 
            ? "bg-green-50 text-green-700 border-green-200" 
            : "bg-red-50 text-red-700 border-red-200 animate-pulse"
        )}
      >
        <div className={cn("h-1.5 w-1.5 rounded-full", isOnline ? "bg-green-600 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-600")} />
        <span className="hidden xs:inline-block">{isOnline ? 'En línea' : 'Sin red'}</span>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between p-4 border-b">
                <h3 className="font-semibold">Notificaciones</h3>
                <Button variant="ghost" size="sm" onClick={markAllNotificationsAsRead} disabled={unreadCount === 0}>
                    <CheckCheck className="mr-2 h-4 w-4" />
                    Marcar todo leído
                </Button>
            </div>
            <div className="p-2 max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">No tienes notificaciones.</p>
              ) : (
                notifications.map((n) => (
                  <div 
                    key={n.id} 
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                        "flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-accent/50",
                        !n.read && "bg-accent/20"
                    )}
                  >
                    <div className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", !n.read && "bg-primary")} />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {n.createdAt ? formatDistanceToNow(n.createdAt, { addSuffix: true, locale: es }) : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar} alt={user.name} data-ai-hint="user avatar" />
              <AvatarFallback>{fallback}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <Link href="/dashboard/profile">
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
            </Link>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configuración</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
