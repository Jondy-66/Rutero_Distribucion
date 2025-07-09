'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User as FirebaseAuthUser, onAuthStateChanged } from 'firebase/auth';
import { app, db, auth } from '@/lib/firebase/config';
import type { User } from '@/lib/types';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Route } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseAuthUser | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const userDocRef = doc(db, 'users', fbUser.uid);
        const unsubscribeFirestore = onSnapshot(userDocRef, 
          async (userDoc) => {
            if (userDoc.exists()) {
              setUser({ id: fbUser.uid, ...userDoc.data() } as User);
              setLoading(false);
            } else {
              // This is a self-healing mechanism.
              // If user exists in Auth but not Firestore, create the Firestore doc.
              // This is common with social logins where the profile creation might fail.
              console.log(`User document not found for UID ${fbUser.uid}, creating one...`);
              try {
                const newUser: Omit<User, 'id'> = {
                    name: fbUser.displayName || 'Usuario',
                    email: fbUser.email!,
                    role: 'Usuario', // Default role for any new sign-up
                    avatar: fbUser.photoURL || `https://placehold.co/100x100/011688/FFFFFF/png?text=${(fbUser.displayName || 'U').charAt(0)}`
                };
                await setDoc(userDocRef, newUser);
                // onSnapshot will fire again with the new data, but we set it here to avoid flicker.
                setUser({ id: fbUser.uid, ...newUser });
              } catch (error) {
                console.error("Failed to create self-healing user document:", error);
                toast({
                    title: "Error de Cuenta",
                    description: "No se pudo crear tu perfil de usuario. Contacta al administrador.",
                    variant: "destructive"
                });
                setUser(null);
              } finally {
                setLoading(false);
              }
            }
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
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [toast]);

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
    <AuthContext.Provider value={{ user, firebaseUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
