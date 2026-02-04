/**
 * @fileoverview Gestión de estado de autenticación y datos globales optimizada para alto rendimiento.
 */

'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { User as FirebaseAuthUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '@/lib/firebase/config';
import type { User, Client, Notification, RoutePlan, PhoneContact } from '@/lib/types';
import { collection, doc, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
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
        const loadUsers = getUsers().then(data => setUsers(data));
        const loadClients = getClients().then(data => setClients(data));
        const loadRoutes = getRoutes().then(data => setRoutes(data.map(transformRouteDates)));
        const loadPhone = getPhoneContacts().then(data => setPhoneContacts(data));

        await Promise.all([loadUsers, loadClients, loadRoutes, loadPhone]);
        isDataInitialized.current = true;
    } catch(error) {
        console.error("Error cargando datos iniciales:", error);
    } finally {
        setDataLoading(false);
    }
  }, []);
  
  const refetchData = useCallback(async (dataType: 'clients' | 'users' | 'routes' | 'phoneContacts') => {
      try {
          if (dataType === 'clients') {
              const data = await getClients();
              setClients(data);
          }
          if (dataType === 'users') {
              const data = await getUsers();
              setUsers(data);
          }
          if (dataType === 'routes') {
              const data = await getRoutes();
              setRoutes(data.map(transformRouteDates));
          }
          if (dataType === 'phoneContacts') {
              const data = await getPhoneContacts();
              setPhoneContacts(data);
          }
      } catch (error) {
          console.error(`Error al refrescar ${dataType}:`, error);
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
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      
      if (fbUser) {
        const userDocRef = doc(db, 'users', fbUser.uid);
        
        const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
          if (doc.exists()) {
            const userData = { id: fbUser.uid, ...doc.data() } as User;
            setUser(userData);
            setLoading(false);
            fetchInitialData();
          } else {
            setLoading(false);
            signOut(auth);
          }
        }, (error) => {
            console.error("Error en perfil:", error);
            setLoading(false);
        });

        const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', fbUser.uid));
        const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
            const notificationsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : null,
            } as Notification));
            
            setNotifications(notificationsData.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)));
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
