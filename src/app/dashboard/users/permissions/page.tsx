
'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { LoaderCircle, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';


const modules = [
    { id: 'dashboard', label: 'Panel de Control' },
    { id: 'clients', label: 'Clientes' },
    { id: 'locations', label: 'Ubicaciones' },
    { id: 'map', label: 'Mapa' },
    { id: 'reports', label: 'Reportes' },
    { id: 'routes', label: 'Rutas' },
    { id: 'users', label: 'Usuarios' },
];

export default function PermissionsPage() {
    const { users, loading: authLoading } = useAuth();
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<Record<string, boolean>>({});
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const selectedUser = useMemo(() => {
        return users.find(u => u.id === selectedUserId) || null;
    }, [selectedUserId, users]);


    const handleUserChange = (userId: string) => {
        setSelectedUserId(userId);
        const user = users.find(u => u.id === userId);
        // Aquí se cargaría los permisos existentes del usuario
        // Por ahora, lo inicializamos todo en falso como maqueta
        const initialPermissions: Record<string, boolean> = {};
        modules.forEach(m => initialPermissions[m.id] = false);
        setPermissions(initialPermissions);
    };

    const handlePermissionChange = (moduleId: string, checked: boolean) => {
        setPermissions(prev => ({
            ...prev,
            [moduleId]: checked
        }));
    };

    const handleSaveChanges = () => {
        if (!selectedUser) {
            toast({ title: 'Error', description: 'Por favor, selecciona un usuario.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        console.log('Guardando permisos para', selectedUser.name, permissions);

        // Aquí iría la lógica para guardar en Firestore
        // Simulamos un guardado exitoso
        setTimeout(() => {
            toast({ title: 'Éxito (Simulado)', description: `Permisos actualizados para ${selectedUser.name}.` });
            setIsSaving(false);
        }, 1500);
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
            <PageHeader title="Gestión de Permisos" description="Asigna o revoca el acceso a los módulos para cada usuario." />

            <Card>
                <CardHeader>
                    <CardTitle>Seleccionar Usuario</CardTitle>
                    <CardDescription>Elige un usuario para configurar sus permisos de acceso a los módulos.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={handleUserChange} disabled={isSaving}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder="Selecciona un usuario..." />
                        </SelectTrigger>
                        <SelectContent>
                            {users.map(user => (
                                <SelectItem key={user.id} value={user.id}>
                                    {user.name} ({user.email})
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
                        <CardDescription>Activa o desactiva los módulos a los que este usuario tendrá acceso.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {modules.map(module => (
                            <div key={module.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`perm-${module.id}`}
                                    checked={permissions[module.id] || false}
                                    onCheckedChange={(checked) => handlePermissionChange(module.id, Boolean(checked))}
                                    disabled={isSaving}
                                />
                                <Label htmlFor={`perm-${module.id}`} className="font-medium">
                                    {module.label}
                                </Label>
                            </div>
                        ))}
                    </CardContent>
                    <CardFooter>
                        <Button onClick={handleSaveChanges} disabled={isSaving}>
                            {isSaving && <LoaderCircle className="animate-spin mr-2" />}
                            <Save className="mr-2 h-4 w-4" />
                            Guardar Cambios
                        </Button>
                    </CardFooter>
                </Card>
            )}
        </>
    );
}
