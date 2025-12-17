
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
import { addClientsBatch, deleteClient, updateClient } from '@/lib/firebase/firestore';
import type { Client } from '@/lib/types';
import { PlusCircle, UploadCloud, File, Search, MoreHorizontal, Download, Users } from 'lucide-react';
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
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/use-auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ClientCsvData = {
    [key: string]: string;
}

const ITEMS_PER_PAGE = 10;

export default function ClientsPage() {
  const { user, clients, loading, refetchData } = useAuth();
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEjecutivo, setSelectedEjecutivo] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, searchTerm, selectedEjecutivo]);

  const handleEdit = (clientId: string) => {
    router.push(`/dashboard/clients/${clientId}`);
  };

  const handleDelete = async (clientId: string) => {
     try {
      await deleteClient(clientId);
      toast({ title: "Éxito", description: "Cliente eliminado correctamente." });
      await refetchData('clients');
    } catch (error: any) {
      console.error("Failed to delete client:", error);
      toast({ title: "Error", description: "No se pudo eliminar el cliente.", variant: "destructive" });
    }
  };

  const processImportedData = async (data: ClientCsvData[], fields: string[] | undefined) => {
    const requiredColumns = ['ejecutivo', 'ruc', 'nombre_cliente', 'nombre_comercial', 'canton', 'direccion', 'provincia'];
    const headers = (fields || []).map(h => h.toString().trim().toLowerCase().replace(/_/g, ''));
    const missingColumns = requiredColumns.filter(col => !headers.includes(col.replace(/_/g, '')));

    if (missingColumns.length > 0) {
      toast({
        title: 'Error de formato',
        description: `Faltan las siguientes columnas en el archivo: ${missingColumns.join(', ')}`,
        variant: 'destructive',
      });
      setIsUploading(false);
      return;
    }
    
    // Normalize keys in data objects
    const normalizedData = data.map(row => {
        const newRow: ClientCsvData = {};
        for(const key in row) {
            newRow[key.trim().toLowerCase().replace(/ /g, '').replace(/_/g, '')] = row[key];
        }
        return newRow;
    });

    const validData = normalizedData.filter(row => row.ruc && row.nombrecliente);

    const invalidRows = normalizedData.length - validData.length;
    if(invalidRows > 0) {
        toast({
            title: 'Datos inválidos',
            description: `Se omitieron ${invalidRows} filas por datos faltantes (Ruc y Nombre_cliente son obligatorios).`,
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
      const rucsInDb = new Map(clients.map(c => [c.ruc, c.id]));
      let addedCount = 0;
      let updatedCount = 0;

      const clientsToProcess = validData.map(item => ({
          ejecutivo: item.ejecutivo || '',
          ruc: item.ruc,
          nombre_cliente: item.nombrecliente || item.nombre_cliente || '',
          nombre_comercial: item.nombrecomercial || item.nombre_comercial || '',
          provincia: item.provincia || '',
          canton: item.canton || '',
          direccion: item.direccion || '',
          latitud: parseFloat(String(item.latitudtrz || item.latitud || '0').replace(',', '.')) || 0,
          longitud: parseFloat(String(item.longitudtrz || item.longitud || '0').replace(',', '.')) || 0,
      }));
      
      const clientsToAdd: any[] = [];
      const clientsToUpdate: { id: string, data: any }[] = [];

      for (const clientData of clientsToProcess) {
        if(rucsInDb.has(clientData.ruc)) {
            const clientId = rucsInDb.get(clientData.ruc)!;
            clientsToUpdate.push({ id: clientId, data: clientData });
            updatedCount++;
        } else {
            clientsToAdd.push(clientData);
            addedCount++;
        }
      }

      if (clientsToAdd.length > 0) {
        await addClientsBatch(clientsToAdd);
      }
      for (const client of clientsToUpdate) {
        await updateClient(client.id, client.data);
      }

      toast({
        title: 'Carga exitosa',
        description: `${addedCount} clientes añadidos y ${updatedCount} clientes actualizados.`,
      });
      await refetchData('clients');
    } catch (error: any)
    {
      console.error("Failed to add or update clients:", error);
      if (error.code === 'permission-denied') {
        toast({
          title: 'Error de Permisos',
          description: 'No tienes permiso para añadir o actualizar clientes.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error en la carga',
          description: 'Ocurrió un error al procesar los clientes.',
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
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    if (file.name.endsWith('.csv')) {
        Papa.parse<ClientCsvData>(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            processImportedData(results.data, results.meta.fields);
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
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: ClientCsvData[] = XLSX.utils.sheet_to_json(worksheet);
                const headers = json.length > 0 ? Object.keys(json[0]) : [];
                processImportedData(json, headers);
            } catch (error) {
                 console.error('Error processing Excel file:', error);
                toast({
                    title: 'Error de archivo',
                    description: 'No se pudo procesar el archivo Excel.',
                    variant: 'destructive',
                });
                setIsUploading(false);
            }
        };
        reader.onerror = (error) => {
            console.error('Error reading file:', error);
            toast({ title: 'Error', description: 'No se pudo leer el archivo.', variant: 'destructive' });
            setIsUploading(false);
        };
        reader.readAsBinaryString(file);
    } else {
        toast({ title: 'Formato no soportado', description: 'Por favor, sube un archivo CSV o Excel.', variant: 'destructive' });
        setIsUploading(false);
    }
  };

  const uniqueEjecutivos = useMemo(() => {
    const ejecutivos = new Set(clients.map(c => c.ejecutivo).filter(Boolean));
    return ['all', ...Array.from(ejecutivos)];
  }, [clients]);

  const filteredClients = useMemo(() => {
    return clients
      .filter(client => {
        if (user?.role === 'Usuario') {
            return client.ejecutivo === user.name;
        }
        return true;
      })
      .filter(client => {
        if (filter === 'all') return true;
        return (client.status || 'active') === filter;
      })
      .filter(client => {
        if (selectedEjecutivo === 'all') return true;
        return client.ejecutivo === selectedEjecutivo;
      })
      .filter(client => {
        const search = searchTerm.toLowerCase();
        return (
          String(client.nombre_cliente).toLowerCase().includes(search) ||
          String(client.nombre_comercial).toLowerCase().includes(search) ||
          String(client.ruc).toLowerCase().includes(search) ||
          String(client.ejecutivo).toLowerCase().includes(search) ||
          String(client.provincia).toLowerCase().includes(search)
        );
      });
  }, [clients, filter, searchTerm, user, selectedEjecutivo]);
  
  const paginatedClients = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredClients.slice(startIndex, endIndex);
  }, [filteredClients, currentPage]);

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);

  const handleDownloadExcel = () => {
    if (filteredClients.length === 0) {
      toast({ title: "Sin Datos", description: "No hay clientes para exportar.", variant: "destructive" });
      return;
    }

    const dataToExport = filteredClients.map(client => ({
      'Ejecutivo': client.ejecutivo,
      'RUC': client.ruc,
      'Nombre Cliente': client.nombre_cliente,
      'Nombre Comercial': client.nombre_comercial,
      'Provincia': client.provincia,
      'Cantón': client.canton,
      'Dirección': client.direccion,
      'Estado': client.status,
      'Latitud': client.latitud,
      'Longitud': client.longitud,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");
    XLSX.writeFile(workbook, "reporte_clientes.xlsx");
    toast({ title: "Descarga Iniciada", description: "Tu reporte de clientes se está descargando." });
  };
  
  const canSeeEjecutivoFilter = user?.role === 'Administrador' || user?.role === 'Supervisor';

  return (
    <>
      <PageHeader title="Clientes" description="Visualiza, gestiona e importa los datos de tus clientes.">
        <div className="flex gap-2">
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
                        <DialogTitle>Importar Clientes desde CSV o Excel</DialogTitle>
                        <DialogDescription>
                            Sube un archivo para añadir o actualizar clientes. Columnas requeridas: Ejecutivo, Ruc, Nombre_cliente, Nombre_comercial, Canton, Direccion, Provincia. Opcionales: latitud, longitud.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                    <Input
                        type="file"
                        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
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
            <Button variant="outline" onClick={handleDownloadExcel}>
                <Download className="mr-2 h-4 w-4" />
                Descargar Excel
            </Button>
        </div>
      </PageHeader>
      
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>Una lista de todos los clientes en tu base de datos.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <Tabs defaultValue="all" onValueChange={(value) => setFilter(value)}>
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="active">Activos</TabsTrigger>
                <TabsTrigger value="inactive">Inactivos</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-col sm:flex-row w-full sm:w-auto sm:items-center gap-2">
                {canSeeEjecutivoFilter && (
                    <Select value={selectedEjecutivo} onValueChange={setSelectedEjecutivo}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <Users className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Filtrar por ejecutivo" />
                        </SelectTrigger>
                        <SelectContent>
                            {uniqueEjecutivos.map(ejecutivo => (
                                <SelectItem key={ejecutivo} value={ejecutivo}>
                                    {ejecutivo === 'all' ? 'Todos los ejecutivos' : ejecutivo}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar clientes..." 
                  className="w-full pl-8" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="border rounded-lg mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell">RUC</TableHead>
                  <TableHead className="hidden lg:table-cell">Ejecutivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden md:table-cell">Dirección</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  paginatedClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell>
                        <div className="font-medium">{client.nombre_cliente}</div>
                        <div className="text-sm text-muted-foreground md:hidden">{client.ruc}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{client.ruc}</TableCell>
                      <TableCell className="hidden lg:table-cell">{client.ejecutivo}</TableCell>
                      <TableCell>
                        <Badge variant={(client.status ?? 'active') === 'active' ? 'success' : 'destructive'}>
                          {(client.status ?? 'active') === 'active' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{client.direccion}</TableCell>
                      <TableCell className="text-right">
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
        <CardFooter>
            <div className="flex items-center justify-between w-full">
                <div className="text-xs text-muted-foreground">
                Mostrando <strong>{paginatedClients.length}</strong> de <strong>{filteredClients.length}</strong> clientes
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        Anterior
                    </Button>
                    <span className="text-sm font-medium">
                        Página {currentPage} de {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                    >
                        Siguiente
                    </Button>
                </div>
            </div>
        </CardFooter>
      </Card>
    </>
  );
}
