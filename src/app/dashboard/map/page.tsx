import { PageHeader } from '@/components/page-header';
import { ClientMap } from '@/components/client-map';

export default function MapPage() {
  return (
    <>
      <PageHeader
        title="Location Visualization"
        description="Visualize all client locations on the map."
      />
      <ClientMap />
    </>
  );
}
