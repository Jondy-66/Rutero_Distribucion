'use client';

import { PageHeader } from '@/components/page-header';

export default function PhoneBasePage() {
  return (
    <>
      <PageHeader
        title="Base Telefónica"
        description="Gestiona y consulta tu base de datos de contactos."
      />
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">
            Módulo de Base Telefónica en Construcción
          </h3>
          <p className="text-sm text-muted-foreground">
            Aquí podrás importar, visualizar y gestionar los contactos telefónicos de tus clientes.
          </p>
        </div>
      </div>
    </>
  );
}
