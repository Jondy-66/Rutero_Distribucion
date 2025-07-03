'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const ClientMapView = dynamic(() => import('@/components/map-view').then((mod) => mod.MapView), {
  ssr: false,
  loading: () => <Skeleton className="h-[600px] w-full" />,
});

export function ClientMap() {
  return <ClientMapView />;
}
