'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User as FirebaseAuthUser, onAuthStateChanged } from 'firebase/auth';
import { app, db, auth } from '@/lib/firebase/config';
import type { User } from '@/lib/types';
import { doc, onSnapshot } from 'firebase/firestore';
import { Route } from 'lucide-react';

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

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        const userDocRef = doc(db, 'users', fbUser.uid);
        const unsubscribeFirestore = onSnapshot(userDocRef, 
          (userDoc) => {
            if (userDoc.exists()) {
              setUser({ id: fbUser.uid, ...userDoc.data() } as User);
            } else {
              // This is an inconsistent state. The user is authenticated with Firebase Auth,
              // but has no corresponding user document in Firestore.
              // This can happen if the document creation failed during sign-up.
              // We'll treat them as not properly logged in to prevent errors.
              console.error(`Inconsistent state: User document not found in Firestore for UID: ${fbUser.uid}`);
              setUser(null);
            }
            setLoading(false);
          },
          (error) => {
            console.error("Firestore user profile subscription error:", error);
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
  }, []);

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
