import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Pegá acá adentro tus credenciales reales de la consola de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBDHsUYaZWU0I-ofJ1fJZIczcqlptwb3JY",
  authDomain: "torneo-app-v2.firebaseapp.com",
  projectId: "torneo-app-v2",
  storageBucket: "torneo-app-v2.firebasestorage.app",
  messagingSenderId: "258639247375",
  appId: "1:258639247375:web:d5c1f45e2b5a708ccf8b7a"
};

// Inicializamos la aplicación de Firebase
const app = initializeApp(firebaseConfig);

// Exportamos las herramientas listas para usar en tus otros archivos
export const db = getFirestore(app);
export const auth = getAuth(app);