/**
 * @fileoverview Gestión de estado de autenticación y datos globales con sincronización optimizada.
 * Se separa la resolución de identidad de la carga de datos masivos para acelerar el inicio.
 */

'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User as FirebaseAuthUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '@/lib/firebase/config';
import type { User, Client, Notification, RoutePlan, PhoneContact } from '@/lib/types';
import { collection, doc, onSnapshot, query, where, Timestamp, orderBy } from 'firebase/firestore';
import { getPhoneContacts, markNotificationAsRead as markAsReadFirestore, markAllNotificationsAsRead as markAllAsReadFirestore } from '@/lib/firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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
  
  // 'loading' solo bloquea hasta resolver la IDENTIDAD básica
  const [loading, setLoading] = useState(true);
  // 'dataLoading' maneja las colecciones pesadas en segundo plano
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

      // 1. Obtener perfil de usuario inmediatamente (PRIORIDAD ALTA)
      const userDocRef = doc(db, 'users', fbUser.uid);
      const unsubscribeUser = onSnapshot(userDocRef, 
        (docSnap) => {
          if (docSnap.exists()) {
            setUser({ id: fbUser.uid, ...docSnap.data() } as User);
            setLoading(false); // Resolvemos la pantalla de carga apenas tenemos el perfil
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

  // 2. Carga de datos operativos en segundo plano (Una vez que el usuario está listo)
  useEffect(() => {
    if (!user || !firebaseUser) return;

    setDataLoading(true);

    // Usuarios (Auditoría)
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    });

    // Rutas
    const routesQuery = query(collection(db, 'routes'), orderBy('createdAt', 'desc'));
    const unsubscribeRoutes = onSnapshot(routesQuery, (snapshot) => {
        setRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
        setDataLoading(false);
    }, () => setDataLoading(false));

    // Notificaciones
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

    // Clientes basado en Rol (Catálogo)
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
