

/**
 * @fileoverview Define los tipos de datos principales utilizados en la aplicación.
 * Estos tipos aseguran la consistencia de los datos entre los componentes y la base de datos de Firestore.
 */

import { Timestamp, GeoPoint } from 'firebase/firestore';

/**
 * Representa la estructura de un objeto de Usuario en el sistema.
 */
export type User = {
  id: string; // El UID de Firebase Auth.
  name: string; // Nombre completo del usuario.
  email: string; // Correo electrónico del usuario.
  role: 'Administrador' | 'Supervisor' | 'Usuario' | 'Telemercaderista'; // Rol del usuario, que define sus permisos.
  avatar?: string; // URL de la imagen de perfil del usuario.
  status?: 'active' | 'inactive'; // Estado del usuario, para activarlo o desactivarlo.
  supervisorId?: string; // ID del supervisor asignado, si el rol es 'Usuario'.
  failedLoginAttempts?: number; // Contador de intentos fallidos de inicio de sesión.
};

/**
 * Representa la estructura de un objeto de Cliente en el sistema.
 */
export type Client = {
  id: string; // ID único del documento en Firestore.
  ejecutivo: string; // Nombre del ejecutivo de ventas asignado al cliente.
  ruc: string; // Registro Único de Contribuyentes del cliente, debe ser único.
  nombre_cliente: string; // Razón social o nombre legal del cliente.
  nombre_comercial: string; // Nombre con el que se conoce comercialmente al cliente.
  provincia: string; // Provincia donde se ubica el cliente.
  canton: string; // Cantón donde se ubica el cliente.
  direccion: string; // Dirección física del cliente.
  latitud: number; // Coordenada de latitud para geolocalización.
  longitud: number; // Coordenada de longitud para geolocalización.
  status: 'active' | 'inactive'; // Estado del cliente, para activarlo o desactivarlo.
};

/**
 * Representa un contacto en la base telefónica del CRM.
 */
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


/**
 * Representa un cliente dentro de una ruta, con sus valores específicos.
 */
export type ClientInRoute = {
  ruc: string; // Usado para identificar al cliente.
  nombre_comercial: string; // Para visualización.
  valorVenta?: number;
  valorCobro?: number;
  tipoCobro?: 'Efectivo' | 'Transferencia' | 'Cheque';
  devoluciones?: number;
  promociones?: number;
  medicacionFrecuente?: number;
  // Campos de planificación individuales
  date?: Date;
  dayOfWeek?: string;
  startTime?: string;
  endTime?: string;
  // Nuevo campo para la observación de eliminación
  removalObservation?: string;
  status?: 'Activo' | 'Eliminado';
  origin?: 'manual' | 'predicted';
  visitStatus?: 'Pendiente' | 'Completado';
  visitType?: 'presencial' | 'telefonica';
  callObservation?: string;
  checkInTime?: string | null;
  checkInLocation?: GeoPoint | null;
}


/**
 * Representa la estructura de un plan de ruta.
 */
export type RoutePlan = {
  id: string; // ID único del documento en Firestore.
  routeName: string; // Nombre descriptivo de la ruta.
  date: Date; // Fecha general de la ruta.
  clients: ClientInRoute[]; // Array de clientes con sus valores específicos para la ruta.
  status: 'Pendiente de Aprobación' | 'Planificada' | 'En Progreso' | 'Completada' | 'Rechazada'; // Estado actual de la ruta.
  supervisorId: string; // ID del supervisor responsable de la ruta.
  supervisorName: string; // Nombre del supervisor (desnormalizado para fácil visualización).
  supervisorObservation?: string; // Observaciones del supervisor al aprobar/rechazar.
  createdBy: string; // ID del usuario que creó la ruta.
  startTime?: string;
  endTime?: string;
  createdAt?: Timestamp | Date;
  origin?: 'manual' | 'predicted';
  isNew?: boolean;
};


/**
 * Representa la estructura de un objeto de Predicción de la API externa.
 */
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

/**
 * Representa la estructura de una notificación en el sistema.
 */
export type Notification = {
    id: string; // ID único del documento en Firestore.
    userId: string; // ID del usuario que debe recibir la notificación.
    title: string; // Título de la notificación.
    message: string; // Mensaje de la notificación.
    read: boolean; // Estado de lectura de la notificación.
    link: string; // Enlace al que se redirige al hacer clic.
    createdAt: Date | null; // Fecha de creación de la notificación.
}

