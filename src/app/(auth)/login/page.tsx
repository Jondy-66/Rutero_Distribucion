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
import { handleSignIn, handleGoogleSignIn, handleSignUp } from '@/lib/firebase/auth';
import { addUser } from '@/lib/firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { redirect } from 'next/navigation';


export default function LoginPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await handleSignIn(email, password);
      toast({ title: "Inicio de sesión exitoso", description: "¡Bienvenido de vuelta!" });
      router.push('/dashboard');
    } catch (error: any) {
      console.error(error);
      let description = "Ocurrió un error al iniciar sesión.";
      if (error.code === 'auth/invalid-credential') {
        description = "Credenciales incorrectas. Por favor, verifica tu correo y contraseña.";
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

  const onGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await handleGoogleSignIn();
      toast({ title: "Inicio de sesión con Google exitoso", description: "¡Bienvenido!" });
      router.push('/dashboard');
    } catch (error: any) {
       console.error(error);
       toast({
        title: "Error con Google",
        description: error.message || "No se pudo iniciar sesión con Google.",
        variant: 'destructive'
      });
    } finally {
        setIsLoading(false);
    }
  }

  const handleSeedDatabase = async () => {
      const seedUsers = [
        { email: 'jdiaza@farmaenlace.com', password: 'j6FS&p^jM6!NmG', name: 'jdiaza', role: 'Administrador' },
        { email: 'wonate@farmaenlace.com', password: '12345678', name: 'wonate', role: 'Supervisor' },
        { email: 'jrueda@farmaenlace.com', password: '123456789', name: 'jrueda', role: 'Usuario' },
      ];
      setIsSeeding(true);
      toast({ title: "Iniciando creación de usuarios...", description: "Por favor espera." });
      try {
        for (const userData of seedUsers) {
          try {
            const userCredential = await handleSignUp(userData.email, userData.password);
            const uid = userCredential.user.uid;
            await addUser(uid, {
              name: userData.name,
              email: userData.email,
              role: userData.role as 'Administrador' | 'Supervisor' | 'Usuario',
              avatar: `https://placehold.co/100x100/011688/FFFFFF/png?text=${userData.name.charAt(0)}`
            });
          } catch (error: any) {
            if (error.code !== 'auth/email-already-in-use') {
              console.error(`Error creando usuario ${userData.email}:`, error);
              throw new Error(`Fallo al crear ${userData.email}.`);
            } else {
               console.log(`Usuario ${userData.email} ya existe. Saltando.`);
            }
          }
        }
        toast({ title: "Éxito", description: "Usuarios por defecto creados o ya existentes." });
      } catch (error: any) {
        console.error(error);
        toast({ title: "Error en la creación", description: error.message, variant: 'destructive' });
      } finally {
        setIsSeeding(false);
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
                <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading || isSeeding} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Contraseña</Label>
                  <Link href="#" className="ml-auto inline-block text-sm underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <PasswordInput id="password" required value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading || isSeeding} />
              </div>
              <div className="space-y-2 pt-2">
                  <Button type="submit" className="w-full" disabled={isLoading || isSeeding}>
                    {isLoading && <LoaderCircle className="animate-spin" />}
                    Iniciar Sesión
                  </Button>
                <Button variant="outline" className="w-full" onClick={onGoogleSignIn} type="button" disabled={isLoading || isSeeding}>
                   {(isLoading || isSeeding) && <LoaderCircle className="animate-spin" />}
                  Iniciar sesión con Google
                </Button>
                 <Button variant="secondary" className="w-full" onClick={handleSeedDatabase} type="button" disabled={isLoading || isSeeding}>
                   {isSeeding && <LoaderCircle className="animate-spin" />}
                   Crear Usuarios por Defecto
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
