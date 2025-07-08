'use client';
import { useAuth } from '@/hooks/use-auth';
import { redirect } from 'next/navigation';
import { Route } from 'lucide-react';


export default function Home() {
  const { user, loading } = useAuth();

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
    );
  }

  if (user) {
    return redirect('/dashboard');
  } 
  
  return redirect('/login');
}
