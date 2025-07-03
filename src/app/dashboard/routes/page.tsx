'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Calendar as CalendarIcon, Users, Check, ChevronsUpDown } from 'lucide-react';
import { mockClients } from '@/lib/mock-data';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

export default function RoutesPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  const handleSelectClient = (ruc: string) => {
    setSelectedClients(prev => 
      prev.includes(ruc) ? prev.filter(c => c !== ruc) : [...prev, ruc]
    );
  };

  return (
    <>
      <PageHeader title="Route Planning" description="Create and manage your sales routes.">
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Route
        </Button>
      </PageHeader>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Route Details</CardTitle>
              <CardDescription>Fill in the details for your new route plan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="routeName">Route Name</Label>
                <Input id="routeName" placeholder="e.g., Quito North - Week 24" />
              </div>
              
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !date && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Select Clients</Label>
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={open}
                      className="w-full justify-between"
                    >
                      {selectedClients.length > 0 ? `${selectedClients.length} clients selected` : "Select clients..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Search clients..." />
                      <CommandList>
                        <CommandEmpty>No clients found.</CommandEmpty>
                        <CommandGroup>
                          {mockClients.map((client) => (
                            <CommandItem
                              key={client.ruc}
                              onSelect={() => handleSelectClient(client.ruc)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedClients.includes(client.ruc) ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {client.nombre_comercial}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supervisor">Assign Supervisor</Label>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <Input id="supervisor" placeholder="Select a supervisor" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Selected Clients</CardTitle>
              <CardDescription>{selectedClients.length} clients selected for this route.</CardDescription>
            </CardHeader>
            <CardContent>
              {selectedClients.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>No clients selected yet.</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {mockClients.filter(c => selectedClients.includes(c.ruc)).map(client => (
                    <div key={client.id} className="p-3 border rounded-md shadow-sm">
                      <p className="font-semibold">{client.nombre_comercial}</p>
                      <p className="text-sm text-muted-foreground">{client.direccion}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2">
                        <Input placeholder="Sales" type="number" />
                        <Input placeholder="Payments" type="number" />
                        <Input placeholder="Returns" type="number" />
                        <Input placeholder="Expired" type="number" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
