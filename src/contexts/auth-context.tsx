/**
 * @fileoverview Gestión de estado de autenticación y datos globales con sincronización optimizada para carga instantánea.
 */

'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User as FirebaseAuthUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '@/lib/firebase/config';
import type { User, Client, Notification, RoutePlan, PhoneContact } from '@/lib/types';
import { collection, doc, onSnapshot, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { getPhoneContacts, markNotificationAsRead as markAsReadFirestore, markAllNotificationsAsRead as markAllAsReadFirestore } from '@/lib/firebase/firestore';

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
  refetchData: (dataType: 'clients' | 'users' | 'phoneContacts') => Promise<void>;
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

  const refetchData = useCallback(async (dataType: 'clients' | 'users' | 'phoneContacts') => {
      if (dataType === 'phoneContacts') {
          const res = await getPhoneContacts();
          setPhoneContacts(res);
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
      
      if (!fbUser) {
        setUser(null);
        setClients([]);
        setUsers([]);
        setRoutes([]);
        setPhoneContacts([]);
        setNotifications([]);
        setLoading(false);
        setDataLoading(false);
        return;
      }

      // Obtener perfil inmediatamente para resolver el estado 'loading' rápido
      const userDocRef = doc(db, 'users', fbUser.uid);
      const unsubscribeUser = onSnapshot(userDocRef, 
        (docSnap) => {
          if (docSnap.exists()) {
            setUser({ id: fbUser.uid, ...docSnap.data() } as User);
            // RESOLVEMOS LOADING AQUÍ: La interfaz principal aparece apenas se identifica al usuario
            setLoading(false);
          } else {
            setLoading(false);
            signOut(auth);
          }
        },
        () => setLoading(false)
      );

      return () => unsubscribeUser();
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user || !firebaseUser) return;

    // Los datos operativos pesados se cargan en segundo plano
    setDataLoading(true);

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    });

    const routesQuery = query(collection(db, 'routes'), orderBy('createdAt', 'desc'));
    const unsubscribeRoutes = onSnapshot(routesQuery, (snapshot) => {
        setRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
        setDataLoading(false);
    }, () => setDataLoading(false));

    const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', firebaseUser.uid));
    const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
        const data = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : null,
        } as Notification))
        .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
        .slice(0, 15);
        setNotifications(data);
    });

    // Filtrado automático de clientes según rol y ejecutivo asignado
    const isSourcingAll = user.role === 'Administrador' || user.role === 'Supervisor' || user.role === 'Auditor';
    const clientsQuery = isSourcingAll 
        ? query(collection(db, 'clients')) 
        : query(collection(db, 'clients'), where('ejecutivo', '==', user.name.trim()));

    const unsubscribeClients = onSnapshot(clientsQuery, (snapshot) => {
        setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });

    getPhoneContacts().then(setPhoneContacts).catch(() => {});

    return () => {
        unsubscribeUsers();
        unsubscribeRoutes();
        unsubscribeNotifications();
        unsubscribeClients();
    };
  }, [user?.id, firebaseUser?.uid]);

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