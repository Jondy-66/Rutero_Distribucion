'use client';

import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { LoaderCircle, Save, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import { updateUser } from '@/lib/firebase/firestore';

const modules = [
    { id: 'dashboard', label: 'Panel' },
    { id: 'admin-dashboard', label: 'KPIs' },
    { id: 'clients', label: 'Clientes' },
    { id: 'locations', label: 'Ubicaciones' },
    { id: 'map', label: 'Mapa' },
    { id: 'reports', label: 'Reportes' },
    { id: 'routes', label: 'Rutas' },
    { id: 'users', label: 'Usuarios' },
    { id: 'recover-clients', label: 'Recuperar Clientes (Rescate)' },
];

const defaultPermissionsByRole: Record<User['role'], string[]> = {
    'Administrador': ['dashboard', 'admin-dashboard', 'clients', 'locations', 'map', 'reports', 'routes', 'users', 'recover-clients'],
    'Supervisor': ['dashboard', 'admin-dashboard', 'clients', 'map', 'reports', 'routes', 'recover-clients'],
    'Usuario': ['dashboard', 'clients', 'map', 'routes'],
    'Telemercaderista': ['dashboard', 'clients', 'map', 'routes'],
};

export default function PermissionsPage() {
    const { users, loading: authLoading, refetchData } = useAuth();
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const selectedUser = useMemo(() => {
        return users.find(u => u.id === selectedUserId) || null;
    }, [selectedUserId, users]);

    useEffect(() => {
        if (selectedUser) {
            // Si el usuario ya tiene permisos guardados, los usamos. 
            // Si no, cargamos los predeterminados según su rol.
            const userPermissions = selectedUser.permissions && selectedUser.permissions.length > 0 
                ? selectedUser.permissions 
                : defaultPermissionsByRole[selectedUser.role] || [];
            
            const initialPermissions: Record<string, boolean> = {};
            modules.forEach(m => {
                initialPermissions[m.id] = userPermissions.includes(m.id);
            });
            setPermissions(initialPermissions);
        } else {
            const initialPermissions: Record<string, boolean> = {};
            modules.forEach(m => initialPermissions[m.id] = false);
            setPermissions(initialPermissions);
        }
    }, [selectedUser]);


    const handleUserChange = (userId: string) => {
        setSelectedUserId(userId);
    };

    const handlePermissionChange = (moduleId: string, checked: boolean) => {
        setPermissions(prev => ({
            ...prev,
            [moduleId]: checked
        }));
    };

    const handleSaveChanges = async () => {
        if (!selectedUser) {
            toast({ title: 'Error', description: 'Por favor, selecciona un usuario.', variant: 'destructive' });
            return;
        }
        
        setIsSaving(true);
        try {
            const permissionList = Object.entries(permissions)
                .filter(([_, enabled]) => enabled)
                .map(([id, _]) => id);

            await updateUser(selectedUser.id, { permissions: permissionList });
            await refetchData('users');
            
            toast({ 
                title: 'Éxito', 
                description: `Permisos actualizados correctamente para ${selectedUser.name}.` 
            });
        } catch (error: any) {
            console.error("Error al guardar permisos:", error);
            toast({ 
                title: 'Error al Guardar', 
                description: 'Ocurrió un error al intentar actualizar los permisos.', 
                variant: 'destructive' 
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (authLoading) {
        return (
            <>
                <PageHeader title="Gestión de Permisos" description="Cargando usuarios..." />
                <Skeleton className="h-96 w-full" />
            </>
        )
    }

    return (
        <>
            <PageHeader title="Gestión de Permisos" description="Asigna o revoca el acceso a los módulos y funciones especiales para cada usuario." />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        Seleccionar Usuario
                    </CardTitle>
                    <CardDescription>Elige un usuario para configurar sus permisos de acceso.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={handleUserChange} disabled={isSaving}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder="Selecciona un usuario..." />
                        </SelectTrigger>
                        <SelectContent>
                            {users.map(user => (
                                <SelectItem key={user.id} value={user.id}>
                                    {user.name} ({user.email}) - {user.role}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {selectedUser && (
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>Permisos para {selectedUser.name}</CardTitle>
                        <CardDescription>
                            Rol actual: <span className="font-bold text-primary">{selectedUser.role}</span>. Activa o desactiva los módulos a los que este usuario tendrá acceso.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {modules.map(module => (
                            <div key={module.id} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/5 transition-colors">
                                <Checkbox
                                    id={`perm-${module.id}`}
                                    checked={permissions[module.id] || false}
                                    onCheckedChange={(checked) => handlePermissionChange(module.id, Boolean(checked))}
                                    disabled={isSaving}
                                />
                                <Label htmlFor={`perm-${module.id}`} className="font-semibold cursor-pointer flex-1">
                                    {module.label}
                                </Label>
                            </div>
                        ))}
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSaveChanges} disabled={isSaving} className="w-full sm:w-auto">
                            {isSaving ? <LoaderCircle className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                            Guardar Permisos
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </>
    );
}
