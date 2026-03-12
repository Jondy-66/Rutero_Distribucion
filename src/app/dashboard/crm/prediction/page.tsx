
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Phone, TrendingUp, Calendar, AlertCircle, Sparkles, Filter, UploadCloud, Download, LoaderCircle } from 'lucide-react';
import { format, isBefore, startOfDay, differenceInDays, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { getMyCustomers, addCustomersBatch } from '@/lib/firebase/firestore';
import type { Customer } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Timestamp } from 'firebase/firestore';

export default function CrmPredictionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshData = async () => {
    if (user) {
      setLoading(true);
      const data = await getMyCustomers(user.id);
      setCustomers(data);
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [user]);

  const callQueue = useMemo(() => {
    return customers
      .map(c => {
        const nextDate = c.next_call_date instanceof Date 
            ? c.next_call_date 
            : (c.next_call_date && typeof (c.next_call_date as any).toDate === 'function')
                ? (c.next_call_date as any).toDate()
                : new Date(c.next_call_date as any);
        
        const daysOverdue = differenceInDays(new Date(), nextDate);
        
        let score = (daysOverdue > 0 ? daysOverdue : 0) * 1.5;
        if (c.tier === 'VIP') score += 50;
        if (c.status === 'lead') score += 20;
        
        const lastPurchase = c.last_purchase_date instanceof Date 
            ? c.last_purchase_date 
            : (c.last_purchase_date && typeof (c.last_purchase_date as any).toDate === 'function')
                ? (c.last_purchase_date as any).toDate()
                : new Date(c.last_purchase_date as any);

        const daysSincePurchase = differenceInDays(new Date(), lastPurchase);
        const isNextToBuy = daysSincePurchase >= (c.purchase_frequency_days - 5);
        if (isNextToBuy) score += 100;

        return { ...c, nextDate, score, isNextToBuy };
      })
      .sort((a, b) => b.score - a.score);
  }, [customers]);

  const handleStartCall = (customerId: string) => {
    router.push(`/dashboard/crm/management?customerId=${customerId}`);
  };

  const processImportedData = async (data: any[]) => {
    if (!user) return;
    setIsUploading(true);

    try {
        const customersToSave: Omit<Customer, 'id'>[] = data.map(row => {
            // Normalizar claves
            const cleanRow: any = {};
            Object.keys(row).forEach(k => {
                cleanRow[k.trim().toLowerCase().replace(/ /g, '_')] = row[k];
            });

            const lastPurchaseDate = cleanRow.last_purchase_date ? new Date(cleanRow.last_purchase_date) : new Date();
            const freq = parseInt(cleanRow.purchase_frequency_days) || 30;
            
            // Si no hay fecha de próxima llamada, calcularla basándose en frecuencia
            const nextCallDate = cleanRow.next_call_date 
                ? new Date(cleanRow.next_call_date) 
                : addDays(lastPurchaseDate, freq);

            return {
                name: cleanRow.name || cleanRow.nombre || 'Sin Nombre',
                phone: String(cleanRow.phone || cleanRow.telefono || ''),
                email: cleanRow.email || '',
                agent_id: user.id,
                average_ticket: parseFloat(cleanRow.average_ticket || cleanRow.ticket_promedio) || 0,
                last_purchase_date: Timestamp.fromDate(lastPurchaseDate),
                next_call_date: Timestamp.fromDate(nextCallDate),
                purchase_frequency_days: freq,
                status: (cleanRow.status || 'active') as any,
                tier: (cleanRow.tier || 'Medio') as any,
                priority_score: 0
            };
        });

        await addCustomersBatch(customersToSave);
        toast({ title: "Carga Exitosa", description: `${customersToSave.length} clientes añadidos a tu cola.` });
        await refreshData();
        document.getElementById('close-import-crm')?.click();
    } catch (e) {
        console.error(e);
        toast({ title: "Error en la carga", variant: "destructive" });
    } finally {
        setIsUploading(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.csv')) {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => processImportedData(results.data)
        });
    } else {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(sheet);
            processImportedData(json);
        };
        reader.readAsBinaryString(file);
    }
  };

  return (
    <>
      <PageHeader
        title="Cola de Llamadas Inteligente"
        description="Clientes priorizados por Ticket Promedio y Ciclo de Compra."
      >
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline" className="font-bold">
                    <UploadCloud className="mr-2 h-4 w-4" /> IMPORTAR BASE
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Cargar Clientes CRM</DialogTitle>
                    <DialogDescription>
                        Sube un archivo CSV/Excel con las métricas de tus clientes. 
                        Columnas requeridas: name, phone, average_ticket, last_purchase_date, purchase_frequency_days.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Input type="file" accept=".csv, .xlsx" onChange={handleFileUpload} disabled={isUploading} />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost" id="close-import-crm">Cerrar</Button></DialogClose>
                    {isUploading && <LoaderCircle className="animate-spin" />}
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-4 mb-6">
        <Card className="bg-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase text-primary">Total Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{callQueue.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase text-orange-700">Vencidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-orange-600">
              {callQueue.filter(c => isBefore(c.nextDate, startOfDay(new Date()))).length}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase text-green-700">Próximos a Comprar</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-green-600">
              {callQueue.filter(c => c.isNextToBuy).length}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold uppercase text-blue-700">VIP en Cola</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-blue-600">
              {callQueue.filter(c => c.tier === 'VIP').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Cola de Prioridad</CardTitle>
            <CardDescription>Algoritmo de llamada basado en valor y frecuencia de compra.</CardDescription>
          </div>
          <Button variant="outline" size="sm"><Filter className="mr-2 h-4 w-4" /> Filtrar</Button>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tier / Valor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Próxima Llamada</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : callQueue.length > 0 ? (
                  callQueue.map((c) => (
                    <TableRow key={c.id} className={c.isNextToBuy ? "bg-green-50/30" : ""}>
                      <TableCell>
                        <div className="font-bold uppercase text-sm">{c.name}</div>
                        <div className="text-[10px] text-muted-foreground">{c.phone}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.tier === 'VIP' ? 'default' : 'secondary'} className="font-black">
                          {c.tier}
                        </Badge>
                        <div className="text-[10px] mt-1 font-bold">${c.average_ticket.toFixed(2)}</div>
                      </TableCell>
                      <TableCell>
                        {c.isNextToBuy && (
                          <Badge className="bg-green-600 hover:bg-green-700 animate-pulse text-[9px] font-black uppercase">
                            <Sparkles className="mr-1 h-3 w-3" /> Comprar pronto
                          </Badge>
                        )}
                        {!c.isNextToBuy && <Badge variant="outline" className="uppercase text-[9px]">{c.status}</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {format(c.nextDate, 'dd MMM yyyy', { locale: es })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-primary" />
                          <span className="font-black text-xs">{c.score.toFixed(0)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" className="font-bold" onClick={() => handleStartCall(c.id)}>
                          <Phone className="mr-2 h-4 w-4" /> LLAMAR
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground font-bold uppercase text-xs">
                      No tienes llamadas programadas para hoy. Sube tu base inteligente para empezar.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
