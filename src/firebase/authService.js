import { auth } from "./config";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut 
} from "firebase/auth";

// 1. FUNCIÓN PARA REGISTRAR UN USUARIO NUEVO
export const registerUser = async (email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error en registro:", error.message);
    throw error;
  }
};

// 2. FUNCIÓN PARA INICIAR SESIÓN
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error("Error en login:", error.message);
    throw error;
  }
};

// 3. FUNCIÓN PARA CERRAR SESIÓN
export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error en logout:", error.message);
    throw error;
  }
};