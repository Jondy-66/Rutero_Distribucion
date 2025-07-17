import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';
import { auth } from './config';

export const handleSignIn = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const handleSignOut = () => {
  return signOut(auth);
};

export const handleSignUp = (email, password) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const handlePasswordReset = (email: string) => {
    return sendPasswordResetEmail(auth, email);
}
