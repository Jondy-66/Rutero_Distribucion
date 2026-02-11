# Manual Funcional del Aplicativo "Rutero"

**Versión:** 1.3
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
- **Administrador:** Control total. Gestión de usuarios, clientes, ubicaciones y rutas globales.
- **Supervisor:** Gestiona su equipo directo, aprueba rutas y genera reportes de rendimiento.
- **Usuario (Vendedor) / Telemercaderista:** Ejecutor de la ruta. Realiza check-in/out, registra ventas y cobranzas.

## 4. Módulos Funcionales del Sistema
- **Gestión de Ruta:** Interfaz para la ejecución diaria. Permite marcar entradas, registrar datos de gestión y finalizar visitas.
- **CRM:** Gestión de base telefónica e interacciones remotas.
- **Usuarios y Permisos:** Administración de accesos y roles.

## 5. Flujo de Procesos

### 5.1. Gestión de Ruta
1.  **Inicio de Jornada:** El usuario selecciona la ruta planificada para el día.
2.  **Gestión de Visita:**
    *   **Check-in:** Registro de ubicación y hora de llegada.
    *   **Registro de Datos:** Captura de valores de venta y cobro.
    *   **Check-out:** Finalización de la visita.

## 8. Reglas de Negocio Globales
- **Persistencia de Sesión:** El sistema mantiene la ruta seleccionada activamente.
- **Filtro de Seguridad:** Los usuarios visualizan los datos asignados según su rol.

## 11. Control de Cambios
| Versión | Fecha         | Autor          | Descripción del Cambio                                 |
|---------|---------------|----------------|--------------------------------------------------------|
| 1.3     | Octubre 2025  | Asistente AI   | Actualización de módulos CRM y Reportes. |