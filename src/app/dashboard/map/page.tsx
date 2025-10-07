
'use client';
import { useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { MapView } from '@/components/map-view';

export default function MapPage() {
    const { user, clients, loading } = useAuth();

    const filteredClients = useMemo(() => {
        if (!user || loading) return [];
        if (user.role === 'Usuario') {
            return clients.filter(client => client.ejecutivo === user.name);
        }
        return clients;
    }, [user, clients, loading]);
    
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
