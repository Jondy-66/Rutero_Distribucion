# Manual Funcional del Aplicativo "Rutero"

**Versión:** 1.4
**Fecha:** Octubre 2025
**Autor(es):** Jonathan Diaz / Asistente AI
**Departamento:** Distribución 
**Empresa:** Farmaenlace

---
 
## Índice de Contenido
1.	[Introducción](#1-introducción)
2.	[Descripción General del Sistema](#2-descripción-general-del-sistema)
3.	[Roles de Usuario y Permisos](#3-roles-de-usuario-y-permisos)
4.	[Módulos Funcionales del Sistema](#4-módulos-funcionales-del-sistema)
5.	[Flujo de Procesos](#5-flujo-de-procesos)
6.	[Pantallas y Navegación](#6-pantallas-y-navegación)
7.	[Reportes y Consultas](#7-reportes-y-consultas)
8.	[Reglas de Negocio Globales](#8-reglas-de-negocio-globales)
9.	[Excepciones y Mensajes del Sistema](#9-excepciones-y-mensajes-del-sistema)
10.	[Consideraciones Funcionales Especiales](#10-consideraciones-funcionales-especiales)
11.	[Control de Cambios](#11-control-de-cambios)
12.	[Anexos](#12-anexos)

---

## 1. Introducción
El presente manual funcional describe las características, flujos y reglas de negocio del aplicativo "Rutero", diseñado para optimizar la logística de ventas y cobranzas.

## 2. Descripción General del Sistema
**Rutero** es una plataforma integral para la gestión de rutas. Facilita la planificación inteligente (manual o asistida por IA), la ejecución en campo con seguimiento en tiempo real y la supervisión administrativa.

## 3. Roles de Usuario y Permisos
- **Administrador:** Control total. Gestión de usuarios, clientes, ubicaciones y **reactivación de rutas del equipo**.
- **Supervisor:** Gestiona su equipo directo, aprueba rutas y genera reportes de rendimiento.
- **Usuario (Vendedor) / Telemercaderista:** Ejecutor de la ruta. Realiza check-in/out, registra ventas y cobranzas.

## 4. Módulos Funcionales del Sistema
- **Gestión de Ruta (Optimizado):** Interfaz para la ejecución diaria. 
  - **Búsqueda Multicriterio:** Al añadir clientes, permite buscar por RUC, Nombre Legal o Nombre Comercial.
  - **Diseño Móvil Adaptativo:** Visualización clara de nombres y direcciones en pantallas pequeñas.
  - **Reordenamiento Inteligente:** Permite arrastrar clientes para cambiar el orden de visita.
- **CRM:** Gestión de base telefónica e interacciones remotas.
- **Usuarios y Permisos:** Administración de accesos y roles.

## 5. Flujo de Procesos

### 5.1. Gestión de Ruta e Inteligencia de Jornada
1.  **Inicio de Jornada:** El sistema identifica las rutas con clientes programados para **hoy**.
2.  **Reactivación Automática:** Si una ruta multidiaria fue completada ayer pero tiene clientes para hoy, el sistema la pone en **"En Progreso"** automáticamente.
3.  **Gestión de Visita:**
    *   **Check-in:** Registro instantáneo de ubicación y hora.
    *   **Registro de Datos:** Captura de valores de venta y cobro.
    *   **Check-out:** Finalización de la visita y bloqueo de edición para integridad de datos.
4.  **Selección Automática:** Al mover un cliente al puesto #1 de la lista, el sistema lo selecciona automáticamente para ser gestionado.

## 8. Reglas de Negocio Globales
- **Persistencia de Sesión:** Al refrescar el navegador, el sistema restaura la ruta activa de hoy y el progreso exacto.
- **Prioridad Local:** Los registros de entrada son instantáneos para garantizar agilidad en campo.
- **Filtro de Seguridad:** Los vendedores solo visualizan sus propios clientes y rutas asignadas para mayor eficiencia.

## 11. Control de Cambios
| Versión | Fecha         | Autor          | Descripción del Cambio                                 |
|---------|---------------|----------------|--------------------------------------------------------|
| 1.3     | Octubre 2025  | Asistente AI   | Actualización de módulos CRM y Reportes. |
| 1.4     | Octubre 2025  | Asistente AI   | Implementación de Reactivación Automática, Búsqueda Multicriterio y Carga Selectiva por Rol. |