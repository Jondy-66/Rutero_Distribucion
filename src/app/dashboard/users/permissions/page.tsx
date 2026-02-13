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
    { id: 'dashboard', label: 'Panel Principal' },
    { id: 'admin-dashboard', label: 'Dashboard de KPIs' },
    { id: 'clients', label: 'Gestión de Clientes' },
    { id: 'locations', label: 'Gestión de Ubicaciones' },
    { id: 'map', label: 'Visualización de Mapa' },
    { id: 'reports', label: 'Reportes y Exportaciones' },
    { id: 'routes', label: 'Gestión de Rutas' },
    { id: 'users', label: 'Administración de Usuarios' },
    { id: 'recover-clients', label: 'RECUPERAR CLIENTES (Rescate de Datos)' },
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
            toast({ title: 'Error', description: 'Selecciona un usuario primero.', variant: 'destructive' });
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
                title: 'Permisos Guardados', 
                description: `Se actualizaron los accesos para ${selectedUser.name}.` 
            });
        } catch (error: any) {
            console.error("Error al guardar permisos:", error);
            toast({ title: 'Error', description: 'No se pudieron actualizar los permisos.', variant: 'destructive' });
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
            <PageHeader title="Gestión de Permisos" description="Configura los accesos granulares por usuario." />

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <ShieldCheck className="h-5 w-5 text-primary" />
                        1. Seleccionar Usuario
                    </CardTitle>
                    <CardDescription>Busca al usuario para modificar sus accesos a módulos.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={handleUserChange} disabled={isSaving}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder="Selecciona un usuario..." />
                        </SelectTrigger>
                        <SelectContent>
                            {users.map(user => (
                                <SelectItem key={user.id} value={user.id}>
                                    {user.name} ({user.role})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </CardContent>
            </Card>

            {selectedUser && (
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle>2. Configurar Permisos para {selectedUser.name}</CardTitle>
                        <CardDescription>
                            Rol base: <span className="font-bold text-primary">{selectedUser.role}</span>. Activa los módulos permitidos.
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
                                <Label htmlFor={`perm-${module.id}`} className="font-bold cursor-pointer flex-1 uppercase text-[11px]">
                                    {module.label}
                                </Label>
                            </div>
                        ))}
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSaveChanges} disabled={isSaving} className="w-full sm:w-auto font-bold">
                            {isSaving ? <LoaderCircle className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                            GUARDAR PERMISOS
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </>
    );
}
