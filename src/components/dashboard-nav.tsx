
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Route, 
  Briefcase, 
  MapPin, 
  List, 
  Wand2, 
  Users2, 
  Lock, 
  Phone, 
  BarChart, 
  LocateFixed, 
  ChevronRight, 
  Database, 
  FileText, 
  ShieldCheck, 
  RefreshCcw, 
  BellRing, 
  Settings, 
  History, 
  Activity, 
  Terminal, 
  PhoneCall, 
  Sparkles, 
  PieChart, 
  Mail,
  Navigation
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarMenu, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubItem } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/use-auth';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useState } from 'react';

export function DashboardNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  
  const [isRoutesOpen, setIsRoutesOpen] = useState(pathname.startsWith('/dashboard/routes'));
  const [isCrmOpen, setIsCrmOpen] = useState(pathname.startsWith('/dashboard/crm'));
  const [isReportsOpen, setIsReportsOpen] = useState(pathname.startsWith('/dashboard/reports'));
  const [isSystemOpen, setIsSystemOpen] = useState(pathname.startsWith('/dashboard/system') || pathname.startsWith('/dashboard/users'));

  const hasPerm = (id: string) => {
    if (!user) return false;
    if (user.role === 'Administrador') return true;
    if (user.permissions && user.permissions.length > 0) return user.permissions.includes(id);
    const roleDefaults: Record<string, string[]> = {
      'Supervisor': ['dashboard', 'admin-dashboard', 'clients', 'map', 'reports', 'seller-reports', 'audit-detail', 'tracking', 'routes', 'recover-clients', 'crm'],
      'Usuario': ['dashboard', 'clients', 'map', 'routes', 'crm'],
      'Telemercaderista': ['dashboard', 'clients', 'map', 'routes', 'crm'],
      'Auditor': ['dashboard', 'admin-dashboard', 'clients', 'locations', 'map', 'reports', 'seller-reports', 'audit-detail', 'tracking', 'routes'],
    };
    return (roleDefaults[user.role] || []).includes(id);
  };

  const buttonStyles = (active: boolean) => cn(
    "flex w-full items-center gap-3 px-3.5 py-1.5 rounded-xl transition-all duration-200 group h-9",
    active ? "bg-[#8CC81F]/10 border border-[#8CC81F]/30 text-[#F4F6FA] shadow-[0_0_15px_rgba(140,200,31,0.1)]" : "text-[#8F98A8] hover:text-[#F4F6FA] hover:bg-white/5"
  );

  const iconClass = "h-[16px] w-[17px] text-[#8CC81F] shrink-0";
  const subIconClass = "h-[13px] w-[13px] text-[#F4F6FA]/60 shrink-0";

  return (
    <div className="flex flex-col gap-0.5 px-2">
      <div className="flex items-center gap-2 px-4 mt-4 mb-2 opacity-80"><span className="text-[8px] font-black tracking-[0.2em] text-[#8F98A8] uppercase">Principal</span></div>
      <SidebarMenu>
        {hasPerm('dashboard') && <SidebarMenuItem><Link href="/dashboard" className={buttonStyles(pathname === '/dashboard')}><LayoutDashboard className={iconClass} /><span className="text-xs font-semibold">Panel de Control</span></Link></SidebarMenuItem>}
        {hasPerm('admin-dashboard') && <SidebarMenuItem><Link href="/dashboard/admin-dashboard" className={buttonStyles(pathname === '/dashboard/admin-dashboard')}><BarChart className={iconClass} /><span className="text-xs font-semibold">KPIs Administrativos</span></Link></SidebarMenuItem>}
        {hasPerm('clients') && <SidebarMenuItem><Link href="/dashboard/clients" className={buttonStyles(pathname === '/dashboard/clients')}><Briefcase className={iconClass} /><span className="text-xs font-semibold">Cartera Clientes</span></Link></SidebarMenuItem>}
        {hasPerm('map') && <SidebarMenuItem><Link href="/dashboard/map" className={buttonStyles(pathname === '/dashboard/map')}><Navigation className={iconClass} /><span className="text-xs font-semibold">Mapa Ubicaciones</span></Link></SidebarMenuItem>}
        {hasPerm('locations') && <SidebarMenuItem><Link href="/dashboard/locations" className={buttonStyles(pathname === '/dashboard/locations')}><MapPin className={iconClass} /><span className="text-xs font-semibold">Gestión Coordenadas</span></Link></SidebarMenuItem>}
      </SidebarMenu>

      <div className="flex items-center gap-2 px-4 mt-4 mb-2 opacity-80"><span className="text-[8px] font-black tracking-[0.2em] text-[#8F98A8] uppercase">Gestión</span></div>
      <SidebarMenu>
        {hasPerm('routes') && (
          <Collapsible open={isRoutesOpen} onOpenChange={setIsRoutesOpen}>
            <SidebarMenuItem><CollapsibleTrigger className={buttonStyles(pathname.startsWith('/dashboard/routes'))}><Route className={iconClass} /><span className="flex-1 text-xs font-semibold text-left uppercase">Rutas</span><ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isRoutesOpen && "rotate-90")} /></CollapsibleTrigger>
              <CollapsibleContent><SidebarMenuSub className="pl-5 border-l border-white/5 mt-0.5 ml-5 space-y-0.5">
                  <SidebarMenuSubItem><Link href="/dashboard/routes/prediction" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/routes/prediction' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><Wand2 className={subIconClass} />IA Predicción</Link></SidebarMenuSubItem>
                  <SidebarMenuSubItem><Link href="/dashboard/routes/management" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/routes/management' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><Route className={subIconClass} />Gestión Jornada</Link></SidebarMenuSubItem>
                  <SidebarMenuSubItem><Link href="/dashboard/routes" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/routes' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><List className={subIconClass} />Mis Rutas</Link></SidebarMenuSubItem>
                  {(user?.role === 'Administrador' || user?.role === 'Supervisor') && <SidebarMenuSubItem><Link href="/dashboard/routes/team-routes" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/routes/team-routes' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><Users2 className={subIconClass} />Rutas de Equipo</Link></SidebarMenuSubItem>}
              </SidebarMenuSub></CollapsibleContent></SidebarMenuItem></Collapsible>
        )}
        {hasPerm('crm') && (
          <Collapsible open={isCrmOpen} onOpenChange={setIsCrmOpen}>
            <SidebarMenuItem><CollapsibleTrigger className={buttonStyles(pathname.startsWith('/dashboard/crm'))}><Phone className={iconClass} /><span className="flex-1 text-xs font-semibold text-left uppercase">Telemercadeo</span><ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isCrmOpen && "rotate-90")} /></CollapsibleTrigger>
              <CollapsibleContent><SidebarMenuSub className="pl-5 border-l border-white/5 mt-0.5 ml-5 space-y-0.5">
                  <SidebarMenuSubItem><Link href="/dashboard/crm/prediction" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/crm/prediction' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><Sparkles className={subIconClass} />Cola Inteligente</Link></SidebarMenuSubItem>
                  <SidebarMenuSubItem><Link href="/dashboard/crm/management" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/crm/management' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><PhoneCall className={subIconClass} />Gestión Activa</Link></SidebarMenuSubItem>
                  <SidebarMenuSubItem><Link href="/dashboard/crm/phone-base" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/crm/phone-base' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><Database className={subIconClass} />Base Telefónica</Link></SidebarMenuSubItem>
              </SidebarMenuSub></CollapsibleContent></SidebarMenuItem></Collapsible>
        )}
      </SidebarMenu>

      <div className="flex items-center gap-2 px-4 mt-4 mb-2 opacity-80"><span className="text-[8px] font-black tracking-[0.2em] text-[#8F98A8] uppercase">Auditoría</span></div>
      <SidebarMenu>
        {hasPerm('tracking') && <SidebarMenuItem><Link href="/dashboard/system/tracking" className={buttonStyles(pathname === '/dashboard/system/tracking')}><LocateFixed className={iconClass} /><span className="text-xs font-semibold">Rastreo GPS Vivo</span></Link></SidebarMenuItem>}
        {hasPerm('reports') && (
          <Collapsible open={isReportsOpen} onOpenChange={setIsReportsOpen}>
            <SidebarMenuItem><CollapsibleTrigger className={buttonStyles(pathname.startsWith('/dashboard/reports'))}><PieChart className={iconClass} /><span className="flex-1 text-xs font-semibold text-left uppercase">Reportes</span><ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isReportsOpen && "rotate-90")} /></CollapsibleTrigger>
              <CollapsibleContent><SidebarMenuSub className="pl-5 border-l border-white/5 mt-0.5 ml-5 space-y-0.5">
                  <SidebarMenuSubItem><Link href="/dashboard/reports/seller-reports" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/reports/seller-reports' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><Users className={subIconClass} />Reporte Vendedores</Link></SidebarMenuSubItem>
                  <SidebarMenuSubItem><Link href="/dashboard/reports/customer-visits" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/reports/customer-visits' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><History className={subIconClass} />Visita Clientes</Link></SidebarMenuSubItem>
                  <SidebarMenuSubItem><Link href="/dashboard/reports/my-completed-routes" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/reports/my-completed-routes' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><FileText className={subIconClass} />Mis Rutas</Link></SidebarMenuSubItem>
              </SidebarMenuSub></CollapsibleContent></SidebarMenuItem></Collapsible>
        )}
      </SidebarMenu>

      <div className="flex items-center gap-2 px-4 mt-4 mb-2 opacity-80"><span className="text-[8px] font-black tracking-[0.2em] text-[#8F98A8] uppercase">Sistema</span></div>
      <SidebarMenu>
        {hasPerm('recover-clients') && <SidebarMenuItem><Link href="/dashboard/clients/recover" className={buttonStyles(pathname === '/dashboard/clients/recover')}><RefreshCcw className={iconClass} /><span className="text-xs font-semibold">Rescate de Cartera</span></Link></SidebarMenuItem>}
        {user?.role === 'Administrador' && (
          <Collapsible open={isSystemOpen} onOpenChange={setIsSystemOpen}>
            <SidebarMenuItem><CollapsibleTrigger className={buttonStyles(pathname.startsWith('/dashboard/system') || pathname.startsWith('/dashboard/users'))}><Lock className={iconClass} /><span className="flex-1 text-xs font-semibold text-left uppercase">Administración</span><ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isSystemOpen && "rotate-90")} /></CollapsibleTrigger>
              <CollapsibleContent><SidebarMenuSub className="pl-5 border-l border-white/5 mt-0.5 ml-5 space-y-0.5">
                  <SidebarMenuSubItem><Link href="/dashboard/users" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/users' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><Users className={subIconClass} />Gestión Usuarios</Link></SidebarMenuSubItem>
                  <SidebarMenuSubItem><Link href="/dashboard/system/cc-config" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/system/cc-config' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><ShieldCheck className={subIconClass} />Copia Auditoría (CC)</Link></SidebarMenuSubItem>
                  <SidebarMenuSubItem><Link href="/dashboard/system/notifications" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/system/notifications' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><BellRing className={subIconClass} />Notificaciones Manuales</Link></SidebarMenuSubItem>
                  <SidebarMenuSubItem><Link href="/dashboard/system/email-test" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/system/email-test' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><Mail className={subIconClass} />Prueba de Email</Link></SidebarMenuSubItem>
                  <SidebarMenuSubItem><Link href="/dashboard/system/cron" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/system/cron' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><Terminal className={subIconClass} />Cron Jobs</Link></SidebarMenuSubItem>
                  <SidebarMenuSubItem><Link href="/dashboard/system/usage" className={cn("flex items-center gap-2 py-1.5 text-[11px] font-medium", pathname === '/dashboard/system/usage' ? "text-[#8CC81F]" : "text-[#8F98A8]")}><Activity className={subIconClass} />Status Sistema</Link></SidebarMenuSubItem>
              </SidebarMenuSub></CollapsibleContent></SidebarMenuItem></Collapsible>
        )}
      </SidebarMenu>
    </div>
  );
}
