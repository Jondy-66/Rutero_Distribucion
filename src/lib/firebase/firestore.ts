import { db } from './config';
import { collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, setDoc, query, orderBy, serverTimestamp, where, writeBatch, Timestamp } from 'firebase/firestore';
import type { User, Client, RoutePlan } from '@/lib/types';

// Users Collection
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
    // Sort by name in the client
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

export const addUser = (uid: string, userData: Partial<Omit<User, 'id' | 'status'>>) => {
    const userDoc = doc(db, "users", uid);
    return setDoc(userDoc, { ...userData, status: 'active' });
};

export const updateUser = (id: string, userData: Partial<User>) => {
  const userDoc = doc(db, 'users', id);
  return updateDoc(userDoc, userData);
};

export const deleteUser = (id: string) => {
  // This only deletes the Firestore document. Deleting from Firebase Auth should be handled separately.
  const userDoc = doc(db, 'users', id);
  return deleteDoc(userDoc);
};


// Clients Collection
const clientsCollection = collection(db, 'clients');

export const getClients = async (): Promise<Client[]> => {
  const snapshot = await getDocs(clientsCollection);
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
    const clientsCollectionRef = collection(db, 'clients');
    
    // Efficiently get all RUCs from the database to check for duplicates.
    const allClientsSnapshot = await getDocs(clientsCollectionRef);
    const rucsInDb = new Set<string>();
    allClientsSnapshot.forEach(doc => {
        rucsInDb.add(doc.data().ruc);
    });

    let addedCount = 0;
    for (const client of clientsData) {
        if (client.ruc && !rucsInDb.has(client.ruc)) {
            const newClientRef = doc(clientsCollectionRef); // Auto-generate ID
            batch.set(newClientRef, {...client, status: 'active'});
            rucsInDb.add(client.ruc); // Add to set to prevent duplicates within the same batch
            addedCount++;
        } else {
            console.warn(`Client with RUC ${client.ruc} already exists or RUC is missing. Skipping.`);
        }
    }

    await batch.commit();
    return addedCount;
}

export const updateClientLocations = async (locations: { ruc: string; provincia: string; canton: string; direccion: string; latitud: number; longitud: number; }[]) => {
    const batch = writeBatch(db);
    const clientsCollectionRef = collection(db, 'clients');
    
    for (const location of locations) {
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
            console.warn(`Client with RUC ${location.ruc} not found. Skipping update.`);
        }
    }

    await batch.commit();
}


// Routes Collection
const routesCollection = collection(db, 'routes');

type RouteToSave = Omit<RoutePlan, 'id' | 'date'> & { date: Timestamp };

export const addRoutesBatch = async (routesData: RouteToSave[]) => {
    const batch = writeBatch(db);
    
    for (const route of routesData) {
        const newRouteRef = doc(routesCollection); // Auto-generate ID
        batch.set(newRouteRef, {...route, createdAt: serverTimestamp()});
    }

    return batch.commit();
}

export const getRoutesBySupervisor = async (supervisorId: string): Promise<RoutePlan[]> => {
    const q = query(routesCollection, where("supervisorId", "==", supervisorId), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            date: (data.date as Timestamp).toDate(), // Convert Firestore Timestamp to JS Date
        } as RoutePlan;
    });
};
