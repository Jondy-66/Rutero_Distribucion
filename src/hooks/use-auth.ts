/**
 * @fileoverview Este archivo define un hook personalizado `useAuth` para acceder fácilmente al `AuthContext`.
 * Simplifica el uso del contexto de autenticación en los componentes.
 */
'use client';
import { useContext } from 'react';
import { AuthContext } from '@/contexts/auth-context';

/**
 * Hook `useAuth` para consumir el `AuthContext`.
 * Proporciona una forma limpia de acceder al estado de autenticación y a los datos globales
 * sin tener que usar `useContext(AuthContext)` directamente en cada componente.
 * 
 * @returns {object} El valor del contexto de autenticación, que incluye `user`, `loading`, etc.
 * @throws {Error} Si el hook se usa fuera de un `AuthProvider`.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  // Asegura que el hook se utilice dentro del árbol de componentes del AuthProvider.
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
