import { db } from "./config";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  where, 
  doc, 
  deleteDoc, 
  updateDoc 
} from "firebase/firestore";

// --- JUEGOS ---
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
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

// MODIFICAR JUEGO
export const updateGame = async (gameId, newName, newDesc) => {
  try {
    const gameRef = doc(db, "games", gameId);
    await updateDoc(gameRef, { name: newName, description: newDesc });
  } catch (error) {
    console.error("Error al editar juego:", error);
    throw error;
  }
};

// ELIMINAR JUEGO
export const deleteGame = async (gameId) => {
  try {
    await deleteDoc(doc(db, "games", gameId));
  } catch (error) {
    console.error("Error al eliminar juego:", error);
    throw error;
  }
};


// --- PARTIDAS ---
// Ahora recibe un array de jugadores con sus nombres y puntos
export const addMatch = async (gameId, playersList) => {
  try {
    const docRef = await addDoc(collection(db, "matches"), {
      gameId: gameId,
      players: playersList, // Guarda ej: [{name: "Agus", points: 15}, {name: "Ivo", points: 12}]
      createdAt: new Date()
    });
    return docRef.id;
  } catch (error) {
    console.error("Error al añadir partida:", error);
    throw error;
  }
};

// Traemos las partidas. Sacamos el 'orderBy' temporalmente para evitar el error de índice de Firebase
export const getMatchesStream = (gameId, callback) => {
  const q = query(collection(db, "matches"), where("gameId", "==", gameId));
  return onSnapshot(q, (snapshot) => {
    const matches = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    // Ordenamos acá en memoria por fecha para que no falle el stream
    matches.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate());
    callback(matches);
  });
};

// ELIMINAR PARTIDA
export const deleteMatch = async (matchId) => {
  try {
    await deleteDoc(doc(db, "matches", matchId));
  } catch (error) {
    console.error("Error al eliminar partida:", error);
    throw error;
  }
};