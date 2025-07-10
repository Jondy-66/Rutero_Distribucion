'use client';
import { PageHeader } from '@/components/page-header';

export default function RouteManagementPage() {
  return (
    <>
      <PageHeader
        title="Gestión de Rutas"
        description="Visualiza y gestiona todas las rutas planificadas."
      />
      <div className="text-center text-muted-foreground py-16">
        <p>Próximamente: Aquí podrás ver y administrar tus rutas.</p>
      </div>
    </>
  );
}
