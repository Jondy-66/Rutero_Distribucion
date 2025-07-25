'use client';
import { PageHeader } from '@/components/page-header';
import { ClientMap } from '@/components/client-map';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';

export default function MapPage() {
    const { clients, loading } = useAuth();

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
