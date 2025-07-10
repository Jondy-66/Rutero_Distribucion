'use client';
import { useEffect, useState, useRef } from 'react';
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
import { getClients, updateClientLocations } from '@/lib/firebase/firestore';
import type { Client } from '@/lib/types';
import { UploadCloud } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ClientMap } from '@/components/client-map';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';

type LocationData = {
  RUC: string;
  Provincia: string;
  Canton: string;
  Direccion: string;
  Latitud: string;
  Longitud: string;
}

export default function LocationsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ provincia: '', canton: '', direccion: '' });
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchClients = async () => {
    setLoading(true);
    try {
      const clientsData = await getClients();
      setClients(clientsData);
      setFilteredClients(clientsData);
    } catch (error: any) {
      console.error("Failed to fetch clients:", error);
      if (error.code === 'permission-denied') {
        toast({ title: "Error de Permisos", description: "No se pudieron cargar los clientes. Revisa las reglas de seguridad de Firestore.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: "No se pudieron cargar los clientes.", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  useEffect(() => {
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
    setFilteredClients(result);
  }, [filters, clients]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
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
          await fetchClients(); 
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
                            </TableRow>
                        ))
                        ) : (
                        filteredClients.map((client) => (
                            <TableRow key={client.id}>
                            <TableCell>
                                <div className="font-medium">{client.nombre_comercial}</div>
                                <div className="text-sm text-muted-foreground">{client.ruc}</div>
                            </TableCell>
                            <TableCell>{client.provincia}</TableCell>
                            <TableCell className="hidden sm:table-cell">{client.canton}</TableCell>
                            <TableCell>{client.direccion}</TableCell>
                            </TableRow>
                        ))
                        )}
                    </TableBody>
                    </Table>
                </div>
            </CardContent>
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
