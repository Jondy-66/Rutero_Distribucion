
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Route, LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleSignIn } from '@/lib/firebase/auth';
import { useAuth } from '@/hooks/use-auth';
import { redirect } from 'next/navigation';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { FloatingLabelPasswordInput } from '@/components/ui/floating-label-password-input';
import Image from 'next/image';

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
    <div className="w-full min-h-screen flex items-center justify-center bg-background p-4 lg:p-8">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:4rem_3rem] sm:bg-[size:6rem_4rem]">
        <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_800px_at_100%_200px,hsl(var(--primary)/0.1),transparent)]"></div>
      </div>
      
      <Card className="w-full max-w-4xl shadow-2xl overflow-hidden rounded-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="relative hidden lg:block">
                <Image
                    src="https://placehold.co/600x800.png"
                    data-ai-hint="logistics map"
                    alt="Mapa de rutas de fondo"
                    width={600}
                    height={800}
                    className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-primary/20 p-8 flex flex-col justify-end text-primary-foreground">
                    <h2 className="text-4xl font-bold font-headline">Optimiza tus Rutas</h2>
                    <p className="mt-2 text-lg">La herramienta definitiva para la gestión y planificación de tus rutas de venta y cobranza.</p>
                </div>
            </div>

            <div className="flex flex-col justify-center p-8 sm:p-12">
                <div className="text-center mb-8">
                    <div className="inline-block bg-primary text-primary-foreground p-3 rounded-full mx-auto">
                        <Route className="h-8 w-8" />
                    </div>
                    <CardTitle className="text-3xl font-bold font-headline mt-4">Bienvenido a Rutero</CardTitle>
                    <CardDescription>Ingresa tus credenciales para acceder</CardDescription>
                </div>
                
                <form onSubmit={onSignIn}>
                    <div className="space-y-6">
                    <FloatingLabelInput 
                        id="email" 
                        label="Correo Electrónico" 
                        type="email"
                        required 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        disabled={isLoading} 
                    />
                    <div className="space-y-2">
                        <FloatingLabelPasswordInput 
                            id="password"
                            label="Contraseña" 
                            required 
                            value={password} 
                            onChange={e => setPassword(e.target.value)} 
                            disabled={isLoading}
                        />
                        <div className="flex items-center pt-1">
                        <Link href="/forgot-password" className="ml-auto inline-block text-sm text-primary hover:underline">
                            ¿Olvidaste tu contraseña?
                        </Link>
                        </div>
                    </div>
                    <div className="space-y-2 pt-2">
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading && <LoaderCircle className="animate-spin" />}
                            Iniciar Sesión
                        </Button>
                    </div>
                    </div>
                </form>
                
                <div className="mt-6 text-center text-sm">
                    ¿No tienes una cuenta?{' '}
                    <a href="mailto:admin@rutero.com" className="underline">
                    Contactar al Administrador
                    </a>
                </div>
            </div>
        </div>
      </Card>
    </div>
  );
}
