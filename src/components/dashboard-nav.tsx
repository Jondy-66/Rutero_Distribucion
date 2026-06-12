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
  PlusCircle,
  FileText,
  UserCheck,
  List,
  Wand2,
  Users2,
  GitCommitHorizontal,
  Lock,
  Phone,
  BarChart,
  Settings2,
  LocateFixed,
  Clock,
  ChevronRight,
  Database,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
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
    <div className="flex items-center gap-2 px-4 mt-8 mb-3 opacity-80">
      <span className="text-[9px] font-black tracking-[0.25em] text-[#8F98A8] uppercase whitespace-nowrap">{title}</span>
      <div className="h-[1px] flex-1 bg-white/5 relative">
        <div className="absolute right-0 top-[-2px] h-[5px] w-[5px] rounded-full bg-[#8CC81F]" />
      </div>
    </div>
  );

  const iconClass = "h-[18px] w-[18px] text-[#8CC81F] shrink-0 transition-all duration-300";
  const subIconClass = "h-[14px] w-[14px] text-[#F4F6FA]/60 shrink-0";

  const buttonStyles = (active: boolean) => cn(
    "flex w-full items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group",
    active 
      ? "bg-[#8CC81F]/10 border border-[#8CC81F]/30 text-[#F4F6FA] shadow-[0_0_20px_rgba(140,200,31,0.1)]" 
      : "text-[#8F98A8] hover:text-[#F4F6FA] hover:bg-white/5"
  );

  return (
    <div className="flex flex-col gap-1 px-3">
      {/* SECCIÓN PRINCIPAL */}
      <NavGroupHeader title="Principal" />
      <SidebarMenu>
        {hasPerm('dashboard') && (
          <SidebarMenuItem>
            <Link href="/dashboard" className={buttonStyles(pathname === '/dashboard')}>
              <LayoutDashboard className={iconClass} />
              <span className="text-sm font-semibold">Panel de Control</span>
            </Link>
          </SidebarMenuItem>
        )}

        {hasPerm('admin-dashboard') && (
          <SidebarMenuItem>
            <Link href="/dashboard/admin-dashboard" className={buttonStyles(pathname === '/dashboard/admin-dashboard')}>
              <BarChart className={iconClass} />
              <span className="text-sm font-semibold">KPIs Administrativos</span>
            </Link>
          </SidebarMenuItem>
        )}

        {hasPerm('clients') && (
          <SidebarMenuItem>
            <Link href="/dashboard/clients" className={buttonStyles(pathname.startsWith('/dashboard/clients'))}>
              <Briefcase className={iconClass} />
              <span className="text-sm font-semibold">Cartera Clientes</span>
            </Link>
          </SidebarMenuItem>
        )}
      </SidebarMenu>

      {/* SECCIÓN MONITOREO */}
      <NavGroupHeader title="Monitoreo" />
      <SidebarMenu>
        {hasPerm('tracking') && (
          <SidebarMenuItem>
            <Link href="/dashboard/system/tracking" className={buttonStyles(pathname === '/dashboard/system/tracking')}>
              <LocateFixed className={iconClass} />
              <span className="text-sm font-semibold">Rastreo GPS Vivo</span>
            </Link>
          </SidebarMenuItem>
        )}

        {hasPerm('locations') && (
          <SidebarMenuItem>
            <Link href="/dashboard/locations" className={buttonStyles(pathname === '/dashboard/locations')}>
              <MapPin className={iconClass} />
              <span className="text-sm font-semibold">Ubicaciones</span>
            </Link>
          </SidebarMenuItem>
        )}

        {hasPerm('map') && (
          <SidebarMenuItem>
            <Link href="/dashboard/map" className={buttonStyles(pathname === '/dashboard/map')}>
              <Map className={iconClass} />
              <span className="text-sm font-semibold">Mapa</span>
            </Link>
          </SidebarMenuItem>
        )}
      </SidebarMenu>

      {/* SECCIÓN GESTIÓN */}
      <NavGroupHeader title="Gestión" />
      <SidebarMenu>
        {hasPerm('routes') && (
          <Collapsible open={isRoutesOpen} onOpenChange={setIsRoutesOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger className={buttonStyles(pathname.startsWith('/dashboard/routes'))}>
                <Route className={iconClass} />
                <span className="flex-1 text-sm font-semibold">Rutas</span>
                <ChevronRight className={cn("h-4 w-4 transition-transform duration-200", isRoutesOpen && "rotate-90")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-6 border-l border-white/5 mt-1 ml-6 space-y-1">
                
                {/* SUBGRUPO: Planificación de Ruta */}
                <Collapsible open={isPlanOpen} onOpenChange={setIsPlanOpen}>
                  <CollapsibleTrigger className={cn(
                    "flex w-full items-center gap-2 py-2 text-xs font-medium transition-colors hover:text-[#F4F6FA]",
                    isPlanOpen ? "text-[#8CC81F]" : "text-[#8F98A8]"
                  )}>
                    <ClipboardList className={subIconClass} />
                    <span className="flex-1 text-left">Planificación de Ruta</span>
                    <ChevronRight className={cn("h-3 w-3 transition-transform duration-200", isPlanOpen && "rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 border-l border-white/10 mt-1 space-y-1">
                    <SidebarMenuSubItem>
                      <Link href="/dashboard/routes/prediction" className={cn("flex items-center gap-2 py-2 text-[11px] font-medium", pathname === '/dashboard/routes/prediction' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                        <Wand2 className="h-3 w-3 shrink-0" />
                        IA Predicción Ruta
                      </Link>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <Link href="/dashboard/routes/optimal-route" className={cn("flex items-center gap-2 py-2 text-[11px] font-medium", pathname === '/dashboard/routes/optimal-route' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                        <GitCommitHorizontal className="h-3 w-3 shrink-0" />
                        Ruta Optima
                      </Link>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                      <Link href="/dashboard/routes/management" className={cn("flex items-center gap-2 py-2 text-[11px] font-medium", pathname === '/dashboard/routes/management' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                        <Route className="h-3 w-3 shrink-0" />
                        Gestión Ruta
                      </Link>
                    </SidebarMenuSubItem>
                  </CollapsibleContent>
                </Collapsible>

                {/* OPCIONES FUERA DE PLANIFICACIÓN */}
                <SidebarMenuSubItem>
                  <Link href="/dashboard/routes" className={cn("flex items-center gap-2 py-2 text-xs font-medium", pathname === '/dashboard/routes' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                    <List className={subIconClass} />
                    Mis Rutas
                  </Link>
                </SidebarMenuSubItem>

                {(user?.role === 'Administrador' || user?.role === 'Supervisor') && (
                  <SidebarMenuSubItem>
                    <Link href="/dashboard/routes/team-routes" className={cn("flex items-center gap-2 py-2 text-xs font-medium", pathname === '/dashboard/routes/team-routes' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                      <Users2 className={subIconClass} />
                      Rutas de equipo
                    </Link>
                  </SidebarMenuSubItem>
                )}
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        )}

        {hasPerm('crm') && (
          <Collapsible open={isCrmOpen} onOpenChange={setIsCrmOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger className={buttonStyles(pathname.startsWith('/dashboard/crm'))}>
                <Phone className={iconClass} />
                <span className="flex-1 text-sm font-semibold">CRM Telemercadeo</span>
                <ChevronRight className={cn("h-4 w-4 transition-transform duration-200", isCrmOpen && "rotate-90")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-6 border-l border-white/5 mt-1 ml-6 space-y-1">
                <SidebarMenuSubItem>
                  <Link href="/dashboard/crm/prediction" className={cn("flex items-center gap-2 py-2 text-xs font-medium", pathname === '/dashboard/crm/prediction' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                    <Wand2 className={subIconClass} />
                    Cola Inteligente
                  </Link>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <Link href="/dashboard/crm/management" className={cn("flex items-center gap-2 py-2 text-xs font-medium", pathname === '/dashboard/crm/management' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                    <ClipboardList className={subIconClass} />
                    Gestión de Llamada
                  </Link>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <Link href="/dashboard/crm/phone-base" className={cn("flex items-center gap-2 py-2 text-xs font-medium", pathname === '/dashboard/crm/phone-base' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                    <Database className={subIconClass} />
                    Base Telefónica
                  </Link>
                </SidebarMenuSubItem>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        )}

        {hasPerm('reports') && (
          <Collapsible open={isReportsOpen} onOpenChange={setIsReportsOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger className={buttonStyles(pathname.startsWith('/dashboard/reports'))}>
                <FileText className={iconClass} />
                <span className="flex-1 text-sm font-semibold">Reportes</span>
                <ChevronRight className={cn("h-4 w-4 transition-transform duration-200", isReportsOpen && "rotate-90")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-6 border-l border-white/5 mt-1 ml-6 space-y-1">
                <SidebarMenuSubItem>
                  <Link href="/dashboard/reports/my-completed-routes" className={cn("flex items-center gap-2 py-2 text-xs font-medium", pathname === '/dashboard/reports/my-completed-routes' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                    <List className={subIconClass} />
                    Rutas Completadas
                  </Link>
                </SidebarMenuSubItem>
                {(user?.role === 'Supervisor' || user?.role === 'Administrador' || user?.role === 'Auditor') && (
                  <SidebarMenuSubItem>
                    <Link href="/dashboard/reports/my-reports" className={cn("flex items-center gap-2 py-2 text-xs font-medium", pathname === '/dashboard/reports/my-reports' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                      <FileText className={subIconClass} />
                      Auditoría Rutas
                    </Link>
                  </SidebarMenuSubItem>
                )}
                {hasPerm('seller-reports') && (
                  <SidebarMenuSubItem>
                    <Link href="/dashboard/reports/seller-reports" className={cn("flex items-center gap-2 py-2 text-xs font-medium", pathname === '/dashboard/reports/seller-reports' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                      <Users className={subIconClass} />
                      Reporte Vendedores
                    </Link>
                  </SidebarMenuSubItem>
                )}
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        )}

        {hasPerm('users') && (
          <Collapsible open={isUsersOpen} onOpenChange={setIsUsersOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger className={buttonStyles(pathname.startsWith('/dashboard/users') || pathname.startsWith('/dashboard/system'))}>
                <Lock className={iconClass} />
                <span className="flex-1 text-sm font-semibold">Administración</span>
                <ChevronRight className={cn("h-4 w-4 transition-transform duration-200", isUsersOpen && "rotate-90")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pl-6 border-l border-white/5 mt-1 ml-6 space-y-1">
                <SidebarMenuSubItem>
                  <Link href="/dashboard/users" className={cn("flex items-center gap-2 py-2 text-xs font-medium", pathname === '/dashboard/users' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                    <Users className={subIconClass} />
                    Gestión Usuarios
                  </Link>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <Link href="/dashboard/users/supervisors" className={cn("flex items-center gap-2 py-2 text-xs font-medium", pathname === '/dashboard/users/supervisors' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                    <UserCheck className={subIconClass} />
                    Supervisores
                  </Link>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <Link href="/dashboard/users/permissions" className={cn("flex items-center gap-2 py-2 text-xs font-medium", pathname === '/dashboard/users/permissions' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                    <Lock className={subIconClass} />
                    Privilegios
                  </Link>
                </SidebarMenuSubItem>
                {user?.role === 'Administrador' && (
                  <SidebarMenuSubItem>
                    <Link href="/dashboard/system/cron" className={cn("flex items-center gap-2 py-2 text-xs font-medium", pathname === '/dashboard/system/cron' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                      <Clock className={subIconClass} />
                      Cron Jobs (Keep)
                    </Link>
                  </SidebarMenuSubItem>
                )}
                <SidebarMenuSubItem>
                  <Link href="/dashboard/system/usage" className={cn("flex items-center gap-2 py-2 text-xs font-medium", pathname === '/dashboard/system/usage' ? "text-[#8CC81F]" : "text-[#8F98A8] hover:text-[#F4F6FA]")}>
                    <Settings2 className={subIconClass} />
                    Salud Sistema
                  </Link>
                </SidebarMenuSubItem>
              </CollapsibleContent>
            </SidebarMenuItem>
          </Collapsible>
        )}
      </SidebarMenu>
    </div>
  );
}