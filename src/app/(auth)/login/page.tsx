'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Route, LoaderCircle } from 'lucide-react';
import { PasswordInput } from '@/components/password-input';
import { useToast } from '@/hooks/use-toast';
import { handleSignIn } from '@/lib/firebase/auth';
import { useAuth } from '@/hooks/use-auth';
import { redirect } from 'next/navigation';


export default function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await handleSignIn(email, password);
      toast({ title: "Inicio de sesión exitoso", description: "Verificando perfil..." });
      // The redirect is now handled by the AuthContext and page effects
    } catch (error: any) {
      console.error(error);
      let description = "Ocurrió un error al iniciar sesión.";
      if (error.code === 'auth/invalid-credential') {
        description = "Credenciales incorrectas. Por favor, verifica tus datos.";
      } else {
        description = error.message || description;
      }
      toast({
        title: "Error de inicio de sesión",
        description: description,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  if(authLoading) {
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

  if (user) {
    return redirect('/dashboard');
  }

  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:4rem_3rem] sm:bg-[size:6rem_4rem]">
        <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_800px_at_100%_200px,hsl(var(--primary)/0.1),transparent)]"></div>
      </div>
      
      <Card className="mx-auto max-w-sm w-full shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="inline-block bg-primary text-primary-foreground p-3 rounded-full mx-auto">
            <Route className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl font-bold font-headline">Rutero</CardTitle>
          <CardDescription>Ingresa tus credenciales para acceder a tus rutas</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSignIn}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link href="#" className="ml-auto inline-block text-sm underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <PasswordInput id="password" required value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} />
              </div>
              <div className="space-y-2 pt-2">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <LoaderCircle className="animate-spin" />}
                    Iniciar Sesión
                  </Button>
              </div>
            </div>
          </form>
          <div className="mt-4 text-center text-sm">
            ¿No tienes una cuenta?{' '}
            <Link href="#" className="underline">
              Contactar al Administrador
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
