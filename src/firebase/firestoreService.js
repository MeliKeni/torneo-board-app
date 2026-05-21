import { db, auth } from "./config";
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  query, 
  where 
} from "firebase/firestore";

// ==========================================
// 👤 SERVICIOS DE USUARIOS Y NICKNAMES
// ==========================================

// Traer el nickname de un usuario por su UID
export const getUserNickname = async (uid) => {
  try {
    const docRef = doc(db, "users", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().nickname;
    }
    return null;
  } catch (error) {
    console.error("Error al traer nickname:", error);
    return null;
  }
};

// ==========================================
// 🎲 SERVICIOS DE JUEGOS (Privados por Creador)
// ==========================================

// Añadir un juego asociándolo al ID del usuario que lo crea
export const addGame = async (name, description, creatorId) => {
  try {
    await addDoc(collection(db, "games"), {
      name,
      description,
      creatorId, // Filtro para que no sea global
      createdAt: new Date()
    });
  } catch (error) {
    console.error("Error al añadir juego:", error);
    throw error;
  }
};

// Escuchar los juegos creados ÚNICAMENTE por el usuario logueado
export const getGamesStream = (userId, callback) => {
  if (!userId) return () => {};
  
  const q = query(
    collection(db, "games"), 
    where("creatorId", "==", userId)
  );
  
  return onSnapshot(q, (snapshot) => {
    const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(games);
  });
};

// Actualizar datos de un juego
export const updateGame = async (gameId, name, description) => {
  try {
    const gameRef = doc(db, "games", gameId);
    await updateDoc(gameRef, { name, description });
  } catch (error) {
    console.error("Error al actualizar juego:", error);
    throw error;
  }
};

// Eliminar un juego de la lista
export const deleteGame = async (gameId) => {
  try {
    const gameRef = doc(db, "games", gameId);
    await deleteDoc(gameRef);
  } catch (error) {
    console.error("Error al eliminar juego:", error);
    throw error;
  }
};

// ==========================================
// 📝 SERVICIOS DE PARTIDAS (Compartidas con Amigos)
// ==========================================

// Escuchar partidas de un juego donde yo esté incluido en el array 'sharedWith'
export const getMatchesStream = (gameId, callback) => {
  const currentUser = auth.currentUser;
  if (!currentUser || !gameId) return () => {};

  const q = query(
    collection(db, `games/${gameId}/matches`), 
    where("sharedWith", "array-contains", currentUser.uid)
  );

  return onSnapshot(q, (snapshot) => {
    const matches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Ordenar por fecha descendente
    const sortedMatches = matches.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : 0;
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : 0;
      return dateB - dateA;
    });

    callback(sortedMatches);
  });
};

// Eliminar una partida del historial sabiendo a qué juego pertenece
export const deleteMatch = async (gameId, matchId) => {
  try {
    const matchRef = doc(db, "games", gameId, "matches", matchId);
    await deleteDoc(matchRef);
  } catch (error) {
    console.error("Error al eliminar partida:", error);
    throw error;
  }
};