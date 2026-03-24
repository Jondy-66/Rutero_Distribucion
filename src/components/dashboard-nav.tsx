
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

const navItems = [
  {
    href: '/dashboard',
    label: 'Panel',
    icon: LayoutDashboard,
    roles: ['Usuario', 'Telemercaderista', 'Auditor'],
    id: 'dashboard',
  },
  {
    href: '/dashboard/clients',
    label: 'Clientes',
    icon: Briefcase,
    roles: ['Administrador', 'Supervisor', 'Usuario', 'Telemercaderista', 'Auditor'],
    id: 'clients',
  },
  {
    href: '/dashboard/locations',
    label: 'Ubicaciones',
    icon: MapPin,
    roles: ['Administrador', 'Auditor'],
    id: 'locations',
  },
  {
    href: '/dashboard/map',
    label: 'Mapa',
    icon: Map,
    roles: ['Administrador', 'Supervisor', 'Usuario', 'Telemercaderista', 'Auditor'],
    id: 'map',
  },
];

const usersNavItem = {
  href: '/dashboard/users',
  label: 'Usuarios',
  icon: Users,
  roles: ['Administrador'],
  id: 'users',
};

/**
 * Componente de navegación principal para el panel de control.
 * Muestra los enlaces de navegación en la barra lateral según el rol del usuario.
 */
export function DashboardNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isRoutesOpen, setIsRoutesOpen] = useState(
    pathname.startsWith('/dashboard/routes')
  );
  const [isPlanningOpen, setIsPlanningOpen] = useState(
    pathname.startsWith('/dashboard/routes')
  );
   const [isCrmOpen, setIsCrmOpen] = useState(
    pathname.startsWith('/dashboard/crm')
  );
  const [isUsersOpen, setIsUsersOpen] = useState(
    pathname.startsWith('/dashboard/users') || pathname.startsWith('/dashboard/system')
  );
  const [isReportsOpen, setIsReportsOpen] = useState(
    pathname.startsWith('/dashboard/reports')
  );
  const [isDashboardOpen, setIsDashboardOpen] = useState(
    pathname.startsWith('/dashboard/admin-dashboard') || pathname === '/dashboard'
  );


  const filteredNavItems = navItems.filter((item) => {
    if (!user || !user.role) return false;
    return item.roles.includes(user.role);
  });

  const canSeeReports = user?.role === 'Supervisor' || user?.role === 'Administrador' || user?.role === 'Usuario' || user?.role === 'Telemercaderista' || user?.role === 'Auditor';
  const isSupervisorOrAdmin = user?.role === 'Supervisor' || user?.role === 'Administrador' || user?.role === 'Auditor';

  const canSeeRoutes =
    user?.role === 'Administrador' ||
    user?.role === 'Supervisor' ||
    user?.role === 'Usuario' ||
    user?.role === 'Telemercaderista' ||
    user?.role === 'Auditor';
    
  const canSeeUsers =
    user?.role && usersNavItem.roles.includes(user.role);
  
  const canSeeTeamRoutes = user?.role === 'Administrador' || user?.role === 'Supervisor';
  
  const canSeeCrm = user?.role === 'Administrador' || user?.role === 'Supervisor' || user?.role === 'Telemercaderista';

  return (
    <nav>
      <SidebarMenu>
        {isSupervisorOrAdmin && (
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
        
        {filteredNavItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href))
              }
              tooltip={item.label}
            >
              <Link href={item.href}>
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}

         {canSeeReports && (
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
                {isSupervisorOrAdmin ? (
                  <>
                    <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/reports/my-reports'}>
                          <Link href="/dashboard/reports/my-reports">
                            <FileText />
                            <span>Rutas Asignadas</span>
                          </Link>
                        </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/reports/seller-reports'}>
                          <Link href="/dashboard/reports/seller-reports">
                            <Users />
                            <span>Reportes Vendedores</span>
                          </Link>
                        </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                     <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/reports/my-completed-routes'}>
                          <Link href="/dashboard/reports/my-completed-routes">
                            <List />
                            <span>Rutas Completadas</span>
                          </Link>
                        </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </>
                ) : (
                  <SidebarMenuSubItem>
                      <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/reports/my-completed-routes'}>
                        <Link href="/dashboard/reports/my-completed-routes">
                          <List />
                          <span>Mis Rutas Completadas</span>
                        </Link>
                      </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}
        {canSeeRoutes && (
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
                 {canSeeTeamRoutes && (
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
        {canSeeCrm && (
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
        {canSeeUsers && (
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
