/**
 * @fileoverview Gestión de estado de autenticación y datos globales con enfoque en estabilidad y rapidez.
 */

'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { User as FirebaseAuthUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '@/lib/firebase/config';
import type { User, Client, Notification, RoutePlan, PhoneContact } from '@/lib/types';
import { collection, doc, onSnapshot, query, where, Timestamp, getDoc } from 'firebase/firestore';
import { getClients, getUsers, getRoutes, getPhoneContacts, markNotificationAsRead as markAsReadFirestore, markAllNotificationsAsRead as markAllAsReadFirestore } from '@/lib/firebase/firestore';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseAuthUser | null;
  loading: boolean;
  dataLoading: boolean;
  clients: Client[];
  users: User[];
  routes: RoutePlan[];
  phoneContacts: PhoneContact[];
  notifications: Notification[];
  unreadCount: number;
  refetchData: (dataType: 'clients' | 'users' | 'routes' | 'phoneContacts') => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
}

const transformRouteDates = (route: RoutePlan): RoutePlan => ({
    ...route,
    date: route.date instanceof Timestamp ? route.date.toDate() : (route.date instanceof Date ? route.date : new Date()),
    clients: route.clients.map(client => ({
        ...client,
        date: client.date instanceof Timestamp ? client.date.toDate() : (client.date instanceof Date ? client.date : undefined)
    }))
});

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [routes, setRoutes] = useState<RoutePlan[]>([]);
  const [phoneContacts, setPhoneContacts] = useState<PhoneContact[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  
  const isDataInitialized = useRef(false);

  const fetchInitialData = useCallback(async () => {
    if (isDataInitialized.current) return;
    
    setDataLoading(true);
    try {
        // Ejecutar descargas en paralelo sin bloquear el hilo principal
        const [usersData, clientsData, routesData, phoneContactsData] = await Promise.all([
            getUsers(), 
            getClients(), 
            getRoutes(), 
            getPhoneContacts()
        ]);
        setUsers(usersData);
        setClients(clientsData);
        setRoutes(routesData.map(transformRouteDates));
        setPhoneContacts(phoneContactsData);
        isDataInitialized.current = true;
    } catch(error) {
        console.error("Failed to fetch initial data:", error);
    } finally {
        setDataLoading(false);
    }
  }, []);
  
  const refetchData = useCallback(async (dataType: 'clients' | 'users' | 'routes' | 'phoneContacts') => {
      try {
          if (dataType === 'clients') setClients(await getClients());
          if (dataType === 'users') setUsers(await getUsers());
          if (dataType === 'routes') setRoutes((await getRoutes()).map(transformRouteDates));
          if (dataType === 'phoneContacts') setPhoneContacts(await getPhoneContacts());
      } catch (error) {
          console.error(`Failed to refetch ${dataType}:`, error);
      }
  }, []);

  const handleMarkNotificationAsRead = async (notificationId: string) => {
    try { await markAsReadFirestore(notificationId); } catch (error) { console.error(error); }
  }

  const handleMarkAllNotificationsAsRead = async () => {
    if (!user) return;
    try { await markAllAsReadFirestore(user.id); } catch (error) { console.error(error); }
  }

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      
      if (fbUser) {
        const userDocRef = doc(db, 'users', fbUser.uid);
        
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = { id: fbUser.uid, ...userDoc.data() } as User;
            setUser(userData);
            // Iniciar descarga de datos en segundo plano sin esperar
            fetchInitialData();
          } else {
            console.error("Profile missing");
            await signOut(auth);
          }
        } catch (err) {
          console.error("Auth init error:", err);
        } finally {
          // Asegurar que la pantalla de carga desaparezca lo antes posible
          setLoading(false);
        }

        // Suscripciones en tiempo real
        const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) setUser({ id: fbUser.uid, ...doc.data() } as User);
        });

        const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', fbUser.uid));
        const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
            const notificationsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : null,
            } as Notification));
            
            notificationsData.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
            setNotifications(notificationsData);
        });

        return () => {
            unsubscribeUser();
            unsubscribeNotifications();
        };
      } else {
        setUser(null);
        setClients([]);
        setUsers([]);
        setRoutes([]);
        setPhoneContacts([]);
        setNotifications([]);
        isDataInitialized.current = false;
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [fetchInitialData]);

  return (
    <AuthContext.Provider value={{ 
        user, 
        firebaseUser, 
        loading,
        dataLoading,
        clients, 
        users, 
        routes,
        phoneContacts,
        refetchData, 
        notifications,
        unreadCount: notifications.filter(n => !n.read).length,
        markNotificationAsRead: handleMarkNotificationAsRead,
        markAllNotificationsAsRead: handleMarkAllNotificationsAsRead
    }}>
      {children}
    </AuthContext.Provider>
  );
};
