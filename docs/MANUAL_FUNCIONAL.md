# Manual Funcional del Aplicativo "Rutero"

**Versión:** 1.0
**Fecha:** Octubre 2025
**Autor(es):** Jonathan Diaz
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
El presente manual funcional describe las características, flujos y reglas de negocio del aplicativo "Rutero", con el fin de facilitar su comprensión, uso y validación por parte de usuarios, analistas y equipos de QA.

Está orientado a usuarios clave, supervisores, analistas funcionales y personal de soporte que necesiten entender el "qué" hace el sistema, sin necesidad de profundizar en los detalles técnicos del "cómo" lo hace.

## 2. Descripción General del Sistema
**Rutero** es una aplicación web integral diseñada para la planificación, gestión y optimización de rutas de venta y cobranza. Resuelve la necesidad de organizar eficientemente las visitas a clientes, mejorar la productividad de los equipos en campo y obtener visibilidad sobre las operaciones diarias.

**Alcance Funcional:**
- Gestión centralizada de clientes y sus ubicaciones.
- Gestión de usuarios con roles y permisos específicos (Administrador, Supervisor, Vendedor, Telemercaderista).
- Planificación de rutas manual o asistida por Inteligencia Artificial (predicción de visitas).
- Flujo de aprobación de rutas entre vendedores y supervisores.
- Gestión y seguimiento en tiempo real de las rutas en progreso.
- Optimización de rutas para calcular el recorrido más eficiente.
- Visualización de clientes y rutas en un mapa interactivo.
- Generación de reportes de gestión.
- Seguridad reforzada con bloqueo de cuentas por intentos fallidos.

**Objetivos de Negocio:**
- Optimizar los tiempos y costos de desplazamiento.
- Aumentar la cobertura de visitas a clientes.
- Mejorar la eficiencia del equipo de ventas y cobranzas.
- Proporcionar a la gerencia visibilidad y control sobre las operaciones en campo.
- Asegurar el acceso a la plataforma mediante mecanismos de seguridad robustos.

## 3. Roles de Usuario y Permisos
El sistema contempla perfiles de usuario, cada uno con responsabilidades y accesos definidos para garantizar la seguridad y la correcta operación del flujo de trabajo.

- **Administrador:**
  - **Gestión Total de Usuarios:** Puede crear, editar y eliminar usuarios de cualquier rol. Es el único que puede desbloquear cuentas bloqueadas por intentos fallidos de inicio de sesión.
  - **Gestión Total de Clientes:** Tiene control absoluto sobre la creación, lectura, actualización y eliminación (CRUD) de clientes. Puede realizar cargas masivas de datos.
  - **Gestión de Ubicaciones:** Puede actualizar masivamente las coordenadas geográficas de los clientes.
  - **Visibilidad Completa:** Tiene acceso a todas las rutas, reportes y dashboards del sistema.
  - **Aprobación de Rutas:** Puede aprobar o rechazar rutas de cualquier usuario.
  - **Gestión de Permisos:** Puede configurar el acceso a los módulos para cada usuario (funcionalidad en desarrollo).

- **Supervisor:**
  - **Gestión de su Equipo:** Ve y gestiona las rutas y reportes de los vendedores (rol "Usuario") que tiene asignados.
  - **Aprobación de Rutas:** Es el responsable principal de aprobar o rechazar las rutas planificadas por su equipo.
  - **Gestión de Clientes:** Puede ver y editar la información de todos los clientes. No puede crear ni eliminar clientes.
  - **Generación de Reportes:** Puede descargar reportes de las rutas completadas por su equipo.

- **Usuario (Vendedor):**
  - **Planificación de Rutas:** Es el rol principal encargado de planificar las rutas. Puede usar las predicciones de la IA para generar una base y luego ajustarla.
  - **Envío a Aprobación:** Envía sus rutas planificadas a su supervisor asignado para que sean aprobadas.
  - **Gestión de Ruta Diaria:** Inicia la ruta del día, registra las visitas a cada cliente (check-in/check-out), e ingresa los datos de la gestión (ventas, cobros, etc.).
  - **Gestión de su Cartera:** Solo puede ver los clientes que tiene asignados a su nombre (ejecutivo).

- **Telemercaderista:**
  - Rol con funcionalidades similares al **Usuario (Vendedor)**, pero orientado a la gestión remota o telefónica de clientes.

## 4. Módulos Funcionales del Sistema

- **Panel de Control (Dashboard):** Pantalla principal que ofrece un resumen visual del estado de las operaciones, incluyendo clientes totales, estado de la ruta actual (si está en progreso), y gráficos de rendimiento.

- **Módulo de Clientes:** Permite la visualización y gestión de la base de datos de clientes.
  - **Funcionalidades:** Crear, editar, eliminar (solo Admin), buscar y filtrar clientes.
  - **Importación Masiva (Admin):** Permite subir un archivo (CSV/Excel) para crear o actualizar clientes en lote, agilizando la carga de datos.

- **Módulo de Ubicaciones (Admin):** Facilita la geolocalización de los clientes.
  - **Funcionalidades:** Actualización masiva de coordenadas (latitud/longitud) mediante un archivo CSV y previsualización de los clientes en un mapa.

- **Módulo de Rutas:** El corazón de la aplicación, donde se planifica y ejecuta el trabajo de campo.
  - **Predicción de Ruta (IA):** Sugiere una lista de clientes a visitar basándose en un modelo de predicción.
  - **Planificación Manual:** Permite crear una ruta desde cero seleccionando clientes.
  - **Gestión de Ruta:** Permite a los vendedores iniciar una ruta aprobada, registrar el check-in, los datos de la visita (ventas, cobros) y el check-out.
  - **Ruta Óptima (IA):** Calcula el orden de visita más eficiente para un conjunto de paradas.

- **Módulo de Usuarios (Admin):** Permite la gestión completa de los usuarios del sistema.
  - **Funcionalidades:** Crear nuevos usuarios (con asignación de rol y contraseña), editar perfiles y eliminar usuarios. Incluye la capacidad de activar/desactivar cuentas.
  - **Permisos:** Una sección dedicada para configurar el acceso de los usuarios a los distintos módulos del sistema.

- **Módulo de Reportes (Supervisor/Admin):** Proporciona herramientas para el seguimiento del rendimiento.
  - **Funcionalidades:** Visualizar y descargar en Excel los reportes de rutas completadas por los vendedores a cargo.

## 5. Flujo de Procesos

### 5.1. Flujo Principal de Planificación y Gestión de Ruta

1.  **Planificación (Vendedor):**
    *   Un vendedor accede a **"Predicción de Ruta"**, selecciona un rango de fechas y la IA sugiere una lista de clientes.
    *   El vendedor guarda esta predicción, lo que crea una nueva ruta en estado **"Planificada"** (borrador).
    *   El sistema lo redirige a la pantalla de edición de la ruta, donde puede añadir o quitar clientes y ajustar detalles.
    *   Alternativamente, puede crear una ruta manualmente desde **"Planificar Nueva Ruta"**.

2.  **Envío a Aprobación (Vendedor):**
    *   Una vez que la ruta está lista, el vendedor hace clic en **"Enviar a Aprobación"**.
    *   La ruta cambia su estado a **"Pendiente de Aprobación"**.
    *   El sistema notifica automáticamente al supervisor asignado.

3.  **Revisión y Aprobación (Supervisor):**
    *   El supervisor recibe una notificación y accede a la ruta para revisarla desde **"Rutas de Equipo"**.
    *   Puede **Aprobar** la ruta, cambiándola a estado **"Planificada"** y dejándola lista para ser ejecutada.
    *   Puede **Rechazar** la ruta, debiendo añadir una observación. La ruta cambia a estado **"Rechazada"**.
    *   En ambos casos, el vendedor creador de la ruta recibe una notificación.

4.  **Gestión en Campo (Vendedor):**
    *   En el día correspondiente, el vendedor accede a **"Gestión de Ruta"**, selecciona la ruta aprobada y la **inicia**. El estado cambia a **"En Progreso"**.
    *   Para cada cliente, el vendedor realiza el check-in, registra los datos de la gestión (venta, cobro, etc.) y realiza el check-out.
    *   El cliente visitado se marca como "Completado".
    *   Si es necesario, puede añadir clientes no planificados sobre la marcha.

### 5.2. Flujo de Acceso y Seguridad

1.  **Inicio de Sesión:** El usuario ingresa su correo y contraseña.
2.  **Validación de Credenciales:** El sistema verifica los datos.
3.  **Contador de Intentos:** Si la contraseña es incorrecta, el sistema registra un intento fallido.
4.  **Bloqueo de Cuenta:** Después de 5 intentos fallidos consecutivos, la cuenta se bloquea automáticamente y el estado cambia a `inactivo`.
5.  **Desbloqueo:** El usuario debe contactar a un **Administrador**, quien podrá reactivar la cuenta desde el módulo de "Usuarios".
6.  **Recuperación de Contraseña:** Si el usuario olvida su contraseña, puede solicitar un enlace de recuperación. El sistema primero verifica que el correo electrónico exista en la base de datos antes de enviar el correo. Si no existe, muestra un mensaje de error.

## 6. Pantallas y Navegación
La navegación principal se realiza a través de una barra lateral que contiene los siguientes accesos, visibles según el rol del usuario:

- **Panel:** Vista principal con métricas clave.
- **Clientes:** Lista y gestión de la cartera de clientes.
- **Ubicaciones (Admin):** Gestión masiva de geolocalización.
- **Mapa:** Visualización de todos los clientes en un mapa.
- **Rutas:** Menú desplegable con sub-secciones:
  - **Planificación de Ruta:** Incluye "Predicción de Ruta" y "Ruta Óptima".
  - **Mis Rutas:** Lista de las rutas creadas por el propio usuario.
  - **Gestión Ruta:** Interfaz para ejecutar la ruta del día.
  - **Rutas de Equipo (Supervisor/Admin):** Lista de rutas enviadas por otros para aprobación.
- **Reportes (Supervisor/Admin):** Menú desplegable con acceso a los reportes.
- **Usuarios (Admin):** Menú desplegable para gestionar "Todos los Usuarios", "Supervisores" y "Permisos".

## 7. Reportes y Consultas
- **Reporte de Vendedores (para Supervisores/Admin):**
  - **Filtros:** Se puede filtrar por vendedor (de los que tiene a cargo) y por rango de fechas.
  - **Resultados:** Muestra una tabla con las rutas completadas por el vendedor, incluyendo nombre de la ruta, fecha y número de clientes.
  - **Exportación:** Los datos filtrados pueden ser exportados a un archivo **Excel (.xlsx)** para un análisis más profundo.

## 8. Reglas de Negocio Globales
- Un usuario con rol "Usuario" o "Telemercaderista" debe tener siempre un supervisor asignado para que el flujo de aprobación funcione.
- Las rutas solo pueden ser iniciadas si están en estado "Planificada" y corresponden al día actual.
- Una vez una ruta está "En Progreso" o "Completada", ya no puede ser editada por ningún rol (salvo para registrar la gestión del día).
- El sistema de notificaciones es automático y se dispara en los eventos clave del flujo de aprobación (envío, aprobación, rechazo).
- Una cuenta de usuario se bloquea automáticamente tras 5 intentos fallidos de inicio de sesión.

## 9. Excepciones y Mensajes del Sistema
El sistema utiliza notificaciones "toast" para comunicar el resultado de las operaciones:
- **Éxito:** "Cliente creado correctamente", "Ruta guardada exitosamente".
- **Error:** "Las contraseñas no coinciden", "Faltan campos obligatorios", "No se encontró ningún usuario con ese correo electrónico.".
- **Error de Seguridad:** "Cuenta bloqueada por demasiados intentos fallidos. Contacta al administrador."
- **Informativo:** "Correo de recuperación enviado", "Tienes notificaciones sin leer".

## 10. Consideraciones Funcionales Especiales
- **Integración con IA:** El sistema se conecta con servicios externos para dos funciones clave:
  1.  **Predicción de Visitas:** Estima qué clientes son más propensos a ser visitados en un rango de fechas.
  2.  **Optimización de Ruta:** Calcula el orden de visita más eficiente para un conjunto de paradas.
- **Geolocalización:** El sistema depende de las coordenadas (latitud y longitud) de los clientes para las funciones de mapa y optimización. Es crucial que estos datos estén correctos.

## 11. Control de Cambios
| Versión | Fecha         | Autor          | Descripción del Cambio                                 |
|---------|---------------|----------------|--------------------------------------------------------|
| 1.0     | Octubre 2025  | Jonathan Diaz  | Creación inicial del documento con la funcionalidad base. |
|         |               |                |                                                        |
|         |               |                |                                                        |

## 12. Anexos
*(Esta sección puede incluir un glosario de términos, ejemplos de los formatos de archivo para importación, o cualquier otro documento de soporte relevante para el entendimiento funcional).*
