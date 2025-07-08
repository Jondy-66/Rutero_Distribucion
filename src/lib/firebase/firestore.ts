import { db } from './config';
import { collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc, doc, setDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import type { User, Client, RoutePlan } from '@/lib/types';

// Users Collection
const usersCollection = collection(db, 'users');

export const getUsers = async (): Promise<User[]> => {
  const q = query(usersCollection, orderBy('name'));
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

export const addUser = (uid: string, userData: Omit<User, 'id'>) => {
    const userDoc = doc(db, "users", uid);
    return setDoc(userDoc, userData);
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

export const addClient = (clientData: Omit<Client, 'id'>) => {
  return addDoc(clientsCollection, clientData);
};

// Routes Collection
const routesCollection = collection(db, 'routes');

export const addRoute = (routeData: Omit<RoutePlan, 'id' | 'date'> & {date: any}) => {
    return addDoc(routesCollection, {...routeData, createdAt: serverTimestamp()});
}
