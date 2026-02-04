'use client';
import { useEffect, useState, use } from 'react';
import { notFound, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Link from 'next/link';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getClient, updateClient } from '@/lib/firebase/firestore';
import type { Client } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { refetchData } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  useEffect(() => {
    const fetchClient = async () => {
      try {
        const clientData = await getClient(clientId);
        if (clientData) {
          setClient(clientData);
        } else {
          notFound();
        }
      } catch (error) {
        console.error("Failed to fetch client:", error);
        toast({ title: "Error", description: "No se pudo cargar el cliente.", variant: "destructive" });
        notFound();
      } finally {
        setLoading(false);
      }
    };
    if (clientId) {
      fetchClient();
    }
  }, [clientId, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!client) return;
    const { id, value } = e.target;
    setClient(prev => ({ ...prev!, [id]: value }));
  };

  const handleStatusChange = (value: 'active' | 'inactive') => {
    if (!client) return;
    setClient(prev => ({...prev!, status: value}));
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !client.ruc || !client.nombre_cliente) {
      toast({ title: "Error", description: "RUC y Nombre del Cliente son campos obligatorios.", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      const clientDataToUpdate = {
        ...client,
        latitud: parseFloat(String(client.latitud)) || 0,
        longitud: parseFloat(String(client.longitud)) || 0,
      };

      await updateClient(client.id, clientDataToUpdate);
      
      await refetchData('clients');
      toast({ title: "Éxito", description: "Cliente actualizado correctamente." });
      router.push('/dashboard/clients');

    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: "No se pudo actualizar el cliente.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
        <>
            <PageHeader title="Editar Cliente" description="Cargando datos del cliente...">
                 <Skeleton className="h-10 w-36" />
            </PageHeader>
            <Card>
                <CardHeader>
                    <Skeleton className="h-6 w-1/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {Array.from({ length: 10 }).map((_, i) => (
                        <div key={i} className="space-y-2">
                           <Skeleton className="h-4 w-1/3" />
                           <Skeleton className="h-10 w-full" />
                        </div>
                    ))}
                </CardContent>
                 <CardFooter>
                    <Skeleton className="h-10 w-32" />
                </CardFooter>
            </Card>
        </>
    );
  }

  if (!client) {
    return notFound();
  }

  return (
    <>
      <PageHeader
        title="Editar Cliente"
        description="Actualiza la información del cliente."
      >
        <Link href="/dashboard/clients">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Clientes
          </Button>
        </Link>
      </PageHeader>
      <form onSubmit={handleUpdateClient}>
        <Card>
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
            <CardDescription>
              Modifica los detalles del cliente y guarda los cambios.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="ejecutivo">Ejecutivo</Label>
              <Input id="ejecutivo" placeholder="Ej: Juan Pérez" value={client.ejecutivo} onChange={handleInputChange} disabled={isSaving} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ruc">RUC</Label>
              <Input id="ruc" placeholder="Ej: 1792233445001" value={client.ruc} onChange={handleInputChange} required disabled={isSaving}/>
            </div>
             <div className="space-y-2">
              <Label htmlFor="nombre_cliente">Nombre del Cliente</Label>
              <Input id="nombre_cliente" placeholder="Ej: Supermercados La Favorita" value={client.nombre_cliente} onChange={handleInputChange} required disabled={isSaving}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre_comercial">Nombre Comercial</Label>
              <Input id="nombre_comercial" placeholder="Ej: Supermaxi" value={client.nombre_comercial} onChange={handleInputChange} disabled={isSaving}/>
            </div>
             <div className="space-y-2">
              <Label htmlFor="provincia">Provincia</Label>
              <Input id="provincia" placeholder="Ej: Pichincha" value={client.provincia} onChange={handleInputChange} disabled={isSaving}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="canton">Cantón</Label>
              <Input id="canton" placeholder="Ej: Quito" value={client.canton} onChange={handleInputChange} disabled={isSaving}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input id="direccion" placeholder="Ej: Av. de los Shyris y Naciones Unidas" value={client.direccion} onChange={handleInputChange} disabled={isSaving}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select value={client.status || 'active'} onValueChange={handleStatusChange} disabled={isSaving}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="Seleccionar estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="latitud">Latitud</Label>
              <Input id="latitud" type="number" step="any" placeholder="Ej: -0.1762" value={client.latitud} onChange={handleInputChange} disabled={isSaving}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitud">Longitud</Label>
              <Input id="longitud" type="number" step="any" placeholder="Ej: -78.4847" value={client.longitud} onChange={handleInputChange} disabled={isSaving}/>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <LoaderCircle className="animate-spin" />}
              Guardar Cambios
            </Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
