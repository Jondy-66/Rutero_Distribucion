'use client';
import { useEffect, useState } from 'react';
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
import { getUser, updateUser } from '@/lib/firebase/firestore';
import type { User } from '@/lib/types';
import { notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PasswordInput } from '@/components/password-input';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function UserProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (params.id) {
      const fetchUser = async () => {
        try {
          const userData = await getUser(params.id);
          if (!userData) {
            notFound();
          }
          setUser(userData);
        } catch (error) {
          console.error("Failed to fetch user:", error);
          notFound();
        } finally {
          setLoading(false);
        }
      };
      fetchUser();
    }
  }, [params.id]);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      await updateUser(user.id, {
        name: user.name,
        email: user.email,
        role: user.role,
      });
      toast({ title: "Éxito", description: "Usuario actualizado correctamente." });
      router.push('/dashboard/users');
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message || "No se pudo actualizar el usuario.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleFieldChange = (field: keyof User, value: string) => {
    if(user) {
        setUser({ ...user, [field]: value });
    }
  }

  if (loading) {
    return (
        <>
        <PageHeader title="Perfil de Usuario" description="Cargando...">
            <Skeleton className="h-10 w-36" />
        </PageHeader>
        <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1"><CardContent className="pt-6"><Skeleton className="h-32 w-32 rounded-full mx-auto" /></CardContent></Card>
            <Card className="md:col-span-2"><CardContent className="pt-6 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>
        </div>
        </>
    );
  }

  if (!user) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Perfil de Usuario"
        description="Gestiona la información del usuario y la configuración de su cuenta."
      >
        <Link href="/dashboard/users">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Usuarios
          </Button>
        </Link>
      </PageHeader>
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Avatar del Usuario</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <Avatar className="h-32 w-32">
              <AvatarImage src={user.avatar} data-ai-hint="user avatar" />
              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <Button variant="outline">Cambiar Avatar</Button>
          </CardContent>
        </Card>

        <form onSubmit={handleUpdateUser} className="md:col-span-2">
            <Card>
            <CardHeader>
                <CardTitle>Información Personal</CardTitle>
                <CardDescription>
                Actualiza los datos personales del usuario aquí. Haz clic en guardar cuando hayas terminado.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                <Label htmlFor="name">Nombre Completo</Label>
                <Input id="name" value={user.name} onChange={e => handleFieldChange('name', e.target.value)} disabled={isSaving}/>
                </div>
                <div className="space-y-2">
                <Label htmlFor="email">Correo Electrónico</Label>
                <Input id="email" type="email" value={user.email} disabled />
                </div>
                <div className="space-y-2">
                <Label htmlFor="role">Rol</Label>
                <Select value={user.role} onValueChange={(value: any) => handleFieldChange('role', value)} disabled={isSaving}>
                    <SelectTrigger id="role">
                    <SelectValue placeholder="Seleccionar rol" />
                    </SelectTrigger>
                    <SelectContent>
                    <SelectItem value="Administrador">Administrador</SelectItem>
                    <SelectItem value="Supervisor">Supervisor</SelectItem>
                    <SelectItem value="Usuario">Usuario</SelectItem>
                    </SelectContent>
                </Select>
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
              Restablece la contraseña del usuario aquí. (Funcionalidad no implementada)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <Button disabled>Restablecer Contraseña</Button>
          </CardFooter>
        </Card>
      </div>
    </>
  );
}
