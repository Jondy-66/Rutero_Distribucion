import { PageHeader } from '@/components/page-header';
import { ClientMap } from '@/components/client-map';

export default function MapPage() {
  return (
    <>
      <PageHeader
        title="Visualización de Ubicaciones"
        description="Visualiza todas las ubicaciones de los clientes en el mapa."
      />
      <ClientMap />
    </>
  );
}
