'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Map, Route, Briefcase, MapPin } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/use-auth';

const navItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard, roles: ['Administrador', 'Supervisor', 'Usuario'] },
  { href: '/dashboard/clients', label: 'Clientes', icon: Briefcase, roles: ['Administrador', 'Supervisor', 'Usuario'] },
  { href: '/dashboard/routes', label: 'Rutas', icon: Route, roles: ['Administrador', 'Supervisor', 'Usuario'] },
  { href: '/dashboard/map', label: 'Mapa', icon: Map, roles: ['Administrador', 'Supervisor', 'Usuario'] },
  { href: '/dashboard/locations', label: 'Ubicaciones', icon: MapPin, roles: ['Administrador'] },
  { href: '/dashboard/users', label: 'Usuarios', icon: Users, roles: ['Administrador'] },
];

export function DashboardNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const filteredNavItems = navItems.filter(item => {
    if (!user || !user.role) return false;
    return item.roles.includes(user.role);
  });

  return (
    <nav>
      <SidebarMenu>
        {filteredNavItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href}>
              <SidebarMenuButton
                isActive={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
                tooltip={item.label}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </nav>
  );
}
