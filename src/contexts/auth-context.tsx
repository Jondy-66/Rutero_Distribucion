/**
 * @fileoverview Gestión de estado de autenticación y datos globales optimizada para cuota.
 */

'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { User as FirebaseAuthUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '@/lib/firebase/config';
import type { User, Client, Notification, RoutePlan, PhoneContact } from '@/lib/types';
import { collection, doc, onSnapshot, query, where, Timestamp, orderBy, limit } from 'firebase/firestore';
import { getClients, getUsers, getRoutes, getPhoneContacts, markNotificationAsRead as markAsReadFirestore, markAllNotificationsAsRead as markAllAsReadFirestore, getMyClients, getMyRoutes } from '@/lib/firebase/firestore';

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

  /**
   * Carga inicial de datos globales con filtros por rol para ahorrar cuota.
   */
  const fetchInitialData = useCallback(async (currentUser: User) => {
    if (isDataInitialized.current) return;
    setDataLoading(true);
    
    try {
        const isSourcingAll = currentUser.role === 'Administrador' || currentUser.role === 'Supervisor';
        
        const [usersData, clientsData, routesData, phoneData] = await Promise.all([
            getUsers(),
            isSourcingAll ? getClients() : getMyClients(currentUser.name),
            isSourcingAll ? getRoutes() : getMyRoutes(currentUser.id),
            getPhoneContacts()
        ]);

        setUsers(usersData);
        setClients(clientsData);
        setRoutes(routesData);
        setPhoneContacts(phoneData);
        isDataInitialized.current = true;
    } catch(error) {
        console.error("Error cargando datos iniciales:", error);
    } finally {
        setDataLoading(false);
    }
  }, []);
  
  const refetchData = useCallback(async (dataType: 'clients' | 'users' | 'routes' | 'phoneContacts') => {
      if (!user) return;
      const isSourcingAll = user.role === 'Administrador' || user.role === 'Supervisor';
      
      try {
          if (dataType === 'clients') setClients(isSourcingAll ? await getClients() : await getMyClients(user.name));
          if (dataType === 'users') setUsers(await getUsers());
          if (dataType === 'routes') setRoutes(isSourcingAll ? await getRoutes() : await getMyRoutes(user.id));
          if (dataType === 'phoneContacts') setPhoneContacts(await getPhoneContacts());
      } catch (error) {
          console.error(`Error al refrescar ${dataType}:`, error);
      }
  }, [user]);

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
            fetchInitialData(userData);
          } else {
            setLoading(false);
            signOut(auth);
          }
        });

        const notificationsQuery = query(
            collection(db, 'notifications'), 
            where('userId', '==', fbUser.uid),
            orderBy('createdAt', 'desc'),
            limit(15)
        );
        const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
            const notificationsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : null,
            } as Notification));
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