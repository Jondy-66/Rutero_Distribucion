'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
import Link from 'next/link';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addClient } from '@/lib/firebase/firestore';

export default function NewClientPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    ejecutivo: '',
    ruc: '',
    nombre_cliente: '',
    nombre_comercial: '',
    provincia: '',
    canton: '',
    direccion: '',
    latitud: '',
    longitud: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ruc || !formData.nombre_cliente) {
        toast({ title: "Error", description: "RUC y Nombre del Cliente son campos obligatorios.", variant: "destructive" });
        return;
    }
    setIsLoading(true);
    try {
      await addClient({
        ...formData,
        latitud: parseFloat(formData.latitud) || 0,
        longitud: parseFloat(formData.longitud) || 0,
      });

      toast({ title: "Éxito", description: "Cliente creado correctamente." });
      router.push('/dashboard/clients');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'permission-denied') {
        toast({ title: "Error de Permisos", description: "No tienes permiso para crear clientes.", variant: "destructive" });
      } else {
        toast({ title: "Error", description: error.message || "No se pudo crear el cliente.", variant: "destructive" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Crear Nuevo Cliente"
        description="Completa el formulario para añadir un nuevo cliente al sistema."
      >
        <Link href="/dashboard/clients">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a Clientes
          </Button>
        </Link>
      </PageHeader>
      <form onSubmit={handleCreateClient}>
        <Card>
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
            <CardDescription>
              Proporciona los detalles del nuevo cliente.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="ejecutivo">Ejecutivo</Label>
              <Input id="ejecutivo" placeholder="Ej: Juan Pérez" value={formData.ejecutivo} onChange={handleInputChange} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ruc">RUC</Label>
              <Input id="ruc" placeholder="Ej: 1792233445001" value={formData.ruc} onChange={handleInputChange} required disabled={isLoading}/>
            </div>
             <div className="space-y-2">
              <Label htmlFor="nombre_cliente">Nombre del Cliente</Label>
              <Input id="nombre_cliente" placeholder="Ej: Supermercados La Favorita" value={formData.nombre_cliente} onChange={handleInputChange} required disabled={isLoading}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nombre_comercial">Nombre Comercial</Label>
              <Input id="nombre_comercial" placeholder="Ej: Supermaxi" value={formData.nombre_comercial} onChange={handleInputChange} disabled={isLoading}/>
            </div>
             <div className="space-y-2">
              <Label htmlFor="provincia">Provincia</Label>
              <Input id="provincia" placeholder="Ej: Pichincha" value={formData.provincia} onChange={handleInputChange} disabled={isLoading}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="canton">Cantón</Label>
              <Input id="canton" placeholder="Ej: Quito" value={formData.canton} onChange={handleInputChange} disabled={isLoading}/>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input id="direccion" placeholder="Ej: Av. de los Shyris y Naciones Unidas" value={formData.direccion} onChange={handleInputChange} disabled={isLoading}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="latitud">Latitud</Label>
              <Input id="latitud" type="number" step="any" placeholder="Ej: -0.1762" value={formData.latitud} onChange={handleInputChange} disabled={isLoading}/>
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitud">Longitud</Label>
              <Input id="longitud" type="number" step="any" placeholder="Ej: -78.4847" value={formData.longitud} onChange={handleInputChange} disabled={isLoading}/>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <LoaderCircle className="animate-spin" />}
              Crear Cliente
            </Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
