'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Map,
  Route,
  Briefcase,
  MapPin,
  ClipboardList,
  List,
  Wand2,
  Users2,
  GitCommitHorizontal,
  Lock,
  Phone,
  BarChart,
  Settings2,
  LocateFixed,
  ChevronRight,
  Database,
  FileText,
  UserCheck,
  Clock,
  ShieldCheck,
  RefreshCcw,
  CalendarCheck,
  CalendarDays,
  Globe,
  Mail,
  BellRing,
  Settings
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/use-auth';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useState } from 'react';

export function DashboardNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  
  const [isRoutesOpen, setIsRoutesOpen] = useState(pathname.startsWith('/dashboard/routes'));
  const [isPlanOpen, setIsPlanOpen] = useState(
    pathname === '/dashboard/routes/prediction' || 
    pathname === '/dashboard/routes/optimal-route' || 
    pathname === '/dashboard/routes/management'
  );
  const [isCrmOpen, setIsCrmOpen] = useState(pathname.startsWith('/dashboard/crm'));
  const [isUsersOpen, setIsUsersOpen] = useState(pathname.startsWith('/dashboard/users') || pathname.startsWith('/dashboard/system'));
  const [isReportsOpen, setIsReportsOpen] = useState(pathname.startsWith('/dashboard/reports'));

  const hasPerm = (id: string) => {
    if (!user) return false;
    if (user.role === 'Administrador') return true;
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions.includes(id);
    }
    const roleDefaults: Record<string, string[]> = {
      'Supervisor': ['dashboard', 'admin-dashboard', 'clients', 'map', 'reports', 'seller-reports', 'audit-detail', 'tracking', 'routes', 'recover-clients', 'crm'],
      'Usuario': ['dashboard', 'clients', 'map', 'routes', 'crm'],
      'Telemercaderista': ['dashboard', 'clients', 'map', 'routes', 'crm'],
      'Auditor': ['dashboard', 'admin-dashboard', 'clients', 'locations', 'map', 'reports', 'seller-reports', 'audit-detail', 'tracking', 'routes'],
    };
    return (roleDefaults[user.role] || []).includes(id);
  };

  const NavGroupHeader = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 px-4 mt-4 mb-2 opacity-80">
      <span className="text-[8px] font-black tracking-[0.2em] text-[#8F98A8] uppercase whitespace-nowrap">{title}</span>
      <div className="h-[1px] flex-1 bg-white/5 relative">
        <div className="absolute right-0 top-[-2px] h-[4px] w-[4px] rounded-full bg-[#8CC81F]" />
      </div>
    </div>
  );

  const iconClass = "h-[16px] w-[17px] text-[#8CC81F] shrink-0 transition-all duration-300";
  const subIconClass = "h-[13px] w-[13px] text-[#F4F6FA]/60 shrink-0";

  const buttonStyles = (active: boolean) => cn(
    "flex w-full items-center gap-3 px-3.5 py-1.5 rounded-xl transition-all duration-200 group h-9",
    active 
      ? "bg-[#8CC81F]/10 border border-[#8CC81F]/30 text-[#F4F6FA] shadow-[0_0_15px_rgba(140,200,31,0.1)]" 
      : "text-[#8F98A8] hover:text-[#F4F6FA] hover:bg-white/5"
  );

  return (
    <div className="flex flex-col gap-0.5 px-2">
      <NavGroupHeader title="Principal" />
      <SidebarMenu>
        {hasPerm('dashboard') && (
          <SidebarMenuItem>
            <Link href="/dashboard" className={buttonStyles(pathname === '/dashboard')}>
              <LayoutDashboard className={iconClass} />
              <span className="text-xs font-semibold">Panel de Control</span>
            </Link>
          </SidebarMenuItem>
        )}
        {hasPerm('admin-dashboard') && (
          <SidebarMenuItem>
            <Link href="/dashboard/admin-dashboard" className={buttonStyles(pathname === '/dashboard/admin-dashboard')}>
              <BarChart className={iconClass} />
              <span className="text-xs font-semibold">KPIs Administrativos</span>
            </Link>
          </SidebarMenuItem>
        )}
        {hasPerm('clients') && (
          <SidebarMenuItem>
            <Link href="/dashboard/clients" className={buttonStyles(pathname.startsWith('/dashboard/clients') && !pathname.includes('recover'))}>
              <Briefcase className={iconClass} />
              <span className="text-xs font-semibold">Cartera Clientes</span>
            </Link>
          </SidebarMenuItem>
        )}
      </SidebarMenu>

      <NavGroupHeader title="Monitoreo" />
      <SidebarMenu>
        {hasPerm('tracking') && (
          <SidebarMenuItem>
            <Link href="/dashboard/system/tracking" className={buttonStyles(pathname === '/dashboard/system/tracking')}>
              <LocateFixed className={iconClass} />
              <span className="text-xs font-semibold">Rastreo GPS Vivo</span>
            </Link>
          </SidebarMenuItem>
        )}
        {hasPerm('map') && (
          <SidebarMenuItem>
            <Link href="/dashboard/map" className={buttonStyles(pathname === '/dashboard/map')}>
              <Map className={iconClass} />
              <span className="text-xs font-semibold">Mapa</span>
            </Link>
          </SidebarMenuItem>
        )}
      </SidebarMenu>

      <NavGroupHeader title="Gestión" />
      <SidebarMenu>
        {hasPerm('routes') && (
          <Collapsible open={isRoutesOpen} onOpenChange={setIsRoutesOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger className={buttonStyles(pathname.startsWith('/dashboard/routes'))}>
                <Route className={iconClass} />
                <span className="flex-1 text-xs font-semibold text-left">Rutas</span>
                <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", isRoutesOpen && "rotate-90")} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub className="pl-5 border-l border-white/5 mt-0.5 ml-5 space-y-0.5">
                  <SidebarMenuSubItem>
                    <Link href="/dashboard/routes/prediction" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/routes/prediction' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                      <Wand2 className={subIconClass} />
                      IA Predicción Ruta
                    </Link>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <Link href="/dashboard/routes/management" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/routes/management' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                      <Route className={subIconClass} />
                      Gestión Ruta
                    </Link>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <Link href="/dashboard/routes" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/routes' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                      <List className={subIconClass} />
                      Mis Rutas
                    </Link>
                  </SidebarMenuSubItem>
                  {(user?.role === 'Administrador' || user?.role === 'Supervisor') && (
                    <SidebarMenuSubItem>
                      <Link href="/dashboard/routes/team-routes" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/routes/team-routes' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                        <Users2 className={subIconClass} />
                        Rutas de equipo
                      </Link>
                    </SidebarMenuSubItem>
                  )}
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        )}
      </SidebarMenu>

      <NavGroupHeader title="Administración" />
      <SidebarMenu>
        {user?.role === 'Administrador' && (
          <Collapsible open={isUsersOpen} onOpenChange={setIsUsersOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger className={buttonStyles(pathname.startsWith('/dashboard/users') || pathname.startsWith('/dashboard/system'))}>
                <Lock className={iconClass} />
                <span className="flex-1 text-xs font-semibold text-left">Sistema</span>
                <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", isUsersOpen && "rotate-90")} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub className="pl-5 border-l border-white/5 mt-0.5 ml-5 space-y-0.5">
                  <SidebarMenuSubItem>
                    <Link href="/dashboard/users" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/users' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                      <Users className={subIconClass} />
                      Gestión Usuarios
                    </Link>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <Link href="/dashboard/system/notifications" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/system/notifications' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                      <BellRing className={subIconClass} />
                      Enviar Notificación
                    </Link>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <Link href="/dashboard/system/cc-config" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/system/cc-config' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                      <Settings className={subIconClass} />
                      Copia de Auditoría
                    </Link>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        )}
      </SidebarMenu>
    </div>
  );
}
