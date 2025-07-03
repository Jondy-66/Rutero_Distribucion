import type { User, Client } from '@/lib/types';

export const mockUsers: User[] = [
  { id: '1', name: 'Admin User', email: 'admin@routero.com', role: 'Admin', avatar: '/avatars/01.png' },
  { id: '2', name: 'Supervisor Sam', email: 'supervisor@routero.com', role: 'Supervisor', avatar: '/avatars/02.png' },
  { id: '3', name: 'Regular User', email: 'user@routero.com', role: 'User', avatar: '/avatars/03.png' },
  { id: '4', name: 'Elena Rodriguez', email: 'elena.r@example.com', role: 'User', avatar: '/avatars/04.png' },
  { id: '5', name: 'Carlos Gomez', email: 'carlos.g@example.com', role: 'Supervisor', avatar: '/avatars/05.png' },
];

export const mockClients: Client[] = [
    {
        id: '1',
        ejecutivo: 'Juan Perez',
        ruc: '1792233445001',
        nombre_cliente: 'Supermercados La Favorita',
        nombre_comercial: 'Supermaxi',
        provincia: 'Pichincha',
        canton: 'Quito',
        direccion: 'Av. de los Shyris y Naciones Unidas',
        latitud: -0.1762,
        longitud: -78.4847
    },
    {
        id: '2',
        ejecutivo: 'Maria Garcia',
        ruc: '0992233445001',
        nombre_cliente: 'Corporación El Rosado',
        nombre_comercial: 'Mi Comisariato',
        provincia: 'Guayas',
        canton: 'Guayaquil',
        direccion: 'Av. 9 de Octubre y Boyacá',
        latitud: -2.1931,
        longitud: -79.8822
    },
    {
        id: '3',
        ejecutivo: 'Juan Perez',
        ruc: '0190345678001',
        nombre_cliente: 'Tipti S.A.S',
        nombre_comercial: 'Tipti',
        provincia: 'Pichincha',
        canton: 'Quito',
        direccion: 'Av. República de El Salvador y Moscú',
        latitud: -0.1856,
        longitud: -78.4824
    },
    {
        id: '4',
        ejecutivo: 'Ana Martinez',
        ruc: '0301894567001',
        nombre_cliente: 'Farmacias FYBECA S.A.',
        nombre_comercial: 'Fybeca',
        provincia: 'Azuay',
        canton: 'Cuenca',
        direccion: 'Av. Remigio Crespo y Av. Loja',
        latitud: -2.9087,
        longitud: -79.0118
    },
    {
        id: '5',
        ejecutivo: 'Maria Garcia',
        ruc: '1792345678001',
        nombre_cliente: 'Holcim Ecuador S.A.',
        nombre_comercial: 'Holcim',
        provincia: 'Pichincha',
        canton: 'Quito',
        direccion: 'Av. Eloy Alfaro y 9 de Octubre',
        latitud: -0.1994,
        longitud: -78.4912
    }
];
