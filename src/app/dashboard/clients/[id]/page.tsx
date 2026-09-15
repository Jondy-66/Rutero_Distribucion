
'use client';
import { useEffect, useState, use, useMemo } from 'react';
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
import { ArrowLeft, LoaderCircle, UserCircle, MapPin, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getClient, updateClient } from '@/lib/firebase/firestore';
import type { Client, Branch } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';

export default function EditClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: clientId } = use(params);
  const router = useRouter();
  const { toast } = useToast();
  const { refetchData, users, user: currentUser } = useAuth();
  const [client, setClient] = useState<Client | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const availableExecutives = useMemo(() => {
    if (!currentUser || !users) return [];
    if (currentUser.role === 'Administrador') return users.filter(u => u.role === 'Usuario' || u.role === 'Telemercaderista');
    if (currentUser.role === 'Supervisor') return users.filter(u => u.supervisorId === currentUser.id);
    return [];
  }, [currentUser, users]);
  
  useEffect(() => {
    const fetchClient = async () => {
      try {
        const clientData = await getClient(clientId);
        if (clientData) {
          setClient(clientData);
          setBranches(clientData.branches || []);
        } else {
          notFound();
        }
      } catch (error) {
        toast({ title: "Error", description: "No se pudo cargar el cliente.", variant: "destructive" });
        notFound();
      } finally {
        setLoading(false);
      }
    };
    if (clientId) fetchClient();
  }, [clientId, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!client) return;
    const { id, value } = e.target;
    setClient(prev => ({ ...prev!, [id]: value }));
  };

  const handleAddBranch = () => {
    setBranches(prev => [...prev, { id: `br-${Date.now()}`, name: '', address: '' }]);
  };

  const handleRemoveBranch = (id: string) => {
    setBranches(prev => prev.filter(b => b.id !== id));
  };

  const handleBranchChange = (id: string, field: keyof Omit<Branch, 'id'>, value: string) => {
    setBranches(prev => prev.map(b => b.id === id ? { ...b, [field]: value } : b));
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !client.ruc || !client.nombre_cliente) return;
    setIsSaving(true);
    try {
      await updateClient(client.id, {
        ...client,
        latitud: parseFloat(String(client.latitud)) || 0,
        longitud: parseFloat(String(client.longitud)) || 0,
        branches: branches,
      });
      await refetchData('clients');
      toast({ title: "Éxito", description: "Cliente actualizado correctamente." });
      router.push('/dashboard/clients');
    } catch (error) {
      toast({ title: "Error", description: "No se pudo actualizar.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-10"><Skeleton className="h-96" /></div>;
  if (!client) return notFound();

  return (
    <>
      <PageHeader title="Editar Cliente" description="Actualiza la información y sucursales.">
        <Link href="/dashboard/clients"><Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button></Link>
      </PageHeader>
      <form onSubmit={handleUpdateClient}>
        <div className="grid gap-6">
          <Card className="shadow-lg border-t-4 border-t-primary">
            <CardHeader><CardTitle className="flex items-center gap-2 font-black uppercase text-sm"><UserCircle className="h-5 w-5 text-primary" />Información Matriz</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-black uppercase text-[10px] text-slate-500">Ejecutivo Asignado</Label>
                {currentUser?.role === 'Usuario' || currentUser?.role === 'Telemercaderista' ? (
                  <Input value={client.ejecutivo} disabled className="bg-muted font-black uppercase h-11" />
                ) : (
                  <Select value={client.ejecutivo} onValueChange={(v) => setClient(p => p ? ({...p, ejecutivo: v}) : null)}>
                    <SelectTrigger className="h-11 font-black"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>{availableExecutives.map(e => <SelectItem key={e.id} value={e.name} className="font-bold">{e.name}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="ruc" className="font-black uppercase text-[10px] text-slate-500">RUC / Identificación</Label>
                <Input id="ruc" value={client.ruc} onChange={handleInputChange} required className="h-11 font-mono font-bold" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nombre_cliente" className="font-black uppercase text-[10px] text-slate-500">Nombre o Razón Social</Label>
                <Input id="nombre_cliente" value={client.nombre_cliente} onChange={handleInputChange} required className="h-11 font-black uppercase" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nombre_comercial" className="font-black uppercase text-[10px] text-slate-500">Nombre Comercial</Label>
                <Input id="nombre_comercial" value={client.nombre_comercial} onChange={handleInputChange} className="h-11 font-black uppercase" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provincia" className="font-black uppercase text-[10px] text-slate-500">Provincia</Label>
                <Input id="provincia" value={client.provincia} onChange={handleInputChange} className="h-11 font-bold uppercase" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="canton" className="font-black uppercase text-[10px] text-slate-500">Cantón</Label>
                <Input id="canton" value={client.canton} onChange={handleInputChange} className="h-11 font-bold uppercase" />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="direccion" className="font-black uppercase text-[10px] text-slate-500">Dirección Exacta</Label>
                <Input id="direccion" value={client.direccion} onChange={handleInputChange} className="h-11 font-bold" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="latitud" className="font-black uppercase text-[10px] text-slate-500">Latitud (GPS)</Label>
                <Input id="latitud" value={client.latitud} onChange={handleInputChange} className="h-11 font-mono font-bold" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitud" className="font-black uppercase text-[10px] text-slate-500">Longitud (GPS)</Label>
                <Input id="longitud" value={client.longitud} onChange={handleInputChange} className="h-11 font-mono font-bold" />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-t-4 border-t-accent">
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="flex items-center gap-2 font-black uppercase text-sm"><MapPin className="h-5 w-5 text-accent" />Sucursales Adicionales</CardTitle></div>
              <Button type="button" onClick={handleAddBranch} variant="outline" className="font-black border-accent text-accent"><Plus className="mr-1 h-4 w-4" /> Añadir</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {branches.map((branch) => (
                <div key={branch.id} className="p-4 bg-slate-50 border-2 rounded-2xl relative">
                  <Button type="button" onClick={() => handleRemoveBranch(branch.id)} variant="ghost" size="icon" className="absolute top-2 right-2 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Nombre Sucursal</Label><Input value={branch.name} onChange={e => handleBranchChange(branch.id, 'name', e.target.value)} className="h-10 font-bold bg-white" /></div>
                    <div className="space-y-1"><Label className="text-[9px] font-black uppercase">Dirección</Label><Input value={branch.address} onChange={e => handleBranchChange(branch.id, 'address', e.target.value)} className="h-10 font-bold bg-white" /></div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          
          <Button type="submit" disabled={isSaving} className="h-14 font-black uppercase shadow-xl rounded-2xl">GUARDAR CAMBIOS</Button>
        </div>
      </form>
    </>
  );
}
