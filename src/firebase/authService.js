import { auth, db } from "./config";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";

// Modificamos para que reciba el nickname y lo guarde en Firestore
// Modificamos para que espere de verdad la creación del usuario antes de meter datos en Firestore
export const registerUser = async (email, password, nickname) => {
  try {
    // 1. Primero creamos el usuario en Firebase Auth y ESPERAMOS el resultado
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // 2. Una vez creado con éxito, recién ahí guardamos el nickname usando su UID único
    await setDoc(doc(db, "users", user.uid), {
      nickname: nickname,
      email: email
    });
    
    return user;
  } catch (error) {
    console.error("Error detallado en el registro:", error);
    throw error;
  }
};

export const loginUser = async (email, password) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const logoutUser = async () => {
  return await signOut(auth);
};