
# Manual Técnico Detallado - Proyecto "Rutero"

## 1. Arquitectura de Datos y Sincronización

### 1.1. Persistencia Offline
Firestore está configurado con `persistentLocalCache` y `persistentMultipleTabManager`. Esto permite que los vendedores sigan registrando datos incluso en zonas con baja cobertura celular. Los datos se sincronizan automáticamente al recuperar la señal.

### 1.2. Lógica de Filtrado Semanal (ISO Week)
Para evitar que las rutas desaparezcan del selector de gestión, se utiliza la función `startOfWeek(date, { weekStartsOn: 1 })`. 
- **Problema corregido:** Las rutas creadas en fin de semana desaparecían porque el sistema anterior las consideraba de la "semana pasada".
- **Solución:** Se normalizan las comparaciones al lunes de cada semana.

## 2. Componentes Críticos

### 2.1. Panel de Gestión en Vivo (`management/page.tsx`)
Utiliza un estado de `activeOriginalIndex` para manejar la edición de paradas. Los campos numéricos (Venta, Cobro) se sanitizan antes de enviarse a Firestore para evitar errores de tipo `NaN` o strings vacíos.

### 2.2. Emisor de Errores de Seguridad
Se implementó `FirestorePermissionError` en `src/firebase/errors.ts`. Este componente intercepta los fallos de las **Security Rules** y los traduce a un formato JSON legible para que el equipo de desarrollo pueda ajustar los permisos sin adivinar la causa del rechazo.

## 3. Gestión de Permisos Granulares
El sistema ha evolucionado de roles estáticos a un array de `permissions` en el documento del usuario. 
- Módulos controlables: `import-clients`, `delete-clients`, `recover-clients` (rescate de datos), `admin-dashboard`.
- El rol **Auditor** tiene activados todos los permisos de visualización pero ninguno de escritura.

## 4. Integración con IA (Proxy Backend)
Las llamadas a la API de Render se realizan a través de un proxy en `/api/predicciones` para:
1. Ocultar el `API_PREDICCION_TOKEN`.
2. Evitar bloqueos de CORS en el navegador.
3. Implementar un "Backoff" de 1 segundo entre peticiones para evitar el Error 429 del servicio externo.
