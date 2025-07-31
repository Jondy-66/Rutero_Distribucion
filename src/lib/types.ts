export type User = {
  id: string;
  name: string;
  email: string;
  role: 'Administrador' | 'Supervisor' | 'Usuario';
  avatar?: string;
  status?: 'active' | 'inactive';
  supervisorId?: string;
};

export type Client = {
  id: string;
  ejecutivo: string;
  ruc: string;
  nombre_cliente: string;
  nombre_comercial: string;
  provincia: string;
  canton: string;
  direccion: string;
  latitud: number;
  longitud: number;
  status: 'active' | 'inactive';
};

export type RoutePlan = {
  id: string;
  routeName: string;
  date: Date;
  dayOfWeek?: string;
  clients: Client[];
  status: 'Planificada' | 'En Progreso' | 'Completada';
  supervisorId: string;
  supervisorName?: string; // Optional: denormalized for easier display
  createdBy: string;
  startTime: string;
  endTime: string;
  valorVenta?: number;
  valorCobro?: number;
  tipoCobro?: 'Efectivo' | 'Transferencia' | 'Cheque';
  devoluciones?: number;
  expirados?: number;
  promociones?: number;
  medicacionFrecuente?: number;
};
