/**
 * @fileoverview Gestión de estado de autenticación y datos globales optimizada.
 */

'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { User as FirebaseAuthUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { db, auth } from '@/lib/firebase/config';
import type { User, Client, Notification, RoutePlan, PhoneContact } from '@/lib/types';
import { collection, doc, onSnapshot, query, where, Timestamp, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  const notificationToastShown = useRef(false);
  const isDataInitialized = useRef(false);

  const fetchInitialData = useCallback(async () => {
    // Si ya estamos cargando o ya inicializamos, no repetir
    if (dataLoading || isDataInitialized.current) return;
    
    setDataLoading(true);
    try {
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
  }, [dataLoading]);
  
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
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      // Iniciar estado de carga al detectar cambio de auth
      setLoading(true);
      notificationToastShown.current = false;
      isDataInitialized.current = false;
      setFirebaseUser(fbUser);

      if (fbUser) {
        const userDocRef = doc(db, 'users', fbUser.uid);
        const unsubscribeUser = onSnapshot(userDocRef, 
          async (userDoc) => {
            try {
                if (userDoc.exists()) {
                  const userData = { id: fbUser.uid, ...userDoc.data() } as User;
                  setUser(userData);
                  // Disparar carga de datos pero NO esperar a que termine para quitar el splash
                  fetchInitialData();
                  setLoading(false);
                } else {
                  // Recuperación manual si onSnapshot falla inicialmente
                  const secondCheck = await getDoc(userDocRef);
                  if (secondCheck.exists()) {
                    const userData = { id: fbUser.uid, ...secondCheck.data() } as User;
                    setUser(userData);
                    fetchInitialData();
                    setLoading(false);
                  } else {
                    console.error(`Perfil no encontrado para UID: ${fbUser.uid}`);
                    toast({
                      title: "Error de Perfil",
                      description: "Tu perfil de usuario no se encontró. Por favor, contacta al administrador.",
                      variant: "destructive",
                    });
                    await signOut(auth);
                    setUser(null);
                    setLoading(false);
                  }
                }
            } catch (err) {
                console.error("Error en inicialización de perfil:", err);
                setLoading(false);
            }
          },
          (error) => {
            console.error("Firestore user onSnapshot error:", error);
            setLoading(false);
          }
        );

        const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', fbUser.uid));
        const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
            const notificationsData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt instanceof Timestamp ? doc.data().createdAt.toDate() : null,
            } as Notification));
            
            notificationsData.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
            setNotifications(notificationsData);

             const unread = notificationsData.filter(n => !n.read).length;
             if (unread > 0 && !notificationToastShown.current) {
                toast({ title: "Notificaciones", description: `Tienes ${unread} sin leer.` });
                notificationToastShown.current = true;
             }
        });

        return () => {
            unsubscribeUser();
            unsubscribeNotifications();
        };
      } else {
        setUser(null);
        setFirebaseUser(null);
        setClients([]);
        setUsers([]);
        setRoutes([]);
        setPhoneContacts([]);
        setNotifications([]);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [toast, fetchInitialData]);

  return (
    <AuthContext.Provider value={{ 
        user, 
        firebaseUser, 
        loading, // Ahora solo depende del perfil crítico
        dataLoading, // Para que componentes individuales muestren skeletons
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
