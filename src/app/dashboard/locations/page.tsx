
'use client';
import { useEffect, useState, useRef, useMemo } from 'react';
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
import { updateClientLocations } from '@/lib/firebase/firestore';
import type { Client } from '@/lib/types';
import { UploadCloud, Edit } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientMap } from '@/components/client-map';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import { useAuth } from '@/hooks/use-auth';

type LocationData = {
  RUC: string;
  Provincia: string;
  Canton: string;
  Direccion: string;
  Latitud: string;
  Longitud: string;
}

const ITEMS_PER_PAGE = 10;

export default function LocationsPage() {
  const { clients, loading, refetchData } = useAuth();
  const [filters, setFilters] = useState({ provincia: '', canton: '', direccion: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();


  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const filteredClients = useMemo(() => {
    let result = clients;
    if (filters.provincia) {
      result = result.filter(c => c.provincia.toLowerCase().includes(filters.provincia.toLowerCase()));
    }
    if (filters.canton) {
      result = result.filter(c => c.canton.toLowerCase().includes(filters.canton.toLowerCase()));
    }
    if (filters.direccion) {
      result = result.filter(c => c.direccion.toLowerCase().includes(filters.direccion.toLowerCase()));
    }
    return result;
  }, [filters, clients]);

  const paginatedClients = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredClients.slice(startIndex, endIndex);
  }, [filteredClients, currentPage]);

  const totalPages = Math.ceil(filteredClients.length / ITEMS_PER_PAGE);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };
  
  const handleEdit = (clientId: string) => {
    router.push(`/dashboard/clients/${clientId}`);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    Papa.parse<LocationData>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const requiredColumns = ['RUC', 'Provincia', 'Canton', 'Direccion', 'Latitud', 'Longitud'];
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
            Latitud: parseFloat(row.Latitud?.replace(',', '.')),
            Longitud: parseFloat(row.Longitud?.replace(',', '.'))
        }));

        const validData = dataWithParsedCoords.filter(row => 
            row.RUC && row.Provincia && row.Canton && row.Direccion && !isNaN(row.Latitud) && !isNaN(row.Longitud)
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
            const locationsToUpdate = validData.map(item => ({
                ruc: item.RUC,
                provincia: item.Provincia,
                canton: item.Canton,
                direccion: item.Direccion,
                latitud: item.Latitud,
                longitud: item.Longitud,
            }));

          await updateClientLocations(locationsToUpdate);

          toast({
            title: 'Carga exitosa',
            description: `${validData.length} ubicaciones de clientes han sido actualizadas.`,
          });
          await refetchData('clients'); 
        } catch (error: any) {
          console.error("Failed to update client locations:", error);
          if (error.code === 'permission-denied') {
            toast({
              title: 'Error de Permisos',
              description: 'No tienes permiso para actualizar ubicaciones. Revisa las reglas de seguridad de Firestore.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Error en la carga',
              description: 'Ocurrió un error al actualizar las ubicaciones.',
              variant: 'destructive',
            });
          }
        } finally {
          setIsUploading(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          document.getElementById('close-dialog')?.click();
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

  return (
    <>
      <PageHeader title="Ubicaciones" description="Gestiona y visualiza las ubicaciones de tus clientes.">
        <Dialog>
          <DialogTrigger asChild>
            <Button>
              <UploadCloud className="mr-2 h-4 w-4" />
              Subir Excel/CSV
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Carga Masiva de Ubicaciones</DialogTitle>
              <DialogDescription>
                Sube un archivo CSV para actualizar las ubicaciones de los clientes. El archivo debe contener las columnas: RUC, Provincia, Canton, Direccion, Latitud, Longitud. El RUC se usará para encontrar al cliente.
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
                    <Button type="button" variant="secondary" id="close-dialog">
                        Cerrar
                    </Button>
                </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageHeader>
      
      <div className="grid grid-cols-1 gap-6">
        <Card>
            <CardHeader>
            <CardTitle>Listado de Ubicaciones de Clientes</CardTitle>
            <CardDescription>Filtra y busca las ubicaciones de los clientes.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                    <Input placeholder="Filtrar por Provincia..." name="provincia" value={filters.provincia} onChange={handleFilterChange} />
                    <Input placeholder="Filtrar por Cantón..." name="canton" value={filters.canton} onChange={handleFilterChange} />
                    <Input placeholder="Filtrar por Dirección..." name="direccion" value={filters.direccion} onChange={handleFilterChange} />
                </div>
                <div className="border rounded-lg max-h-[60vh] overflow-auto">
                    <Table>
                    <TableHeader className="sticky top-0 bg-card">
                        <TableRow>
                        <TableHead>Nombre Comercial</TableHead>
                        <TableHead>Provincia</TableHead>
                        <TableHead className="hidden sm:table-cell">Cantón</TableHead>
                        <TableHead>Dirección</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <TableRow key={i}>
                            <TableCell><Skeleton className="h-5 w-3/4" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                            <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-full" /></TableCell>
                            <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-8 w-8 ml-auto" /></TableCell>
                            </TableRow>
                        ))
                        ) : (
                        paginatedClients.map((client) => (
                            <TableRow key={client.id}>
                            <TableCell>
                                <div className="font-medium">{client.nombre_comercial}</div>
                                <div className="text-sm text-muted-foreground">{client.ruc}</div>
                            </TableCell>
                            <TableCell>{client.provincia}</TableCell>
                            <TableCell className="hidden sm:table-cell">{client.canton}</TableCell>
                            <TableCell>{client.direccion}</TableCell>
                            <TableCell className="text-right">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(client.id)}>
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Editar</span>
                                </Button>
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
        
        <Card>
            <CardHeader>
                <CardTitle>Previsualización en Mapa</CardTitle>
                <CardDescription>Ubicaciones de los clientes filtrados.</CardDescription>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-[400px] w-full" /> : <ClientMap clients={filteredClients} />}
            </CardContent>
        </Card>
      </div>
    </>
  );
}
