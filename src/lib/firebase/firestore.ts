
import { db } from './config';
import { 
    collection, 
    getDocs, 
    getDoc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    setDoc, 
    query, 
    orderBy, 
    serverTimestamp, 
    where, 
    writeBatch, 
    Timestamp, 
    limit,
    onSnapshot,
    GeoPoint
} from 'firebase/firestore';
import type { User, Client, RoutePlan, ActiveLocation, Zone, Breadcrumb, Notification, PhoneContact, Customer, CrmCall, CronConfig, SystemLog } from '@/lib/types';

// --- GEOLOCALIZACIÓN PROFESIONAL ---

export const updateLiveLocation = (userId: string, data: Partial<ActiveLocation>) => {
    const docRef = doc(db, 'active_locations', userId);
    return setDoc(docRef, { 
        ...data, 
        userId, 
        timestamp: serverTimestamp() 
    }, { merge: true });
};

export const saveBreadcrumb = (userId: string, point: Omit<Breadcrumb, 'id'>) => {
    const colRef = collection(db, 'route_history', userId, 'points');
    return addDoc(colRef, {
        ...point,
        timestamp: serverTimestamp()
    });
};

export const getZones = async (): Promise<Zone[]> => {
    const snapshot = await getDocs(collection(db, 'zones'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Zone[];
};

export const saveZone = (zone: Omit<Zone, 'id'>) => {
    return addDoc(collection(db, 'zones'), zone);
};

export const deleteZone = (zoneId: string) => {
    return deleteDoc(doc(db, 'zones', zoneId));
};

export const getRecentHistory = async (userId: string): Promise<Breadcrumb[]> => {
    const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);
    const q = query(
        collection(db, 'route_history', userId, 'points'),
        where('timestamp', '>=', Timestamp.fromDate(eightHoursAgo)),
        orderBy('timestamp', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Breadcrumb[];
};

// --- GESTIÓN DE USUARIOS ---

export const getUsers = async (): Promise<User[]> => {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
};

export const getUser = async (userId: string): Promise<User | null> => {
    const docSnap = await getDoc(doc(db, 'users', userId));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as User : null;
};

export const addUser = (uid: string, data: any) => {
    return setDoc(doc(db, 'users', uid), { ...data, status: 'active', createdAt: serverTimestamp() });
};

export const updateUser = (userId: string, data: Partial<User>) => {
    return updateDoc(doc(db, 'users', userId), data);
};

export const deleteUser = (userId: string) => {
    return deleteDoc(doc(db, 'users', userId));
};

export const getSupervisors = async (): Promise<User[]> => {
    const q = query(collection(db, 'users'), where('role', '==', 'Supervisor'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
};

export const getUsersBySupervisor = async (supervisorId: string): Promise<User[]> => {
    const q = query(collection(db, 'users'), where('supervisorId', '==', supervisorId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
};

// --- GESTIÓN DE CLIENTES ---

export const getClients = async (): Promise<Client[]> => {
  const snapshot = await getDocs(collection(db, 'clients'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[];
};

export const getMyClients = async (ejecutivo: string): Promise<Client[]> => {
    const q = query(collection(db, 'clients'), where('ejecutivo', '==', ejecutivo));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[];
};

export const getClient = async (id: string): Promise<Client | null> => {
    const docSnap = await getDoc(doc(db, 'clients', id));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Client : null;
};

export const addClient = (data: any) => {
    return addDoc(collection(db, 'clients'), { ...data, createdAt: serverTimestamp() });
};

export const updateClient = (id: string, data: Partial<Client>) => {
    return updateDoc(doc(db, 'clients', id), data);
};

export const deleteClient = (id: string) => {
    return deleteDoc(doc(db, 'clients', id));
};

export const updateClientLocations = async (locations: any[]) => {
    const batch = writeBatch(db);
    const clientsRef = collection(db, 'clients');
    
    // Obtenemos todos los RUCs existentes para mapear
    const snapshot = await getDocs(clientsRef);
    const rucMap = new Map(snapshot.docs.map(d => [d.data().ruc, d.id]));

    locations.forEach(loc => {
        const id = rucMap.get(loc.ruc);
        if (id) {
            batch.update(doc(db, 'clients', id), {
                provincia: loc.provincia,
                canton: loc.canton,
                direccion: loc.direccion,
                latitud: loc.latitud,
                longitud: loc.longitud
            });
        }
    });
    return batch.commit();
};

// --- GESTIÓN DE RUTAS ---

export const getRoutes = async (): Promise<RoutePlan[]> => {
    const q = query(collection(db, 'routes'), orderBy('date', 'desc'), limit(150));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({id: d.id, ...d.data()})) as any;
};

export const getMyRoutes = async (userId: string): Promise<RoutePlan[]> => {
    const q = query(collection(db, 'routes'), where('createdBy', '==', userId), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({id: d.id, ...d.data()})) as any;
};

export const getRoute = async (id: string): Promise<RoutePlan | null> => {
    const docSnap = await getDoc(doc(db, 'routes', id));
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as any : null;
};

export const addRoutesBatch = async (routes: any[]) => {
    const batch = writeBatch(db);
    routes.forEach(r => {
        const newRef = doc(collection(db, 'routes'));
        batch.set(newRef, { ...r, createdAt: serverTimestamp() });
    });
    return batch.commit();
};

export const updateRoute = (id: string, data: Partial<RoutePlan>) => {
    return updateDoc(doc(db, 'routes', id), data);
};

export const deleteRoute = (id: string) => {
    return deleteDoc(doc(db, 'routes', id));
};

// --- CRM Y NOTIFICACIONES ---

export const addNotification = (data: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    return addDoc(collection(db, 'notifications'), {
        ...data,
        read: false,
        createdAt: serverTimestamp()
    });
};

export const markNotificationAsRead = (id: string) => {
    return updateDoc(doc(db, 'notifications', id), { read: true });
};

export const markAllNotificationsAsRead = async (userId: string) => {
    const q = query(collection(db, 'notifications'), where('userId', '==', userId), where('read', '==', false));
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.docs.forEach(d => batch.update(d.ref, { read: true }));
    return batch.commit();
};

export const getMyCustomers = async (agentId: string): Promise<Customer[]> => {
    const q = query(collection(db, 'crm_customers'), where('agent_id', '==', agentId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[];
};

export const addCustomersBatch = async (customers: any[]) => {
    const batch = writeBatch(db);
    customers.forEach(c => {
        const ref = doc(collection(db, 'crm_customers'));
        batch.set(ref, { ...c, createdAt: serverTimestamp() });
    });
    return batch.commit();
};

export const addCrmCall = (data: Omit<CrmCall, 'id'>) => {
    return addDoc(collection(db, 'crm_calls'), { ...data, timestamp: serverTimestamp() });
};

export const updateCustomerMetrics = (id: string, data: any) => {
    return updateDoc(doc(db, 'crm_customers', id), data);
};

export const getPhoneContacts = async (): Promise<PhoneContact[]> => {
    const snapshot = await getDocs(collection(db, 'phoneContacts'));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as PhoneContact[];
};

export const addPhoneContact = (data: Omit<PhoneContact, 'id'>) => {
    return addDoc(collection(db, 'phoneContacts'), data);
};

export const addPhoneContactsBatch = async (contacts: any[]) => {
    const batch = writeBatch(db);
    contacts.forEach(c => {
        const ref = doc(collection(db, 'phoneContacts'));
        batch.set(ref, c);
    });
    return batch.commit();
};

// --- CONFIGURACIÓN DE SISTEMA ---

export const getCronConfig = async (): Promise<CronConfig> => {
    const docSnap = await getDoc(doc(db, 'system_config', 'cron'));
    return docSnap.exists() ? docSnap.data() as CronConfig : { enabled: true, active24h: true, scheduledDays: [1,2,3,4,5] };
};

export const updateCronConfig = (data: Partial<CronConfig>) => {
    return setDoc(doc(db, 'system_config', 'cron'), data, { merge: true });
};

export const getSystemLogs = async (): Promise<SystemLog[]> => {
    const q = query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        timestamp: d.data().timestamp instanceof Timestamp ? d.data().timestamp.toDate() : d.data().timestamp 
    })) as SystemLog[];
};
