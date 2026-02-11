/**
 * @fileoverview Este archivo contiene funciones para interactuar con la base de datos Firestore.
 * Proporciona una capa de abstracción para realizar operaciones CRUD (Crear, Leer, Actualizar, Eliminar)
 * en las colecciones de la aplicación, como 'users', 'clients' y 'routes'.
 */

import { db } from './config';
import { collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, setDoc, query, orderBy, serverTimestamp, where, writeBatch, Timestamp, limit } from 'firebase/firestore';
import type { User, Client, RoutePlan, ClientInRoute, Notification, PhoneContact } from '@/lib/types';
import { updateUserPasswordAsAdmin } from './auth';

// --- COLECCIÓN DE USUARIOS ---

const usersCollection = collection(db, 'users');

export const getUsers = async (): Promise<User[]> => {
  const q = query(usersCollection, orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
};

export const getSupervisors = async (): Promise<User[]> => {
    const q = query(usersCollection, where('role', '==', 'Supervisor'));
    const snapshot = await getDocs(q);
    const supervisors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
    return supervisors.sort((a, b) => a.name.localeCompare(b.name));
};

export const getUsersBySupervisor = async (supervisorId: string): Promise<User[]> => {
    const q = query(usersCollection, where('supervisorId', '==', supervisorId), orderBy('name'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
};

export const getUser = async (id: string): Promise<User | null> => {
    const docRef = doc(db, 'users', id);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()) {
        return {id: docSnap.id, ...docSnap.data()} as User;
    }
    return null;
}

export const getUserByEmail = async (email: string): Promise<User | null> => {
    const q = query(usersCollection, where("email", "==", email), limit(1));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) return null;
    const userDoc = querySnapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() } as User;
};

export const addUser = (uid: string, userData: Partial<Omit<User, 'id' | 'status'>>) => {
    const userDoc = doc(db, "users", uid);
    return setDoc(userDoc, { ...userData, status: 'active', failedLoginAttempts: 0 });
};

export const updateUser = (id: string, userData: Partial<User>) => {
  const userDoc = doc(db, 'users', id);
  const dataToUpdate = { ...userData };
  if (userData.status === 'active') {
    dataToUpdate.failedLoginAttempts = 0;
  }
  return updateDoc(userDoc, dataToUpdate);
};

export const updateUserPassword = async (uid: string, newPassword: string): Promise<void> => {
  return updateUserPasswordAsAdmin(uid, newPassword);
};

export const deleteUser = (id: string) => {
  const userDoc = doc(db, 'users', id);
  return deleteDoc(userDoc);
};

// --- COLECCIÓN DE CLIENTES ---

const clientsCollection = collection(db, 'clients');

/**
 * Obtiene clientes filtrados opcionalmente por ejecutivo para reducir consumo de cuota.
 */
export const getClients = async (ejecutivo?: string): Promise<Client[]> => {
  let q = query(clientsCollection);
  if (ejecutivo) {
    q = query(clientsCollection, where('ejecutivo', '==', ejecutivo));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[];
};

export const getClient = async (id: string): Promise<Client | null> => {
    const docRef = doc(db, 'clients', id);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()) {
        return {id: docSnap.id, ...docSnap.data()} as Client;
    }
    return null;
}

export const addClient = (clientData: Omit<Client, 'id' | 'status'> & {status: 'active' | 'inactive'}) => {
  return addDoc(clientsCollection, clientData);
};

export const updateClient = (id: string, clientData: Partial<Client>) => {
  const clientDoc = doc(db, 'clients', id);
  return updateDoc(clientDoc, clientData);
};

export const deleteClient = (id: string) => {
  const clientDoc = doc(db, 'clients', id);
  return deleteDoc(clientDoc);
}

export const addClientsBatch = async (clientsData: Omit<Client, 'id' | 'status'>[]) => {
    const batch = writeBatch(db);
    const allClientsSnapshot = await getDocs(query(clientsCollection, limit(1000))); // Limit scan for batch
    const rucsInDb = new Set<string>();
    allClientsSnapshot.forEach(doc => {
        rucsInDb.add(doc.data().ruc);
    });

    let addedCount = 0;
    for (const client of clientsData) {
        if (client.ruc && !rucsInDb.has(client.ruc)) {
            const newClientRef = doc(clientsCollection);
            batch.set(newClientRef, {...client, status: 'active'});
            rucsInDb.add(client.ruc);
            addedCount++;
        }
    }
    await batch.commit();
    return addedCount;
}

export const updateClientLocations = async (locations: { ruc: string; provincia: string; canton: string; direccion: string; latitud: number; longitud: number; }[]) => {
    const batch = writeBatch(db);
    for (const location of locations) {
        const q = query(clientsCollection, where("ruc", "==", location.ruc), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const clientDoc = querySnapshot.docs[0];
            batch.update(doc(db, 'clients', clientDoc.id), {
                provincia: location.provincia,
                canton: location.canton,
                direccion: location.direccion,
                latitud: location.latitud,
                longitud: location.longitud,
            });
        }
    }
    await batch.commit();
}

// --- COLECCIÓN DE RUTAS ---

const routesCollection = collection(db, 'routes');

export const addRoutesBatch = async (routesData: Omit<RoutePlan, 'id' | 'createdAt'>[]): Promise<string[]> => {
    const batch = writeBatch(db);
    const newRouteIds: string[] = [];
    for (const route of routesData) {
        const newRouteRef = doc(routesCollection);
        newRouteIds.push(newRouteRef.id);
        const clientsWithTimestamps = route.clients.map(client => ({
            ...client,
            date: client.date ? Timestamp.fromDate(new Date(client.date as any)) : null,
        }));
        batch.set(newRouteRef, {
            ...route, 
            date: route.date ? Timestamp.fromDate(new Date(route.date as any)) : serverTimestamp(),
            clients: clientsWithTimestamps,
            createdAt: serverTimestamp()
        });
    }
    await batch.commit();
    return newRouteIds;
}

export const addRoute = async (routeData: Omit<RoutePlan, 'id' | 'createdAt'>): Promise<string> => {
    const clientsWithTimestamps = routeData.clients.map(client => ({
        ...client,
        date: client.date ? Timestamp.fromDate(new Date(client.date as any)) : null,
    }));
    const newDocRef = await addDoc(routesCollection, {
        ...routeData,
        date: routeData.date ? Timestamp.fromDate(new Date(routeData.date as any)) : serverTimestamp(),
        clients: clientsWithTimestamps,
        createdAt: serverTimestamp()
    });
    return newDocRef.id;
};

/**
 * Obtiene rutas filtradas por usuario o supervisor para ahorrar cuota.
 */
export const getRoutes = async (filters?: { createdBy?: string, supervisorId?: string }): Promise<RoutePlan[]> => {
    let q = query(routesCollection, orderBy('createdAt', 'desc'), limit(100)); // Limit per user
    if (filters?.createdBy) {
        q = query(routesCollection, where('createdBy', '==', filters.createdBy), orderBy('createdAt', 'desc'));
    } else if (filters?.supervisorId) {
        q = query(routesCollection, where('supervisorId', '==', filters.supervisorId), orderBy('createdAt', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            date: data.date ? (data.date as Timestamp).toDate() : new Date(),
            clients: (data.clients as any[]).map(c => ({ ...c, date: c.date ? (c.date as Timestamp).toDate() : undefined }))
        } as RoutePlan;
    });
};

export const getRoute = async (id: string): Promise<RoutePlan | null> => {
    const docRef = doc(db, 'routes', id);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()) {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            ...data,
            date: data.date ? (data.date as Timestamp).toDate() : new Date(),
            clients: (data.clients as any[]).map(c => ({ ...c, date: c.date ? (c.date as Timestamp).toDate() : undefined }))
        } as RoutePlan;
    }
    return null;
};

export const updateRoute = (id: string, routeData: Partial<Omit<RoutePlan, 'id'>>) => {
    const routeDoc = doc(db, 'routes', id);
    return updateDoc(routeDoc, routeData);
};

export const deleteRoute = (id: string) => {
  const routeDoc = doc(db, 'routes', id);
  return deleteDoc(routeDoc);
};

// --- NOTIFICACIONES ---

const notificationsCollection = collection(db, 'notifications');

export const addNotification = (notificationData: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    return addDoc(notificationsCollection, {
        ...notificationData,
        read: false,
        createdAt: serverTimestamp(),
    });
};

export const markNotificationAsRead = (notificationId: string) => {
    const notificationDoc = doc(db, 'notifications', notificationId);
    return updateDoc(notificationDoc, { read: true });
};

export const markAllNotificationsAsRead = async (userId: string) => {
    const q = query(notificationsCollection, where('userId', '==', userId), where('read', '==', false));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.update(doc.ref, { read: true }));
    return batch.commit();
};

// --- CRM ---

const phoneContactsCollection = collection(db, 'phoneContacts');

export const getPhoneContacts = async (): Promise<PhoneContact[]> => {
    const snapshot = await getDocs(query(phoneContactsCollection, limit(500)));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PhoneContact[];
};

export const addPhoneContact = async (contactData: Omit<PhoneContact, 'id'>): Promise<void> => {
    await addDoc(phoneContactsCollection, contactData);
};

export const addPhoneContactsBatch = async (contactsData: Omit<PhoneContact, 'id'>[]) => {
    const batch = writeBatch(db);
    for (const contact of contactsData) {
        batch.set(doc(phoneContactsCollection), contact);
    }
    await batch.commit();
}
