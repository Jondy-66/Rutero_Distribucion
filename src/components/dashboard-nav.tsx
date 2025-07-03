'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Map, Route, Briefcase, Settings } from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';

const navItems = [
  { href: '/dashboard', label: 'Panel', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'Clientes', icon: Briefcase },
  { href: '/dashboard/routes', label: 'Rutas', icon: Route },
  { href: '/dashboard/map', label: 'Mapa', icon: Map },
  { href: '/dashboard/users', label: 'Usuarios', icon: Users },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav>
      <SidebarMenu>
        {navItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href}>
              <SidebarMenuButton
                isActive={pathname === item.href}
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
