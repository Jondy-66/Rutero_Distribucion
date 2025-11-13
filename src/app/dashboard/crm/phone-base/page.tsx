

'use client';

import { useState, useMemo, useRef } from 'react';
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
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { PlusCircle, UploadCloud, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import type { PhoneContact } from '@/lib/types';
import { addPhoneContact, addPhoneContactsBatch } from '@/lib/firebase/firestore';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';


type ContactCsvData = {
    [key: string]: string;
}

const ITEMS_PER_PAGE = 10;

export default function PhoneBasePage() {
  const { phoneContacts, loading, refetchData } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [newContact, setNewContact] = useState<Omit<PhoneContact, 'id'>>({
      cedula: '',
      nombre_cliente: '',
      nombre_comercial: '',
      ciudad: '',
      regional: '',
      nombre_vendedor: '',
      direccion_cliente: '',
      telefono1: '',
      estado_cliente: 'Activo',
      observacion: '',
  });

  const filteredContacts = useMemo(() => {
    if (!searchTerm) return phoneContacts;
    return phoneContacts.filter(contact =>
      Object.values(contact).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm, phoneContacts]);

  const paginatedContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredContacts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredContacts, currentPage]);

  const totalPages = Math.ceil(filteredContacts.length / ITEMS_PER_PAGE);
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { id, value } = e.target;
      setNewContact(prev => ({...prev, [id]: value}));
  }

  const handleStateChange = (value: 'Activo' | 'Inactivo') => {
      setNewContact(prev => ({...prev, estado_cliente: value}));
  }

  const handleAddContact = async () => {
    if (!newContact.cedula || !newContact.nombre_cliente) {
        toast({ title: 'Campos requeridos', description: 'Cédula y Nombre del Cliente son obligatorios.', variant: 'destructive' });
        return;
    }
    setIsSaving(true);
    try {
        await addPhoneContact(newContact);
        toast({ title: 'Éxito', description: 'Nuevo contacto añadido a la base telefónica.' });
        await refetchData('phoneContacts');
        document.getElementById('close-add-dialog')?.click();
        setNewContact({
          cedula: '', nombre_cliente: '', nombre_comercial: '', ciudad: '', regional: '',
          nombre_vendedor: '', direccion_cliente: '', telefono1: '', estado_cliente: 'Activo', observacion: ''
        });
    } catch (error: any) {
        console.error("Error adding contact:", error);
        toast({ title: 'Error', description: 'No se pudo añadir el contacto.', variant: 'destructive'});
    } finally {
        setIsSaving(false);
    }
  }
  
  const processImportedData = async (data: ContactCsvData[], fields: string[] | undefined) => {
    const requiredColumns = ['cedula', 'nombredelcliente', 'nombrecomercial', 'ciudad', 'regional', 'nombredelvendedor', 'direcciondelcliente', 'telefono1', 'estadocliente'];
    
    // Normalize headers for validation
    const headers = (fields || []).map(h => h.toString().trim().toLowerCase().replace(/ /g, '').replace(/_/g, ''));
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));

    if (missingColumns.length > 0) {
      toast({
        title: 'Error de formato',
        description: `Faltan columnas requeridas: ${missingColumns.join(', ')}`,
        variant: 'destructive',
      });
      setIsUploading(false);
      return;
    }
    
    // Normalize keys in data objects for consistent access
    const normalizedData = data.map(row => {
        const newRow: ContactCsvData = {};
        for(const key in row) {
            newRow[key.trim().toLowerCase().replace(/ /g, '').replace(/_/g, '')] = row[key];
        }
        return newRow;
    });

    const validData = normalizedData.filter(row => row.cedula && row.nombredelcliente);

    const invalidRows = normalizedData.length - validData.length;
    if(invalidRows > 0) {
        toast({
            title: 'Datos inválidos',
            description: `Se omitieron ${invalidRows} filas por falta de Cédula o Nombre del Cliente.`,
        });
    }
    
    if (validData.length === 0) {
        toast({
            title: 'No hay datos válidos',
            description: 'No se encontraron filas con datos válidos para procesar.',
            variant: 'destructive',
        });
        setIsUploading(false);
        return;
    }

    try {
      const contactsToAdd: Omit<PhoneContact, 'id'>[] = validData.map(item => ({
          cedula: item.cedula || '',
          nombre_cliente: item.nombredelcliente || '',
          nombre_comercial: item.nombrecomercial || '',
          ciudad: item.ciudad || '',
          regional: item.regional || '',
          nombre_vendedor: item.nombredelvendedor || '',
          direccion_cliente: item.direcciondelcliente || '',
          telefono1: item.telefono1 || '',
          estado_cliente: (item.estadocliente === 'Activo' || item.estadocliente === 'Inactivo') ? item.estadocliente : 'Activo',
          observacion: item.observacion || '',
      }));
      
      await addPhoneContactsBatch(contactsToAdd);

      toast({
        title: 'Carga exitosa',
        description: `${contactsToAdd.length} contactos añadidos a la base telefónica.`,
      });
      await refetchData('phoneContacts');

    } catch (error: any) {
      console.error("Failed to add contacts batch:", error);
      toast({
        title: 'Error en la carga',
        description: 'Ocurrió un error al guardar los contactos.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      document.getElementById('close-import-dialog')?.click();
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const handleImport = () => {
    if (!selectedFile) {
        toast({ title: 'Sin archivo', description: 'Por favor, selecciona un archivo primero.', variant: 'destructive'});
        return;
    };

    setIsUploading(true);
    
     if (selectedFile.name.endsWith('.csv')) {
        Papa.parse<ContactCsvData>(selectedFile, {
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
    } else if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json: ContactCsvData[] = XLSX.utils.sheet_to_json(worksheet);
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
        reader.readAsBinaryString(selectedFile);
    } else {
        toast({ title: 'Formato no soportado', description: 'Por favor, sube un archivo CSV o Excel.', variant: 'destructive' });
        setIsUploading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Base Telefónica"
        description="Gestiona y consulta tu base de datos de contactos."
      >
        <div className="flex gap-2">
            <Dialog>
                <DialogTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Añadir
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[625px]">
                    <DialogHeader>
                        <DialogTitle>Añadir Nuevo Contacto</DialogTitle>
                        <DialogDescription>
                            Completa el formulario para añadir un nuevo contacto a la base telefónica.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="cedula">Cédula</Label>
                            <Input id="cedula" placeholder="Ej: 1712345678" value={newContact.cedula} onChange={handleInputChange} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="nombre_cliente">Nombre del Cliente</Label>
                            <Input id="nombre_cliente" placeholder="Ej: Juan Antonio Pérez" value={newContact.nombre_cliente} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nombre_comercial">Nombre Comercial</Label>
                            <Input id="nombre_comercial" placeholder="Ej: Supermercado El Ahorro" value={newContact.nombre_comercial} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ciudad">Ciudad</Label>
                            <Input id="ciudad" placeholder="Ej: Quito" value={newContact.ciudad} onChange={handleInputChange} />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="regional">Regional</Label>
                            <Input id="regional" placeholder="Ej: Sierra" value={newContact.regional} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nombre_vendedor">Nombre del Vendedor</Label>
                            <Input id="nombre_vendedor" placeholder="Ej: Ana Lucía Martínez" value={newContact.nombre_vendedor} onChange={handleInputChange} />
                        </div>
                         <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="direccion_cliente">Dirección del Cliente</Label>
                            <Input id="direccion_cliente" placeholder="Ej: Av. Amazonas y Eloy Alfaro" value={newContact.direccion_cliente} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="telefono1">Teléfono 1</Label>
                            <Input id="telefono1" placeholder="Ej: 0991234567" value={newContact.telefono1} onChange={handleInputChange} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="estado_cliente">Estado Cliente</Label>
                            <Select onValueChange={handleStateChange} value={newContact.estado_cliente}>
                                <SelectTrigger id="estado_cliente">
                                    <SelectValue placeholder="Seleccionar estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Activo">Activo</SelectItem>
                                    <SelectItem value="Inactivo">Inactivo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="observacion">Observación</Label>
                            <Textarea id="observacion" placeholder="Añadir una observación..." value={newContact.observacion} onChange={handleInputChange} />
                        </div>
                    </div>
                    <DialogFooter>
                       <DialogClose asChild>
                            <Button id="close-add-dialog" type="button" variant="secondary">Cerrar</Button>
                       </DialogClose>
                       <Button onClick={handleAddContact} disabled={isSaving}>
                           {isSaving ? "Guardando..." : "Guardar Contacto"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline">
                        <UploadCloud className="mr-2 h-4 w-4" />
                        Importar
                    </Button>
                </DialogTrigger>
                 <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Importar desde CSV o Excel</DialogTitle>
                        <DialogDescription>
                            Sube un archivo para añadir o actualizar la Base Telefónica. Columnas requeridas: CEDULA, NOMBRE DEL CLIENTE, NOMBRE COMERCIAL, CIUDAD, REGIONAL, NOMBRE DEL VENDEDOR, DIRECCION DEL CLIENTE, TELEFONO 1, ESTADO CLIENTE. La columna OBSERVACION es opcional.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                    <Input
                        type="file"
                        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        disabled={isUploading}
                    />
                    </div>
                    <DialogFooter className="sm:justify-between">
                        <span className="text-sm text-muted-foreground">{isUploading ? 'Procesando archivo...' : (selectedFile ? `Archivo listo: ${selectedFile.name}` : 'Selecciona un archivo para empezar.')}</span>
                        <div className="flex gap-2">
                             <Button type="button" onClick={handleImport} disabled={isUploading || !selectedFile}>
                                {isUploading ? 'Importando...' : 'Importar'}
                            </Button>
                            <DialogClose asChild>
                                <Button type="button" variant="secondary" id="close-import-dialog">
                                    Cerrar
                                </Button>
                            </DialogClose>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      </PageHeader>
      <Card>
        <CardHeader>
          <CardTitle>Lista de Clientes Base Telefónica</CardTitle>
          <CardDescription>Una lista de todos los contactos en tu base telefónica.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-end mb-4">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar contactos..."
                className="w-full pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="border rounded-lg mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell">Cédula</TableHead>
                  <TableHead className="hidden lg:table-cell">Teléfono</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedContacts.length > 0 ? (
                  paginatedContacts.map((contact) => (
                    <TableRow key={contact.id}>
                        <TableCell>{contact.nombre_cliente}</TableCell>
                        <TableCell className="hidden sm:table-cell">{contact.cedula}</TableCell>
                        <TableCell className="hidden lg:table-cell">{contact.telefono1}</TableCell>
                        <TableCell>{contact.ciudad}</TableCell>
                        <TableCell>{contact.nombre_vendedor}</TableCell>
                        <TableCell>{contact.estado_cliente}</TableCell>
                    </TableRow>
                  ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                            No hay contactos en la base telefónica.
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardFooter>
            <div className="flex items-center justify-between w-full">
                <div className="text-xs text-muted-foreground">
                    Mostrando <strong>{paginatedContacts.length}</strong> de <strong>{filteredContacts.length}</strong> contactos.
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
