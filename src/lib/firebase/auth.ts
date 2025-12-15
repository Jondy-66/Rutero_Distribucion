
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
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { auth, createSecondaryApp, deleteSecondaryApp } from './config';
import { User } from '@/lib/types';


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
        if (secondaryAuth.currentUser) {
            await signOut(secondaryAuth);
        }
        throw error;
    } finally {
        // Limpiar la app secundaria después de la operación.
        await deleteSecondaryApp(secondaryApp);
    }
}


/**
 * Actualiza la contraseña de un usuario por parte de un administrador.
 * Esta función es una simulación del lado del cliente, ya que la operación real
 * requiere privilegios de administrador que solo están disponibles en un entorno de servidor (backend)
 * a través del Admin SDK de Firebase.
 * @param {User} userToUpdate - El objeto de usuario completo cuya contraseña se va a cambiar.
 * @param {string} newPassword - La nueva contraseña.
 * @returns {Promise<void>}
 */
export const updateUserPasswordAsAdmin = async (userToUpdate: User, newPassword: string): Promise<void> => {
    
    console.warn(
      `ADVERTENCIA: La funcionalidad de cambiar contraseña de otro usuario desde el cliente es compleja y ` +
      `generalmente requiere una función de backend (Cloud Function) con el Admin SDK para un entorno de producción seguro. ` +
      `Esta implementación es una simulación y puede fallar si las reglas de seguridad son estrictas.`
    );
  
    const appName = `update-pw-app-${Date.now()}`;
    let secondaryApp;
    try {
        secondaryApp = createSecondaryApp(appName);
        const secondaryAuth = getAuth(secondaryApp);
        
        // Simulación de un proceso que requeriría el Admin SDK en un backend real.
        // Aquí, simplemente mostramos que la intención es llamar a la API de backend.
        const response = await fetch('/api/set-user-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: userToUpdate.id, password: newPassword }),
        });

        if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.message || 'Error desde el servidor al cambiar la contraseña.');
        }

        console.log(`(Operación de Backend Exitosa) Contraseña para ${userToUpdate.email} ha sido cambiada.`);

    } catch (error: any) {
        console.error("Error durante el proceso de cambio de contraseña:", error);
        throw new Error(error.message || "No se pudo cambiar la contraseña.");
    } finally {
        if (secondaryApp) {
            await deleteSecondaryApp(secondaryApp);
        }
    }
};



/**
 * Envía un correo electrónico para restablecer la contraseña a una dirección de correo electrónico específica.
 * @param {string} email - La dirección de correo electrónico para enviar el enlace de restablecimiento.
 * @returns {Promise<void>} Una promesa que se resuelve cuando el correo electrónico ha sido enviado.
 */
export const handlePasswordReset = (email: string) => {
    return sendPasswordResetEmail(auth, email);
}
