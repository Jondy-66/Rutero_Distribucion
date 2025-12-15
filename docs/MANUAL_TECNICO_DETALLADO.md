
Versión: 1.0
Fecha: __________________
Autor(es): __________________
Departamento: __________________
Empresa: __________________

---

## Índice de Contenido
1.	[Introducción](#1-introducción)
2.	[Descripción General del Sistema](#2-descripción-general-del-sistema)
3.	[Arquitectura de la Solución](#3-arquitectura-de-la-solución)
4.	[Estructura del Proyecto / Componentes Técnicos](#4-estructura-del-proyecto--componentes-técnicos)
5.	[Instalación y Configuración](#5-instalación-y-configuración)
6.	[Base de Datos](#6-base-de-datos)
7.	[Funcionalidades Clave (Vista Técnica)](#7-funcionalidades-clave-vista-técnica)
8.	[Seguridad y Cumplimiento](#8-seguridad-y-cumplimiento)
9.	[Mantenimiento y Actualizaciones](#9-mantenimiento-y-actualizaciones)
10.	[Pruebas y Calidad del Software](#10-pruebas-y-calidad-del-software)
11.	[Logs, Monitoreo y Alertas](#11-logs-monitoreo-y-alertas)
12.	[Manual de Soporte (Troubleshooting)](#12-manual-de-soporte-troubleshooting)
13.	[Anexos](#13-anexos)

---

### 1. Introducción
Este manual técnico tiene como propósito documentar los aspectos funcionales, técnicos y operativos del aplicativo "Rutero", permitiendo su correcta instalación, mantenimiento y evolución en el tiempo. El documento está dirigido a desarrolladores, ingenieros de soporte, analistas QA y personal de infraestructura.

### 2. Descripción General del Sistema
Rutero es una aplicación web avanzada diseñada para la planificación, gestión y optimización de rutas de venta y cobranza. Construida sobre un stack tecnológico moderno, permite a los usuarios administrar clientes, planificar rutas, asignar supervisores, visualizar ubicaciones en un mapa interactivo y utilizar modelos de inteligencia artificial para predecir visitas y calcular rutas óptimas.

Los roles de usuario principales son:
- **Administrador:** Gestión total del sistema (usuarios, clientes, rutas).
- **Supervisor:** Gestiona y aprueba las rutas de los vendedores a su cargo.
- **Usuario (Vendedor):** Planifica y ejecuta las rutas diarias de visita a clientes.
- **Telemercaderista:** Rol con permisos similares al 'Usuario', enfocado en gestión remota.

### 3. Arquitectura de la Solución
El siguiente diagrama ilustra la arquitectura de alto nivel de la aplicación "Rutero", mostrando los componentes principales y cómo interactúan entre sí.

```mermaid
graph TD
    subgraph "Navegador del Usuario"
        A[Frontend App - Next.js/React]
    end

    subgraph "Servidor Next.js (Vercel/Host)"
        B[API Routes (Proxy & Admin)]
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
    B --"Usa Admin SDK para cambiar pass"--> C
```
**Descripción de Componentes:**

- **Frontend (Next.js/React):** Aplicación de página única (SPA) que se ejecuta en el navegador del usuario. Utiliza el App Router de Next.js para una combinación de Server y Client Components. La UI está construida con ShadCN/UI y Tailwind CSS. Se comunica directamente con Firebase para autenticación y datos, y con su propio backend (API Routes) para las llamadas a servicios de IA y operaciones de administrador.
- **Servidor Next.js (BFF):** Actúa como un Backend For Frontend. Sirve como un proxy seguro para las llamadas a las APIs externas (evitando problemas de CORS y protegiendo claves) y aloja lógica de servidor para operaciones privilegiadas, como el cambio de contraseña de un usuario por parte de un administrador, utilizando el **Firebase Admin SDK**.
- **Firebase (Google Cloud):**
    - **Authentication:** Gestiona el inicio de sesión con correo/contraseña. El Admin SDK en el backend le permite realizar operaciones de gestión de usuarios.
    - **Firestore:** Base de datos NoSQL donde se almacena toda la información de usuarios, clientes, rutas y notificaciones. Las reglas de seguridad de Firestore garantizan la integridad y el acceso a los datos.
- **Servicios de Terceros:**
    - **APIs Externas:** Servicios de Machine Learning para predecir visitas y optimizar rutas.
    - **Google Maps Platform:** Proporciona los mapas, marcadores y el servicio de direcciones para la visualización de rutas.


### 4. Estructura del Proyecto / Componentes Técnicos
El proyecto sigue la estructura estándar de una aplicación Next.js con el App Router. Los directorios más importantes dentro de `src/` son:

- **`app/`**: Contiene todas las rutas y páginas de la aplicación.
  - **`(auth)/`**: Rutas de autenticación (`login`, `forgot-password`).
  - **`api/`**: Endpoints de Next.js. Incluye los proxies para servicios externos y la lógica de backend para operaciones de administrador (ej. `set-user-password`).
  - **`dashboard/`**: Layout y páginas protegidas del panel de control.
    - **`users/permissions`**: Nueva página para la gestión de permisos por módulo.
- **`components/`**: Componentes de React reutilizables (UI de ShadCN y componentes personalizados).
- **`contexts/`**: Proveedores de contexto, principalmente `auth-context.tsx` para el estado global.
- **`hooks/`**: Hooks personalizados como `use-auth.ts`.
- **`lib/`**: Lógica de negocio, tipos y utilidades.
  - **`firebase/`**: Configuración de Firebase y funciones de ayuda.
    - **`config.ts`**: Configuración del SDK de cliente de Firebase.
    - **`admin-config.ts`**: Configuración del SDK de Administrador de Firebase (para el backend).
    - **`auth.ts`**: Funciones de ayuda para autenticación (login, logout, etc.).
    - **`firestore.ts`**: Funciones para interactuar con Firestore.
  - **`types.ts`**: Definiciones de tipos de TypeScript para los datos principales, incluyendo `failedLoginAttempts`.
- **`services/`**: Funciones para interactuar con las API proxy.
- **`docs/`**: Documentación del proyecto.

### 5. Instalación y Configuración
**Requerimientos del Sistema:**
- Node.js (versión 20.x o superior)
- npm o yarn

**Pasos de Instalación:**
1. Clonar el repositorio: `git clone <url_del_repositorio>`
2. Navegar al directorio del proyecto: `cd rutero`
3. Instalar dependencias: `npm install`

**Variables de Entorno:**
Crear un archivo `.env.local` en la raíz del proyecto con las siguientes variables:
```
# Clave de API de Google Maps para el frontend
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...

# Configuración de Firebase (obtenida desde la consola de Firebase) - LADO DEL CLIENTE
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

# Credenciales de la Cuenta de Servicio de Firebase (para el Admin SDK) - LADO DEL SERVIDOR
# Estas deben configurarse en el entorno de despliegue (ej. Vercel)
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@...iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Ejecución en Desarrollo:**
```bash
npm run dev
```
La aplicación estará disponible en `http://localhost:9002`.

### 6. Base de Datos
- **Motor:** Google Firestore (NoSQL).
- **Colecciones Principales:**
    - `users`: Almacena los perfiles de usuario, incluyendo su rol (`Administrador`, `Supervisor`, `Usuario`, `Telemercaderista`), estado (`active`, `inactive`) y `failedLoginAttempts`. El ID del documento corresponde al UID de Firebase Authentication.
    - `clients`: Contiene la información de todos los clientes (RUC, nombre, dirección, coordenadas, etc.).
    - `routes`: Guarda todos los planes de ruta, su estado (`Planificada`, `En Progreso`, etc.), los clientes asociados y el supervisor asignado.
    - `notifications`: Almacena notificaciones para los usuarios, con suscripción en tiempo real.
    - `phoneContacts`: Almacena la base de contactos telefónicos para el módulo CRM.
- **Seguridad:** El acceso a los datos está controlado por las **Reglas de Seguridad de Firestore**, que validan las operaciones de lectura y escritura basándose en el rol y el ID del usuario autenticado.

### 7. Funcionalidades Clave (Vista Técnica)
- **Autenticación y Sesión:** Gestionada por Firebase Authentication y el `AuthProvider` (`src/contexts/auth-context.tsx`), que se suscribe a los cambios de estado (`onAuthStateChanged`) y carga el perfil del usuario desde Firestore.
- **Gestión de Datos con Firestore:** Centralizada en `src/lib/firebase/firestore.ts`. Se utiliza una estrategia de carga única para datos globales (usuarios, clientes) para optimizar el uso de cuota, con recargas manuales (`refetchData`) después de operaciones CRUD.
- **Notificaciones en Tiempo Real:** El `AuthProvider` se suscribe a la colección `notifications` del usuario logueado usando `onSnapshot`, mostrando alertas y actualizando el contador de no leídas en la `UserNav`.
- **Integración con APIs Externas:** Se utilizan rutas de API de Next.js como proxies (`/api/predicciones`, `/api/ruta-optima`) para evitar problemas de CORS y proteger las URLs y tokens de los servicios externos. Los nuevos parámetros para la predicción (`lat_base`, `lon_base`, `max_km`, `token`) se gestionan a través de este proxy.
- **Mapas y Geolocalización:** Se centraliza en el componente `src/components/map-view.tsx`, utilizando `@vis.gl/react-google-maps` para renderizar el mapa, `AdvancedMarker` para los marcadores y el `DirectionsService` de Google Maps para dibujar rutas.
- **Importación y Exportación de Datos:**
    - **Importación:** Los módulos de Clientes y Base Telefónica permiten la carga masiva de datos desde archivos CSV o Excel. La lógica de parseo se realiza en el cliente con `papaparse` y `xlsx`, y los datos se envían en lotes a Firestore.
    - **Exportación:** El módulo de Clientes permite descargar la lista filtrada en formato Excel (`.xlsx`).

### 8. Seguridad y Cumplimiento
- **Autenticación:** Realizada por Firebase Authentication, que utiliza tokens (JWT) para gestionar las sesiones de forma segura.
- **Creación Segura de Usuarios (Admin):** Para evitar que un administrador sea deslogueado al crear un nuevo usuario, se utiliza una instancia secundaria y temporal de la aplicación de Firebase. Esta instancia se usa para llamar a `createUserWithEmailAndPassword` y se destruye inmediatamente después, aislando la operación de la sesión principal del administrador.
- **Cambio de Contraseña por Admin:** Se realiza a través de un endpoint seguro en el backend (`/api/set-user-password`) que utiliza el **Firebase Admin SDK**, el cual sí tiene los permisos para modificar la contraseña de otro usuario. El frontend nunca tiene acceso a esta lógica privilegiada.
- **Bloqueo Inteligente:** Se ha implementado un mecanismo de bloqueo de cuentas en `src/app/(auth)/login/page.tsx`. Tras 5 intentos de inicio de sesión fallidos, la cuenta del usuario se marca como `inactive` en Firestore y se bloquea el acceso. El desbloqueo debe ser realizado por un `Administrador`.
- **Recuperación de Contraseña:** El flujo en `src/app/(auth)/forgot-password/page.tsx` ha sido modificado para validar la existencia del correo electrónico en Firestore antes de invocar el envío del correo de recuperación, mostrando un error si el usuario no existe.
- **Autorización:** Implementada en el frontend (mostrando/ocultando UI según el rol) y reforzada en el backend con Reglas de Seguridad de Firestore. Por ejemplo, un `Usuario` solo puede modificar las rutas que ha creado (`request.auth.uid == resource.data.createdBy`).
- **Protección de Datos:** Las claves de API y URLs de servicios sensibles están en el backend (API Routes), no expuestas en el cliente.
- **Cumplimiento:** Se recomienda seguir las mejores prácticas de OWASP Top 10 para aplicaciones web.

### 9. Mantenimiento y Actualizaciones
- **Control de Versiones:** Se utiliza Git y se recomienda un flujo de trabajo como GitFlow (branches `main`, `develop`, `feature/*`).
- **Despliegues:** La aplicación está configurada para ser desplegada en un entorno compatible con Next.js (como Vercel o Firebase App Hosting). El despliegue se activa con `npm run build`.
- **Respaldos:** Firestore ofrece respaldos automáticos gestionados desde la consola de Google Cloud. Se recomienda configurar exportaciones periódicas.

### 10. Pruebas y Calidad del Software
La estrategia de calidad del software se centra en garantizar la fiabilidad, funcionalidad y mantenibilidad de la aplicación a través de varios niveles de pruebas y estándares de codificación.

- **Calidad del Código:**
    - **TypeScript:** El uso de TypeScript en todo el proyecto asegura la tipificación estática, lo que permite detectar errores en tiempo de desarrollo y mejorar la legibilidad y el autocompletado del código.
    - **Linting y Formateo:** Se utilizan herramientas como **ESLint** para aplicar reglas de estilo y buenas prácticas de codificación de manera automática. Esto ayuda a mantener un código consistente y a prevenir errores comunes.
    - **Revisión de Código (Code Review):** Se recomienda un proceso de revisión por pares antes de integrar nuevo código a la rama principal para garantizar que cumple con los estándares de calidad del equipo.

- **Pruebas Unitarias (Unit Testing):**
    - **Objetivo:** Verificar que los componentes individuales y las funciones de lógica de negocio (helpers, utils) funcionen como se espera de forma aislada.
    - **Herramientas Recomendadas:** **Jest** como corredor de pruebas y **React Testing Library** para renderizar y probar componentes de React.
    - **Ejemplos de Casos de Prueba:**
        - Un componente de botón (`Button`) se renderiza correctamente y responde a los eventos de clic.
        - Un hook como `useAuth` lanza un error si se usa fuera de su proveedor.
        - Una función de utilidad en `src/lib/utils.ts` formatea una fecha correctamente.

- **Pruebas de Integración (Integration Testing):**
    - **Objetivo:** Asegurar que diferentes partes de la aplicación funcionen juntas correctamente. Especialmente importante para la interacción entre el frontend y los servicios de backend (Firebase).
    - **Herramientas Recomendadas:** Se puede usar **React Testing Library** junto con el **emulador de Firebase** para simular la base de datos y la autenticación en un entorno de prueba controlado.
    - **Ejemplos de Casos de Prueba:**
        - Al llenar un formulario de "Nuevo Cliente" y hacer clic en "Guardar", se verifica que la función `addClient` de Firestore sea llamada con los datos correctos.
        - Un usuario con rol "Usuario" no puede ver los botones de administración.
        - Al iniciar sesión con credenciales incorrectas, se muestra el toast de error correspondiente.

- **Pruebas End-to-End (E2E Testing):**
    - **Objetivo:** Simular flujos de usuario completos en un entorno lo más parecido posible a producción para validar la funcionalidad de la aplicación de principio a fin.
    - **Herramientas Recomendadas:** **Cypress** o **Playwright**.
    - **Ejemplos de Flujos a Probar:**
        1.  **Flujo de Aprobación de Ruta:**
            - Un usuario "Vendedor" inicia sesión.
            - Crea una nueva ruta, añade clientes y la envía a aprobación.
            - Cierra sesión.
            - Un usuario "Supervisor" inicia sesión.
            - Encuentra la ruta pendiente, la revisa y la aprueba.
            - Verifica que el estado de la ruta cambie a "Planificada".
        2.  **Flujo de Bloqueo de Cuenta:**
            - Intentar iniciar sesión con un usuario y contraseña incorrecta 5 veces.
            - Verificar que se muestra el mensaje de "Cuenta bloqueada".
            - Iniciar sesión como "Administrador".
            - Navegar al perfil del usuario bloqueado, cambiar su estado a "activo" y guardar.
            - Volver a iniciar sesión con el usuario (ahora desbloqueado) y las credenciales correctas para confirmar el acceso.

### 11. Logs, Monitoreo y Alertas
- **Logging:** Las rutas API de Next.js utilizan `console.error` para registrar errores del lado del servidor. El frontend también registra errores en la consola del navegador. Se recomienda integrar un servicio de logging centralizado (ej. Sentry, Logtail).
- **Monitoreo:** El proveedor de hosting (ej. Vercel) ofrece dashboards de monitoreo de rendimiento. Firebase proporciona métricas de uso de Firestore y Authentication.
- **Alertas:** *(Pendiente de configuración)*. Se deben configurar alertas en el servicio de monitoreo para notificar sobre picos de errores o degradación del rendimiento.

### 12. Manual de Soporte (Troubleshooting)
| Error Común | Causa Probable | Solución |
| :--- | :--- | :--- |
| El usuario no puede iniciar sesión. | Credenciales incorrectas o el usuario no existe. | Verificar correo/contraseña. Utilizar la función "Recuperar Contraseña". Si persiste, verificar en Firebase Auth. |
| El usuario reporta cuenta bloqueada. | El usuario ha superado los 5 intentos fallidos de inicio de sesión. | Un `Administrador` debe acceder al perfil del usuario en la sección "Usuarios", cambiar su estado de `inactive` a `active` y guardar los cambios. |
| No se puede cambiar la contraseña de otro usuario. | Las variables de entorno del Admin SDK (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`) no están configuradas en el entorno de despliegue. | El administrador del sistema debe configurar las variables de entorno de la cuenta de servicio de Firebase en la configuración del hosting (ej. Vercel). |
| El usuario no puede ver datos (clientes, rutas). | Error en las reglas de seguridad de Firestore o el usuario no tiene el rol correcto. | Verificar los logs de Firestore y las reglas de seguridad. Asegurarse de que el `user.role` sea el adecuado. |
| El mapa no se carga. | La `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` no está configurada o es incorrecta. | Revisar el archivo `.env.local` y asegurarse de que la clave de API de Google Maps sea válida. |
| Las predicciones de ruta fallan. | El servicio externo `api-distribucion-rutas.onrender.com` está caído o hay un problema de red. | Verificar el estado del servicio externo y los logs de la ruta proxy en `/api/predicciones`. |
| Carga masiva de clientes falla. | El archivo CSV/Excel no tiene las columnas requeridas (`Ruc`, `Nombre_cliente`, etc.) o los datos tienen formato incorrecto. | Asegurarse de que el archivo cumpla con la estructura definida y no tenga filas vacías o datos inválidos. |

### 13. Anexos
*(Esta sección puede incluir diagramas de flujo de datos detallados, un glosario de términos, ejemplos de código clave, etc.)*
