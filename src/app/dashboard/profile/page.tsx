'use client';
import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PasswordInput } from '@/components/password-input';
import { useAuth } from '@/hooks/use-auth';
import { notFound, useRouter } from 'next/navigation';
import { updateUser } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import { LoaderCircle } from 'lucide-react';

export default function ProfilePage() {
  const { user, firebaseUser } = useAuth();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(user);
  const [isSaving, setIsSaving] = useState(false);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSaving(true);
    try {
        await updateUser(currentUser.id, {
            name: currentUser.name
        });
        toast({ title: "Éxito", description: "Perfil actualizado." });
    } catch (error: any) {
        console.error(error);
        toast({ title: "Error", description: "No se pudo actualizar el perfil.", variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleFieldChange = (field: keyof User, value: string) => {
    if(currentUser) {
        setCurrentUser({ ...currentUser, [field]: value });
    }
  }

  if (!currentUser || !firebaseUser) {
    return notFound();
  }

  return (
    <>
      <PageHeader
        title="Perfil"
        description="Gestiona tu información personal y la configuración de tu cuenta."
      />
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Tu Avatar</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Avatar className="h-32 w-32">
              <AvatarImage src={currentUser.avatar} data-ai-hint="user avatar" />
              <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <Button variant="outline">Cambiar Avatar</Button>
          </CardContent>
        </Card>

        <form onSubmit={handleUpdateProfile} className="md:col-span-2">
            <Card>
            <CardHeader>
                <CardTitle>Información Personal</CardTitle>
                <CardDescription>
                Actualiza tus datos personales aquí. Haz clic en guardar cuando hayas terminado.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                <Label htmlFor="name">Nombre Completo</Label>
                <Input id="name" value={currentUser.name} onChange={(e) => handleFieldChange('name', e.target.value)} disabled={isSaving} />
                </div>
                <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input id="email" type="email" value={currentUser.email} disabled />
                </div>
                <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Input id="role" value={currentUser.role} disabled />
                </div>
            </CardContent>
            <CardFooter>
                <Button type="submit" disabled={isSaving}>
                    {isSaving && <LoaderCircle className="animate-spin" />}
                    Guardar Cambios
                </Button>
            </CardFooter>
            </Card>
        </form>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Contraseña</CardTitle>
            <CardDescription>
              Cambia tu contraseña aquí. Después de guardar, se cerrará tu sesión. (Funcionalidad no implementada)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Contraseña Actual</Label>
              <PasswordInput id="current-password" disabled/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nueva Contraseña</Label>
              <PasswordInput id="new-password" disabled/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nueva Contraseña</Label>
              <PasswordInput id="confirm-password" disabled/>
            </div>
          </CardContent>
          <CardFooter>
            <Button disabled>Actualizar Contraseña</Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
