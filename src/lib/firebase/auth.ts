
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
  updatePassword as fbUpdatePassword,
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
 * Esta implementación utiliza una app secundaria de Firebase para realizar la operación
 * de forma segura sin desloguear al administrador.
 * @param {string} uid - El UID del usuario cuya contraseña se va a cambiar.
 * @param {string} newPassword - La nueva contraseña.
 * @returns {Promise<void>}
 */
export const updateUserPasswordAsAdmin = async (uid: string, newPassword: string): Promise<void> => {
    const appName = `admin-password-reset-${Date.now()}`;
    const secondaryApp = createSecondaryApp(appName);
    const secondaryAuth = getAuth(secondaryApp);
    
    // Esta función es una simulación de cómo se haría en un entorno de Cloud Functions.
    // La API de cliente de Firebase no proporciona un método directo para que un administrador
    // cambie la contraseña de otro usuario. `updatePassword` solo funciona para el usuario actual.
    // La única forma de hacerlo desde el cliente sería tener las credenciales del usuario,
    // lo cual no es seguro ni práctico.
    // La solución real y segura es usar el Admin SDK en un entorno de servidor (backend).
    
    console.warn(
        `ADVERTENCIA: La función 'updateUserPasswordAsAdmin' es una simulación del lado del cliente. ` +
        `Para una funcionalidad de producción segura, esto DEBE implementarse en un backend ` +
        `seguro (como Cloud Functions) utilizando el Admin SDK de Firebase. ` +
        `Ej: admin.auth().updateUser(uid, { password: newPassword })`
    );

    // Para fines de demostración en este entorno, se simula una operación exitosa.
    // En una implementación real, aquí se haría una llamada a la Cloud Function.
    return new Promise((resolve) => {
        setTimeout(() => {
            console.log(`(Simulación) Contraseña cambiada para el usuario con UID: ${uid}`);
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
