# Manual Técnico del Aplicativo "Rutero"

## 1. Descripción General
Rutero es una aplicación Next.js 15 integrada con Firebase para la gestión logística avanzada.

### 1.1. Stack Tecnológico
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, ShadCN UI.
- **Backend**: Firebase (Firestore, Authentication).
- **Mapas**: Google Maps API.

## 2. Estructura del Proyecto
- **`src/contexts/auth-context.tsx`**: Motor central de datos y autenticación.
- **`src/lib/firebase/firestore.ts`**: Capa de acceso a datos CRUD.
- **`src/app/dashboard/routes/management`**: Módulo de ejecución de rutas.

---

## 4. Funcionalidades Clave (Vista Técnica)

### 4.1. Gestión de Datos con Firestore
El sistema utiliza Firestore para el almacenamiento de datos en tiempo real. Se cargan los datos globales al inicio de la sesión para asegurar la disponibilidad offline y reducir la latencia percibida por el usuario.

### 4.2. Persistencia de Gestión
El módulo de gestión utiliza estados locales sincronizados con Firestore para mantener el progreso del usuario durante su jornada diaria.

---

## 8. Seguridad y Cumplimiento
- **Autenticación**: Firebase Auth con JWT.
- **Autorización**: Reglas de Seguridad de Firestore para restringir el acceso a documentos según el UID del usuario.

---

## 12. Manual de Soporte (Troubleshooting)
| Error Común | Causa Probable | Solución |
| :--- | :--- | :--- |
| Quota exceeded | Lecturas masivas de datos | Revisar los límites de Firestore. Considerar optimizar las consultas si el tráfico aumenta. |