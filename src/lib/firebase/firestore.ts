/**
 * @fileoverview Este archivo contiene funciones para interactuar con la base de datos Firestore.
 * Proporciona una capa de abstracción para realizar operaciones CRUD (Crear, Leer, Actualizar, Eliminar)
 * en las colecciones de la aplicación, como 'users', 'clients' y 'routes'.
 */

import { db } from './config';
import { collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, setDoc, query, orderBy, serverTimestamp, where, writeBatch, Timestamp } from 'firebase/firestore';
import type { User, Client, RoutePlan } from '@/lib/types';

// --- COLECCIÓN DE USUARIOS ---

/**
 * Referencia a la colección 'users' en Firestore.
 */
const usersCollection = collection(db, 'users');

/**
 * Obtiene todos los usuarios de la base de datos, ordenados por nombre.
 * @returns {Promise<User[]>} Una promesa que se resuelve con un array de objetos User.
 */
export const getUsers = async (): Promise<User[]> => {
  const q = query(usersCollection, orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
};

/**
 * Obtiene todos los usuarios con el rol de 'Supervisor', ordenados por nombre.
 * @returns {Promise<User[]>} Una promesa que se resuelve con un array de objetos User de supervisores.
 */
export const getSupervisors = async (): Promise<User[]> => {
    const q = query(usersCollection, where('role', '==', 'Supervisor'));
    const snapshot = await getDocs(q);
    const supervisors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
    // La ordenación por nombre se hace en el lado del cliente después de la consulta.
    return supervisors.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * Obtiene todos los usuarios asignados a un supervisor específico, ordenados por nombre.
 * @param {string} supervisorId - El ID del supervisor.
 * @returns {Promise<User[]>} Una promesa que se resuelve con un array de usuarios asignados.
 */
export const getUsersBySupervisor = async (supervisorId: string): Promise<User[]> => {
    const q = query(usersCollection, where('supervisorId', '==', supervisorId), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
};

/**
 * Obtiene un único usuario por su ID.
 * @param {string} id - El ID del documento del usuario a obtener.
 * @returns {Promise<User | null>} Una promesa que se resuelve con el objeto User o null si no se encuentra.
 */
export const getUser = async (id: string): Promise<User | null> => {
    const docRef = doc(db, 'users', id);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()) {
        return {id: docSnap.id, ...docSnap.data()} as User;
    }
    return null;
}

/**
 * Añade un nuevo usuario a la colección 'users' utilizando su UID de Firebase Auth como ID del documento.
 * @param {string} uid - El UID del usuario de Firebase Authentication.
 * @param {Partial<Omit<User, 'id' | 'status'>>} userData - Los datos del usuario a añadir.
 * @returns {Promise<void>} Una promesa que se resuelve cuando el usuario ha sido añadido.
 */
export const addUser = (uid: string, userData: Partial<Omit<User, 'id' | 'status'>>) => {
    const userDoc = doc(db, "users", uid);
    // Todos los usuarios nuevos se crean con estado 'active'.
    return setDoc(userDoc, { ...userData, status: 'active' });
};

/**
 * Actualiza los datos de un usuario existente.
 * @param {string} id - El ID del documento del usuario a actualizar.
 * @param {Partial<User>} userData - Los campos del usuario a actualizar.
 * @returns {Promise<void>} Una promesa que se resuelve cuando el usuario ha sido actualizado.
 */
export const updateUser = (id: string, userData: Partial<User>) => {
  const userDoc = doc(db, 'users', id);
  return updateDoc(userDoc, userData);
};

/**
 * Elimina un usuario de la colección 'users' en Firestore.
 * Nota: Esto no elimina al usuario de Firebase Authentication.
 * @param {string} id - El ID del documento del usuario a eliminar.
 * @returns {Promise<void>} Una promesa que se resuelve cuando el usuario ha sido eliminado.
 */
export const deleteUser = (id: string) => {
  const userDoc = doc(db, 'users', id);
  return deleteDoc(userDoc);
};


// --- COLECCIÓN DE CLIENTES ---

/**
 * Referencia a la colección 'clients' en Firestore.
 */
const clientsCollection = collection(db, 'clients');

/**
 * Obtiene todos los clientes de la base de datos.
 * @returns {Promise<Client[]>} Una promesa que se resuelve con un array de objetos Client.
 */
export const getClients = async (): Promise<Client[]> => {
  const snapshot = await getDocs(clientsCollection);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[];
};

/**
 * Obtiene un único cliente por su ID.
 * @param {string} id - El ID del documento del cliente a obtener.
 * @returns {Promise<Client | null>} Una promesa que se resuelve con el objeto Client o null si no se encuentra.
 */
export const getClient = async (id: string): Promise<Client | null> => {
    const docRef = doc(db, 'clients', id);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()) {
        return {id: docSnap.id, ...docSnap.data()} as Client;
    }
    return null;
}

/**
 * Añade un nuevo cliente a la colección 'clients'.
 * @param {Omit<Client, 'id'>} clientData - Los datos del cliente a añadir.
 * @returns {Promise<DocumentReference>} Una promesa que se resuelve con la referencia al documento creado.
 */
export const addClient = (clientData: Omit<Client, 'id' | 'status'> & {status: 'active' | 'inactive'}) => {
  return addDoc(clientsCollection, clientData);
};

/**
 * Actualiza los datos de un cliente existente.
 * @param {string} id - El ID del documento del cliente a actualizar.
 * @param {Partial<Client>} clientData - Los campos del cliente a actualizar.
 * @returns {Promise<void>} Una promesa que se resuelve cuando el cliente ha sido actualizado.
 */
export const updateClient = (id: string, clientData: Partial<Client>) => {
  const clientDoc = doc(db, 'clients', id);
  return updateDoc(clientDoc, clientData);
};

/**
 * Elimina un cliente de la colección 'clients'.
 * @param {string} id - El ID del documento del cliente a eliminar.
 * @returns {Promise<void>} Una promesa que se resuelve cuando el cliente ha sido eliminado.
 */
export const deleteClient = (id: string) => {
  const clientDoc = doc(db, 'clients', id);
  return deleteDoc(clientDoc);
}

/**
 * Añade múltiples clientes en un lote (batch).
 * Verifica la existencia de RUCs para evitar duplicados.
 * @param {Omit<Client, 'id' | 'status'>[]} clientsData - Un array de objetos de cliente a añadir.
 * @returns {Promise<number>} Una promesa que se resuelve con el número de clientes realmente añadidos.
 */
export const addClientsBatch = async (clientsData: Omit<Client, 'id' | 'status'>[]) => {
    const batch = writeBatch(db);
    const clientsCollectionRef = collection(db, 'clients');
    
    // Obtener todos los RUCs existentes para una verificación eficiente de duplicados.
    const allClientsSnapshot = await getDocs(clientsCollectionRef);
    const rucsInDb = new Set<string>();
    allClientsSnapshot.forEach(doc => {
        rucsInDb.add(doc.data().ruc);
    });

    let addedCount = 0;
    for (const client of clientsData) {
        // Solo añade el cliente si tiene RUC y no existe ya en la BD.
        if (client.ruc && !rucsInDb.has(client.ruc)) {
            const newClientRef = doc(clientsCollectionRef); // Firestore genera un ID automático.
            batch.set(newClientRef, {...client, status: 'active'});
            rucsInDb.add(client.ruc); // Añadir al set para evitar duplicados dentro del mismo lote.
            addedCount++;
        } else {
            console.warn(`Cliente con RUC ${client.ruc} ya existe o el RUC falta. Omitiendo.`);
        }
    }

    await batch.commit();
    return addedCount;
}

/**
 * Actualiza las ubicaciones de múltiples clientes en un lote.
 * Busca a los clientes por su RUC y actualiza sus datos de ubicación.
 * @param {object[]} locations - Un array de objetos con los datos de ubicación a actualizar.
 * @returns {Promise<void>} Una promesa que se resuelve cuando todas las ubicaciones han sido actualizadas.
 */
export const updateClientLocations = async (locations: { ruc: string; provincia: string; canton: string; direccion: string; latitud: number; longitud: number; }[]) => {
    const batch = writeBatch(db);
    const clientsCollectionRef = collection(db, 'clients');
    
    for (const location of locations) {
        // Encontrar al cliente por su RUC.
        const q = query(clientsCollectionRef, where("ruc", "==", location.ruc));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const clientDoc = querySnapshot.docs[0];
            const clientDocRef = doc(db, 'clients', clientDoc.id);
            batch.update(clientDocRef, {
                provincia: location.provincia,
                canton: location.canton,
                direccion: location.direccion,
                latitud: location.latitud,
                longitud: location.longitud,
            });
        } else {
            console.warn(`Cliente con RUC ${location.ruc} no encontrado. Omitiendo actualización.`);
        }
    }

    await batch.commit();
}


// --- COLECCIÓN DE RUTAS ---

/**
 * Referencia a la colección 'routes' en Firestore.
 */
const routesCollection = collection(db, 'routes');

/**
 * Tipo auxiliar para guardar rutas, convirtiendo la fecha a Timestamp de Firestore.
 */
type RouteToSave = Omit<RoutePlan, 'id' | 'date' | 'createdAt'> & { date: Timestamp };

/**
 * Añade múltiples planes de ruta en un lote.
 * @param {RouteToSave[]} routesData - Un array de objetos de ruta a guardar.
 * @returns {Promise<void>} Una promesa que se resuelve cuando todas las rutas han sido añadidas.
 */
export const addRoutesBatch = async (routesData: RouteToSave[]) => {
    const batch = writeBatch(db);
    
    for (const route of routesData) {
        const newRouteRef = doc(routesCollection); // Firestore genera un ID automático.
        batch.set(newRouteRef, {...route, createdAt: serverTimestamp()}); // Añade una marca de tiempo de creación.
    }

    return batch.commit();
}

/**
 * Obtiene todas las rutas planificadas, ordenadas por fecha descendente.
 * @returns {Promise<RoutePlan[]>} Una promesa que se resuelve con un array de objetos RoutePlan.
 */
export const getRoutes = async (): Promise<RoutePlan[]> => {
    const q = query(routesCollection, orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        // Convierte el Timestamp de Firestore a un objeto Date de JavaScript.
        return {
            id: doc.id,
            ...data,
            date: (data.date as Timestamp).toDate(),
        } as RoutePlan;
    });
};

/**
 * Obtiene un único plan de ruta por su ID.
 * @param {string} id - El ID del documento de la ruta a obtener.
 * @returns {Promise<RoutePlan | null>} Una promesa que se resuelve con el objeto RoutePlan o null si no se encuentra.
 */
export const getRoute = async (id: string): Promise<RoutePlan | null> => {
    const docRef = doc(db, 'routes', id);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()) {
        const data = docSnap.data();
        // Convierte el Timestamp de Firestore a un objeto Date de JavaScript.
        return {
            id: docSnap.id,
            ...data,
            date: (data.date as Timestamp).toDate(),
        } as RoutePlan;
    }
    return null;
};

/**
 * Actualiza los datos de un plan de ruta existente.
 * @param {string} id - El ID del documento de la ruta a actualizar.
 * @param {Partial<RoutePlan>} routeData - Los campos de la ruta a actualizar.
 * @returns {Promise<void>} Una promesa que se resuelve cuando la ruta ha sido actualizada.
 */
export const updateRoute = (id: string, routeData: Partial<RoutePlan>) => {
    const routeDoc = doc(db, 'routes', id);
    return updateDoc(routeDoc, routeData);
};


/**
 * Obtiene todas las rutas asignadas a un supervisor específico, ordenadas por fecha descendente.
 * @param {string} supervisorId - El ID del supervisor.
 * @returns {Promise<RoutePlan[]>} Una promesa que se resuelve con un array de objetos RoutePlan.
 */
export const getRoutesBySupervisor = async (supervisorId: string): Promise<RoutePlan[]> => {
    const q = query(routesCollection, where("supervisorId", "==", supervisorId), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            date: (data.date as Timestamp).toDate(), // Convierte el Timestamp de Firestore a un objeto Date de JavaScript.
        } as RoutePlan;
    });
};
