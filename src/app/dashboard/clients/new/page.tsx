
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
import { ArrowLeft, LoaderCircle, UserCircle, MapPin, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addClient } from '@/lib/firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import type { Branch } from '@/lib/types';

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
  const [branches, setBranches] = useState<Omit<Branch, 'id'>[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-completar ejecutivo si el usuario es vendedor
  useEffect(() => {
    if (user && (user.role === 'Usuario' || user.role === 'Telemercaderista')) {
      setFormData(prev => ({ ...prev, ejecutivo: user.name }));
    }
  }, [user]);

  const availableExecutives = useMemo(() => {
    if (!user || !users) return [];
    if (user.role === 'Administrador') return users.filter(u => u.role === 'Usuario' || u.role === 'Telemercaderista');
    if (user.role === 'Supervisor') return users.filter(u => u.supervisorId === user.id);
    return [];
  }, [user, users]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    if (id === 'ruc') {
        const numericValue = value.replace(/\D/g, '');
        if (numericValue.length <= 13) setFormData(prev => ({ ...prev, [id]: numericValue }));
        return;
    }
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleAddBranch = () => {
    setBranches(prev => [...prev, { name: '', address: '' }]);
  };

  const handleRemoveBranch = (index: number) => {
    setBranches(prev => prev.filter((_, i) => i !== index));
  };

  const handleBranchChange = (index: number, field: keyof Omit<Branch, 'id'>, value: string) => {
    setBranches(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ejecutivo || !formData.ruc || !formData.nombre_cliente) {
        toast({ title: "Error", description: "Campos obligatorios faltantes.", variant: "destructive" });
        return;
    }

    const rucLength = formData.ruc.length;
    if (rucLength !== 10 && rucLength !== 13) {
        toast({ title: "Identificación Inválida", description: "Debe tener 10 o 13 dígitos.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    try {
      const branchesWithId = branches.map((b, idx) => ({ ...b, id: `br-${Date.now()}-${idx}` }));
      await addClient({
        ...formData,
        latitud: parseFloat(formData.latitud) || 0,
        longitud: parseFloat(formData.longitud) || 0,
        status: 'active',
        branches: branchesWithId,
      });
      await refetchData('clients');
      toast({ title: "Éxito", description: "Cliente creado correctamente." });
      router.push('/dashboard/clients');
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "No se pudo crear el cliente.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PageHeader title="Crear Nuevo Cliente" description="Completa el formulario para añadir un nuevo cliente.">
        <Link href="/dashboard/clients"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button></Link>
      </PageHeader>
      <form onSubmit={handleCreateClient}>
        <div className="grid gap-6">
          <Card className="shadow-lg border-t-4 border-t-primary">
            <CardHeader><CardTitle className="flex items-center gap-2"><UserCircle className="h-5 w-5 text-primary" />Información Matriz</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-black uppercase text-[10px] text-slate-950">Ejecutivo Asignado</Label>
                {user?.role === 'Usuario' || user?.role === 'Telemercaderista' ? (
                  <Input value={formData.ejecutivo} disabled className="bg-muted font-black uppercase h-11" />
                ) : (
                  <Select value={formData.ejecutivo} onValueChange={(v) => setFormData(p => ({...p, ejecutivo: v}))}>
                    <SelectTrigger className="h-11 font-black"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>{availableExecutives.map(e => <SelectItem key={e.id} value={e.name} className="font-bold">{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ruc" className="font-black uppercase text-[10px] text-slate-950">RUC / Identificación</Label>
                <Input id="ruc" value={formData.ruc} onChange={handleInputChange} required className="h-11 font-mono font-bold" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nombre_cliente" className="font-black uppercase text-[10px] text-slate-950">Nombre / Razón Social</Label>
                <Input id="nombre_cliente" value={formData.nombre_cliente} onChange={handleInputChange} required className="h-11 font-black uppercase" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="direccion" className="font-black uppercase text-[10px] text-slate-950">Dirección Matriz</Label>
                <Input id="direccion" value={formData.direccion} onChange={handleInputChange} className="h-11 font-bold" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-t-4 border-t-accent">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-accent" />Sucursales Adicionales</CardTitle>
                <CardDescription>Añade otras ubicaciones o sucursales de este cliente.</CardDescription>
              </div>
              <Button type="button" onClick={handleAddBranch} variant="outline" className="font-black border-accent text-accent hover:bg-accent/5"><Plus className="mr-1 h-4 w-4" /> Añadir Sucursal</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {branches.length > 0 ? (
                branches.map((branch, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 border-2 rounded-2xl space-y-4 relative group">
                    <Button type="button" onClick={() => handleRemoveBranch(idx)} variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase">Nombre de Sucursal</Label>
                        <Input value={branch.name} onChange={e => handleBranchChange(idx, 'name', e.target.value)} placeholder="Ej: Sucursal Centro" className="h-10 font-bold bg-white" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase">Dirección de Sucursal</Label>
                        <Input value={branch.address} onChange={e => handleBranchChange(idx, 'address', e.target.value)} placeholder="Ej: Av. Principal 123" className="h-10 font-bold bg-white" />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 opacity-30 uppercase font-black text-xs italic tracking-widest">Sin sucursales registradas</div>
              )}
            </CardContent>
          </Card>
          
          <div className="flex justify-end p-4">
            <Button type="submit" disabled={isLoading} className="h-14 px-12 font-black uppercase shadow-xl rounded-2xl">{isLoading ? <LoaderCircle className="animate-spin" /> : "Crear Cliente con Sucursales"}</Button>
          </div>
        </div>
      </form>
    </>
  );
}
