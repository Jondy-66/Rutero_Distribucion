/**
 * @fileoverview Gestión de estado de autenticación y datos globales con sincronización total en tiempo real.
 * Optimizado para una carga inicial ultra rápida.
 */

'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
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
  
  // 'loading' solo bloquea hasta resolver la IDENTIDAD
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
      
      if (fbUser) {
        const userDocRef = doc(db, 'users', fbUser.uid);
        
        // Listener del perfil del usuario actual (Prioridad Alta)
        const unsubscribeUser = onSnapshot(userDocRef, 
          (docSnap) => {
            if (docSnap.exists()) {
              const userData = { id: fbUser.uid, ...docSnap.data() } as User;
              setUser(userData);
              // Una vez tenemos el perfil, permitimos entrar al app inmediatamente
              setLoading(false);
            } else {
              setLoading(false);
              signOut(auth);
            }
          },
          async (serverError) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: userDocRef.path,
              operation: 'get'
            }));
            setLoading(false);
          }
        );

        // --- CARGA DE DATOS EN SEGUNDO PLANO (No bloquean el splash screen) ---
        setDataLoading(true);

        // Usuarios
        const unsubscribeUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
            setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
        });

        // Rutas
        const unsubscribeRoutes = onSnapshot(query(collection(db, 'routes'), orderBy('createdAt', 'desc')), (snapshot) => {
            setRoutes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
            setDataLoading(false);
        }, () => setDataLoading(false));

        // Notificaciones
        const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', fbUser.uid));
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

        getPhoneContacts().then(setPhoneContacts).catch(() => {});

        return () => {
            unsubscribeUser();
            unsubscribeUsers();
            unsubscribeRoutes();
            unsubscribeNotifications();
        };
      } else {
        setUser(null);
        setClients([]);
        setUsers([]);
        setRoutes([]);
        setPhoneContacts([]);
        setNotifications([]);
        setLoading(false);
        setDataLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Sync de clientes basado en rol
  useEffect(() => {
    if (!user) return;
    const isSourcingAll = user.role === 'Administrador' || user.role === 'Supervisor' || user.role === 'Auditor';
    const clientsQuery = isSourcingAll 
        ? query(collection(db, 'clients')) 
        : query(collection(db, 'clients'), where('ejecutivo', '==', user.name.trim()));

    const unsubscribeClients = onSnapshot(clientsQuery, (snapshot) => {
        setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    });
    return () => unsubscribeClients();
  }, [user?.role, user?.name]);

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
