
import { Timestamp, GeoPoint } from 'firebase/firestore';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'Administrador' | 'Supervisor' | 'Usuario' | 'Telemercaderista';
  avatar?: string;
  status?: 'active' | 'inactive';
  supervisorId?: string;
  failedLoginAttempts?: number;
  permissions?: string[];
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  agent_id: string;
  average_ticket: number;
  last_purchase_date: Timestamp | Date;
  next_call_date: Timestamp | Date;
  purchase_frequency_days: number;
  status: 'lead' | 'active' | 'churn';
  tier?: 'VIP' | 'Medio' | 'Bajo';
  priority_score?: number;
};

export type CrmSale = {
  id: string;
  customer_id: string;
  amount: number;
  date: Timestamp | Date;
  agent_id: string;
  category: string;
};

export type CrmCall = {
  id: string;
  customer_id: string;
  agent_id: string;
  duration: number;
  outcome: 'sold' | 'no_answer' | 'callback';
  timestamp: Timestamp | Date;
  notes?: string;
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

export type PhoneContact = {
    id: string;
    cedula: string;
    nombre_cliente: string;
    nombre_comercial: string;
    ciudad: string;
    regional: string;
    nombre_vendedor: string;
    direccion_cliente: string;
    telefono1: string;
    estado_cliente: 'Activo' | 'Inactivo';
    observacion: string;
};

export type ClientInRoute = {
  ruc: string;
  nombre_comercial: string;
  valorVenta?: number;
  valorCobro?: number;
  tipoCobro?: 'Efectivo' | 'Transferencia' | 'Cheque';
  devoluciones?: number;
  promociones?: number;
  medicacionFrecuente?: number;
  date?: Date;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  removalObservation?: string;
  status?: 'Activo' | 'Eliminado';
  origin?: 'manual' | 'predicted';
  visitStatus?: 'Pendiente' | 'Completado';
  visitType?: 'presencial' | 'telefonica';
  callObservation?: string;
  checkInTime?: string | null;
  checkInLocation?: GeoPoint | null;
  checkOutTime?: string | null;
  checkOutLocation?: GeoPoint | null;
}

export type RoutePlan = {
  id: string;
  routeName: string;
  date: Date;
  clients: ClientInRoute[];
  status: 'Pendiente de Aprobación' | 'Planificada' | 'En Progreso' | 'Completada' | 'Rechazada' | 'Incompleta';
  supervisorId: string;
  supervisorName: string;
  supervisorObservation?: string;
  createdBy: string;
  startTime?: string;
  endTime?: string;
  createdAt?: Timestamp | Date;
  origin?: 'manual' | 'predicted';
  isNew?: boolean;
};

export type Prediction = {
  Ejecutivo: string;
  RUC: string;
  fecha_predicha: string;
  probabilidad_visita: number;
  LatitudTrz: number;
  LongitudTrz: number;
  ventas?: string | number;
  cobros?: string | number;
  promociones?: string | number;
};

export type Notification = {
    id: string;
    userId: string;
    title: string;
    message: string;
    read: boolean;
    link: string;
    createdAt: Date | null;
}
