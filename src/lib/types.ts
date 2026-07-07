
import { Timestamp, GeoPoint } from 'firebase/firestore';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'Administrador' | 'Supervisor' | 'Usuario' | 'Telemercaderista' | 'Auditor';
  avatar?: string;
  status?: 'active' | 'inactive';
  supervisorId?: string;
  failedLoginAttempts?: number;
  permissions?: string[];
  extendedClosingTime?: string; // HH:mm para cierre permanente
  extendedClosingDays?: number[]; // [1,2,3,4,5] días de la semana
};

export type ActiveLocation = {
  userId: string;
  userName: string;
  lat: number;
  lng: number;
  timestamp: Timestamp | Date;
  heading?: number;
  accuracy?: number;
  address_text?: string;
  is_out_of_route?: boolean;
  gpsEnabled?: boolean;
  isPermissionDenied?: boolean;
  isSignalWeak?: boolean;
};

export type Zone = {
  id: string;
  userId: string;
  name: string;
  geoJson: any; // Formato Feature (Polygon)
};

export type Breadcrumb = {
  id: string;
  lat: number;
  lng: number;
  timestamp: Timestamp | Date;
};

export type Notification = {
    id: string;
    userId: string;
    title: string;
    message: string;
    link: string;
    read: boolean;
    createdAt: Date | Timestamp;
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
  status?: 'active' | 'inactive';
  createdAt?: any;
};

export type ClientInRoute = {
    ruc: string;
    nombre_comercial: string;
    date: Date | Timestamp;
    visitStatus: 'Pendiente' | 'Completado';
    status: 'Activo' | 'Eliminado';
    visitType?: 'presencial' | 'telefonica' | null;
    isReadded?: boolean;
    reAdditionObservation?: string;
    visitObservation?: string;
    callObservation?: string;
    checkInTime?: string | null;
    checkOutTime?: string | null;
    checkInLocation?: GeoPoint | { latitude: number; longitude: number } | null;
    checkOutLocation?: GeoPoint | { latitude: number; longitude: number } | null;
    valorVenta?: number;
    valorCobro?: number;
    devoluciones?: number;
    promociones?: number;
    medicacionFrecuente?: number;
    removalObservation?: string;
};

export type RoutePlan = {
  id: string;
  routeName: string;
  date: Date | Timestamp;
  clients: ClientInRoute[];
  status: 'Planificada' | 'En Progreso' | 'Completada' | 'Pendiente de Aprobación' | 'Rechazada';
  createdBy: string;
  supervisorId: string;
  supervisorName: string;
  createdAt: Date | Timestamp;
  supervisorObservation?: string;
  extendedClosingTime?: string; // Hora máxima de cierre extendida (HH:mm)
};

export type Prediction = {
    Ejecutivo: string;
    cliente_id: string;
    Cliente: string;
    probabilidad_visita: number;
    ventas: number;
    cobros: number;
    LatitudTrz: number;
    LongitudTrz: number;
    fecha_predicha: string;
    promociones: number;
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
    observacion?: string;
};

export type Customer = {
    id: string;
    name: string;
    phone: string;
    email: string;
    agent_id: string;
    average_ticket: number;
    last_purchase_date: Date | Timestamp;
    next_call_date: Date | Timestamp;
    purchase_frequency_days: number;
    status: 'lead' | 'active' | 'churned';
    tier: 'VIP' | 'Medio' | 'Bajo';
    priority_score: number;
};

export type CrmCall = {
    id: string;
    customer_id: string;
    agent_id: string;
    duration: number; // minutos
    outcome: 'sold' | 'no_answer' | 'callback';
    timestamp: Date | Timestamp;
    notes: string;
};

export type CronConfig = {
    enabled: boolean;
    active24h: boolean;
    scheduledDays: number[];
    refreshIntervalMinutes: number;
    lastRun?: Date | Timestamp;
};

export type SystemLog = {
    id: string;
    type: string;
    timestamp: Date | Timestamp;
    processed: number;
    details: any;
};
