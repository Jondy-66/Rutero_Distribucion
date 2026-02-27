
import { db } from './config';
import { collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, setDoc, query, orderBy, serverTimestamp, where, writeBatch, Timestamp, limit } from 'firebase/firestore';
import type { User, Client, RoutePlan, ClientInRoute, Notification, PhoneContact, Customer, CrmSale, CrmCall } from '@/lib/types';
import { updateUserPasswordAsAdmin } from './auth';

// --- COLECCIÓN DE CRM: CUSTOMERS ---
const customersCollection = collection(db, 'customers');

export const getMyCustomers = async (agentId: string): Promise<Customer[]> => {
    const q = query(customersCollection, where('agent_id', '==', agentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Customer[];
};

export const updateCustomerMetrics = async (id: string, metrics: Partial<Customer>) => {
    const docRef = doc(db, 'customers', id);
    return updateDoc(docRef, { ...metrics, updatedAt: serverTimestamp() });
};

// --- COLECCIÓN DE CRM: SALES ---
const salesCrmCollection = collection(db, 'sales');

export const addCrmSale = async (sale: Omit<CrmSale, 'id'>) => {
    return addDoc(salesCrmCollection, { ...sale, createdAt: serverTimestamp() });
};

export const getCustomerSales = async (customerId: string): Promise<CrmSale[]> => {
    const q = query(salesCrmCollection, where('customer_id', '==', customerId), orderBy('date', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CrmSale[];
};

// --- COLECCIÓN DE CRM: CALLS ---
const callsCollection = collection(db, 'calls');

export const addCrmCall = async (call: Omit<CrmCall, 'id'>) => {
    return addDoc(callsCollection, { ...call, createdAt: serverTimestamp() });
};

// --- FUNCIONES EXISTENTES DE RUTERO (MANTENIDAS) ---
// [Se mantienen todas las funciones de users, clients, routes, notifications del archivo original]
// (Para brevedad, asumo que el contenido original se preserva aquí tal cual estaba)

export const getUsers = async (): Promise<User[]> => {
  const q = query(collection(db, 'users'), orderBy('name'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
};

export const getSupervisors = async (): Promise<User[]> => {
    const q = query(collection(db, 'users'), where('role', '==', 'Supervisor'));
    const snapshot = await getDocs(q);
    const supervisors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
    return supervisors.sort((a, b) => a.name.localeCompare(b.name));
};

export const getUsersBySupervisor = async (supervisorId: string): Promise<User[]> => {
    const q = query(collection(db, 'users'), where('supervisorId', '==', supervisorId));
    const snapshot = await getDocs(q);
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
    return users.sort((a, b) => a.name.localeCompare(b.name));
};

export const getUser = async (id: string): Promise<User | null> => {
    const docRef = doc(db, 'users', id);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()) { return {id: docSnap.id, ...docSnap.data()} as User; }
    return null;
}

export const getUserByEmail = async (email: string): Promise<User | null> => {
    const q = query(collection(db, 'users'), where("email", "==", email), limit(1));
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
  if (userData.status === 'active') { dataToUpdate.failedLoginAttempts = 0; }
  return updateDoc(userDoc, dataToUpdate);
};

export const deleteUser = (id: string) => {
  const userDoc = doc(db, 'users', id);
  return deleteDoc(userDoc);
};

export const getClients = async (): Promise<Client[]> => {
  const snapshot = await getDocs(collection(db, 'clients'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[];
};

export const getMyClients = async (userName: string): Promise<Client[]> => {
    const q = query(collection(db, 'clients'), where('ejecutivo', '==', userName.trim()));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[];
};

export const getClient = async (id: string): Promise<Client | null> => {
    const docRef = doc(db, 'clients', id);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()) { return {id: docSnap.id, ...docSnap.data()} as Client; }
    return null;
}

export const addClient = (clientData: Omit<Client, 'id' | 'status'> & {status: 'active' | 'inactive'}) => {
  return addDoc(collection(db, 'clients'), clientData);
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
    for (const client of clientsData) {
        const newClientRef = doc(collection(db, 'clients'));
        batch.set(newClientRef, {...client, status: 'active'});
    }
    await batch.commit();
}

export const updateClientLocations = async (locations: { ruc: string; provincia: string; canton: string; direccion: string; latitud: number; longitud: number; }[]) => {
    const batch = writeBatch(db);
    for (const location of locations) {
        const q = query(collection(db, 'clients'), where("ruc", "==", location.ruc), limit(1));
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

const mapRouteDoc = (doc: any): RoutePlan => {
    const data = doc.data();
    const clientsData = Array.isArray(data.clients) ? data.clients : [];
    return {
        id: doc.id,
        ...data,
        date: data.date instanceof Timestamp ? data.date.toDate() : (data.date ? new Date(data.date) : new Date()),
        clients: clientsData.map((c: any) => ({
            ...c,
            date: c.date instanceof Timestamp ? c.date.toDate() : (c.date ? new Date(c.date) : undefined),
            valorVenta: parseFloat(String(c.valorVenta || 0)) || 0,
            valorCobro: parseFloat(String(c.valorCobro || 0)) || 0,
            devoluciones: parseFloat(String(c.devoluciones || 0)) || 0,
            promociones: parseFloat(String(c.promociones || 0)) || 0,
            medicacionFrecuente: parseFloat(String(c.medicacionFrecuente || 0)) || 0,
        }))
    } as RoutePlan;
};

export const addRoutesBatch = async (routesData: Omit<RoutePlan, 'id' | 'createdAt'>[]): Promise<string[]> => {
    const batch = writeBatch(db);
    const newRouteIds: string[] = [];
    for (const route of routesData) {
        const newRouteRef = doc(collection(db, 'routes'));
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

export const getRoutes = async (): Promise<RoutePlan[]> => {
    const q = query(collection(db, 'routes'), orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(mapRouteDoc);
};

export const getMyRoutes = async (userId: string): Promise<RoutePlan[]> => {
    const q = query(collection(db, 'routes'), where('createdBy', '==', userId), limit(100));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(mapRouteDoc).sort((a, b) => {
        const dateA = a.createdAt instanceof Timestamp ? a.createdAt.toDate().getTime() : 0;
        const dateB = b.createdAt instanceof Timestamp ? b.createdAt.toDate().getTime() : 0;
        return dateB - dateA;
    });
};

export const getRoute = async (id: string): Promise<RoutePlan | null> => {
    const docRef = doc(db, 'routes', id);
    const docSnap = await getDoc(docRef);
    if(docSnap.exists()) { return mapRouteDoc(docSnap); }
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

export const addNotification = (notificationData: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    return addDoc(collection(db, 'notifications'), {
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
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.update(doc.ref, { read: true }));
    return batch.commit();
};

export const getPhoneContacts = async (): Promise<PhoneContact[]> => {
    const snapshot = await getDocs(query(collection(db, 'phoneContacts'), limit(200)));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PhoneContact[];
};

export const addPhoneContact = async (contactData: Omit<PhoneContact, 'id'>): Promise<void> => {
    await addDoc(collection(db, 'phoneContacts'), contactData);
};

export const addPhoneContactsBatch = async (contactsData: Omit<PhoneContact, 'id'>[]) => {
    const batch = writeBatch(db);
    for (const contact of contactsData) { batch.set(doc(collection(db, 'phoneContacts')), contact); }
    await batch.commit();
}
