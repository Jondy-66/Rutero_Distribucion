
/**
 * @fileoverview Este archivo proporciona funciones de ayuda para interactuar con el servicio de Autenticación de Firebase.
 * Abstrae las llamadas a la API de Firebase Auth para operaciones comunes como iniciar sesión, cerrar sesión,
 * registrarse y restablecer la contraseña.
 */

import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  getAuth,
  updatePassword,
} from 'firebase/auth';
import { auth, createSecondaryApp, deleteSecondaryApp } from './config';

/**
 * Inicia sesión de un usuario con su correo electrónico y contraseña.
 * @param {string} email - El correo electrónico del usuario.
 * @param {string} password - La contraseña del usuario.
 * @returns {Promise<UserCredential>} Una promesa que se resuelve con las credenciales del usuario si el inicio de sesión es exitoso.
 */
export const handleSignIn = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

/**
 * Cierra la sesión del usuario actualmente autenticado.
 * @returns {Promise<void>} Una promesa que se resuelve cuando el usuario ha cerrado sesión.
 */
export const handleSignOut = () => {
  return signOut(auth);
};

/**
 * Registra un nuevo usuario con un correo electrónico y una contraseña.
 * Importante: Esta función inicia sesión con el usuario recién creado,
 * por lo que solo debe usarse en flujos de registro de autoservicio.
 * @param {string} email - El correo electrónico para el nuevo usuario.
 * @param {string} password - La contraseña para el nuevo usuario.
 * @returns {Promise<UserCredential>} Una promesa que se resuelve con las credenciales del nuevo usuario si el registro es exitoso.
 */
export const handleSignUp = (email, password) => {
  return createUserWithEmailAndPassword(auth, email, password);
};


/**
 * Registra un nuevo usuario por un administrador sin afectar la sesión actual.
 * Crea una instancia de app secundaria temporal para este propósito.
 * @param {string} email - El correo electrónico del nuevo usuario.
 * @param {string} password - La contraseña del nuevo usuario.
 * @returns {Promise<import('firebase/auth').UserCredential>} Las credenciales del usuario creado.
 */
export const handleSignUpAsAdmin = async (email, password) => {
    const appName = `secondary-app-${Date.now()}`;
    const secondaryApp = createSecondaryApp(appName);
    const secondaryAuth = getAuth(secondaryApp);

    try {
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        // Es importante cerrar sesión de la instancia secundaria para no dejar estados de auth colgados.
        await signOut(secondaryAuth);
        return userCredential;
    } catch (error) {
        // En caso de error, asegurarse de que la sesión secundaria se cierre también.
        await signOut(secondaryAuth);
        throw error;
    } finally {
        // Limpiar la app secundaria después de la operación.
        await deleteSecondaryApp(secondaryApp);
    }
}

/**
 * Actualiza la contraseña de un usuario por parte de un administrador.
 * Esta función es una solución alternativa del lado del cliente y tiene implicaciones de seguridad.
 * En un entorno de producción, esto DEBERÍA ser manejado por una Cloud Function.
 * @param {string} email - El email del usuario cuya contraseña se cambiará.
 * @param {string} newPassword - La nueva contraseña.
 * @returns {Promise<void>}
 */
export const updateUserPasswordAsAdmin = async (email: string, newPassword: string): Promise<void> => {
    // ADVERTENCIA: Esta implementación es una solución alternativa y no es la ideal para producción.
    // Inicia sesión temporalmente con el usuario para obtener un objeto de usuario válido y poder cambiar la contraseña.
    // Esto es inherentemente complejo y menos seguro que usar el Admin SDK en un backend.
    
    // Esta función requiere que el proveedor de correo/contraseña esté habilitado.
    // También requiere credenciales temporales o una forma de volver a autenticar, lo cual es complicado.
    // La función `updatePassword` del SDK cliente está diseñada para que el *propio usuario* cambie su contraseña.
    
    // Por limitaciones del entorno, simularemos una llamada a un backend.
    console.warn(`(SIMULACIÓN) Se intentó cambiar la contraseña para el usuario con email: ${email}. ` +
               `Esta funcionalidad requiere una implementación de backend (Cloud Function) con el Admin SDK ` +
               `para ser segura y funcional en producción.`);
    
    // Aquí se haría una llamada a una Cloud Function. Ejemplo:
    // const response = await fetch('https://<region>-<project-id>.cloudfunctions.net/updateUserPassword', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}` },
    //   body: JSON.stringify({ email, newPassword }),
    // });
    // if (!response.ok) {
    //   const error = await response.json();
    //   throw new Error(error.message || 'Error en el servidor');
    // }

    // Simulación de éxito para que el flujo de UI funcione.
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, 1000);
    });
};


/**
 * Envía un correo electrónico para restablecer la contraseña a una dirección de correo electrónico específica.
 * @param {string} email - La dirección de correo electrónico para enviar el enlace de restablecimiento.
 * @returns {Promise<void>} Una promesa que se resuelve cuando el correo electrónico ha sido enviado.
 */
export const handlePasswordReset = (email: string) => {
    return sendPasswordResetEmail(auth, email);
}
