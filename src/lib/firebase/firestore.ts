
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
    onSnapshot
} from 'firebase/firestore';
import type { User, Client, RoutePlan, ActiveLocation, Zone, Breadcrumb } from '@/lib/types';

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

// --- FUNCIONES EXISTENTES REQUERIDAS ---
export const getUsers = async (): Promise<User[]> => {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as User[];
};

export const getClients = async (): Promise<Client[]> => {
  const snapshot = await getDocs(collection(db, 'clients'));
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[];
};

export const getRoutes = async (): Promise<RoutePlan[]> => {
    const q = query(collection(db, 'routes'), orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({id: d.id, ...d.data()})) as any;
};
