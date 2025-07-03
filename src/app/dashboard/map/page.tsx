import { PageHeader } from '@/components/page-header';
import { MapView } from '@/components/map-view';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

export default function MapPage() {
  // Dynamically import the map view to ensure it's treated as a client component
  const ClientMapView = dynamic(() => import('@/components/map-view').then(mod => mod.MapView), {
    ssr: false,
    loading: () => <Skeleton className="h-[600px] w-full" />,
  });

  return (
    <>
      <PageHeader
        title="Location Visualization"
        description="Visualize all client locations on the map."
      />
      <ClientMapView />
    </>
  );
}
