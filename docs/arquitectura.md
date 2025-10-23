
# Diseño de Arquitectura de la Solución "Rutero"

## 1. Diagrama de Arquitectura

El siguiente diagrama ilustra la arquitectura de alto nivel de la aplicación "Rutero", mostrando los componentes principales y cómo interactúan entre sí.

```mermaid
graph TD
    subgraph "Navegador del Usuario"
        A[Frontend App - Next.js/React]
    end

    subgraph "Servidor Next.js (Vercel/Host)"
        B[API Routes (Proxy)]
    end

    subgraph "Google Cloud Platform"
        C[Firebase Authentication]
        D[Firestore Database]
    end

    subgraph "Servicios de Terceros"
        E[API Externa de Predicción]
        F[API Externa de Ruta Óptima]
        G[Google Maps Platform API]
    end

    A --"Inicia Sesión / Lee y escribe datos"--> C
    A --"Lee y escribe datos (CRUD)"--> D
    A --"Peticiones a /api/*"--> B
    A --"Renderiza mapa y marcadores"--> G

    B --"Llama a API de predicción"--> E
    B --"Llama a API de ruta óptima"--> F
```

## 2. Descripción de Componentes

### 2.1. Frontend (Navegador del Usuario)

- **Tecnología**: Aplicación de página única (SPA) construida con **Next.js** y **React**.
- **Renderizado**: Utiliza el **App Router** de Next.js, lo que permite una combinación de Server Components (para renderizado inicial rápido y seguro) y Client Components (para interactividad).
- **UI**: La interfaz de usuario está construida con componentes de **ShadCN/UI** y estilizada con **Tailwind CSS**, lo que garantiza una apariencia moderna y un desarrollo ágil.
- **Manejo de Estado**: El estado global, especialmente la información del usuario y los datos compartidos como clientes y usuarios, se gestiona a través del **React Context API** (`AuthProvider`).
- **Interacción con Servicios**:
    - Se comunica directamente con **Firebase Authentication** para el manejo de sesiones (inicio de sesión, cierre de sesión, etc.).
    - Realiza todas las operaciones de lectura y escritura (CRUD) directamente contra **Firestore**, aprovechando las reglas de seguridad para proteger los datos.
    - Utiliza la **API de Google Maps** (`@vis.gl/react-google-maps`) para renderizar mapas, marcadores y rutas en el navegador.
    - Para las funcionalidades de IA, realiza peticiones a su propio backend (`/api/*`) en lugar de llamar directamente a las APIs externas.

### 2.2. Servidor Next.js (Backend For Frontend - BFF)

- **Función Principal**: Actúa como una capa intermedia o un **Backend For Frontend (BFF)**. Su rol principal es servir de **proxy** para las llamadas a las APIs externas.
- **Rutas de API (`/api/*`)**:
    - `api/predicciones`: Recibe la solicitud del frontend, la reenvía a la API externa de predicción y devuelve la respuesta.
    - `api/ruta-optima`: Recibe la solicitud del frontend con los waypoints, la reenvía a la API externa de optimización y devuelve la respuesta.
- **Beneficios**:
    - **Evita Problemas de CORS**: Al hacer las llamadas de servidor a servidor, se eliminan los errores de Cross-Origin Resource Sharing (CORS) que ocurrirían si el navegador llamara directamente a una API en un dominio diferente.
    - **Seguridad**: Oculta las URLs reales de las APIs externas y permite añadir una capa de autenticación o manejo de claves de API en el servidor, sin exponerlas en el cliente.

### 2.3. Servicios de Google Cloud (Firebase)

- **Firebase Authentication**:
    - Proporciona un sistema completo y seguro para la gestión de usuarios, incluyendo inicio de sesión con correo/contraseña y restablecimiento de contraseña.
    - Es el pilar de la seguridad del lado del cliente, ya que el estado de autenticación del usuario se utiliza en las reglas de seguridad de Firestore.

- **Firestore Database**:
    - Es la base de datos NoSQL donde se almacena toda la información persistente de la aplicación, organizada en colecciones:
        - `users`: Perfiles de los usuarios, incluyendo su rol y supervisor asignado.
        - `clients`: Información detallada de cada cliente.
        - `routes`: Todos los planes de ruta creados, con su estado y clientes asociados.
        - `notifications`: Notificaciones generadas para los usuarios.
    - **Reglas de Seguridad**: La integridad y seguridad de los datos están garantizadas por las reglas de seguridad de Firestore, que definen quién puede leer, escribir, actualizar o eliminar documentos en cada colección, basándose en el rol y el ID del usuario autenticado.

### 2.4. Servicios de Terceros

- **APIs Externas (en `onrender.com`)**:
    - **API de Predicción**: Un modelo de machine learning que, dada una fecha y un número de días, predice qué clientes son más propensos a ser visitados.
    - **API de Ruta Óptima**: Un servicio que recibe un punto de origen y una lista de paradas (waypoints) y devuelve el orden óptimo para visitarlos, minimizando la distancia o el tiempo de viaje.

- **Google Maps Platform**:
    - Se utiliza en el frontend para la visualización de datos geoespaciales.
    - **Maps JavaScript API**: Renderiza el mapa base.
    - **Advanced Markers**: Muestra las ubicaciones de los clientes en el mapa.
    - **Directions Service**: Calcula y dibuja las rutas entre múltiples puntos para la funcionalidad de ruta óptima.
