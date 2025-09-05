
# Manual Técnico del Aplicativo "Rutero"

## 1. Descripción General

Rutero es una aplicación web avanzada diseñada para la planificación, gestión y optimización de rutas de venta y cobranza. Construida sobre un stack tecnológico moderno, permite a los usuarios administrar clientes, planificar rutas, asignar supervisores, visualizar ubicaciones en un mapa interactivo y utilizar modelos de inteligencia artificial para predecir visitas y calcular rutas óptimas.

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

---

## 3. Funcionalidades Clave

### 3.1. Autenticación y Manejo de Sesión

- **Flujo**: El flujo de autenticación es gestionado por Firebase Authentication.
  1.  El usuario ingresa sus credenciales en `/login`.
  2.  La función `handleSignIn` en `src/lib/firebase/auth.ts` se comunica con Firebase.
  3.  El `AuthProvider` (`src/contexts/auth-context.tsx`) detecta el cambio de estado de autenticación a través de `onAuthStateChanged`.
  4.  Al detectar un usuario, carga su perfil desde la colección `users` en Firestore y los datos globales (clientes, usuarios).
  5.  La aplicación redirige al `/dashboard`.

- **Roles de Usuario**: El sistema maneja tres roles: `Administrador`, `Supervisor` y `Usuario`. La lógica de autorización se implementa directamente en los componentes, mostrando u ocultando elementos de la interfaz según el `user.role` disponible en el `AuthContext`.

### 3.2. Gestión de Datos con Firestore

- **Modelo de Datos**: Los tipos principales (`User`, `Client`, `RoutePlan`, `Notification`) están definidos en `src/lib/types.ts` y se corresponden con las colecciones en Firestore.
- **Acceso a Datos**: Todas las operaciones CRUD se centralizan en `src/lib/firebase/firestore.ts`.
- **Optimización**: Para evitar exceder la cuota de Firestore, la aplicación sigue una estrategia de carga de datos optimizada:
  1.  **Carga Única**: Los datos de `users` y `clients`, que no cambian con frecuencia, se cargan una sola vez al iniciar sesión en el `AuthProvider`.
  2.  **Actualización Manual**: Después de una operación CRUD (ej. crear un cliente), se llama a la función `refetchData` del `AuthContext` para volver a cargar los datos relevantes y mantener la UI actualizada.
  3.  **Tiempo Real (Solo para Notificaciones)**: La única escucha en tiempo real (`onSnapshot`) activa es para la colección de `notifications`, ya que estas sí requieren actualizaciones instantáneas.

### 3.3. Sistema de Notificaciones

- **Generación**: Las notificaciones se crean en Firestore mediante la función `addNotification` en `firestore.ts`. Esto ocurre en dos escenarios:
  1.  Un `Usuario` envía una ruta a aprobación, generando una notificación para el `Supervisor` asignado.
  2.  Un `Supervisor` aprueba o rechaza una ruta, generando una notificación para el `Usuario` que la creó.
- **Visualización**:
  1.  El `AuthProvider` se suscribe a las notificaciones del usuario logueado.
  2.  `user-nav.tsx` muestra un indicador (`Bell`) y un contador de notificaciones no leídas.
  3.  Un `Popover` muestra la lista de notificaciones, permitiendo marcarlas como leídas.
  4.  Al iniciar sesión, si hay notificaciones nuevas, se muestra una alerta (`toast`).

### 3.4. Integración con APIs Externas (Predicción y Ruta Óptima)

Para evitar problemas de CORS y proteger posibles claves de API en el futuro, la aplicación utiliza rutas de API de Next.js como **proxies**.

- **Flujo de Petición**:
  1.  El componente del frontend (ej. `PrediccionesPage`) llama a una función del servicio (ej. `getPredicciones` en `src/services/api.ts`).
  2.  Esta función construye una URL y realiza una petición `fetch` al endpoint proxy de la propia aplicación (ej. `/api/predicciones`).
  3.  El manejador de la ruta de API (ej. `src/app/api/predicciones/route.ts`) recibe la petición, la reenvía al servicio externo (`api-distribucion-rutas.onrender.com`) y devuelve la respuesta al cliente.

### 3.5. Mapas y Geolocalización

- **Componente Principal**: La visualización de mapas se centraliza en `src/components/map-view.tsx`.
- **Renderizado**: Utiliza `@vis.gl/react-google-maps` para renderizar el mapa y los marcadores (`AdvancedMarker`).
- **Rutas Óptimas**: El mismo componente `MapView` tiene la capacidad de dibujar una ruta entre múltiples puntos utilizando el `DirectionsService` de Google Maps. Se activa mediante la prop `showDirections`.
- **Manejo de Errores**: El componente incluye validaciones para asegurarse de que solo se intenten renderizar coordenadas numéricas válidas, previniendo así errores comunes de la API de Google Maps.
