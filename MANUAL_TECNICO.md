
# Manual Técnico del Aplicativo "Rutero"

## 1. Descripción General

Rutero es una aplicación web avanzada diseñada para la planificación, gestión y optimización de rutas de venta y cobranza. Construida sobre un stack tecnológico moderno, permite a los usuarios administrar clientes, planificar rutas, asignar supervisores, visualizar ubicaciones en un mapa interactivo y utilizar modelos de inteligencia artificial para predecir visitas y calcular rutas óptimas.

### 1.1. Stack Tecnológico

- **Framework Frontend**: Next.js 15 (con App Router)
- **Lenguaje**: TypeScript
- **Base de Datos y Autenticación**: Google Firebase (Firestore y Authentication)
- **UI y Estilos**: ShadCN/UI y Tailwind CSS
- **Manejo de Errores**: Arquitectura contextual `FirestorePermissionError` para depuración de Security Rules.

---

## 2. Estructura del Proyecto

- **`app/dashboard/routes/management`**: Módulo de ejecución diaria. Implementa una lógica de filtrado de **Semana ISO** (Lunes a Domingo) para garantizar que los planes hechos el fin de semana sean visibles inmediatamente.
- **`contexts/auth-context.tsx`**: Centraliza la carga de datos. Incluye manejo de errores en `onSnapshot` para emitir alertas contextuales si fallan los permisos.
- **`lib/firebase/firestore.ts`**: Capa CRUD con soporte para operaciones masivas (batch) y actualización de ubicaciones GPS.

---

## 3. Lógicas Críticas de Negocio

### 3.1. Visibilidad de Rutas
El sistema calcula el inicio de la semana laboral cada **Lunes**. Las rutas planificadas son visibles en el selector de gestión si su fecha es igual o posterior al lunes vigente. Esto soluciona problemas de desfase cuando se planifica un sábado o domingo.

### 3.2. Gestión Multiusuario (Admin)
Los usuarios con rol de **Administrador** tienen habilitada la opción **"Gestionar Jornada"** dentro del panel de Rutas de Equipo. Esto permite al administrador iniciar, editar y finalizar la ruta de cualquier usuario del sistema en tiempo real para fines de soporte.

---

## 4. Seguridad y Errores

### 4.1. FirestorePermissionError
La aplicación utiliza un emisor de eventos global (`errorEmitter`) para capturar fallos de permisos en Firestore. En lugar de un error genérico, el sistema muestra el objeto de la solicitud denegada, facilitando el ajuste de las reglas de seguridad.

### 4.2. Bloqueo de Jornada
Por política de seguridad, la edición de gestiones se bloquea automáticamente todos los días a las **19:00** y los viernes para el cierre semanal, a menos que el usuario sea Administrador.
