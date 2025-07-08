import {
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { getFirebaseAuth, db } from './config';
import { doc, setDoc } from 'firebase/firestore';

export const handleSignIn = (email, password) => {
  const auth = getFirebaseAuth();
  return signInWithEmailAndPassword(auth, email, password);
};

export const handleSignOut = () => {
  const auth = getFirebaseAuth();
  return signOut(auth);
};

export const handleSignUp = (email, password) => {
  const auth = getFirebaseAuth();
  return createUserWithEmailAndPassword(auth, email, password);
};

export const handleGoogleSignIn = async () => {
    const auth = getFirebaseAuth();
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
