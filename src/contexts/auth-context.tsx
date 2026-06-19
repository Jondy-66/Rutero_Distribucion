/**
 * @fileoverview Gestión de estado de autenticación y datos globales con sincronización total en tiempo real para todos los roles.
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
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  
  const isDataInitialized = useRef<string | null>(null);

  /**
   * Refetch manual para datos que no están en snapshot (si aplica).
   */
  const refetchData = useCallback(async (dataType: 'clients' | 'users' | 'phoneContacts') => {
      // Nota: Con snapshots en tiempo real, refetch suele ser innecesario para clients/users,
      // pero se mantiene para compatibilidad con componentes que lo invocan.
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
        
        // Listener del perfil del usuario actual
        const unsubscribeUser = onSnapshot(userDocRef, 
          (docSnap) => {
            if (docSnap.exists()) {
              const userData = { id: fbUser.uid, ...docSnap.data() } as User;
              setUser(userData);
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
          }
        );

        // --- SINCRONIZACIÓN DE USUARIOS EN TIEMPO REAL (COLECCIÓN) ---
        const usersQuery = query(collection(db, 'users'));
        const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as User));
            setUsers(usersData);
        }, (error) => {
            console.error("Error real-time users:", error);
        });

        // --- SINCRONIZACIÓN DE RUTAS EN TIEMPO REAL ---
        const routesQuery = query(collection(db, 'routes')); 
        const unsubscribeRoutes = onSnapshot(routesQuery, (snapshot) => {
            const routesData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as any)) as RoutePlan[];
            
            setRoutes(routesData.sort((a, b) => {
                const getMillis = (ts: any) => {
                    if (ts instanceof Timestamp) return ts.toMillis();
                    if (ts?.seconds) return ts.seconds * 1000 + (ts.nanoseconds / 1000000 || 0);
                    if (ts instanceof Date) return ts.getTime();
                    return 0;
                };
                return getMillis(b.createdAt) - getMillis(a.createdAt);
            }));
        }, (error) => {
            console.error("Error real-time routes:", error);
        });

        // --- SINCRONIZACIÓN DE NOTIFICACIONES EN TIEMPO REAL ---
        const notificationsQuery = query(
            collection(db, 'notifications'), 
            where('userId', '==', fbUser.uid)
        );
        const unsubscribeNotifications = onSnapshot(notificationsQuery, 
          (snapshot) => {
            const notificationsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : null,
            } as Notification))
            .sort((a, b) => {
                const dateA = a.createdAt?.getTime() || 0;
                const dateB = b.createdAt?.getTime() || 0;
                return dateB - dateA; 
            })
            .slice(0, 15);
            
            setNotifications(notificationsData);
          },
          (error) => {
            console.error("Error real-time notifications:", error);
          }
        );

        // Carga inicial de PhoneContacts (estático por ahora)
        getPhoneContacts().then(setPhoneContacts).catch(console.error);

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
        isDataInitialized.current = null;
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Effect para manejar la sincronización de Clientes basada en el rol del usuario cargado
  useEffect(() => {
    if (!user) return;

    const isSourcingAll = user.role === 'Administrador' || user.role === 'Supervisor' || user.role === 'Auditor';
    const clientsQuery = isSourcingAll 
        ? query(collection(db, 'clients')) 
        : query(collection(db, 'clients'), where('ejecutivo', '==', user.name.trim()));

    const unsubscribeClients = onSnapshot(clientsQuery, (snapshot) => {
        const clientsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Client));
        setClients(clientsData);
    }, (error) => {
        console.error("Error real-time clients:", error);
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
