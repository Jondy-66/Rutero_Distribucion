
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

// Mock data until we have a real data source
const mockPhoneBaseClients: any[] = [];
const loading = false;

export default function PhoneBasePage() {
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const filteredClients = useMemo(() => {
    if (!searchTerm) return mockPhoneBaseClients;
    return mockPhoneBaseClients.filter(client =>
      Object.values(client).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [searchTerm]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    // Placeholder for file upload logic
    toast({ title: "Función no implementada", description: "La lógica para procesar el archivo será añadida pronto." });
  };
  
  const handleImport = () => {
    toast({ title: "Función no implementada", description: "La lógica de importación se conectará aquí." });
  }

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
                            <Input id="cedula" placeholder="Ej: 1712345678" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="nombre_cliente">Nombre del Cliente</Label>
                            <Input id="nombre_cliente" placeholder="Ej: Juan Antonio Pérez" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nombre_comercial">Nombre Comercial</Label>
                            <Input id="nombre_comercial" placeholder="Ej: Supermercado El Ahorro" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="ciudad">Ciudad</Label>
                            <Input id="ciudad" placeholder="Ej: Quito" />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="regional">Regional</Label>
                            <Input id="regional" placeholder="Ej: Sierra" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="nombre_vendedor">Nombre del Vendedor</Label>
                            <Input id="nombre_vendedor" placeholder="Ej: Ana Lucía Martínez" />
                        </div>
                         <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="direccion">Dirección del Cliente</Label>
                            <Input id="direccion" placeholder="Ej: Av. Amazonas y Eloy Alfaro" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="telefono1">Teléfono 1</Label>
                            <Input id="telefono1" placeholder="Ej: 0991234567" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="estado_cliente">Estado Cliente</Label>
                            <Select>
                                <SelectTrigger id="estado_cliente">
                                    <SelectValue placeholder="Seleccionar estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="activo">Activo</SelectItem>
                                    <SelectItem value="inactivo">Inactivo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <Label htmlFor="observacion">Observación</Label>
                            <Textarea id="observacion" placeholder="Añadir una observación..." />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit">Guardar Contacto</Button>
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
                            Sube un archivo para añadir o actualizar la Base Telefónica. Columnas requeridas: CEDULA, NOMBRE DEL CLIENTE, NOMBRE COMERCIAL, CIUDAD, REGIONAL, NOMBRE DEL VENDEDOR, DIRECCION DEL CLIENTE, TELEFONO 1, ESTADO CLIENTE, OBSERVACION.
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
                        <div className="flex gap-2">
                             <Button type="button" onClick={handleImport} disabled={isUploading}>
                                Importar
                            </Button>
                            <DialogClose asChild>
                                <Button type="button" variant="secondary" id="close-dialog-clients">
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
                ) : filteredClients.length > 0 ? (
                  filteredClients.map((client) => (
                    <TableRow key={client.id}>
                        {/* Placeholder cells for when data is connected */}
                        <TableCell>{client.nombre_cliente}</TableCell>
                        <TableCell className="hidden sm:table-cell">{client.cedula}</TableCell>
                        <TableCell className="hidden lg:table-cell">{client.telefono1}</TableCell>
                        <TableCell>{client.ciudad}</TableCell>
                        <TableCell>{client.nombre_vendedor}</TableCell>
                        <TableCell>{client.estado_cliente}</TableCell>
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
            <div className="text-xs text-muted-foreground">
                Mostrando <strong>{filteredClients.length}</strong> de <strong>{mockPhoneBaseClients.length}</strong> contactos.
            </div>
        </CardFooter>
      </Card>
    </>
  );
}
