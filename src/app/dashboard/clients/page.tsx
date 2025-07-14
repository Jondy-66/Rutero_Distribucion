
'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
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
import { getClients, addClientsBatch, deleteClient } from '@/lib/firebase/firestore';
import type { Client } from '@/lib/types';
import { PlusCircle, UploadCloud, File, Search, MoreHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import Papa from 'papaparse';

type ClientCsvData = {
    ejecutivo: string;
    ruc: string;
    nombre_cliente: string;
    nombre_comercial: string;
    provincia: string;
    canton: string;
    direccion: string;
    latitud: string;
    longitud: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const fetchClients = async () => {
    // setLoading(true) is not needed here as it's part of the main loading state
    try {
      const clientsData = await getClients();
      setClients(clientsData);
    } catch (error: any) {
      console.error("Failed to fetch clients:", error);
      if (error.code === 'permission-denied') {
        toast({ title: "Error de Permisos", description: "No tienes permiso para ver los clientes. Revisa las reglas de seguridad de Firestore.", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleEdit = (clientId: string) => {
    router.push(`/dashboard/clients/${clientId}`);
  };

  const handleDelete = async (clientId: string) => {
     try {
      await deleteClient(clientId);
      toast({ title: "Éxito", description: "Cliente eliminado correctamente." });
      fetchClients(); // Refresh the list
    } catch (error: any) {
      console.error("Failed to delete client:", error);
      toast({ title: "Error", description: "No se pudo eliminar el cliente.", variant: "destructive" });
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    Papa.parse<ClientCsvData>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const requiredColumns = ['ejecutivo', 'ruc', 'nombre_cliente', 'nombre_comercial', 'provincia', 'canton', 'direccion', 'latitud', 'longitud'];
        const headers = results.meta.fields || [];
        const missingColumns = requiredColumns.filter(col => !headers.includes(col));

        if (missingColumns.length > 0) {
          toast({
            title: 'Error de formato',
            description: `Faltan las siguientes columnas en el archivo: ${missingColumns.join(', ')}`,
            variant: 'destructive',
          });
          setIsUploading(false);
          return;
        }
        
        const dataWithParsedCoords = results.data.map(row => ({
            ...row,
            latitud: parseFloat(row.latitud?.replace(',', '.')),
            longitud: parseFloat(row.longitud?.replace(',', '.'))
        }));

        const validData = dataWithParsedCoords.filter(row => 
            row.ruc && row.nombre_cliente && !isNaN(row.latitud) && !isNaN(row.longitud)
        );

        const invalidRows = results.data.length - validData.length;
        if(invalidRows > 0) {
            toast({
                title: 'Datos inválidos',
                description: `Se omitieron ${invalidRows} filas por datos faltantes o con formato incorrecto.`,
            });
        }
        
        if (validData.length === 0) {
            toast({
                title: 'No hay datos válidos',
                description: `No se encontraron filas con datos válidos para procesar.`,
                variant: 'destructive',
            });
            setIsUploading(false);
            return;
        }

        try {
          const clientsToAdd = validData.map(item => ({
              ejecutivo: item.ejecutivo || '',
              ruc: item.ruc,
              nombre_cliente: item.nombre_cliente,
              nombre_comercial: item.nombre_comercial || '',
              provincia: item.provincia || '',
              canton: item.canton || '',
              direccion: item.direccion || '',
              latitud: item.latitud,
              longitud: item.longitud,
          }));

          const addedCount = await addClientsBatch(clientsToAdd);

          toast({
            title: 'Carga exitosa',
            description: `${addedCount} de ${validData.length} clientes nuevos han sido añadidos. Se omitieron duplicados por RUC.`,
          });
          setLoading(true);
          await fetchClients(); 
        } catch (error: any)
        {
          console.error("Failed to add new clients:", error);
          if (error.code === 'permission-denied') {
            toast({
              title: 'Error de Permisos',
              description: 'No tienes permiso para añadir clientes.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Error en la carga',
              description: 'Ocurrió un error al añadir los clientes.',
              variant: 'destructive',
            });
          }
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          document.getElementById('close-dialog-clients')?.click();
        }
      },
      error: (error) => {
        console.error('Error parsing CSV:', error);
        toast({
          title: 'Error de archivo',
          description: 'No se pudo procesar el archivo CSV.',
          variant: 'destructive',
        });
        setIsUploading(false);
      }
    });
  };

  const filteredClients = useMemo(() => {
    return clients
      .filter(client => {
        if (filter === 'all') return true;
        // Handle old data that might not have the status field, defaulting to 'active'
        return (client.status || 'active') === filter;
      })
      .filter(client => {
        const search = searchTerm.toLowerCase();
        return (
          client.nombre_cliente.toLowerCase().includes(search) ||
          client.nombre_comercial.toLowerCase().includes(search) ||
          client.ruc.toLowerCase().includes(search) ||
          client.ejecutivo.toLowerCase().includes(search) ||
          client.provincia.toLowerCase().includes(search)
        );
      });
  }, [clients, filter, searchTerm]);

  return (
    <>
      <PageHeader title="Clientes" description="Visualiza, gestiona e importa los datos de tus clientes.">
        <Link href="/dashboard/clients/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Añadir Cliente
          </Button>
        </Link>
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">
                    <UploadCloud className="mr-2 h-4 w-4" />
                    Importar
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Importar Clientes desde CSV</DialogTitle>
                    <DialogDescription>
                        Sube un archivo CSV para añadir clientes nuevos. Columnas requeridas: ejecutivo, ruc, nombre_cliente, nombre_comercial, provincia, canton, direccion, latitud, longitud.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                <Input
                    type="file"
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    disabled={isUploading}
                />
                </div>
                <DialogFooter className="sm:justify-between">
                    <span className="text-sm text-muted-foreground">{isUploading ? 'Procesando archivo...' : 'Selecciona un archivo para empezar.'}</span>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" id="close-dialog-clients">
                            Cerrar
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </PageHeader>
      
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>Una lista de todos los clientes en tu base de datos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" onValueChange={(value) => setFilter(value)}>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="active">Activos</TabsTrigger>
                <TabsTrigger value="inactive">Inactivos</TabsTrigger>
              </TabsList>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar clientes..." 
                    className="w-full pl-8" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-1">
                      <File className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Columnas</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Alternar columnas</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem checked>Ejecutivo</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked>RUC</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked>Nombre Cliente</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked>Provincia</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem>Canton</DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </Tabs>
          <div className="border rounded-lg mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell">RUC</TableHead>
                  <TableHead className="hidden md:table-cell">Ejecutivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-full" /></TableCell>
                       <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  filteredClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="font-medium">{client.nombre_cliente}</div>
                        <div className="text-sm text-muted-foreground">{client.nombre_comercial}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{client.ruc}</TableCell>
                      <TableCell className="hidden md:table-cell">{client.ejecutivo}</TableCell>
                      <TableCell>
                        <Badge variant={(client.status ?? 'active') === 'active' ? 'default' : 'secondary'}>
                          {(client.status ?? 'active') === 'active' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>{client.direccion}</TableCell>
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
                              <DropdownMenuItem onClick={() => handleEdit(client.id)}>Editar</DropdownMenuItem>
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
                                Esta acción no se puede deshacer. Esto eliminará permanentemente al cliente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(client.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
