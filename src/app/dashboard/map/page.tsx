
'use client';
import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/use-auth';
import { MapView } from '@/components/map-view';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function MapPage() {
    const { user, users, clients, loading } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredClients = useMemo(() => {
        if (!user || loading) return [];

        let baseClients = clients;

        if (user.role === 'Usuario') {
            baseClients = clients.filter(client => client.ejecutivo?.trim().toLowerCase() === user.name.trim().toLowerCase());
        } else if (user.role === 'Supervisor') {
            const managedUserNames = users
                .filter(u => u.supervisorId === user.id)
                .map(u => u.name.trim().toLowerCase());
            
            baseClients = clients.filter(client => 
                managedUserNames.includes(client.ejecutivo?.trim().toLowerCase())
            );
        }

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            baseClients = baseClients.filter(c => 
                (c.nombre_cliente || '').toLowerCase().includes(term) ||
                (c.nombre_comercial || '').toLowerCase().includes(term) ||
                (c.direccion || '').toLowerCase().includes(term) ||
                (c.ruc || '').includes(term)
            );
        }
        
        return baseClients;
    }, [user, users, clients, loading, searchTerm]);
    
    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Visualización de Ubicaciones"
                description="Visualiza todas las ubicaciones de los clientes en el mapa."
            />
            
            <div className="relative">
                <Search className="absolute left-4 top-3.5 h-5 w-5 text-primary" />
                <Input 
                    placeholder="BUSCAR POR CLIENTE, RUC O DIRECCIÓN..." 
                    className="pl-12 h-12 font-black text-slate-950 uppercase border-2 border-slate-200 rounded-2xl shadow-xl focus:ring-4 focus:ring-primary/10 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-card min-h-[600px]">
                {loading ? <Skeleton className="h-[600px] w-full" /> : <MapView clients={filteredClients} />}
            </div>
        </div>
    );
}
