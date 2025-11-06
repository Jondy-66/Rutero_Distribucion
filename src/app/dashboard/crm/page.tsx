'use client';

import { PageHeader } from '@/components/page-header';

export default function CrmPage() {
  return (
    <>
      <PageHeader
        title="CRM"
        description="Gestiona la relación con tus clientes."
      />
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">
            Módulo CRM en Construcción
          </h3>
          <p className="text-sm text-muted-foreground">
            Aquí podrás gestionar todas las interacciones con tus clientes.
          </p>
        </div>
      </div>
    </>
  );
}
