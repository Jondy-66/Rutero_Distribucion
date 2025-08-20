/**
 * @fileoverview Define los tipos de datos principales utilizados en la aplicación.
 * Estos tipos aseguran la consistencia de los datos entre los componentes y la base de datos de Firestore.
 */

/**
 * Representa la estructura de un objeto de Usuario en el sistema.
 */
export type User = {
  id: string; // El UID de Firebase Auth.
  name: string; // Nombre completo del usuario.
  email: string; // Correo electrónico del usuario.
  role: 'Administrador' | 'Supervisor' | 'Usuario'; // Rol del usuario, que define sus permisos.
  avatar?: string; // URL de la imagen de perfil del usuario.
  status?: 'active' | 'inactive'; // Estado del usuario, para activarlo o desactivarlo.
  supervisorId?: string; // ID del supervisor asignado, si el rol es 'Usuario'.
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
}


/**
 * Representa la estructura de un plan de ruta.
 */
export type RoutePlan = {
  id: string; // ID único del documento en Firestore.
  routeName: string; // Nombre descriptivo de la ruta.
  date: Date; // Fecha en que se debe realizar la ruta.
  dayOfWeek?: string; // Día de la semana (ej. "Lunes"), para rutas recurrentes.
  clients: ClientInRoute[]; // Array de clientes con sus valores específicos para la ruta.
  status: 'Planificada' | 'En Progreso' | 'Completada'; // Estado actual de la ruta.
  supervisorId: string; // ID del supervisor responsable de la ruta.
  supervisorName?: string; // Nombre del supervisor (desnormalizado para fácil visualización).
  createdBy: string; // ID del usuario que creó la ruta.
  startTime: string; // Hora de inicio planificada (ej. "08:00").
  endTime: string; // Hora de finalización planificada (ej. "17:00").
  valorVenta?: number; // Monto total de la venta planificada para la ruta. (DEPRECATED: Now per-client)
  valorCobro?: number; // Monto total a cobrar en la ruta. (DEPRECATED: Now per-client)
  tipoCobro?: 'Efectivo' | 'Transferencia' | 'Cheque'; // Método de cobro principal. (DEPRECATED: Now per-client)
  devoluciones?: number; // Monto total de devoluciones. (DEPRECATED: Now per-client)
  promociones?: number; // Monto total de promociones aplicadas. (DEPRECATED: Now per-client)
  medicacionFrecuente?: number; // Monto total de medicación frecuente vendida. (DEPRECATED: Now per-client)
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
};
