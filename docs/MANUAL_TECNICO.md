
# Manual Técnico del Aplicativo "Rutero"

## 1. Descripción General

Rutero es una aplicación web avanzada diseñada para la planificación, gestión y optimización de rutas de venta y cobranza. Construida sobre un stack tecnológico moderno, permite a los usuarios administrar clientes, planificar rutas, asignar supervisores, visualizar ubicaciones en un mapa interactivo y utilizar modelos de inteligencia artificial para predecir visitas y calcular rutas óptimas.

Para una visión de alto nivel de los componentes y sus interacciones, consulta el documento de [Diseño de Arquitectura](docs/arquitectura.md).

### 1.1. Stack Tecnológico

- **Framework Frontend**: Next.js 15 (con App Router)
- **Lenguaje**: TypeScript
- **Base de Datos y Autenticación**: Google Firebase (Firestore y Authentication) en el proyecto `rutero-fed`.
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
  - **`auth-context.tsx`**: El corazón del manejo de estado global. Proporciona información del usuario, datos de clientes, usuarios, rutas y contactos del CRM a toda la aplicación.

- **`hooks/`**: Hooks de React personalizados.
  - **`use-auth.ts`**: Simplifica el acceso al `AuthContext`.
  - **`use-toast.ts`**: Hook para mostrar notificaciones (toasts).

- **`lib/`**: Contiene la lógica de negocio, tipos y utilidades.
  - **`firebase/`**:
    - **`config.ts`**: Configuración e inicialización de Firebase.
    - **`auth.ts`**: Funciones de ayuda para la autenticación (login, logout, etc.).
    - **`firestore.ts`**: Funciones para interactuar con la base de datos Firestore (CRUD para usuarios, clientes, rutas, etc.).
  - **`types.ts`**: Define los tipos de datos principales (`User`, `Client`, `RoutePlan`, `Notification`, `PhoneContact`).
  - **`utils.ts`**: Funciones de utilidad, como `cn` para combinar clases de Tailwind.

- **`services/`**: Contiene funciones para interactuar con APIs externas.
  - **`api.ts`**: Define las funciones `getPredicciones` y `getRutaOptima` que se comunican con los endpoints proxy de la aplicación.

- **`docs/`**: Contiene la documentación del proyecto.
    - **`arquitectura.md`**: Describe la arquitectura de alto nivel de la solución.

---

## 3. Documentación Funcional (¿Qué hace la aplicación?)

Esta sección describe las capacidades de la aplicación desde la perspectiva de un usuario final.

### 3.1. Roles de Usuario y Permisos

El sistema está diseñado para cuatro roles con responsabilidades claras:

- **Administrador:**
  - **Gestión Total de Usuarios:** Puede crear, editar (incluyendo nombre y correo) y eliminar usuarios de cualquier rol.
  - **Gestión Total de Clientes:** Tiene control absoluto sobre el CRUD (Crear, Leer, Actualizar, Eliminar) de la base de datos de clientes.
  - **Gestión de Ubicaciones:** Puede actualizar masivamente las coordenadas geográficas de los clientes.
  - **Visibilidad Completa:** Tiene acceso a todas las rutas, reportes y dashboards del sistema.
  - **Aprobación de Rutas:** Puede aprobar o rechazar rutas enviadas por cualquier usuario.

- **Supervisor:**
  - **Gestión de su Equipo:** Puede ver y gestionar las rutas y reportes de los vendedores (rol "Usuario") que tiene asignados.
  - **Aprobación de Rutas:** Es el responsable principal de aprobar o rechazar las rutas planificadas por su equipo.
  - **Gestión de Clientes:** Puede ver y editar la información de todos los clientes. No puede crear ni eliminar clientes.
  - **Generación de Reportes:** Puede descargar reportes de las rutas completadas por su equipo.

- **Usuario (Vendedor) y Telemercaderista:**
  - **Planificación de Rutas:** Es el rol principal encargado de planificar las rutas. Puede usar las predicciones de la IA para generar una base y luego ajustarla.
  - **Envío a Aprobación:** Envía sus rutas planificadas a su supervisor asignado para que sean aprobadas.
  - **Gestión de Ruta Diaria:** Inicia la ruta del día, registra las visitas a cada cliente (check-in/check-out), e ingresa los datos de la gestión (ventas, cobros, etc.).
  - **Gestión de su Cartera:** Solo puede ver los clientes que tiene asignados a su nombre (ejecutivo).
  - **Reportes Propios:** Puede visualizar y descargar sus propios reportes de rutas completadas.

### 3.2. Módulo de Clientes

- **Creación y Edición:** El administrador puede añadir nuevos clientes manualmente o editar los existentes. Campos como RUC, nombre, dirección y coordenadas son gestionados aquí.
- **Importación Masiva:** El administrador puede subir un archivo (CSV o Excel) para crear o actualizar clientes en lote, agilizando la carga de datos.
- **Visualización y Filtro:** Todos los usuarios pueden ver la lista de clientes, filtrarlos por estado (activo/inactivo) y buscarlos por nombre, RUC, provincia, etc.
- **Geolocalización:** El módulo de "Ubicaciones" permite al administrador actualizar masivamente las coordenadas (latitud/longitud) de los clientes a través de un archivo CSV y previsualizarlas en un mapa.

### 3.3. Módulo de Rutas (Flujo de Trabajo Principal)

1.  **Planificación (IA y Manual):**
    *   **Predicción IA:** Un usuario va a "Predicción de Ruta", selecciona un rango de fechas y la IA sugiere una lista de clientes a visitar.
    *   **Guardado y Revisión:** El usuario guarda esta predicción como una nueva ruta, la cual queda en estado "Planificada". Es redirigido para revisarla, añadir o quitar clientes manualmente y ajustar detalles.
    *   **Planificación Manual:** El usuario también puede crear una ruta desde cero, seleccionando manualmente los clientes.

2.  **Aprobación:**
    *   Una vez que la ruta está lista, el usuario la **"Envía a Aprobación"**. El estado cambia a "Pendiente de Aprobación" y su supervisor asignado recibe una notificación.
    *   El **Supervisor** revisa la ruta. Puede aprobarla (cambia a "Planificada") o rechazarla (añadiendo una observación). El creador de la ruta es notificado.

3.  **Gestión Diaria:**
    *   En el día correspondiente, el usuario va a "Gestión de Ruta", selecciona la ruta planificada y la **inicia**. El estado cambia a "En Progreso".
    *   El usuario ve la lista de clientes del día. Por cada uno, realiza check-in, registra datos (venta, cobro, etc.) y realiza check-out. El progreso se guarda en cada paso.
    *   Al finalizar el último cliente, la ruta se marca automáticamente como "Completada".

4.  **Optimización:**
    *   La sección "Ruta Óptima" permite a los usuarios obtener el orden de visita más eficiente para un conjunto de paradas.

### 3.4. Sistema de Notificaciones y Reportes

- **Notificaciones:** El sistema genera notificaciones automáticas para los flujos de aprobación, manteniendo a los usuarios informados.
- **Reportes:** Los Supervisores y Administradores pueden descargar reportes de rutas completadas de su equipo. Los Vendedores pueden descargar sus propios reportes.

---

## 4. Funcionalidades Clave (Vista Técnica)

### 4.1. Autenticación y Manejo de Sesión

- **Flujo**: Gestionado por Firebase Authentication. El `AuthProvider` (`src/contexts/auth-context.tsx`) detecta el cambio de estado (`onAuthStateChanged`), carga el perfil del usuario desde la colección `users` en Firestore y los datos globales (clientes, usuarios, etc.).
- **Roles de Usuario**: Los roles (`Administrador`, `Supervisor`, `Usuario`, `Telemercaderista`) se usan para implementar la lógica de autorización en los componentes, mostrando u ocultando elementos de la UI.

### 4.2. Gestión de Datos con Firestore

- **Modelo de Datos**: Los tipos principales (`User`, `Client`, `RoutePlan`, `Notification`, `PhoneContact`) definidos en `src/lib/types.ts` se corresponden con las colecciones en Firestore.
- **Acceso a Datos**: Todas las operaciones CRUD se centralizan en `src/lib/firebase/firestore.ts`.
- **Optimización**: Para optimizar el uso de cuota, los datos de `users`, `clients`, `routes` y `phoneContacts` se cargan una sola vez al iniciar sesión y se actualizan manualmente (`refetchData`) tras operaciones CRUD. Solo las `notifications` usan una escucha en tiempo real.

### 4.3. Sistema de Notificaciones

- **Generación**: Las notificaciones se crean en Firestore mediante la función `addNotification` cuando una ruta se envía, aprueba o rechaza.
- **Visualización**: El `AuthProvider` se suscribe a las notificaciones del usuario, que se muestran en el componente `user-nav.tsx`.

### 4.4. Integración con APIs Externas (Predicción y Ruta Óptima)

Para evitar problemas de CORS y proteger claves de API, la aplicación utiliza rutas de API de Next.js como **proxies**. El frontend llama a un endpoint local (ej. `/api/predicciones`), y este a su vez llama al servicio externo.

### 4.5. Mapas y Geolocalización

- **Componente Principal**: La visualización de mapas se centraliza en `src/components/map-view.tsx`.
- **Renderizado**: Utiliza `@vis.gl/react-google-maps` para renderizar el mapa y los marcadores.
- **Rutas Óptimas**: El componente puede dibujar una ruta entre múltiples puntos utilizando el `DirectionsService` de Google Maps.
