import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { mockClients } from '@/lib/mock-data';
import { PlusCircle, UploadCloud, File, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ClientsPage() {
  return (
    <>
      <PageHeader title="Clients" description="View, manage, and import your client data.">
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Client
        </Button>
        <Button variant="outline">
          <UploadCloud className="mr-2 h-4 w-4" />
          Import
        </Button>
      </PageHeader>
      
      <Card>
        <CardHeader>
          <CardTitle>Client List</CardTitle>
          <CardDescription>A list of all clients in your database.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="inactive">Inactive</TabsTrigger>
              </TabsList>
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search clients..." className="w-full pl-8" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="gap-1">
                      <File className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Columns</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem checked>Ejecutivo</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked>RUC</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked>Nombre Cliente</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem checked>Provincia</DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem>Canton</DropdownMenuCheckboxItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </Tabs>
          <div className="border rounded-lg mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell">RUC</TableHead>
                  <TableHead className="hidden md:table-cell">Ejecutivo</TableHead>
                  <TableHead className="hidden lg:table-cell">Provincia</TableHead>
                  <TableHead>Dirección</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell>
                      <div className="font-medium">{client.nombre_cliente}</div>
                      <div className="text-sm text-muted-foreground">{client.nombre_comercial}</div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{client.ruc}</TableCell>
                    <TableCell className="hidden md:table-cell">{client.ejecutivo}</TableCell>
                    <TableCell className="hidden lg:table-cell">{client.provincia}</TableCell>
                    <TableCell>{client.direccion}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
