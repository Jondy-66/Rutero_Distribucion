export type User = {
  id: string;
  name: string;
  email: string;
  role: 'Administrador' | 'Supervisor' | 'Usuario';
  avatar?: string;
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
};

export type RoutePlan = {
  id: string;
  routeName: string;
  date: Date;
  clients: Client[];
  status: 'Planificada' | 'En Progreso' | 'Completada';
};
