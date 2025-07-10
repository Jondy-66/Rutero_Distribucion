
'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { CalendarIcon, Clock, Plus, Route, Search } from 'lucide-react';

const availableClients = [
    { name: 'GTI', description: 'Global Tech Inc.' },
    { name: 'Innovatech', description: 'Soluciones Innovadoras' },
    { name: 'Quantum', description: 'Industrias Quantum' },
    { name: 'Pioneer', description: 'Logística Pionera' },
    { name: 'Starlight', description: 'Empresas Starlight' },
]

export default function RouteManagementPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column */}
        <div className="lg:col-span-1 flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Configuración de Ruta</CardTitle>
                    <CardDescription>Selecciona una ruta o configura una nueva.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Seleccionar Ruta</Label>
                        <Select>
                            <SelectTrigger>
                                <Route className="mr-2 h-4 w-4" />
                                <SelectValue placeholder="Elige una ruta predefinida" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ruta-1">Ruta Quito Norte</SelectItem>
                                <SelectItem value="ruta-2">Ruta Guayaquil Sur</SelectItem>
                            </SelectContent>
                        </Select>
                        <Slider defaultValue={[0]} max={100} step={1} className="py-2"/>
                    </div>
                     <div className="space-y-2">
                        <Label>Fecha</Label>
                        <Button variant="outline" className="w-full justify-start font-normal text-left">
                           <CalendarIcon className="mr-2 h-4 w-4" />
                           10 de julio de 2025
                        </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Hora de Inicio</Label>
                             <Select defaultValue="08:00">
                                <SelectTrigger>
                                     <Clock className="mr-2 h-4 w-4" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="08:00">08:00</SelectItem>
                                    <SelectItem value="08:30">08:30</SelectItem>
                                    <SelectItem value="09:00">09:00</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Hora de Fin</Label>
                             <Select defaultValue="18:00">
                                <SelectTrigger>
                                     <Clock className="mr-2 h-4 w-4" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="17:00">17:00</SelectItem>
                                    <SelectItem value="17:30">17:30</SelectItem>
                                    <SelectItem value="18:00">18:00</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Clientes Disponibles</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="relative mb-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar por RUC, nombre..." className="pl-8" />
                    </div>
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                       {availableClients.map((client) => (
                         <div key={client.name} className="flex items-center justify-between">
                            <div>
                                <p className="font-medium">{client.name}</p>
                                <p className="text-sm text-muted-foreground">{client.description}</p>
                            </div>
                            <Button variant="ghost" size="sm">
                                <Plus className="mr-2 h-4 w-4" />
                                Añadir
                            </Button>
                        </div>
                       ))}
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2">
             <Card>
                <CardHeader>
                    <CardTitle>Ruta de Hoy</CardTitle>
                    <CardDescription>Arrastra para reordenar los clientes en tu ruta.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center min-h-[60vh] rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-8 text-center">
                        <div>
                            <p className="font-semibold text-lg">Tu ruta está vacía.</p>
                            <p className="text-muted-foreground">Selecciona una ruta o añade clientes para empezar.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
  );
}
