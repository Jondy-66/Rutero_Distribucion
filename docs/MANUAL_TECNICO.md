# Manual Técnico del Aplicativo "Rutero"

## 1. Descripción General
Rutero es una aplicación Next.js 15 integrada con Firebase para la gestión logística avanzada.

### 1.1. Stack Tecnológico
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, ShadCN UI.
- **Backend**: Firebase (Firestore, Authentication).
- **Mapas**: Google Maps API (Visualización Clientes) y Leaflet/OpenStreetMap (Rastreo GPS).

## 2. Estructura del Proyecto
- **`src/contexts/auth-context.tsx`**: Motor central de datos y autenticación.
- **`src/lib/firebase/firestore.ts`**: Capa de acceso a datos CRUD.
- **`src/app/dashboard/routes/management`**: Módulo de ejecución de rutas.
- **`src/hooks/use-tracker.ts`**: Lógica de captura GPS en tiempo real.

---

## 4. Funcionalidades Clave (Vista Técnica)

### 4.1. Gestión de Datos con Firestore
El sistema utiliza Firestore para el almacenamiento de datos en tiempo real. Se cargan los datos globales al inicio de la sesión para asegurar la disponibilidad offline y reducir la latencia percibida por el usuario.

### 4.2. Persistencia de Gestión
El módulo de gestión utiliza estados locales sincronizados con Firestore para mantener el progreso del usuario durante su jornada diaria.

### 4.3. Rastreo GPS (Tracking)
El sistema implementa un monitoreo híbrido:
1. **Captura (Ejecutor)**: El hook `useTracker` utiliza la API de Geolocalización del navegador con filtros de precisión (<30m) y movimiento (>30m) para optimizar batería y datos.
2. **Visualización (Supervisor)**: Utiliza Leaflet para renderizar posiciones en vivo y el historial de trayecto (breadcrumbs) de las últimas 8 horas.
3. **Geocercas**: Permite definir polígonos de seguridad. La validación de entrada/salida se realiza mediante lógica de proximidad y visualización dinámica (cambio de color de marcador a rojo en caso de infracción).

---

## 8. Seguridad y Cumplimiento
- **Autenticación**: Firebase Auth con JWT.
- **Autorización**: Reglas de Seguridad de Firestore para restringir el acceso a documentos según el UID del usuario.

---

## 12. Manual de Soporte (Troubleshooting)
| Error Common | Causa Probable | Solución |
| :--- | :--- | :--- |
| Quota exceeded | Lecturas masivas de datos | Revisar los límites de Firestore. Considerar optimizar las consultas si el tráfico aumenta. |
| Marcador Rojo | Usuario fuera de ruta | Verificar con el vendedor si su zona asignada es correcta o si hubo un desvío justificado. |
