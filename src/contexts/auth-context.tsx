'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { User as FirebaseAuthUser, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth, db } from '@/lib/firebase/config';
import type { User } from '@/lib/types';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
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
    const auth = getFirebaseAuth();
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        // Listen for real-time updates to the user's profile
        const userDocRef = doc(db, 'users', fbUser.uid);
        const unsubscribeFirestore = onSnapshot(userDocRef, (userDoc) => {
          if (userDoc.exists()) {
            setUser({ id: fbUser.uid, ...userDoc.data() } as User);
          } else {
            // This might happen if the user signed up but the Firestore doc creation failed or is pending
            setUser({
              id: fbUser.uid,
              name: fbUser.displayName || 'Usuario',
              email: fbUser.email || '',
              role: 'Usuario',
              avatar: fbUser.photoURL || ''
            });
          }
          setLoading(false);
        });
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
