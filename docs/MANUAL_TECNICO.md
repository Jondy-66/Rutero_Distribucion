# Manual Técnico del Aplicativo "Rutero"

## 1. Descripción General
Rutero es una aplicación Next.js 15 integrada con Firebase para la gestión logística avanzada. Esta versión incluye optimizaciones críticas para el manejo de cuotas y persistencia de datos.

### 1.1. Stack Tecnológico
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, ShadCN UI.
- **Backend**: Firebase (Firestore, Authentication).
- **Mapas**: Google Maps API.

## 2. Estructura del Proyecto
- **`src/contexts/auth-context.tsx`**: Motor central de datos. Implementa carga selectiva por rol.
- **`src/lib/firebase/firestore.ts`**: Capa de acceso a datos con filtros optimizados.
- **`src/app/dashboard/routes/management`**: Módulo de alta interactividad con persistencia de sesión.

---

## 4. Funcionalidades Clave (Vista Técnica)

### 4.1. Optimización de Cuota Firestore (Lecturas Eficientes)
Para evitar el error "Quota exceeded", el sistema implementa **Filtros de Servidor (Server-side filtering)**:
- **Vendedores**: Solo descargan clientes donde `ejecutivo == user.name` y rutas donde `createdBy == user.id`.
- **Supervisores**: Descargan rutas donde `supervisorId == user.id`.
- **Administradores**: Tienen acceso a la carga completa.
Esto reduce el consumo de lecturas en un 90% para organizaciones con grandes carteras de clientes.

### 4.2. Persistencia y Escudo de Datos (Gestión de Ruta)
- **Escudo Local**: En el módulo de gestión, los estados de `checkInTime` y progreso se mantienen en el estado local del componente con prioridad sobre el servidor durante la sincronización, evitando que la latencia borre registros de entrada.
- **Rehidratación de Sesión**: Se utiliza `localStorage` con claves vinculadas al `userId` para restaurar la ruta activa después de un refresco de página o pérdida de conexión.
- **Reactivación Automática**: Un `useEffect` monitorea el cambio de fecha y los clientes pendientes hoy en rutas completadas, disparando una actualización de estado a "En Progreso" si es necesario.

### 4.3. Búsqueda y Filtros
El motor de búsqueda en el diálogo de adición utiliza una lógica de concatenación de campos para permitir el filtrado simultáneo por `ruc`, `nombre_cliente` y `nombre_comercial`, mejorando la experiencia del usuario final.

---

## 8. Seguridad y Cumplimiento
- **Aislamiento de Datos**: Reforzado mediante el filtrado en el `AuthContext`.
- **Integridad de Gestión**: Los campos de la visita se bloquean automáticamente una vez ejecutado el `check-out`.
- **Registro de Ubicación**: Se utiliza la API de Geolocalización del navegador para capturar coordenadas `GeoPoint` en los hitos de entrada y salida.

---

## 12. Manual de Soporte (Troubleshooting)
| Error Común | Causa Probable | Solución |
| :--- | :--- | :--- |
| Quota exceeded | Lecturas masivas de clientes | Se implementó carga selectiva. Verificar que los vendedores tengan su nombre correctamente asignado en el campo `ejecutivo` de los clientes. |
| La ruta no sale hoy | Filtro de fecha restrictivo | Se ajustó el filtro para incluir rutas con clientes programados para hoy, no solo por fecha principal. |
| Registro borrado al refrescar | Inconsistencia de sincronización | Se implementó el "Escudo Local" y persistencia en localStorage. |