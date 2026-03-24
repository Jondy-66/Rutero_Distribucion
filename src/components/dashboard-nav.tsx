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

/**
 * Componente de navegación principal para el panel de control.
 * Muestra los enlaces de navegación en la barra lateral según el rol y permisos del usuario.
 */
export function DashboardNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  
  const [isRoutesOpen, setIsRoutesOpen] = useState(pathname.startsWith('/dashboard/routes'));
  const [isPlanningOpen, setIsPlanningOpen] = useState(pathname.startsWith('/dashboard/routes'));
  const [isCrmOpen, setIsCrmOpen] = useState(pathname.startsWith('/dashboard/crm'));
  const [isUsersOpen, setIsUsersOpen] = useState(pathname.startsWith('/dashboard/users') || pathname.startsWith('/dashboard/system'));
  const [isReportsOpen, setIsReportsOpen] = useState(pathname.startsWith('/dashboard/reports'));
  const [isDashboardOpen, setIsDashboardOpen] = useState(pathname.startsWith('/dashboard/admin-dashboard') || pathname === '/dashboard');

  // Ayudante para verificar permisos granulares con soporte de fallback por rol
  const hasPerm = (id: string) => {
    if (!user) return false;
    if (user.role === 'Administrador') return true;
    
    // Si el usuario tiene un array de permisos definido, lo usamos como fuente de verdad
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions.includes(id);
    }
    
    // Fallback a permisos por defecto si no hay array de permisos en el perfil
    const roleDefaults: Record<string, string[]> = {
      'Supervisor': ['dashboard', 'admin-dashboard', 'clients', 'map', 'reports', 'seller-reports', 'routes'],
      'Usuario': ['dashboard', 'clients', 'map', 'routes'],
      'Telemercaderista': ['dashboard', 'clients', 'map', 'routes'],
      'Auditor': ['dashboard', 'admin-dashboard', 'clients', 'locations', 'map', 'reports', 'seller-reports', 'routes'],
    };
    
    return (roleDefaults[user.role] || []).includes(id);
  };

  return (
    <nav>
      <SidebarMenu>
        {/* PANEL DE CONTROL / KPIs */}
        {hasPerm('admin-dashboard') && (
          <Collapsible open={isDashboardOpen} onOpenChange={setIsDashboardOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Dashboard">
                  <LayoutDashboard className="h-5 w-5" />
                  <span>Dashboard</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
              <SidebarMenuSub>
                  <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard'}>
                        <Link href="/dashboard">
                          <ClipboardList />
                          <span>Panel de Control</span>
                        </Link>
                      </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/admin-dashboard'}>
                        <Link href="/dashboard/admin-dashboard">
                          <BarChart />
                          <span>KPIs</span>
                        </Link>
                      </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* MODULOS BASICOS */}
        {hasPerm('clients') && (
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard/clients')} tooltip="Clientes">
              <Link href="/dashboard/clients">
                <Briefcase className="h-5 w-5" />
                <span>Clientes</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}

        {hasPerm('locations') && (
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/dashboard/locations'} tooltip="Ubicaciones">
              <Link href="/dashboard/locations">
                <MapPin className="h-5 w-5" />
                <span>Ubicaciones</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}

        {hasPerm('map') && (
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={pathname === '/dashboard/map'} tooltip="Mapa">
              <Link href="/dashboard/map">
                <Map className="h-5 w-5" />
                <span>Mapa</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        )}

        {/* REPORTES */}
        {hasPerm('reports') && (
          <Collapsible open={isReportsOpen} onOpenChange={setIsReportsOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Reportes">
                  <FileText className="h-5 w-5" />
                  <span>Reportes</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/reports/my-completed-routes'}>
                      <Link href="/dashboard/reports/my-completed-routes">
                        <List />
                        <span>Rutas Completadas</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                {(user?.role === 'Supervisor' || user?.role === 'Administrador' || user?.role === 'Auditor') && (
                  <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/reports/my-reports'}>
                        <Link href="/dashboard/reports/my-reports">
                          <FileText />
                          <span>Rutas Asignadas</span>
                        </Link>
                      </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )}
                {hasPerm('seller-reports') && (
                  <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/reports/seller-reports'}>
                        <Link href="/dashboard/reports/seller-reports">
                          <Users />
                          <span>Reportes Vendedores</span>
                        </Link>
                      </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* RUTAS */}
        {hasPerm('routes') && (
          <Collapsible open={isRoutesOpen} onOpenChange={setIsRoutesOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Rutas">
                  <Route className="h-5 w-5" />
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
                                <PlusCircle />
                                <span>Planificación de Ruta</span>
                             </SidebarMenuSubButton>
                        </CollapsibleTrigger>
                     </SidebarMenuItem>
                      <CollapsibleContent>
                         <SidebarMenuSub>
                            <SidebarMenuSubItem>
                                <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/routes/prediction'}>
                                <Link href="/dashboard/routes/prediction">
                                    <Wand2 />
                                    <span>Predicción Ruta</span>
                                </Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                                <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/routes/optimal-route'}>
                                <Link href="/dashboard/routes/optimal-route">
                                    <GitCommitHorizontal />
                                    <span>Ruta Óptima</span>
                                </Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                               <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/routes'}>
                                 <Link href="/dashboard/routes">
                                    <List />
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
                        <ClipboardList />
                        <span>Gestión Ruta</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuItem>
                 {(user?.role === 'Administrador' || user?.role === 'Supervisor') && (
                    <SidebarMenuItem>
                        <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/routes/team-routes'}>
                            <Link href="/dashboard/routes/team-routes">
                                <Users2 />
                                <span>Rutas de Equipo</span>
                            </Link>
                        </SidebarMenuSubButton>
                    </SidebarMenuItem>
                 )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* CRM */}
        {hasPerm('dashboard') && (user?.role === 'Administrador' || user?.role === 'Supervisor' || user?.role === 'Telemercaderista') && (
           <Collapsible open={isCrmOpen} onOpenChange={setIsCrmOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="CRM">
                  <HeartHandshake className="h-5 w-5" />
                  <span>CRM</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/crm/prediction'}>
                      <Link href="/dashboard/crm/prediction">
                        <Wand2 />
                        <span>Predicción Crm</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/crm/phone-base'}>
                      <Link href="/dashboard/crm/phone-base">
                        <Database />
                        <span>Base Telefónica</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                 <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/crm/management'}>
                      <Link href="/dashboard/crm/management">
                        <Phone />
                        <span>Gestión Crm</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* ADMINISTRACION SISTEMA */}
        {hasPerm('users') && (
          <Collapsible open={isUsersOpen} onOpenChange={setIsUsersOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Administración">
                  <Users className="h-5 w-5" />
                  <span>Administración</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/users'}>
                      <Link href="/dashboard/users">
                        <Users />
                        <span>Todos los Usuarios</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/users/supervisors'}>
                      <Link href="/dashboard/users/supervisors">
                        <UserCheck />
                        <span>Supervisores</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/users/permissions'}>
                      <Link href="/dashboard/users/permissions">
                        <Lock />
                        <span>Permisos</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/system/usage'}>
                      <Link href="/dashboard/system/usage">
                        <Settings2 />
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
