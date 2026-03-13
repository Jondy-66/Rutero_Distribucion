
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PasswordInput } from '@/components/password-input';
import Link from 'next/link';
import { ArrowLeft, LoaderCircle, Users, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleSignUpAsAdmin } from '@/lib/firebase/auth';
import { addUser } from '@/lib/firebase/firestore';
import type { User } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

export default function NewUserPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { users, loading, refetchData } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Administrador' | 'Supervisor' | 'Usuario' | 'Telemercaderista'>('Usuario');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [selectedSupervisor, setSelectedSupervisor] = useState<string | undefined>();

  useEffect(() => {
    if (users) {
        setSupervisors(users.filter(u => u.role === 'Supervisor'));
    }
  }, [users]);

  /**
   * Valida que la contraseña cumpla con criterios de seguridad.
   */
  const validatePasswordSecurity = (pass: string) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(pass);
    const hasLowerCase = /[a-z]/.test(pass);
    const hasNumber = /[0-9]/.test(pass);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(pass);

    if (pass.length < minLength) return "La contraseña debe tener al menos 8 caracteres.";
    if (!hasUpperCase) return "Debe incluir al menos una letra MAYÚSCULA.";
    if (!hasLowerCase) return "Debe incluir al menos una letra minúscula.";
    if (!hasNumber) return "Debe incluir al menos un número.";
    if (!hasSpecialChar) return "Debe incluir al menos un carácter especial (ej: @, #, $, %).";
    
    return null;
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 1. Validar coincidencia
    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Las contraseñas no coinciden.", variant: "destructive" });
      return;
    }

    // 2. Validar Seguridad de Contraseña (Raíz del requerimiento)
    const securityError = validatePasswordSecurity(password);
    if (securityError) {
        toast({ 
            title: "Contraseña poco segura", 
            description: securityError, 
            variant: "destructive" 
        });
        return;
    }

    // 3. Validar Supervisor para roles operativos
    if ((role === 'Usuario' || role === 'Telemercaderista') && !selectedSupervisor) {
      toast({ title: "Error", description: "Debes asignar un supervisor para el rol de Usuario o Telemercaderista.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const userCredential = await handleSignUpAsAdmin(email, password);
      const uid = userCredential.user.uid;

      const newUser: Omit<User, 'id' | 'status'> = {
        name,
        email,
        role,
        avatar: `https://placehold.co/100x100/011688/FFFFFF/png?text=${name.charAt(0)}`
      };

      if ((role === 'Usuario' || role === 'Telemercaderista') && selectedSupervisor) {
          newUser.supervisorId = selectedSupervisor;
      }

      await addUser(uid, newUser);
      await refetchData('users');

      toast({ title: "Éxito", description: "Usuario creado correctamente con credenciales seguras." });
      router.push('/dashboard/users');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'permission-denied') {
        toast({ title: "Error de Permisos", description: "No tienes permiso para crear usuarios.", variant: "destructive" });
      } else if (error.code === 'auth/email-already-in-use') {
        toast({ title: "Error", description: "El correo electrónico ya está en uso.", variant: "destructive" });
      }
      else {
        toast({ title: "Error", description: error.message || "No se pudo crear el usuario.", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Crear Nuevo Usuario"
        description="Completa el formulario para añadir un nuevo usuario al sistema."
      >
        <Link href="/dashboard/users">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Usuarios
          </Button>
        </Link>
      </PageHeader>
      <form onSubmit={handleCreateUser}>
        <Card>
          <CardHeader>
            <CardTitle>Información del Usuario</CardTitle>
            <CardDescription>
              Proporciona los detalles del nuevo usuario y asigna una contraseña robusta.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre Completo</Label>
              <Input id="name" placeholder="Ej: Juan Pérez" value={name} onChange={e => setName(e.target.value)} required disabled={isLoading || loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input id="email" type="email" placeholder="juan.perez@rutero.com" value={email} onChange={e => setEmail(e.target.value)} required disabled={isLoading || loading}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select onValueChange={(value: any) => setRole(value)} defaultValue={role} required disabled={isLoading || loading}>
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
            {(role === 'Usuario' || role === 'Telemercaderista') && (
              <div className="space-y-2">
                <Label htmlFor="supervisor">Asignar Supervisor</Label>
                <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor} disabled={isLoading || loading}>
                    <SelectTrigger id="supervisor">
                        <Users className="mr-2 h-4 w-4" />
                        <SelectValue placeholder="Seleccionar supervisor" />
                    </SelectTrigger>
                    <SelectContent>
                        {loading ? (
                            <SelectItem value="loading" disabled>Cargando...</SelectItem>
                        ) : (
                            supervisors.map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))
                        )}
                    </SelectContent>
                </Select>
              </div>
            )}
            
            <div className="bg-muted/30 p-4 rounded-lg border border-dashed space-y-4">
                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase mb-2">
                    <ShieldAlert className="h-4 w-4" /> Seguridad de Acceso
                </div>
                <div className="space-y-2">
                    <Label htmlFor="new-password">Contraseña</Label>
                    <PasswordInput id="new-password" value={password} onChange={e => setPassword(e.target.value)} required disabled={isLoading || loading}/>
                    <p className="text-[10px] text-muted-foreground font-medium">Mínimo 8 caracteres, incluye mayúsculas, números y símbolos.</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                    <PasswordInput id="confirm-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required disabled={isLoading || loading}/>
                </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full sm:w-auto font-black px-10" disabled={isLoading || loading}>
              {(isLoading || loading) && <LoaderCircle className="animate-spin mr-2" />}
              CREAR USUARIO SEGURO
            </Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
