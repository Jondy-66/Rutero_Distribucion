
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

// Tipos heredados
export type RoutePlan = {
  id: string;
  routeName: string;
  date: Date;
  clients: any[];
  status: string;
  createdBy: string;
};

export type Client = {
  id: string;
  nombre_cliente: string;
  latitud: number;
  longitud: number;
};
