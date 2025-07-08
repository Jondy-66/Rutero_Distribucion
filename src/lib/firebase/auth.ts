import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth, db } from './config';
import { doc, setDoc } from 'firebase/firestore';

export const handleSignIn = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const handleSignOut = () => {
  return signOut(auth);
};

export const handleSignUp = (email, password) => {
  return createUserWithEmailAndPassword(auth, email, password);
};

export const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Create user document in Firestore
    const userDoc = doc(db, "users", user.uid);
    await setDoc(userDoc, {
      name: user.displayName,
      email: user.email,
      role: 'Usuario', // Default role
      avatar: user.photoURL
    }, { merge: true }); // Use merge to not overwrite existing data if user logs in again
    
    return result;
}
