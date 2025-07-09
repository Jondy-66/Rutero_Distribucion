'use client';
import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { ClientMap } from '@/components/client-map';
import type { Client } from '@/lib/types';
import { getClients } from '@/lib/firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

export default function MapPage() {
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const clientsData = await getClients();
                setClients(clientsData);
            } catch (error: any) {
                console.error("Failed to fetch clients:", error);
                if (error.code === 'permission-denied') {
                    toast({ title: "Error de Permisos", description: "No se pudieron cargar los clientes. Revisa las reglas de seguridad de Firestore.", variant: "destructive" });
                } else {
                    toast({ title: "Error", description: "Ocurrió un error al cargar los clientes.", variant: "destructive" });
                }
            } finally {
                setLoading(false);
            }
        };
        fetchClients();
    }, [toast]);

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
