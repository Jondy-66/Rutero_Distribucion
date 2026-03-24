
'use client'
import { redirect } from "next/navigation";
import { useAuth } from '@/hooks/use-auth';

export default function ReportsRedirectPage() {
    const { user, loading } = useAuth();
    
    if (loading) {
        return null;
    }

    // Los Administradores, Supervisores y Auditores van a la vista de gestión
    if (user?.role === 'Supervisor' || user?.role === 'Administrador' || user?.role === 'Auditor') {
        redirect('/dashboard/reports/seller-reports');
    } else {
        redirect('/dashboard/reports/my-completed-routes');
    }

    return null;
}
