import React from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
} from '@/components/ui/sidebar';
import { DashboardNav } from '@/components/dashboard-nav';
import { UserNav } from '@/components/user-nav';
import { Button } from '@/components/ui/button';
import { Settings, LogOut, Route } from 'lucide-react';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="min-h-screen">
        <Sidebar>
          <div className="flex flex-col h-full">
            <SidebarHeader className="p-4">
              <Link href="/dashboard" className="flex items-center gap-2">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground p-2 rounded-lg">
                  <Route className="h-6 w-6" />
                </div>
                <h1 className="text-xl font-semibold font-headline text-sidebar-foreground group-data-[collapsible=icon]:hidden">
                  Routero
                </h1>
              </Link>
            </SidebarHeader>
            <SidebarContent>
              <DashboardNav />
            </SidebarContent>
            <SidebarFooter>
              <Link href="/dashboard/profile">
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Settings className="h-5 w-5" />
                  <span className="group-data-[collapsible=icon]:hidden">Settings</span>
                </Button>
              </Link>
               <Link href="/login">
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <LogOut className="h-5 w-5" />
                  <span className="group-data-[collapsible=icon]:hidden">Logout</span>
                </Button>
              </Link>
            </SidebarFooter>
          </div>
        </Sidebar>
        <SidebarInset>
            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-lg px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
              <SidebarTrigger className="sm:hidden" />
              <div className="flex-1"></div>
              <UserNav />
            </header>
            <main className="p-4 sm:p-6">{children}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
