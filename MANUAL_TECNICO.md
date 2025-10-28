
# Manual Técnico del Aplicativo "Rutero"

## 1. Descripción General

Rutero es una aplicación web avanzada diseñada para la planificación, gestión y optimización de rutas de venta y cobranza. Construida sobre un stack tecnológico moderno, permite a los usuarios administrar clientes, planificar rutas, asignar supervisores, visualizar ubicaciones en un mapa interactivo y utilizar modelos de inteligencia artificial para predecir visitas y calcular rutas óptimas.

Para una visión de alto nivel de los componentes y sus interacciones, consulta el documento de [Diseño de Arquitectura](docs/arquitectura.md).

### 1.1. Stack Tecnológico

- **Framework Frontend**: Next.js 15 (con App Router)
- **Lenguaje**: TypeScript
- **Base de Datos y Autenticación**: Google Firebase (Firestore y Authentication)
- **UI y Estilos**: ShadCN/UI y Tailwind CSS
- **Mapas**: Google Maps API a través de `@vis.gl/react-google-maps`
- **Inteligencia Artificial**:
  - API externa para predicción de visitas (`api-distribucion-rutas.onrender.com`).
  - API externa para cálculo de ruta óptima (`api-distribucion-rutas.onrender.com`).
- **Manejo de Estado Global**: React Context API (`AuthProvider`).
- **Formularios**: React Hook Form (aunque no se usa extensivamente, está en las dependencias).
- **Notificaciones**: Componente `Toaster` personalizado (`use-toast`).

---

## 2. Estructura del Proyecto

El proyecto sigue la estructura estándar de una aplicación Next.js con el App Router. Los directorios más importantes dentro de `src/` son:

- **`app/`**: Contiene todas las rutas y páginas de la aplicación.
  - **`(auth)/`**: Agrupa las rutas relacionadas con la autenticación (`login`, `forgot-password`).
  - **`api/`**: Contiene los endpoints de la API de Next.js que actúan como proxy para los servicios externos, evitando problemas de CORS.
  - **`dashboard/`**: Contiene el layout principal y todas las páginas protegidas del panel de control. Cada subdirectorio corresponde a una sección de la aplicación (ej. `clients`, `users`, `routes`).
  - **`layout.tsx`**: Layout raíz de la aplicación.
  - **`page.tsx`**: Página de inicio que redirige según el estado de autenticación.

- **`components/`**: Contiene componentes de React reutilizables.
  - **`ui/`**: Componentes base de ShadCN (Button, Card, Input, etc.).
  - **Componentes personalizados**: `page-header.tsx`, `user-nav.tsx`, `map-view.tsx`, etc., que encapsulan lógica específica de la aplicación.

- **`contexts/`**: Proveedores de contexto de React.
  - **`auth-context.tsx`**: El corazón del manejo de estado global. Proporciona información del usuario, datos de clientes, usuarios y notificaciones a toda la aplicación.

- **`hooks/`**: Hooks de React personalizados.
  - **`use-auth.ts`**: Simplifica el acceso al `AuthContext`.
  - **`use-toast.ts`**: Hook para mostrar notificaciones (toasts).

- **`lib/`**: Contiene la lógica de negocio, tipos y utilidades.
  - **`firebase/`**:
    - **`config.ts`**: Configuración e inicialización de Firebase.
    - **`auth.ts`**: Funciones de ayuda para la autenticación (login, logout, etc.).
    - **`firestore.ts`**: Funciones para interactuar con la base de datos Firestore (CRUD para usuarios, clientes y rutas).
  - **`types.ts`**: Define los tipos de datos principales (`User`, `Client`, `RoutePlan`, `Notification`).
  - **`utils.ts`**: Funciones de utilidad, como `cn` para combinar clases de Tailwind.

- **`services/`**: Contiene funciones para interactuar con APIs externas.
  - **`api.ts`**: Define las funciones `getPredicciones` y `getRutaOptima` que se comunican con los endpoints proxy de la aplicación.

- **`docs/`**: Contiene la documentación del proyecto.
    - **`arquitectura.md`**: Describe la arquitectura de alto nivel de la solución.

---

## 3. Documentación Funcional (¿Qué hace la aplicación?)

Esta sección describe las capacidades de la aplicación desde la perspectiva de un usuario final.

### 3.1. Roles de Usuario y Permisos

El sistema está diseñado para tres roles con responsabilidades claras:

- **Administrador:**
  - **Gestión Total de Usuarios:** Puede crear, editar y eliminar usuarios de cualquier rol (Administradores, Supervisores, Usuarios).
  - **Gestión Total de Clientes:** Tiene control absoluto sobre el CRUD (Crear, Leer, Actualizar, Eliminar) de la base de datos de clientes.
  - **Gestión de Ubicaciones:** Puede actualizar masivamente las coordenadas geográficas de los clientes.
  - **Visibilidad Completa:** Tiene acceso a todas las rutas, reportes y dashboards del sistema.
  - **Aprobación de Rutas:** Puede aprobar o rechazar rutas enviadas por cualquier usuario.

- **Supervisor:**
  - **Gestión de su Equipo:** Puede ver y gestionar las rutas y reportes de los vendedores (rol "Usuario") que tiene asignados.
  - **Aprobación de Rutas:** Es el responsable principal de aprobar o rechazar las rutas planificadas por su equipo.
  - **Gestión de Clientes:** Puede ver y editar la información de todos los clientes. No puede crear ni eliminar clientes.
  - **Generación de Reportes:** Puede descargar reportes de las rutas completadas por su equipo.

- **Usuario (Vendedor):**
  - **Planificación de Rutas:** Es el rol principal encargado de planificar las rutas. Puede usar las predicciones de la IA para generar una base y luego ajustarla.
  - **Envío a Aprobación:** Envía sus rutas planificadas a su supervisor asignado para que sean aprobadas.
  - **Gestión de Ruta Diaria:** Inicia la ruta del día, registra las visitas a cada cliente (check-in/check-out), e ingresa los datos de la gestión (ventas, cobros, etc.).
  - **Gestión de su Cartera:** Solo puede ver los clientes que tiene asignados a su nombre (ejecutivo).

### 3.2. Módulo de Clientes

- **Creación y Edición:** El administrador puede añadir nuevos clientes manualmente o editar los existentes. Campos como RUC, nombre, dirección y coordenadas son gestionados aquí.
- **Importación Masiva:** El administrador puede subir un archivo (CSV o Excel) para crear o actualizar clientes en lote, agilizando la carga de datos.
- **Visualización y Filtro:** Todos los usuarios pueden ver la lista de clientes, filtrarlos por estado (activo/inactivo) y buscarlos por nombre, RUC, provincia, etc.
- **Geolocalización:** El módulo de "Ubicaciones" permite al administrador actualizar masivamente las coordenadas (latitud/longitud) de los clientes a través de un archivo CSV y previsualizarlas en un mapa.

### 3.3. Módulo de Rutas (Flujo de Trabajo Principal)

1.  **Planificación (IA y Manual):**
    *   **Predicción IA:** Un usuario (generalmente rol "Usuario") va a "Predicción de Ruta", selecciona un rango de fechas y la IA sugiere una lista de clientes a visitar, junto con una probabilidad de visita.
    *   **Guardado y Revisión:** El usuario guarda esta predicción como una nueva ruta, la cual queda en estado "Planificada" (borrador). Es redirigido para revisarla, añadir o quitar clientes manualmente, y ajustar los detalles de cada visita.
    *   **Planificación Manual:** El usuario también puede crear una ruta desde cero, seleccionando manualmente los clientes y configurando los detalles.

2.  **Aprobación:**
    *   Una vez que la ruta está lista, el usuario la **"Envía a Aprobación"**. El estado cambia a "Pendiente de Aprobación" y su supervisor asignado recibe una notificación.
    *   El **Supervisor** revisa la ruta. Puede aprobarla (cambia a "Planificada" y está lista para ejecutarse) o rechazarla (añadiendo una observación). El creador de la ruta es notificado en ambos casos. Una ruta aprobada ya no puede ser editada por el usuario.

3.  **Gestión Diaria:**
    *   En el día correspondiente, el usuario va a "Gestión de Ruta", selecciona la ruta planificada y la **inicia**. El estado cambia a "En Progreso".
    *   El usuario ve la lista de clientes del día. Por cada uno, realiza:
        *   **Check-in:** Marca la hora de llegada.
        *   **Registro de Datos:** Ingresa valores de venta, cobro, promociones, etc.
        *   **Check-out:** Confirma la finalización de la visita, guardando los datos.
    *   El cliente gestionado se marca como "Completado" y la aplicación presenta el siguiente cliente pendiente.
    *   Puede añadir clientes sobre la marcha si es necesario.

4.  **Optimización:**
    *   La sección "Ruta Óptima" permite a los usuarios tomar las paradas de una ruta planificada y obtener el orden de visita más eficiente, minimizando el tiempo de viaje. El resultado se puede visualizar en un enlace a Google Maps.

### 3.4. Sistema de Notificaciones y Reportes

- **Notificaciones:** El sistema genera notificaciones automáticas para los flujos de aprobación (cuando se envía, aprueba o rechaza una ruta), manteniendo a los usuarios informados.
- **Reportes:** Los supervisores pueden acceder a una sección de reportes para visualizar y descargar en Excel la información de las rutas completadas por los vendedores de su equipo.

---

## 4. Funcionalidades Clave (Vista Técnica)

### 4.1. Autenticación y Manejo de Sesión

- **Flujo**: El flujo de autenticación es gestionado por Firebase Authentication.
  1.  El usuario ingresa sus credenciales en `/login`.
  2.  La función `handleSignIn` en `src/lib/firebase/auth.ts` se comunica con Firebase.
  3.  El `AuthProvider` (`src/contexts/auth-context.tsx`) detecta el cambio de estado de autenticación a través de `onAuthStateChanged`.
  4.  Al detectar un usuario, carga su perfil desde la colección `users` en Firestore y los datos globales (clientes, usuarios).
  5.  La aplicación redirige al `/dashboard`.

- **Roles de Usuario**: El sistema maneja tres roles: `Administrador`, `Supervisor` y `Usuario`. La lógica de autorización se implementa directamente en los componentes, mostrando u ocultando elementos de la interfaz según el `user.role` disponible en el `AuthContext`.

### 4.2. Gestión de Datos con Firestore

- **Modelo de Datos**: Los tipos principales (`User`, `Client`, `RoutePlan`, `Notification`) están definidos en `src/lib/types.ts` y se corresponden con las colecciones en Firestore.
- **Acceso a Datos**: Todas las operaciones CRUD se centralizan en `src/lib/firebase/firestore.ts`.
- **Optimización**: Para evitar exceder la cuota de Firestore, la aplicación sigue una estrategia de carga de datos optimizada:
  1.  **Carga Única**: Los datos de `users` y `clients`, que no cambian con frecuencia, se cargan una sola vez al iniciar sesión en el `AuthProvider`.
  2.  **Actualización Manual**: Después de una operación CRUD (ej. crear un cliente), se llama a la función `refetchData` del `AuthContext` para volver a cargar los datos relevantes y mantener la UI actualizada.
  3.  **Tiempo Real (Solo para Notificaciones)**: La única escucha en tiempo real (`onSnapshot`) activa es para la colección de `notifications`, ya que estas sí requieren actualizaciones instantáneas.

### 4.3. Sistema de Notificaciones

- **Generación**: Las notificaciones se crean en Firestore mediante la función `addNotification` en `firestore.ts`. Esto ocurre en dos escenarios:
  1.  Un `Usuario` envía una ruta a aprobación, generando una notificación para el `Supervisor` asignado.
  2.  Un `Supervisor` aprueba o rechaza una ruta, generando una notificación para el `Usuario` que la creó.
- **Visualización**:
  1.  El `AuthProvider` se suscribe a las notificaciones del usuario logueado.
  2.  `user-nav.tsx` muestra un indicador (`Bell`) y un contador de notificaciones no leídas.
  3.  Un `Popover` muestra la lista de notificaciones, permitiendo marcarlas como leídas.
  4.  Al iniciar sesión, si hay notificaciones nuevas, se muestra una alerta (`toast`).

### 4.4. Integración con APIs Externas (Predicción y Ruta Óptima)

Para evitar problemas de CORS y proteger posibles claves de API en el futuro, la aplicación utiliza rutas de API de Next.js como **proxies**.

- **Flujo de Petición**:
  1.  El componente del frontend (ej. `PrediccionesPage`) llama a una función del servicio (ej. `getPredicciones` en `src/services/api.ts`).
  2.  Esta función construye una URL y realiza una petición `fetch` al endpoint proxy de la propia aplicación (ej. `/api/predicciones`).
  3.  El manejador de la ruta de API (ej. `src/app/api/predicciones/route.ts`) recibe la petición, la reenvía al servicio externo (`api-distribucion-rutas.onrender.com`) y devuelve la respuesta al cliente.

### 4.5. Mapas y Geolocalización

- **Componente Principal**: La visualización de mapas se centraliza en `src/components/map-view.tsx`.
- **Renderizado**: Utiliza `@vis.gl/react-google-maps` para renderizar el mapa y los marcadores (`AdvancedMarker`).
- **Rutas Óptimas**: El mismo componente `MapView` tiene la capacidad de dibujar una ruta entre múltiples puntos utilizando el `DirectionsService` de Google Maps. Se activa mediante la prop `showDirections`.
- **Manejo de Errores**: El componente incluye validaciones para asegurarse de que solo se intenten renderizar coordenadas numéricas válidas, previniendo así errores comunes de la API de Google Maps.
