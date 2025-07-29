
'use client';
import { PageHeader } from '@/components/page-header';
import { ClientMap } from '@/components/client-map';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import type { Client } from '@/lib/types';
import { useEffect, useState } from 'react';

export default function MapPage() {
    const { clients, loading } = useAuth();
    const [mapClients, setMapClients] = useState<Client[]>([]);

    useEffect(() => {
        if (!loading && clients) {
            setMapClients(clients);
        }
    }, [clients, loading]);

  return (
    <>
      <PageHeader
        title="Visualización de Ubicaciones"
        description="Visualiza todas las ubicaciones de los clientes en el mapa."
      />
      {loading ? <Skeleton className="h-[600px] w-full" /> : <ClientMap clients={mapClients} />}
    </>
  );
}
