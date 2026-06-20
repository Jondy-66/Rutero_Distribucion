'use client';

import { useState, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { RefreshCcw, Search, ShieldAlert, LoaderCircle, AlertTriangle, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase/config';
import { writeBatch, doc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';

export default function RecoverClientsPage() {
    const { user, clients, refetchData, loading } = useAuth();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);

    const inactiveClients = useMemo(() => {
        return clients
            .filter(c => (c.status === 'inactive' || (c as any).estado === 'inactive'))
            .filter(c => {
                const term = searchTerm.toLowerCase();
                return c.nombre_cliente.toLowerCase().includes(term) || 
                       c.nombre_comercial.toLowerCase().includes(term) ||
                       c.ruc.includes(term);
            });
    }, [clients, searchTerm]);

    const handleRecover = async (ids: string[]) => {
        if (ids.length === 0) return;
        setIsProcessing(true);
        try {
            const batch = writeBatch(db);
            ids.forEach(id => {
                const clientRef = doc(db, 'clients', id);
                batch.update(clientRef, { status: 'active' });
            });
            
            await batch.commit();
            
            toast({ 
                title: "Restauración Completada", 
                description: `Se han reactivado ${ids.length} clientes con éxito.`,
                className: "bg-green-600 text-white font-black"
            });
            
            setSelectedIds([]);
            await refetchData('clients');
        } catch (error) {
            console.error("Batch recovery error:", error);
            toast({ title: "Error", description: "No se pudieron restaurar los registros en el servidor.", variant: "destructive" });
        } finally {
            setIsProcessing(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    if (user?.role !== 'Administrador' && !user?.permissions?.includes('recover-clients')) {
        return <PageHeader title="Acceso Denegado" description="No tienes permisos para rescatar datos." />;
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader title="Rescate de Cartera" description="Mantenimiento y reactivación de clientes inactivos.">
                {selectedIds.length > 0 && (
                    <Button 
                        onClick={() => handleRecover(selectedIds)} 
                        disabled={isProcessing}
                        className="bg-primary hover:bg-primary/90 text-white font-black uppercase shadow-xl animate-in zoom-in h-12 px-8"
                    >
                        {isProcessing ? <LoaderCircle className="animate-spin mr-2 h-5 w-5" /> : <UserPlus className="mr-2 h-5 w-5" />}
                        Restaurar {selectedIds.length} Clientes
                    </Button>
                )}
            </PageHeader>

            <AlertTriangle className="h-full w-full fixed inset-0 opacity-[0.02] pointer-events-none -z-10" />

            <div className="grid gap-6">
                <Card className="border-t-4 border-t-amber-500 shadow-2xl rounded-[2rem] overflow-hidden">
                    <CardHeader className="bg-amber-50/50 border-b">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <CardTitle className="font-black text-slate-950 uppercase flex items-center gap-2">
                                    <ShieldAlert className="h-6 w-6 text-amber-600" />
                                    Clientes para Reactivación
                                </CardTitle>
                                <CardDescription className="font-bold text-[10px] text-amber-800 uppercase mt-1">
                                    Viendo {inactiveClients.length} registros fuera de circulación.
                                </CardDescription>
                            </div>
                            <div className="relative w-full sm:max-w-xs">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input 
                                    placeholder="RUC o Nombre..." 
                                    className="pl-9 h-10 border-2 rounded-xl font-black text-slate-950 uppercase text-xs" 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="max-h-[60vh] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="w-12 text-center h-14">
                                            <Checkbox 
                                                checked={selectedIds.length === inactiveClients.length && inactiveClients.length > 0}
                                                onCheckedChange={() => setSelectedIds(selectedIds.length === inactiveClients.length ? [] : inactiveClients.map(c => c.id))}
                                            />
                                        </TableHead>
                                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Cliente / RUC</TableHead>
                                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Ejecutivo</TableHead>
                                        <TableHead className="font-black text-slate-950 uppercase text-[10px]">Estado Actual</TableHead>
                                        <TableHead className="text-right font-black text-slate-950 uppercase text-[10px] pr-8">Acción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell></TableRow>
                                        ))
                                    ) : inactiveClients.length > 0 ? (
                                        inactiveClients.map((client) => (
                                            <TableRow key={client.id} className={cn("hover:bg-slate-50 transition-colors", selectedIds.includes(client.id) && "bg-amber-50/30")}>
                                                <TableCell className="text-center">
                                                    <Checkbox 
                                                        checked={selectedIds.includes(client.id)}
                                                        onCheckedChange={() => toggleSelect(client.id)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <p className="font-black text-xs text-slate-950 uppercase leading-tight">{client.nombre_comercial}</p>
                                                    <p className="text-[9px] font-mono text-slate-400 font-bold uppercase mt-0.5">{client.ruc}</p>
                                                </TableCell>
                                                <TableCell className="font-black text-primary text-[10px] uppercase">{client.ejecutivo}</TableCell>
                                                <TableCell>
                                                    <Badge variant="destructive" className="font-black text-[9px] uppercase border-none">INACTIVO</Badge>
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-8 font-black uppercase text-[10px] border-primary text-primary hover:bg-primary/5 rounded-lg"
                                                        onClick={() => handleRecover([client.id])}
                                                        disabled={isProcessing}
                                                    >
                                                        Restaurar
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center h-40 font-black text-slate-400 uppercase text-xs">
                                                <RefreshCcw className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                                No hay clientes inactivos para rescatar.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
