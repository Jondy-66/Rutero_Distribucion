
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Route, LoaderCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handlePasswordReset } from '@/lib/firebase/auth';

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const onResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Verificar existencia vía API segura (evita error de permisos Firestore)
      const res = await fetch(`/api/auth/security?email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (data.exists) {
        await handlePasswordReset(email);
        setIsSent(true);
        toast({ 
          title: "Correo enviado", 
          description: "Revisa tu bandeja de entrada para restablecer tu contraseña."
        });
      } else {
        toast({
          title: "Error",
          description: "No se encontró ningún usuario con ese correo electrónico.",
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Error",
        description: "Ocurrió un error al procesar tu solicitud.",
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

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
          <CardTitle className="text-3xl font-bold font-headline">Recuperar Contraseña</CardTitle>
          <CardDescription>
            {isSent 
              ? "Revisa tu correo para continuar." 
              : "Ingresa tu correo para enviarte un enlace de restablecimiento."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isSent ? (
            <form onSubmit={onResetPassword}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={e => setEmail(e.target.value)} disabled={isLoading} />
                </div>
                <div className="space-y-2 pt-2">
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <LoaderCircle className="animate-spin mr-2" />}
                      Enviar correo de restablecimiento
                    </Button>
                </div>
              </div>
            </form>
          ) : (
            <div className="text-center text-green-600 font-medium">
              <p>¡Correo enviado exitosamente!</p>
            </div>
          )}
          <div className="mt-4 text-center text-sm">
            <Link href="/login" className="underline flex items-center justify-center gap-1">
                <ArrowLeft className="h-4 w-4" />
                Volver a Iniciar Sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
