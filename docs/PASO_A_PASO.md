
# Guía Paso a Paso: Aplicativo Rutero

Este documento detalla el procedimiento estándar para operar el sistema Rutero, desde el acceso inicial hasta las funciones específicas por rol.

---

## 1. Acceso al Sistema
1.  **Ingreso**: Abra su navegador web (se recomienda Google Chrome) y coloque la dirección URL proporcionada por la organización.
2.  **Identificación**: En la pantalla de inicio, ingrese su correo electrónico institucional y su contraseña.
3.  **Inicio**: Presione el botón **"Iniciar Sesión"**. Verá una pantalla de carga con el logo de **Routify** mientras se valida su perfil.

---

## 2. Guía para el Usuario (Vendedor / Telemercaderista)

### A. Planificación de la Semana
1.  Vaya al menú lateral: **Gestión > Rutas > Planificación de Ruta > IA Predicción**.
2.  Seleccione la fecha de inicio y los días a predecir. Presione **"Obtener Predicciones"**.
3.  Revise los clientes sugeridos y presione **"Planificar Ruta"**.
4.  En la pantalla de edición, organice sus paradas por día (Lunes a Viernes).
5.  Presione **"Confirmar y Enviar"** para que su supervisor apruebe el plan.

### B. Ejecución Diaria (Gestión de Jornada)
1.  Al iniciar su día, vaya a **Rutas > Gestión Ruta**.
2.  Seleccione el plan aprobado para hoy y presione **"Iniciar Ruta Diaria"**.
3.  **Check-in**: Al llegar donde un cliente, selecciónelo en la lista y presione **"Marcar Entrada (GPS)"**.
4.  **Registro**: Ingrese los valores de Venta, Cobro o Devoluciones. Agregue observaciones si es necesario.
5.  **Check-out**: Presione **"Finalizar Gestión"** para guardar los datos y la ubicación de salida.
    *   *Nota: El sistema bloquea la edición automáticamente a las 19:00.*

---

## 3. Guía para el Supervisor

### A. Aprobación de Rutas
1.  Vaya a **Rutas > Rutas de equipo**.
2.  Busque las rutas con estado **"Pendiente"**.
3.  Haga clic en **"Revisar para Aprobación"**.
4.  Puede ajustar paradas o valores y presionar **"Aprobar Plan de Ruta"**.

### B. Monitoreo en Tiempo Real
1.  Ingrese a **Monitoreo > Rastreo GPS Vivo**.
2.  Visualice en el mapa la ubicación actual de sus vendedores.
3.  Haga clic en el nombre de un vendedor para ver su historial de trayecto (breadcrumbs) de las últimas 8 horas.

---

## 4. Guía para el Auditor
1.  **Consulta de Cartera**: Ingrese a **Cartera Clientes** para buscar datos por RUC o Nombre. No podrá editar ni eliminar.
2.  **Visualización**: Use el módulo **Mapa** para ver la dispersión geográfica de los clientes.
3.  **Reportes**: Vaya a **Reportes > Reporte Vendedores** para auditar las horas de entrada/salida y efectividad de cada ejecutivo.

---

## 5. Guía para el Administrador

### A. Gestión de Usuarios
1.  Vaya a **Administración > Gestión Usuarios**.
2.  **Crear**: Use el botón **"Añadir Usuario"**, asigne un rol y un supervisor (obligatorio para vendedores).
3.  **Seguridad**: En caso de bloqueo (5 intentos fallidos), edite el usuario y cambie su estado a **"Activo"**.

### B. Mantenimiento de Datos
1.  **Importación**: En **Cartera Clientes**, use el botón **"Importar"** para subir archivos Excel/CSV con nuevos clientes.
2.  **Rescate**: Si hay problemas de sincronización, vaya a **Rescate de Datos** para reactivar clientes inactivos de forma masiva.

### C. Configuración del Sistema
1.  Ingrese a **Administración > Cron Jobs**.
2.  Asegúrese de que la **Sincronización Maestra** esté activa para garantizar que los datos de IA se actualicen automáticamente.
