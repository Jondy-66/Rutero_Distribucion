

'use client';
import { useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { MapView } from '@/components/map-view';

export default function MapPage() {
    const { user, users, clients, loading } = useAuth();

    const filteredClients = useMemo(() => {
        if (!user || loading) return [];

        if (user.role === 'Usuario') {
            return clients.filter(client => client.ejecutivo.trim().toLowerCase() === user.name.trim().toLowerCase());
        }

        if (user.role === 'Supervisor') {
            const managedUserNames = users
                .filter(u => u.supervisorId === user.id)
                .map(u => u.name.trim().toLowerCase());
            
            return clients.filter(client => 
                managedUserNames.includes(client.ejecutivo.trim().toLowerCase())
            );
        }
        
        // Admin sees all clients
        return clients;
    }, [user, users, clients, loading]);
    
    return (
        <>
        <PageHeader
            title="Visualización de Ubicaciones"
            description="Visualiza todas las ubicaciones de los clientes en el mapa."
        />
        {loading ? <Skeleton className="h-[600px] w-full" /> : <MapView clients={filteredClients} />}
        </>
    );
}
