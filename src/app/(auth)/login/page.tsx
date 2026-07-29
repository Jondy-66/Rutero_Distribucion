'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Route, LoaderCircle, WifiOff, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleSignIn } from '@/lib/firebase/auth';
import { useAuth } from '@/hooks/use-auth';
import { redirect } from 'next/navigation';
import { FloatingLabelInput } from '@/components/ui/floating-label-input';
import { FloatingLabelPasswordInput } from '@/components/ui/floating-label-password-input';
import Image from 'next/image';

export default function LoginPage() {
  const { user, loading: authLoading, refetchData } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      timer = setTimeout(() => {
        setIsSlowConnection(true);
      }, 6000);
    } else {
      setIsSlowConnection(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIsSlowConnection(false);

    // Normalizar email para evitar errores de coincidencia en base de datos
    const cleanEmail = email.trim().toLowerCase();

    try {
        // 1. Verificar estado mediante API segura antes de cualquier intento
        const checkRes = await fetch(`/api/auth/security?email=${encodeURIComponent(cleanEmail)}`);
        const userSecurity = await checkRes.json();

        if (userSecurity.exists && userSecurity.status === 'inactive') {
            toast({
                title: "ACCESO DENEGADO",
                description: "TU CUENTA HA SIDO BLOQUEADA. Por favor, contacta al Administrador del sistema para su desbloqueo.",
                variant: "destructive",
            });
            setIsLoading(false);
            return;
        }

        // 2. Intentar autenticación en Firebase
        await handleSignIn(cleanEmail, password);

        // 3. Si tiene éxito, resetear intentos fallidos vía API
        if (userSecurity.exists && userSecurity.failedLoginAttempts > 0) {
            await fetch('/api/auth/security', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: cleanEmail, action: 'reset' })
            });
            await refetchData('users');
        }

        toast({ title: "Inicio de sesión exitoso", description: "Verificando perfil..." });

    } catch (error: any) {
        console.error("Login error code:", error.code);
        let description = "Ocurrió un error al iniciar sesión.";
        
        // Cualquier error de auth (excepto red) debe contar como intento fallido
        const isAuthError = error.code && error.code.startsWith('auth/');
        const isNetworkError = error.code === 'auth/network-request-failed';

        if (isNetworkError) {
            description = "Error de conexión. Por favor, verifica tu internet.";
        } else if (isAuthError) {
            // 4. Registrar fallo vía API segura para disparar el bloqueo de 5 intentos
            try {
                const failRes = await fetch('/api/auth/security', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: cleanEmail, action: 'fail' })
                });
                
                if (failRes.ok) {
                    const failData = await failRes.json();
                    if (failData.blocked) {
                        description = "CUENTA BLOQUEADA DEFINITIVAMENTE. Has excedido los 5 intentos permitidos. CONTACTA AL ADMINISTRADOR.";
                    } else if (failData.attempts) {
                        const remaining = 5 - failData.attempts;
                        description = `Credenciales incorrectas. Intento ${failData.attempts} de 5. Tras 5 fallos la cuenta será BLOQUEADA PERMANENTEMENTE.`;
                        
                        if (error.code === 'auth/too-many-requests') {
                            description = "Demasiados intentos rápidos detectados. Google ha bloqueado temporalmente el acceso, y esto ha sido registrado como un fallo en tu cuenta.";
                        }
                    }
                }
            } catch (apiErr) {
                console.error("Error registrando fallo en DB:", apiErr);
            }
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
                <Image 
                    src="https://i.ibb.co/JjfktNsS/Routify.png"
                    alt="Logo Routify"
                    width={180}
                    height={60}
                    className="h-auto w-auto animate-pulse"
                />
                <p className="text-primary font-bold uppercase text-[10px] tracking-[0.2em] animate-pulse">Cargando Routify...</p>
            </div>
      </div>
    )
  }

  if (user) {
    return redirect('/dashboard');
  }

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center bg-background p-4 lg:p-8">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white bg-[linear-gradient(to_right,#f0f0f0_1px,transparent_1px),linear-gradient(to_bottom,#f0f0f0_1px,transparent_1px)] bg-[size:4rem_3rem] sm:bg-[size:6rem_4rem]">
        <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_800px_at_100%_200px,hsl(var(--primary)/0.1),transparent)]"></div>
      </div>
      
      <main className="flex-grow flex items-center justify-center w-full">
        <Card className="w-full max-w-4xl shadow-2xl overflow-hidden rounded-2xl border-none">
            <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="relative hidden lg:block">
                    <Image
                        src="https://i.ibb.co/S4W628Xg/rut-img2.png"
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

                <div className="flex flex-col justify-center p-6 sm:p-8">
                    <div className="text-center mb-4 flex flex-col items-center">
                        <Image 
                            src="https://i.ibb.co/JjfktNsS/Routify.png"
                            alt="Logo Routify"
                            width={220}
                            height={80}
                            className="h-auto w-auto mb-1"
                        />
                        <h1 className="text-sm font-black tracking-[0.2em] text-primary uppercase">Rutero | Distribución</h1>
                        <CardDescription className="mt-2">Ingresa tus credenciales para acceder</CardDescription>
                    </div>
                    
                    <form onSubmit={onSignIn}>
                        <div className="space-y-4">
                        <FloatingLabelInput 
                            id="email" 
                            label="Correo Electrónico" 
                            type="email"
                            required 
                            value={email} 
                            onChange={e => setEmail(e.target.value)} 
                            disabled={isLoading} 
                        />
                        <div className="space-y-1">
                            <FloatingLabelPasswordInput 
                                id="password"
                                label="Contraseña" 
                                required 
                                value={password} 
                                onChange={e => setPassword(e.target.value)} 
                                disabled={isLoading}
                            />
                        </div>
                        <div className="space-y-2 pt-1">
                            <Button type="submit" className="w-full h-11" disabled={isLoading}>
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <LoaderCircle className="animate-spin h-5 w-5" />
                                        <span>Iniciando...</span>
                                    </div>
                                ) : (
                                    "Iniciar Sesión"
                                )}
                            </Button>
                            {isSlowConnection && (
                                <p className="text-[10px] text-orange-600 font-bold flex items-center justify-center gap-1 mt-2 animate-pulse uppercase">
                                    <WifiOff className="h-3 w-3" />
                                    Conexión lenta detectada...
                                </p>
                            )}
                        </div>
                        </div>
                    </form>
                    
                    <div className="mt-6 text-center text-xs">
                        ¿No tienes una cuenta?{' '}
                        <a href="mailto:jdiaza@farmaenlace.com" className="underline font-black text-primary uppercase">
                        Contactar al Administrador
                        </a>
                    </div>
                </div>
            </div>
        </Card>
      </main>
      <footer className="text-center text-[10px] font-bold text-muted-foreground mt-6 uppercase tracking-widest">
        © 2026 Farmaenlace. Todos los derechos reservados.
      </footer>
    </div>
  );
}