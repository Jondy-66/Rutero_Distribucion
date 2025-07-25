
'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { User as FirebaseAuthUser, onAuthStateChanged } from 'firebase/auth';
import { app, db, auth } from '@/lib/firebase/config';
import type { User, Client } from '@/lib/types';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Route } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getClients, getUsers } from '@/lib/firebase/firestore';


interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseAuthUser | null;
  loading: boolean;
  clients: Client[];
  users: User[];
  refetchData: (dataType: 'clients' | 'users') => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const { toast } = useToast();

  const fetchInitialData = useCallback(async () => {
    setDataLoading(true);
    try {
        const [clientsData, usersData] = await Promise.all([
            getClients(),
            getUsers()
        ]);
        setClients(clientsData);
        setUsers(usersData);
    } catch(error) {
        console.error("Failed to fetch initial data:", error);
        toast({ title: "Error", description: "No se pudieron cargar los datos iniciales.", variant: "destructive" });
    } finally {
        setDataLoading(false);
    }
  }, [toast]);
  
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

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      setLoading(true);
      setFirebaseUser(fbUser);
      if (fbUser) {
        const userDocRef = doc(db, 'users', fbUser.uid);
        const unsubscribeFirestore = onSnapshot(userDocRef, 
          async (userDoc) => {
            if (userDoc.exists()) {
              const userData = { id: fbUser.uid, ...userDoc.data() } as User;
              setUser(userData);
              await fetchInitialData();
            } else {
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
                toast({
                    title: "Error de Cuenta",
                    description: "No se pudo crear tu perfil de usuario. Contacta al administrador.",
                    variant: "destructive"
                });
                setUser(null);
              }
            }
            setLoading(false);
          },
          (error) => {
            console.error("Firestore user profile subscription error:", error);
            if ((error as any).code === 'permission-denied') {
                toast({
                    title: "Error de Permisos",
                    description: "No se pudo verificar tu perfil. Revisa las reglas de seguridad de Firestore.",
                    variant: "destructive"
                });
            }
            setUser(null);
            setLoading(false);
          }
        );
        return () => unsubscribeFirestore();
      } else {
        setUser(null);
        setFirebaseUser(null);
        setClients([]);
        setUsers([]);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [toast, fetchInitialData]);

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

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading: dataLoading, clients, users, refetchData }}>
      {children}
    </AuthContext.Provider>
  );
};
