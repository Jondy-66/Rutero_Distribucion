'use client';
import { useState, useEffect } from 'react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PasswordInput } from '@/components/password-input';
import { useAuth } from '@/hooks/use-auth';
import { notFound, useRouter } from 'next/navigation';
import { updateUser, getRoutesBySupervisor } from '@/lib/firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import type { User, RoutePlan } from '@/lib/types';
import { LoaderCircle, Download } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export default function ProfilePage() {
  const { user, firebaseUser } = useAuth();
  const { toast } = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(user);
  const [isSaving, setIsSaving] = useState(false);
  const [routes, setRoutes] = useState<RoutePlan[]>([]);
  const [loadingRoutes, setLoadingRoutes] = useState(true);

  useEffect(() => {
    if (user?.role === 'Supervisor') {
        const fetchRoutes = async () => {
            setLoadingRoutes(true);
            try {
                const supervisorRoutes = await getRoutesBySupervisor(user.id);
                setRoutes(supervisorRoutes);
            } catch (error) {
                console.error("Failed to fetch routes for supervisor:", error);
                toast({
                    title: "Error al Cargar Rutas",
                    description: "No se pudieron cargar las rutas asignadas.",
                    variant: "destructive"
                });
            } finally {
                setLoadingRoutes(false);
            }
        };
        fetchRoutes();
    }
  }, [user, toast]);

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
        if (error.code === 'permission-denied') {
            toast({ title: "Error de Permisos", description: "No tienes permiso para actualizar este perfil.", variant: "destructive" });
        } else {
            toast({ title: "Error", description: "No se pudo actualizar el perfil.", variant: "destructive" });
        }
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleFieldChange = (field: keyof User, value: string) => {
    if(currentUser) {
        setCurrentUser({ ...currentUser, [field]: value });
    }
  }

  const handleDownloadExcel = () => {
    // TODO: Implement actual data export
    const worksheet = XLSX.utils.json_to_sheet(routes.map(r => ({
        Nombre: r.routeName,
        Fecha: format(r.date, 'PPP', {locale: es}),
        Estado: r.status
    })));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rutas");
    XLSX.writeFile(workbook, "reporte_rutas.xlsx");
    toast({ title: "Descarga iniciada", description: "Tu reporte en Excel se está descargando." });
  };

  const handleDownloadPdf = () => {
    // TODO: Implement actual data export
    const doc = new jsPDF();
    autoTable(doc, {
      head: [['Nombre', 'Fecha', 'Estado']],
      body: routes.map(r => [r.routeName, format(r.date, 'PPP', {locale: es}), r.status]),
    });
    doc.save('reporte_rutas.pdf');
    toast({ title: "Descarga iniciada", description: "Tu reporte en PDF se está descargando." });
  };

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

        {currentUser.role === 'Supervisor' && (
             <Card className="md:col-span-3">
                <CardHeader>
                    <CardTitle>Reportes de Rutas</CardTitle>
                    <CardDescription>
                        Visualiza y descarga los reportes de las rutas que tienes asignadas.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-end gap-2 mb-4">
                        <Button variant="outline" onClick={handleDownloadExcel}>
                            <Download className="mr-2" />
                            Descargar Excel
                        </Button>
                        <Button variant="outline" onClick={handleDownloadPdf}>
                             <Download className="mr-2" />
                            Descargar PDF
                        </Button>
                    </div>
                     <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead>Nombre de Ruta</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Clientes</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingRoutes ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                            <TableCell><Skeleton className="h-5 w-8" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : routes.length > 0 ? (
                                    routes.map((route) => (
                                        <TableRow key={route.id}>
                                            <TableCell className="font-medium">{route.routeName}</TableCell>
                                            <TableCell>{format(route.date, 'PPP', { locale: es })}</TableCell>
                                            <TableCell>{route.status}</TableCell>
                                            <TableCell>{route.clients.length}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center h-24">
                                            No tienes rutas asignadas.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        )}

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
