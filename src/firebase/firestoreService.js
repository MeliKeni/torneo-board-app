import { db } from "./config";
import { collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";

export const addGame = async (gameName, description) => {
  try {
    const docRef = await addDoc(collection(db, "games"), {
      name: gameName,
      description: description,
      createdAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error al añadir juego:", error);
    throw error;
  }
};

export const getGamesStream = (callback) => {
  const q = query(collection(db, "games"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snapshot) => {
    const games = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(games);
  });
};