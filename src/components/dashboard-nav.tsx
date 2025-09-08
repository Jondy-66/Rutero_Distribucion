
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
    roles: ['Administrador', 'Supervisor', 'Usuario'],
  },
   {
    href: '/dashboard/reports',
    label: 'Reportes',
    icon: FileText,
    roles: ['Supervisor'],
  },
  {
    href: '/dashboard/clients',
    label: 'Clientes',
    icon: Briefcase,
    roles: ['Administrador', 'Supervisor', 'Usuario'],
  },
  {
    href: '/dashboard/locations',
    label: 'Ubicaciones',
    icon: MapPin,
    roles: ['Administrador'],
  },
  {
    href: '/dashboard/map',
    label: 'Mapa',
    icon: Map,
    roles: ['Administrador', 'Supervisor', 'Usuario'],
  },
];

const usersNavItem = {
  href: '/dashboard/users',
  label: 'Usuarios',
  icon: Users,
  roles: ['Administrador'],
};

/**
 * Componente de navegación principal para el panel de control.
 * Muestra los enlaces de navegación en la barra lateral según el rol del usuario.
 * @returns {React.ReactElement} El componente de navegación.
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
  const [isUsersOpen, setIsUsersOpen] = useState(
    pathname.startsWith('/dashboard/users')
  );

  const filteredNavItems = navItems.filter((item) => {
    if (!user || !user.role) return false;
    return item.roles.includes(user.role);
  });

  const canSeeRoutes =
    user?.role === 'Administrador' ||
    user?.role === 'Supervisor' ||
    user?.role === 'Usuario';
    
  const canSeeUsers =
    user?.role && usersNavItem.roles.includes(user.role);
  
  const canSeeTeamRoutes = user?.role === 'Administrador' || user?.role === 'Supervisor';

  return (
    <nav>
      <SidebarMenu>
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
                               <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/routes/new'}>
                                <Link href="/dashboard/routes/new">
                                    <PlusCircle />
                                    <span>Nueva Ruta</span>
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
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/routes/prediction'}>
                      <Link href="/dashboard/routes/prediction">
                        <Wand2 />
                        <span>Predicción Ruta</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/routes/optimal-route'}>
                      <Link href="/dashboard/routes/optimal-route">
                        <GitCommitHorizontal />
                        <span>Ruta Óptima</span>
                      </Link>
                    </SidebarMenuSubButton>
                </SidebarMenuItem>
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
        {canSeeUsers && (
          <Collapsible open={isUsersOpen} onOpenChange={setIsUsersOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip="Usuarios">
                  <Users className="h-5 w-5" />
                  <span>Usuarios</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                    <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/users' || pathname.startsWith('/dashboard/users/[id]')}>
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
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}
      </SidebarMenu>
    </nav>
  );
}
