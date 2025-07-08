'use client';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { ClientMap } from '@/components/client-map';
import type { Client } from '@/lib/types';
import { getClients } from '@/lib/firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

export default function MapPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const clientsData = await getClients();
                setClients(clientsData);
            } catch (error) {
                console.error("Failed to fetch clients:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchClients();
    }, []);

  return (
    <>
      <PageHeader
        title="Visualización de Ubicaciones"
        description="Visualiza todas las ubicaciones de los clientes en el mapa."
      />
      {loading ? <Skeleton className="h-[600px] w-full" /> : <ClientMap clients={clients} />}
    </>
  );
}
