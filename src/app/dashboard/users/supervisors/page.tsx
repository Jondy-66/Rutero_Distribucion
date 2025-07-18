
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getSupervisors, deleteUser } from '@/lib/firebase/firestore';
import type { User } from '@/lib/types';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Skeleton } from '@/components/ui/skeleton';

export default function SupervisorsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSupervisors = async () => {
    setLoading(true);
    try {
      const supervisorsData = await getSupervisors();
      setSupervisors(supervisorsData);
    } catch (error: any) {
      console.error("Failed to fetch supervisors:", error);
      if (error.code === 'permission-denied') {
        toast({ title: "Error de Permisos", description: "No tienes permiso para ver supervisores.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "No se pudieron cargar los supervisores.", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSupervisors();
  }, []);

  const getBadgeVariantForRole = (role: string) => {
    if (role === 'Administrador') return 'default';
    if (role === 'Supervisor') return 'secondary';
    return 'outline';
  };
  
  const getBadgeVariantForStatus = (status: 'active' | 'inactive' | undefined) => {
    return (status ?? 'active') === 'active' ? 'success' : 'destructive';
  }

  const handleEdit = (userId: string) => {
    router.push(`/dashboard/users/${userId}`);
  };

  const handleDelete = async (userId: string) => {
    try {
      await deleteUser(userId);
      toast({ title: "Éxito", description: "Usuario eliminado correctamente." });
      fetchSupervisors(); // Refresh the list
    } catch (error: any) {
      console.error("Failed to delete user:", error);
      if (error.code === 'permission-denied') {
        toast({ title: "Error de Permisos", description: "No tienes permiso para eliminar usuarios.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "No se pudo eliminar el usuario.", variant: "destructive" });
      }
    }
  };

  return (
    <>
      <PageHeader title="Supervisores" description="Gestiona los usuarios con rol de supervisor.">
        <Link href="/dashboard/users/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Usuario
          </Button>
        </Link>
      </PageHeader>
      <div className="bg-card p-4 rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="hidden sm:table-cell">Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="space-y-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                </TableRow>
              ))
            ) : (
              supervisors.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.avatar} data-ai-hint="user avatar" />
                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getBadgeVariantForRole(user.role)}>{user.role}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant={getBadgeVariantForStatus(user.status)}>
                        {(user.status ?? 'active') === 'active' ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <AlertDialog>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button aria-haspopup="true" size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Alternar menú</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleEdit(user.id)}>Editar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                           <AlertDialogTrigger asChild>
                            <DropdownMenuItem className="text-red-600">Eliminar</DropdownMenuItem>
                          </AlertDialogTrigger>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. Esto eliminará permanentemente al usuario
                            de la base de datos de la aplicación (pero no de la autenticación de Firebase).
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(user.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            )}
            { !loading && supervisors.length === 0 && (
                <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                        No se encontraron supervisores.
                    </TableCell>
                </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
