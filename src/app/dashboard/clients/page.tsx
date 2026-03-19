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
import { deleteClient } from '@/lib/firebase/firestore';
import { db } from '@/lib/firebase/config';
import { writeBatch, doc, collection } from 'firebase/firestore';
import type { Client } from '@/lib/types';
import { PlusCircle, UploadCloud, Search, MoreHorizontal, Download, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
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
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

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
  const [uploadProgress, setUploadProgress] = useState(0);
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
    
    const normalizedData = data.map(row => {
        const newRow: ClientCsvData = {};
        for(const key in row) {
            newRow[key.trim().toLowerCase().replace(/ /g, '').replace(/_/g, '')] = row[key];
        }
        return newRow;
    });

    const validData = normalizedData.filter(row => row.ruc && (row.nombrecliente || row.nombre_cliente));

    if (validData.length === 0) {
        toast({
            title: 'Sin datos válidos',
            description: `No se encontraron filas con RUC y Nombre de Cliente válidos.`,
            variant: 'destructive',
        });
        setIsUploading(false);
        return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const rucsInDb = new Map(clients.map(c => [String(c.ruc).trim(), c.id]));
      let addedCount = 0;
      let updatedCount = 0;

      const clientsToProcess = validData.map(item => ({
          ejecutivo: item.ejecutivo || '',
          ruc: String(item.ruc).trim(),
          nombre_cliente: item.nombrecliente || item.nombre_cliente || '',
          nombre_comercial: item.nombrecomercial || item.nombre_comercial || '',
          provincia: item.provincia || '',
          canton: item.canton || '',
          direccion: item.direccion || '',
          latitud: parseFloat(String(item.latitudtrz || item.latitud || '0').replace(',', '.')) || 0,
          longitud: parseFloat(String(item.longitudtrz || item.longitud || '0').replace(',', '.')) || 0,
      }));
      
      const total = clientsToProcess.length;
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      for (let i = 0; i < total; i++) {
        const clientData = clientsToProcess[i];
        
        if(rucsInDb.has(clientData.ruc)) {
            const clientId = rucsInDb.get(clientData.ruc)!;
            const clientRef = doc(db, 'clients', clientId);
            currentBatch.update(clientRef, clientData);
            updatedCount++;
        } else {
            const newClientRef = doc(collection(db, 'clients'));
            currentBatch.set(newClientRef, {...clientData, status: 'active'});
            addedCount++;
        }

        operationCount++;

        // Firestore permite hasta 500 operaciones por batch
        if (operationCount === 450 || i === total - 1) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            operationCount = 0;
            // Pequeña pausa para permitir que React actualice la UI del progreso
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        setUploadProgress(Math.round(((i + 1) / total) * 100));
      }

      toast({
        title: 'Carga exitosa',
        description: `${addedCount} clientes añadidos y ${updatedCount} actualizados.`,
      });
      await refetchData('clients');
    } catch (error: any) {
      console.error("Batch import error:", error);
      toast({
        title: 'Error en la carga',
        description: 'Ocurrió un fallo al procesar los datos en lote.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
      document.getElementById('close-dialog-clients')?.click();
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.csv')) {
        Papa.parse<ClientCsvData>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processImportedData(results.data, results.meta.fields),
        error: () => toast({ title: 'Error', description: 'No se pudo procesar el CSV.', variant: 'destructive' })
        });
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const json: ClientCsvData[] = XLSX.utils.sheet_to_json(XLSX.utils.book_get_sheet_by_name(workbook, workbook.SheetNames[0]));
            processImportedData(json, json.length > 0 ? Object.keys(json[0]) : []);
        };
        reader.readAsBinaryString(file);
    }
  };

  const uniqueEjecutivos = useMemo(() => {
    const ejecutivos = new Set(clients.map(c => c.ejecutivo).filter(Boolean));
    return ['all', ...Array.from(ejecutivos)];
  }, [clients]);

  const filteredClients = useMemo(() => {
    return clients
      .filter(client => {
        if (user?.role === 'Usuario') return client.ejecutivo === user.name;
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
          String(client.ruc).toLowerCase().includes(search)
        );
      });
  }, [clients, filter, searchTerm, user, selectedEjecutivo]);
  
  const paginatedClients = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredClients.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredClients, currentPage]);

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);

  const handleDownloadExcel = () => {
    if (filteredClients.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(filteredClients);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Clientes");
    XLSX.writeFile(workbook, "reporte_clientes.xlsx");
  };
  
  const canImport = user?.role === 'Administrador' || user?.permissions?.includes('import-clients');
  const canDelete = user?.role === 'Administrador' || user?.permissions?.includes('delete-clients');

  return (
    <>
      <PageHeader title="Clientes" description="Gestión y carga masiva de cartera.">
        <div className="flex gap-2">
            <Link href="/dashboard/clients/new"><Button><PlusCircle className="mr-2 h-4 w-4" /> Añadir</Button></Link>
            {canImport && (
                <Dialog onOpenChange={(open) => !open && setUploadProgress(0)}>
                    <DialogTrigger asChild><Button variant="outline"><UploadCloud className="mr-2 h-4 w-4" /> Importar</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Importación Masiva</DialogTitle>
                            <DialogDescription>Columnas requeridas: Ejecutivo, Ruc, Nombre_cliente, Nombre_comercial, Canton, Direccion, Provincia.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} disabled={isUploading} />
                        </div>
                        <div className="space-y-3 pb-4">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                <span className={cn(isUploading ? "text-primary animate-pulse" : "text-muted-foreground")}>
                                    {isUploading ? `Procesando registros...` : 'Esperando archivo...'}
                                </span>
                                {isUploading && (
                                    <span className="text-primary font-black text-xs bg-primary/10 px-2 py-0.5 rounded-full">
                                        {uploadProgress}%
                                    </span>
                                )}
                            </div>
                            {isUploading && (
                                <Progress value={uploadProgress} className="h-2 bg-slate-100" />
                            )}
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary" id="close-dialog-clients">Cerrar</Button></DialogClose>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
            <Button variant="outline" onClick={handleDownloadExcel}><Download className="mr-2 h-4 w-4" /> Excel</Button>
        </div>
      </PageHeader>
      
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes</CardTitle>
          <CardDescription>Base de datos completa de clientes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
            <Tabs defaultValue="all" onValueChange={setFilter}>
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="active">Activos</TabsTrigger>
                <TabsTrigger value="inactive">Inactivos</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
                {(user?.role === 'Administrador' || user?.role === 'Supervisor') && (
                    <Select value={selectedEjecutivo} onValueChange={setSelectedEjecutivo}>
                        <SelectTrigger className="w-full sm:w-[180px]"><Users className="mr-2 h-4 w-4" /><SelectValue placeholder="Ejecutivo" /></SelectTrigger>
                        <SelectContent>{uniqueEjecutivos.map(e => <SelectItem key={e} value={e}>{e === 'all' ? 'Todos' : e}</SelectItem>)}</SelectContent>
                    </Select>
                )}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell">RUC</TableHead>
                  <TableHead className="hidden lg:table-cell">Ejecutivo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  paginatedClients.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell><div className="font-medium text-slate-900">{client.nombre_cliente}</div></TableCell>
                      <TableCell className="hidden sm:table-cell">{client.ruc}</TableCell>
                      <TableCell className="hidden lg:table-cell">{client.ejecutivo}</TableCell>
                      <TableCell><Badge variant={(client.status ?? 'active') === 'active' ? 'success' : 'destructive'}>{(client.status ?? 'active') === 'active' ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(client.id)}>Editar</DropdownMenuItem>
                              {canDelete && <AlertDialogTrigger asChild><DropdownMenuItem className="text-red-600">Eliminar</DropdownMenuItem></AlertDialogTrigger>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                           <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle></AlertDialogHeader>
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
        <CardFooter className="flex justify-between text-xs text-muted-foreground">
            <div>Mostrando {paginatedClients.length} de {filteredClients.length}</div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Anterior</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Siguiente</Button>
            </div>
        </CardFooter>
      </Card>
    </>
  );
}
