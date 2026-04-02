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
import { PlusCircle, UploadCloud, Search, MoreHorizontal, Download, Users, CheckCircle2, ArrowRightLeft, LoaderCircle } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
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
  const [isUploadFinished, setIsUploadFinished] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Estados para Migración
  const [isMigrateDialogOpen, setIsMigrateDialogOpen] = useState(false);
  const [sourceExecutive, setSourceExecutive] = useState('');
  const [targetExecutive, setTargetExecutive] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);

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

        if (operationCount === 450 || i === total - 1) {
            await currentBatch.commit();
            currentBatch = writeBatch(db);
            operationCount = 0;
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        setUploadProgress(Math.round(((i + 1) / total) * 100));
      }

      setUploadProgress(100);
      setIsUploadFinished(true);
      setIsUploading(false);
      
      toast({
        title: '¡Importación Finalizada!',
        description: `${addedCount} clientes añadidos y ${updatedCount} actualizados con éxito.`,
      });

      setTimeout(async () => {
        await refetchData('clients');
        document.getElementById('close-dialog-clients')?.click();
      }, 1200);

    } catch (error: any) {
      console.error("Batch import error:", error);
      toast({
        title: 'Error en la carga',
        description: 'Ocurrió un fallo al procesar los datos en lote.',
        variant: 'destructive',
      });
      setIsUploading(false);
    }
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setIsUploadFinished(false);
    setUploadProgress(0);

    if (file.name.endsWith('.csv')) {
        Papa.parse<ClientCsvData>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processImportedData(results.data, results.meta.fields),
        error: () => {
            toast({ title: 'Error', description: 'No se pudo procesar el CSV.', variant: 'destructive' });
            setIsUploading(false);
        }
        });
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json: ClientCsvData[] = XLSX.utils.sheet_to_json(sheet);
                processImportedData(json, json.length > 0 ? Object.keys(json[0]) : []);
            } catch (err) {
                console.error("Excel processing error:", err);
                toast({ title: 'Error', description: 'No se pudo procesar el archivo Excel.', variant: 'destructive' });
                setIsUploading(false);
            }
        };
        reader.onerror = () => {
            toast({ title: 'Error', description: 'Error al leer el archivo.', variant: 'destructive' });
            setIsUploading(false);
        };
        reader.readAsBinaryString(file);
    }
  };

  const handleMigrateClients = async () => {
    if (!sourceExecutive || !targetExecutive || sourceExecutive === targetExecutive) {
        toast({ title: "Atención", description: "Selecciona dos ejecutivos diferentes.", variant: "destructive" });
        return;
    }

    setIsMigrating(true);
    try {
        const clientsToMigrate = clients.filter(c => c.ejecutivo === sourceExecutive);
        
        if (clientsToMigrate.length === 0) {
            toast({ title: "Sin Clientes", description: `El ejecutivo ${sourceExecutive} no tiene clientes asignados.`, variant: "destructive" });
            setIsMigrating(false);
            return;
        }

        const total = clientsToMigrate.length;
        let currentBatch = writeBatch(db);
        let count = 0;

        for (let i = 0; i < total; i++) {
            const client = clientsToMigrate[i];
            const clientRef = doc(db, 'clients', client.id);
            currentBatch.update(clientRef, { ejecutivo: targetExecutive });
            count++;

            // Límites de batch de Firestore
            if (count === 450 || i === total - 1) {
                await currentBatch.commit();
                currentBatch = writeBatch(db);
                count = 0;
                // Pequeña pausa para no saturar la red si el batch es gigante
                await new Promise(r => setTimeout(r, 50));
            }
        }

        toast({ 
            title: "Migración Exitosa", 
            description: `Se han transferido ${total} clientes de ${sourceExecutive} a ${targetExecutive}.` 
        });
        
        await refetchData('clients');
        setIsMigrateDialogOpen(false);
        setSourceExecutive('');
        setTargetExecutive('');
    } catch (error) {
        console.error("Migration error:", error);
        toast({ title: "Error", description: "Ocurrió un fallo durante la transferencia masiva.", variant: "destructive" });
    } finally {
        setIsMigrating(false);
    }
  };

  const uniqueEjecutivos = useMemo(() => {
    const ejecutivos = new Set(clients.map(c => c.ejecutivo).filter(Boolean));
    return ['all', ...Array.from(ejecutivos)];
  }, [clients]);

  const executivesForMigration = useMemo(() => {
    return uniqueEjecutivos.filter(e => e !== 'all');
  }, [uniqueEjecutivos]);

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
        const rucStr = String(client.ruc || '');
        return (
          String(client.nombre_cliente || '').toLowerCase().includes(search) ||
          String(client.nombre_comercial || '').toLowerCase().includes(search) ||
          rucStr.includes(search)
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
  
  const isAdmin = user?.role === 'Administrador';
  const canImport = isAdmin || user?.permissions?.includes('import-clients');
  const canDelete = isAdmin || user?.permissions?.includes('delete-clients');

  return (
    <>
      <PageHeader title="Clientes" description="Gestión y carga masiva de cartera.">
        <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/clients/new"><Button className="font-black"><PlusCircle className="mr-2 h-4 w-4" /> Añadir</Button></Link>
            
            {isAdmin && (
                <Dialog open={isMigrateDialogOpen} onOpenChange={setIsMigrateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="font-black border-2 border-primary text-primary hover:bg-primary/5">
                            <ArrowRightLeft className="mr-2 h-4 w-4" /> Migrar Cartera
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md rounded-2xl border-none shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black uppercase text-slate-950">Migrar Clientes</DialogTitle>
                            <DialogDescription className="text-xs font-bold uppercase text-slate-500">
                                Transfiere todos los clientes de un ejecutivo hacia otro de forma masiva.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6 py-6">
                            <div className="space-y-2">
                                <Label className="font-black uppercase text-[10px] text-slate-950">Ejecutivo de Origen (Quien entrega)</Label>
                                <Select value={sourceExecutive} onValueChange={setSourceExecutive} disabled={isMigrating}>
                                    <SelectTrigger className="h-12 border-2 border-slate-200 font-black text-slate-950">
                                        <SelectValue placeholder="Seleccionar origen..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {executivesForMigration.map(e => <SelectItem key={e} value={e} className="font-black">{e}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="flex justify-center">
                                <div className="bg-primary/10 p-2 rounded-full">
                                    <ArrowRightLeft className="h-6 w-6 text-primary rotate-90" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="font-black uppercase text-[10px] text-slate-950">Ejecutivo de Destino (Quien recibe)</Label>
                                <Select value={targetExecutive} onValueChange={setTargetExecutive} disabled={isMigrating}>
                                    <SelectTrigger className="h-12 border-2 border-slate-200 font-black text-slate-950">
                                        <SelectValue placeholder="Seleccionar destino..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {executivesForMigration.map(e => <SelectItem key={e} value={e} className="font-black">{e}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter className="gap-2">
                            <DialogClose asChild><Button variant="ghost" className="font-black uppercase" disabled={isMigrating}>Cancelar</Button></DialogClose>
                            <Button 
                                onClick={handleMigrateClients} 
                                className="font-black uppercase h-12 shadow-lg" 
                                disabled={isMigrating || !sourceExecutive || !targetExecutive}
                            >
                                {isMigrating ? <><LoaderCircle className="animate-spin mr-2 h-4 w-4" /> Procesando...</> : 'Confirmar Migración'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {canImport && (
                <Dialog onOpenChange={(open) => {
                    if(!open) {
                        setUploadProgress(0);
                        setIsUploadFinished(false);
                        setIsUploading(false);
                    }
                }}>
                    <DialogTrigger asChild><Button variant="outline" className="font-black"><UploadCloud className="mr-2 h-4 w-4" /> Importar</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="font-black uppercase">Importación Masiva</DialogTitle>
                            <DialogDescription className="font-bold text-xs">Columnas requeridas: Ejecutivo, Ruc, Nombre_cliente, Nombre_comercial, Canton, Direccion, Provincia.</DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Input type="file" accept=".csv, .xlsx, .xls" ref={fileInputRef} onChange={handleFileUpload} disabled={isUploading} className="h-12 font-black border-2" />
                        </div>
                        <div className="space-y-3 pb-4">
                            <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-950">
                                <span className={cn(
                                    isUploading ? "text-primary animate-pulse" : 
                                    isUploadFinished ? "text-green-600 flex items-center gap-1" : "text-muted-foreground"
                                )}>
                                    {isUploading ? `Procesando registros...` : 
                                     isUploadFinished ? <><CheckCircle2 className="h-3 w-3" /> Carga completada con éxito</> : 
                                     'Esperando archivo...'}
                                </span>
                                {(isUploading || isUploadFinished) && (
                                    <span className={cn(
                                        "font-black text-xs px-2 py-0.5 rounded-full",
                                        isUploadFinished ? "bg-green-100 text-green-700" : "bg-primary/10 text-primary"
                                    )}>
                                        {uploadProgress}%
                                    </span>
                                )}
                            </div>
                            {(isUploading || isUploadFinished) && (
                                <Progress value={uploadProgress} className={cn("h-2 bg-slate-100", isUploadFinished && "[&>div]:bg-green-500")} />
                            )}
                        </div>
                        <DialogFooter>
                            <DialogClose asChild><Button type="button" variant="secondary" id="close-dialog-clients" className="font-black">Cerrar</Button></DialogClose>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
            <Button variant="outline" onClick={handleDownloadExcel} className="font-black"><Download className="mr-2 h-4 w-4" /> Excel</Button>
        </div>
      </PageHeader>
      
      <Card className="border-t-4 border-t-primary shadow-xl">
        <CardHeader>
          <CardTitle className="font-black uppercase text-slate-950">Lista de Clientes</CardTitle>
          <CardDescription className="font-bold text-[10px] uppercase text-slate-500">Base de datos completa de clientes asignados en el sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <Tabs defaultValue="all" onValueChange={setFilter} className="w-full sm:w-auto">
              <TabsList className="bg-slate-100 p-1 border-2 border-slate-200 rounded-xl">
                <TabsTrigger value="all" className="font-black uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:text-primary">Todos</TabsTrigger>
                <TabsTrigger value="active" className="font-black uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:text-green-600">Activos</TabsTrigger>
                <TabsTrigger value="inactive" className="font-black uppercase text-[10px] data-[state=active]:bg-white data-[state=active]:text-destructive">Inactivos</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
                {(user?.role === 'Administrador' || user?.role === 'Supervisor' || user?.role === 'Auditor') && (
                    <Select value={selectedEjecutivo} onValueChange={setSelectedEjecutivo}>
                        <SelectTrigger className="w-full sm:w-[200px] h-11 border-2 border-slate-200 font-black text-slate-950 rounded-xl">
                            <Users className="mr-2 h-4 w-4 text-primary" />
                            <SelectValue placeholder="Ejecutivo" />
                        </SelectTrigger>
                        <SelectContent>{uniqueEjecutivos.map(e => <SelectItem key={e} value={e} className="font-black">{e === 'all' ? 'Todos los Ejecutivos' : e}</SelectItem>)}</SelectContent>
                    </Select>
                )}
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-950 font-black" />
                <Input placeholder="Buscar por RUC o Nombre..." className="h-11 pl-10 border-2 border-slate-200 font-black text-slate-950 rounded-xl" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="border-2 border-slate-100 rounded-2xl overflow-hidden shadow-inner">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-black text-slate-950 uppercase text-[10px] h-12">Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell font-black text-slate-950 uppercase text-[10px]">RUC</TableHead>
                  <TableHead className="hidden lg:table-cell font-black text-slate-950 uppercase text-[10px]">Ejecutivo</TableHead>
                  <TableHead className="font-black text-slate-950 uppercase text-[10px]">Estado</TableHead>
                  <TableHead className="text-right font-black text-slate-950 uppercase text-[10px]">Acciones</TableHead>
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
                    <TableRow key={client.id} className="hover:bg-slate-50/50">
                      <TableCell><div className="font-black text-slate-950 text-xs uppercase">{client.nombre_cliente}</div></TableCell>
                      <TableCell className="hidden sm:table-cell font-mono font-bold text-slate-600">{client.ruc}</TableCell>
                      <TableCell className="hidden lg:table-cell font-black text-primary text-[10px] uppercase">{client.ejecutivo}</TableCell>
                      <TableCell><Badge variant={(client.status ?? 'active') === 'active' ? 'success' : 'destructive'} className="font-black text-[9px] uppercase border-none">{(client.status ?? 'active') === 'active' ? 'Activo' : 'Inactivo'}</Badge></TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="hover:bg-slate-100 rounded-full"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuLabel className="font-black text-[10px] uppercase text-slate-500">Opciones</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleEdit(client.id)} className="font-black text-xs uppercase">Editar Ficha</DropdownMenuItem>
                              {canDelete && <AlertDialogTrigger asChild><DropdownMenuItem className="text-red-600 font-black text-xs uppercase">Eliminar</DropdownMenuItem></AlertDialogTrigger>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                           <AlertDialogContent className="rounded-2xl border-none">
                            <AlertDialogHeader><AlertDialogTitle className="font-black uppercase text-slate-950">¿Eliminar cliente?</AlertDialogTitle></AlertDialogHeader>
                            <AlertDialogDescription className="font-bold text-xs uppercase">Esta acción eliminará la ficha de {client.nombre_cliente} permanentemente.</AlertDialogDescription>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="font-black">Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(client.id)} className="bg-destructive hover:bg-destructive/90 font-black">ELIMINAR</AlertDialogAction>
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
        <CardFooter className="flex justify-between items-center bg-slate-50 p-6 rounded-b-2xl border-t-2 border-slate-100">
            <div className="text-[10px] font-black uppercase text-slate-500">Mostrando {paginatedClients.length} de {filteredClients.length} registros</div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1} className="font-black uppercase text-[10px] h-9 border-2">Anterior</Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages} className="font-black uppercase text-[10px] h-9 border-2">Siguiente</Button>
            </div>
        </CardFooter>
      </Card>
    </>
  );
}
