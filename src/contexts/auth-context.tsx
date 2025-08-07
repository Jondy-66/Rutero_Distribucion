/**
 * @fileoverview Este archivo define el `AuthContext` y el `AuthProvider`.
 * Es el núcleo de la gestión de estado de autenticación y datos globales en la aplicación.
 * Proporciona información sobre el usuario autenticado, así como datos de clientes y usuarios
 * a cualquier componente hijo que lo consuma.
 */

'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User as FirebaseAuthUser, onAuthStateChanged } from 'firebase/auth';
import { app, db, auth } from '@/lib/firebase/config';
import type { User, Client } from '@/lib/types';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Route } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getClients, getUsers } from '@/lib/firebase/firestore';

/**
 * Define la forma de los datos que se proporcionarán a través del AuthContext.
 */
interface AuthContextType {
  user: User | null; // Datos del perfil del usuario desde Firestore.
  firebaseUser: FirebaseAuthUser | null; // Objeto de usuario de Firebase Auth.
  loading: boolean; // Indica si se está cargando el estado inicial de autenticación o los datos.
  clients: Client[]; // Lista de todos los clientes.
  users: User[]; // Lista de todos los usuarios.
  refetchData: (dataType: 'clients' | 'users') => Promise<void>; // Función para recargar datos específicos.
}

/**
 * Creación del contexto de autenticación.
 */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Proveedor de contexto que envuelve la aplicación y gestiona el estado de autenticación.
 * @param {object} props - Propiedades del componente.
 * @param {ReactNode} props.children - Los componentes hijos que tendrán acceso al contexto.
 * @returns {React.ReactElement} El componente proveedor.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Estado para el objeto de usuario de Firebase Auth.
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  // Estado para los datos del perfil de usuario de Firestore.
  const [user, setUser] = useState<User | null>(null);
  // Estado para la lista de clientes.
  const [clients, setClients] = useState<Client[]>([]);
  // Estado para la lista de usuarios.
  const [users, setUsers] = useState<User[]>([]);
  // Estado de carga general para la autenticación inicial.
  const [loading, setLoading] = useState(true);
  // Estado de carga específico para la carga de datos (clientes, usuarios).
  const [dataLoading, setDataLoading] = useState(false);
  const { toast } = useToast();

  /**
   * Carga los datos iniciales de la aplicación (usuarios) cuando un usuario inicia sesión.
   */
  const fetchInitialData = useCallback(async () => {
    setDataLoading(true);
    try {
        const usersData = await getUsers();
        setUsers(usersData);
    } catch(error) {
        console.error("Failed to fetch initial data:", error);
        toast({ title: "Error", description: "No se pudieron cargar los datos iniciales.", variant: "destructive" });
    } finally {
        setDataLoading(false);
    }
  }, [toast]);
  
  /**
   * Función para forzar la recarga de datos específicos (clientes o usuarios).
   * @param {'clients' | 'users'} dataType - El tipo de datos a recargar.
   */
  const refetchData = useCallback(async (dataType: 'clients' | 'users') => {
      try {
          if (dataType === 'clients') {
              const clientsData = await getClients();
              setClients(clientsData);
          }
          if (dataType === 'users') {
              const usersData = await getUsers();
              setUsers(usersData);
          }
      } catch (error) {
          console.error(`Failed to refetch ${dataType}:`, error);
          toast({ title: "Error", description: `No se pudieron actualizar los ${dataType}.`, variant: "destructive" });
      }
  }, [toast]);

  /**
   * Efecto principal que se suscribe a los cambios de estado de autenticación de Firebase.
   */
  useEffect(() => {
    // onAuthStateChanged devuelve una función para darse de baja (unsubscribe).
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      setLoading(true);
      setFirebaseUser(fbUser);

      if (fbUser) {
        // Si hay un usuario autenticado, nos suscribimos a su documento en Firestore.
        const userDocRef = doc(db, 'users', fbUser.uid);
        const unsubscribeUser = onSnapshot(userDocRef, 
          async (userDoc) => {
            if (userDoc.exists()) {
              const userData = { id: fbUser.uid, ...userDoc.data() } as User;
              setUser(userData);
              // Cargar datos iniciales una vez que el perfil del usuario está confirmado.
              await fetchInitialData();
            } else {
              // Auto-reparación: si el documento del usuario no existe, se crea.
              console.log(`User document not found for UID ${fbUser.uid}, creating one...`);
              try {
                const newUser: Omit<User, 'id'> = {
                    name: fbUser.displayName || 'Usuario',
                    email: fbUser.email!,
                    role: 'Usuario',
                    avatar: fbUser.photoURL || `https://placehold.co/100x100/011688/FFFFFF/png?text=${(fbUser.displayName || 'U').charAt(0)}`
                };
                await setDoc(userDocRef, newUser);
                setUser({ id: fbUser.uid, ...newUser });
              } catch (error) {
                console.error("Failed to create self-healing user document:", error);
                toast({ title: "Error de Cuenta", description: "No se pudo crear tu perfil de usuario. Contacta al administrador.", variant: "destructive"});
                setUser(null);
              }
            }
            setLoading(false);
          },
          (error) => {
            console.error("Firestore user profile subscription error:", error);
            if ((error as any).code === 'permission-denied') {
                toast({ title: "Error de Permisos", description: "No se pudo verificar tu perfil. Revisa las reglas de seguridad de Firestore.", variant: "destructive" });
            }
            setUser(null);
            setLoading(false);
          }
        );

        // Suscripción en tiempo real a la colección de clientes.
        const clientsCollectionRef = collection(db, 'clients');
        const unsubscribeClients = onSnapshot(clientsCollectionRef, (snapshot) => {
            const clientsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Client[];
            setClients(clientsData);
        }, (error) => {
            console.error("Error fetching clients in real-time:", error);
            toast({ title: "Error", description: "No se pudieron cargar los clientes en tiempo real.", variant: "destructive" });
        });

        // Función de limpieza: darse de baja de las suscripciones cuando el componente se desmonta.
        return () => {
            unsubscribeUser();
            unsubscribeClients();
        };

      } else {
        // Si no hay usuario, limpiar todos los estados relacionados.
        setUser(null);
        setFirebaseUser(null);
        setClients([]);
        setUsers([]);
        setLoading(false);
      }
    });

    // Limpieza final de la suscripción de autenticación.
    return () => unsubscribeAuth();
  }, [toast, fetchInitialData]);

  // Muestra una pantalla de carga global mientras el estado de autenticación inicial se resuelve.
  if (loading) {
      return (
        <div className="w-full min-h-screen flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <div className="inline-block bg-primary text-primary-foreground p-4 rounded-full">
                    <Route className="h-10 w-10 animate-pulse" />
                </div>
                <p className="text-muted-foreground">Cargando Rutero...</p>
            </div>
      </div>
      )
  }

  // Provee el estado y las funciones a los componentes hijos.
  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading: dataLoading, clients, users, refetchData }}>
      {children}
    </AuthContext.Provider>
  );
};
