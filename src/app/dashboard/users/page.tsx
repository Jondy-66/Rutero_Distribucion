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
import { mockUsers } from '@/lib/mock-data';
import { PlusCircle, MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function UsersPage() {
  const getBadgeVariant = (role: string) => {
    if (role === 'Administrador') return 'default';
    if (role === 'Supervisor') return 'secondary';
    return 'outline';
  };

  return (
    <>
      <PageHeader title="Usuarios" description="Gestiona todos los usuarios del sistema.">
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Añadir Usuario
        </Button>
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
            {mockUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={`https://placehold.co/40x40/011688/FFFFFF/png?text=${user.name.charAt(0)}`} data-ai-hint="user avatar" />
                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{user.name}</div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getBadgeVariant(user.role)}>{user.role}</Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <Badge variant="outline">Activo</Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Alternar menú</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                      <DropdownMenuItem>Editar</DropdownMenuItem>
                      <DropdownMenuItem>Eliminar</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
