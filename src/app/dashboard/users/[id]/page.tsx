

'use client';
import { useEffect, useState, useMemo } from 'react';
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
import { updateUser, getUsersBySupervisor } from '@/lib/firebase/firestore';
import { updateUserPasswordAsAdmin as updateUserPasswordInAuth } from '@/lib/firebase/auth';

import type { User } from '@/lib/types';
import { notFound, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LoaderCircle, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';
import { PasswordInput } from '@/components/password-input';

export default function UserProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser, users, loading: authLoading, refetchData } = useAuth();
  
  const [user, setUser] = useState<User | null>(null);
  const [assignedUsers, setAssignedUsers] = useState<User[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingAssignedUsers, setLoadingAssignedUsers] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    if (users.length > 0 && params.id) {
        const userData = users.find(u => u.id === params.id);
        if (!userData) {
            notFound();
            return;
        }
        setUser(userData);
        setSupervisors(users.filter(u => u.role === 'Supervisor'));

        if(userData.role === 'Supervisor') {
            setLoadingAssignedUsers(true);
            getUsersBySupervisor(userData.id).then(data => {
                setAssignedUsers(data);
                setLoadingAssignedUsers(false);
            });
        }
    }
  }, [params.id, users]);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      const dataToUpdate: Partial<User> = {
        role: user.role,
        status: user.status,
      };

      // Solo un admin puede cambiar nombre y correo
      if(currentUser?.role === 'Administrador') {
        dataToUpdate.name = user.name;
        dataToUpdate.email = user.email;
      }

      if ((user.role === 'Usuario' || user.role === 'Telemercaderista') && user.supervisorId !== undefined) {
        dataToUpdate.supervisorId = user.supervisorId;
      }
      
      // Si el estado se cambia a activo, reseteamos los intentos fallidos
      if (user.status === 'active') {
          dataToUpdate.failedLoginAttempts = 0;
      }

      await updateUser(user.id, dataToUpdate);
      await refetchData('users');
      toast({ title: "Éxito", description: "Usuario actualizado correctamente." });
      // No redirigimos para que el admin pueda seguir gestionando
    } catch (error: any) {
      console.error(error);
      if (error.code === 'permission-denied') {
        toast({ title: "Error de Permisos", description: "No tienes permiso para actualizar usuarios.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message || "No se pudo actualizar el usuario.", variant: "destructive" });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user) return;
      if (newPassword !== confirmPassword) {
          toast({ title: "Error", description: "Las nuevas contraseñas no coinciden.", variant: "destructive" });
          return;
      }
      if (newPassword.length < 6) {
          toast({ title: "Error", description: "La contraseña debe tener al menos 6 caracteres.", variant: "destructive" });
          return;
      }

      setIsChangingPassword(true);
      try {
          await updateUserPasswordInAuth(user.id, newPassword);
          toast({ title: "Éxito", description: "La contraseña del usuario ha sido cambiada." });
          setNewPassword('');
          setConfirmPassword('');
      } catch (error: any) {
          console.error("Error changing password:", error);
          toast({ title: "Error al cambiar contraseña", description: "No se pudo cambiar la contraseña. " + error.message, variant: "destructive" });
      } finally {
          setIsChangingPassword(false);
      }
  }
  
  const handleFieldChange = (field: keyof User, value: string) => {
    if(user) {
        setUser({ ...user, [field]: value });
    }
  }
  
  const canEditNameAndEmail = currentUser?.role === 'Administrador';

  if (authLoading || !user) {
    return (
        <>
        <PageHeader title="Perfil de Usuario" description="Cargando...">
            <Skeleton className="h-10 w-36" />
        </PageHeader>
        <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1"><CardContent className="pt-6"><Skeleton className="h-32 w-32 rounded-full mx-auto" /></CardContent></Card>
            <Card className="md:col-span-2"><CardContent className="pt-6 space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></CardContent></Card>
        </div>
        </>
    );
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
      <div className="grid gap-6">
        <div className="grid md:grid-cols-3 gap-6">
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
                    <Input id="name" value={user.name} onChange={e => handleFieldChange('name', e.target.value)} disabled={isSaving || !canEditNameAndEmail}/>
                    </div>
                    <div className="space-y-2">
                    <Label htmlFor="email">Correo Electrónico</Label>
                    <Input id="email" type="email" value={user.email} onChange={e => handleFieldChange('email', e.target.value)} disabled={isSaving || !canEditNameAndEmail} />
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
                        <SelectItem value="Telemercaderista">Telemercaderista</SelectItem>
                        </SelectContent>
                    </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="status">Estado</Label>
                        <Select value={user.status || 'active'} onValueChange={(value: 'active' | 'inactive') => handleFieldChange('status', value)} disabled={isSaving}>
                            <SelectTrigger id="status">
                            <SelectValue placeholder="Seleccionar estado" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="active">Activo</SelectItem>
                            <SelectItem value="inactive">Inactivo</SelectItem>
                            </SelectContent>
                        </Select>
                         {user.status === 'inactive' && user.failedLoginAttempts && user.failedLoginAttempts >= 5 && (
                           <p className="text-sm text-destructive mt-1">Cuenta bloqueada por {user.failedLoginAttempts} intentos fallidos.</p>
                        )}
                    </div>
                    {(user.role === 'Usuario' || user.role === 'Telemercaderista') && (
                        <div className="space-y-2">
                            <Label htmlFor="supervisor">Asignar Supervisor</Label>
                            <Select value={user.supervisorId} onValueChange={(value) => handleFieldChange('supervisorId', value)} disabled={isSaving || supervisors.length === 0}>
                                <SelectTrigger id="supervisor">
                                    <Users className="mr-2 h-4 w-4" />
                                    <SelectValue placeholder="Seleccionar supervisor" />
                                </SelectTrigger>
                                <SelectContent>
                                    {supervisors.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </CardContent>
                <CardFooter>
                    <Button type="submit" disabled={isSaving}>
                        {isSaving && <LoaderCircle className="animate-spin" />}
                        Guardar Cambios
                    </Button>
                </CardFooter>
                </Card>
            </form>
        </div>

        <form onSubmit={handleChangePassword}>
          <Card>
            <CardHeader>
                <CardTitle>Cambiar Contraseña</CardTitle>
                <CardDescription>
                Establece una nueva contraseña para este usuario.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="new-password">Nueva Contraseña</Label>
                    <PasswordInput id="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} disabled={isChangingPassword} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar Nueva Contraseña</Label>
                    <PasswordInput id="confirm-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={isChangingPassword} />
                </div>
            </CardContent>
            <CardFooter>
                <Button type="submit" disabled={isChangingPassword}>
                    {isChangingPassword && <LoaderCircle className="animate-spin" />}
                    Actualizar Contraseña
                </Button>
            </CardFooter>
          </Card>
        </form>

        {user.role === 'Supervisor' && (
             <Card>
                <CardHeader>
                    <CardTitle>Usuarios Asignados</CardTitle>
                    <CardDescription>Lista de usuarios gestionados por {user.name}.</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingAssignedUsers ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                            <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : assignedUsers.length > 0 ? (
                                    assignedUsers.map(assigned => (
                                        <TableRow key={assigned.id}>
                                            <TableCell>{assigned.name}</TableCell>
                                            <TableCell>{assigned.email}</TableCell>
                                            <TableCell>
                                                <Badge variant={assigned.status === 'active' ? 'success' : 'destructive'}>
                                                    {assigned.status === 'active' ? 'Activo' : 'Inactivo'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center h-24">
                                            Este supervisor no tiene usuarios asignados.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
             </Card>
        )}
      </div>
    </>
  );
}

    