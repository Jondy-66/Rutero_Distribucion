
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

export function DashboardNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isRoutesOpen, setIsRoutesOpen] = useState(
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

  return (
    <nav>
      <SidebarMenu>
        {filteredNavItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href}>
              <SidebarMenuButton
                isActive={
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))
                }
                tooltip={item.label}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </Link>
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
                <SidebarMenuSubItem>
                  <Link href="/dashboard/routes/new">
                    <SidebarMenuSubButton
                      isActive={pathname === '/dashboard/routes/new'}
                    >
                      <PlusCircle />
                      <span>Planificación</span>
                    </SidebarMenuSubButton>
                  </Link>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <Link href="/dashboard/routes">
                    <SidebarMenuSubButton
                      isActive={pathname === '/dashboard/routes'}
                    >
                      <List />
                      <span>Lista de Rutas</span>
                    </SidebarMenuSubButton>
                  </Link>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <Link href="/dashboard/routes/management">
                    <SidebarMenuSubButton
                      isActive={pathname === '/dashboard/routes/management'}
                    >
                      <ClipboardList />
                      <span>Gestión Ruta</span>
                    </SidebarMenuSubButton>
                  </Link>
                </SidebarMenuSubItem>
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
                  <Link href="/dashboard/users">
                    <SidebarMenuSubButton
                      isActive={pathname === '/dashboard/users' || pathname.startsWith('/dashboard/users/[id]')}
                    >
                      <Users />
                      <span>Todos los Usuarios</span>
                    </SidebarMenuSubButton>
                  </Link>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <Link href="/dashboard/users/supervisors">
                    <SidebarMenuSubButton
                      isActive={pathname === '/dashboard/users/supervisors'}
                    >
                      <UserCheck />
                      <span>Supervisores</span>
                    </SidebarMenuSubButton>
                  </Link>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        )}
      </SidebarMenu>
    </nav>
  );
}
