'use client'
import { redirect } from "next/navigation";
import { useAuth } from '@/hooks/use-auth';

export default function ReportsRedirectPage() {
    const { user, loading } = useAuth();
    
    if (loading) {
        return null;
    }

    if (user?.role === 'Supervisor' || user?.role === 'Administrador') {
        redirect('/dashboard/reports/my-reports');
    } else {
        redirect('/dashboard/reports/my-completed-routes');
    }

    return null;
}
