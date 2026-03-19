'use client';
import { useState, useEffect, useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowLeft, LoaderCircle, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addClient } from '@/lib/firebase/firestore';
import { useAuth } from '@/hooks/use-auth';

export default function NewClientPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, users, refetchData, loading: authLoading } = useAuth();
  
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

  // Auto-completar ejecutivo si el usuario es vendedor
  useEffect(() => {
    if (user && (user.role === 'Usuario' || user.role === 'Telemercaderista')) {
      setFormData(prev => ({ ...prev, ejecutivo: user.name }));
    }
  }, [user]);

  // Obtener lista de ejecutivos disponibles según el rol
  const availableExecutives = useMemo(() => {
    if (!user || !users) return [];
    
    if (user.role === 'Administrador') {
      // Admin ve a todos los roles operativos
      return users.filter(u => u.role === 'Usuario' || u.role === 'Telemercaderista');
    }
    
    if (user.role === 'Supervisor') {
      // Supervisor ve solo a su equipo asignado
      return users.filter(u => u.supervisorId === user.id);
    }
    
    return [];
  }, [user, users]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const updateField = (id: string, value: string) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.ejecutivo) {
        toast({ title: "Error", description: "Debes seleccionar o asignar un ejecutivo.", variant: "destructive" });
        return;
    }
    
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
        status: 'active',
      });
      
      await refetchData('clients');
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

  const isSeller = user?.role === 'Usuario' || user?.role === 'Telemercaderista';

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
        <Card className="shadow-lg border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-primary" />
                Información del Cliente
            </CardTitle>
            <CardDescription>
              Proporciona los detalles del nuevo cliente y asígnalo a un ejecutivo.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            <div className="space-y-2">
              <Label htmlFor="ejecutivo" className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Ejecutivo Asignado</Label>
              {isSeller ? (
                <div className="relative">
                    <Input 
                        id="ejecutivo" 
                        value={formData.ejecutivo} 
                        disabled 
                        className="bg-muted font-black text-primary uppercase h-11"
                    />
                    <Badge variant="secondary" className="absolute right-3 top-2.5 text-[9px] font-black uppercase">Tu Perfil</Badge>
                </div>
              ) : (
                <Select 
                    value={formData.ejecutivo} 
                    onValueChange={(value) => updateField('ejecutivo', value)}
                    disabled={isLoading || authLoading}
                >
                    <SelectTrigger className="h-11 font-bold">
                        <SelectValue placeholder="Seleccionar un ejecutivo..." />
                    </SelectTrigger>
                    <SelectContent>
                        {availableExecutives.length > 0 ? (
                            availableExecutives.map(exec => (
                                <SelectItem key={exec.id} value={exec.name} className="font-medium">
                                    {exec.name} ({exec.role})
                                </SelectItem>
                            ))
                        ) : (
                            <SelectItem value="none" disabled>No hay ejecutivos disponibles</SelectItem>
                        )}
                    </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ruc" className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">RUC / Identificación</Label>
              <Input id="ruc" placeholder="Ej: 1792233445001" value={formData.ruc} onChange={handleInputChange} required disabled={isLoading} className="h-11 font-mono" />
            </div>

             <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nombre_cliente" className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Nombre o Razón Social</Label>
              <Input id="nombre_cliente" placeholder="Ej: Supermercados La Favorita" value={formData.nombre_cliente} onChange={handleInputChange} required disabled={isLoading} className="h-11 font-black uppercase" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="nombre_comercial" className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Nombre Comercial</Label>
              <Input id="nombre_comercial" placeholder="Ej: Supermaxi" value={formData.nombre_comercial} onChange={handleInputChange} disabled={isLoading} className="h-11 font-bold uppercase" />
            </div>

             <div className="space-y-2">
              <Label htmlFor="provincia" className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Provincia</Label>
              <Input id="provincia" placeholder="Ej: Pichincha" value={formData.provincia} onChange={handleInputChange} disabled={isLoading} className="h-11 font-medium" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="canton" className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Cantón</Label>
              <Input id="canton" placeholder="Ej: Quito" value={formData.canton} onChange={handleInputChange} disabled={isLoading} className="h-11 font-medium" />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="direccion" className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Dirección Exacta</Label>
              <Input id="direccion" placeholder="Ej: Av. de los Shyris y Naciones Unidas" value={formData.direccion} onChange={handleInputChange} disabled={isLoading} className="h-11" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="latitud" className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Latitud (GPS)</Label>
              <Input id="latitud" type="number" step="any" placeholder="Ej: -0.1762" value={formData.latitud} onChange={handleInputChange} disabled={isLoading} className="h-11 font-mono" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="longitud" className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Longitud (GPS)</Label>
              <Input id="longitud" type="number" step="any" placeholder="Ej: -78.4847" value={formData.longitud} onChange={handleInputChange} disabled={isLoading} className="h-11 font-mono" />
            </div>
          </CardContent>
          <CardFooter className="bg-muted/30 border-t p-6">
            <Button type="submit" disabled={isLoading} className="w-full sm:w-auto font-black px-10 h-12 shadow-md">
              {isLoading ? <LoaderCircle className="animate-spin mr-2" /> : null}
              CREAR CLIENTE
            </Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
