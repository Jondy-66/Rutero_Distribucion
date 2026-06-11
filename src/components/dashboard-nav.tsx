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
  HeartHandshake,
  Database,
  Phone,
  BarChart,
  Settings2,
  RefreshCw,
  LocateFixed,
  Clock,
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
  const [isPlanningOpen, setIsPlanningOpen] = useState(pathname.startsWith('/dashboard/routes'));
  const [isCrmOpen, setIsCrmOpen] = useState(pathname.startsWith('/dashboard/crm'));
  const [isUsersOpen, setIsUsersOpen] = useState(pathname.startsWith('/dashboard/users') || pathname.startsWith('/dashboard/system'));
  const [isReportsOpen, setIsReportsOpen] = useState(pathname.startsWith('/dashboard/reports'));
  const [isDashboardOpen, setIsDashboardOpen] = useState(pathname.startsWith('/dashboard/admin-dashboard') || pathname === '/dashboard');

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

  // Clases comunes para iconos vibrantes
  const iconClass = "h-5 w-5 text-sidebar-primary shrink-0 transition-colors";
  const subIconClass = "h-4 w-4 text-sidebar-primary/80 shrink-0 transition-colors";

  return (
    <nav>
      <SidebarMenu>
        {hasPerm('admin-dashboard') && (
          <Collapsible open={isDashboardOpen} onOpenChange={setIsDashboardOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Dashboard">
                  <LayoutDashboard className={iconClass} />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
              <SidebarMenuSub>
                  <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard'}>
                        <Link href="/dashboard">
                          <ClipboardList className={subIconClass} />
                          <span>Panel de Control</span>
                        </Link>
                      </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/admin-dashboard'}>
                        <Link href="/dashboard/admin-dashboard">
                          <BarChart className={subIconClass} />
                          <span>KPIs</span>
                        </Link>
                      </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {hasPerm('clients') && (
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/clients')} tooltip="Clientes">
              <Link href="/dashboard/clients">
                <Briefcase className={iconClass} />
                <span>Clientes</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}

        {hasPerm('tracking') && (
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/dashboard/system/tracking'} tooltip="Rastreo GPS">
              <Link href="/dashboard/system/tracking">
                <LocateFixed className={iconClass} />
                <span className="font-black">Rastreo GPS</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}

        {hasPerm('locations') && (
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/dashboard/locations'} tooltip="Ubicaciones">
              <Link href="/dashboard/locations">
                <MapPin className={iconClass} />
                <span>Ubicaciones</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}

        {hasPerm('map') && (
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/dashboard/map'} tooltip="Mapa">
              <Link href="/dashboard/map">
                <Map className={iconClass} />
                <span>Mapa</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}

        {hasPerm('reports') && (
          <Collapsible open={isReportsOpen} onOpenChange={setIsReportsOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Reportes">
                  <FileText className={iconClass} />
                  <span>Reportes</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/reports/my-completed-routes'}>
                      <Link href="/dashboard/reports/my-completed-routes">
                        <List className={subIconClass} />
                        <span>Rutas Completadas</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                {(user?.role === 'Supervisor' || user?.role === 'Administrador' || user?.role === 'Auditor') && (
                  <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/reports/my-reports'}>
                        <Link href="/dashboard/reports/my-reports">
                          <FileText className={subIconClass} />
                          <span>Rutas Asignadas</span>
                        </Link>
                      </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )}
                {hasPerm('seller-reports') && (
                  <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/reports/seller-reports'}>
                        <Link href="/dashboard/reports/seller-reports">
                          <Users className={subIconClass} />
                          <span>Reportes Vendedores</span>
                        </Link>
                      </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {hasPerm('routes') && (
          <Collapsible open={isRoutesOpen} onOpenChange={setIsRoutesOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Rutas">
                  <Route className={iconClass} />
                  <span>Rutas</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
              <SidebarMenuSub>
                  <Collapsible open={isPlanningOpen} onOpenChange={setIsPlanningOpen}>
                     <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                            <SidebarMenuSubButton>
                                <PlusCircle className={subIconClass} />
                                <span>Planificación de Ruta</span>
                             </SidebarMenuSubButton>
                        </CollapsibleTrigger>
                     </SidebarMenuItem>
                      <CollapsibleContent>
                         <SidebarMenuSub>
                            <SidebarMenuSubItem>
                                <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/routes/prediction'}>
                                <Link href="/dashboard/routes/prediction">
                                    <Wand2 className={subIconClass} />
                                    <span>Predicción Ruta</span>
                                </Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                                <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/routes/optimal-route'}>
                                <Link href="/dashboard/routes/optimal-route">
                                    <GitCommitHorizontal className={subIconClass} />
                                    <span>Ruta Óptima</span>
                                </Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                               <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/routes'}>
                                 <Link href="/dashboard/routes">
                                    <List className={subIconClass} />
                                    <span>Mis Rutas</span>
                                 </Link>
                               </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                         </SidebarMenuSub>
                      </CollapsibleContent>
                  </Collapsible>
                 <SidebarMenuItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/routes/management'}>
                      <Link href="/dashboard/routes/management">
                        <ClipboardList className={subIconClass} />
                        <span>Gestión Ruta</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuItem>
                 {(user?.role === 'Administrador' || user?.role === 'Supervisor') && (
                    <SidebarMenuItem>
                        <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/routes/team-routes'}>
                            <Link href="/dashboard/routes/team-routes">
                                <Users2 className={subIconClass} />
                                <span>Rutas de Equipo</span>
                            </Link>
                        </SidebarMenuSubButton>
                    </SidebarMenuItem>
                 )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {hasPerm('crm') && (
          <Collapsible open={isCrmOpen} onOpenChange={setIsCrmOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="CRM">
                  <Phone className={iconClass} />
                  <span>CRM</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/crm/prediction'}>
                      <Link href="/dashboard/crm/prediction">
                        <Wand2 className={subIconClass} />
                        <span>Cola Inteligente</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/crm/management'}>
                      <Link href="/dashboard/crm/management">
                        <ClipboardList className={subIconClass} />
                        <span>Gestión de Llamada</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/crm/phone-base'}>
                      <Link href="/dashboard/crm/phone-base">
                        <Database className={subIconClass} />
                        <span>Base Telefónica</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {hasPerm('users') && (
          <Collapsible open={isUsersOpen} onOpenChange={setIsUsersOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Administración">
                  <Users className={iconClass} />
                  <span>Administración</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/users'}>
                      <Link href="/dashboard/users">
                        <Users className={subIconClass} />
                        <span>Todos los Usuarios</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/users/supervisors'}>
                      <Link href="/dashboard/users/supervisors">
                        <UserCheck className={subIconClass} />
                        <span>Supervisores</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/users/permissions'}>
                      <Link href="/dashboard/users/permissions">
                        <Lock className={subIconClass} />
                        <span>Permisos</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                {user?.role === 'Administrador' && (
                  <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/system/cron'}>
                        <Link href="/dashboard/system/cron">
                          <Clock className={subIconClass} />
                          <span>Cron Jobs</span>
                        </Link>
                      </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )}
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/system/usage'}>
                      <Link href="/dashboard/system/usage">
                        <Settings2 className={subIconClass} />
                        <span>Uso del Sistema</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}
      </SidebarMenu>
    </nav>
  );
}
