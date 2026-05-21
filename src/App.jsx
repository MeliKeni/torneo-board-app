import { useState, useEffect } from 'react';
import { auth } from './firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { registerUser, loginUser, logoutUser } from './firebase/authService';
import { addGame, getGamesStream } from './firebase/firestoreService';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Estados para los Juegos
  const [games, setGames] = useState([]);
  const [gameName, setGameName] = useState('');
  const [gameDesc, setGameDesc] = useState('');

  // Escucha de Autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Escucha de Firestore en tiempo real
  useEffect(() => {
    if (!user) return;
    
    const unsubscribeGames = getGamesStream((updatedGames) => {
      setGames(updatedGames);
    });

    return () => unsubscribeGames();
  }, [user]);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    try { 
      await registerUser(email, password); 
      alert('¡Registrado con éxito!'); 
    } catch (error) { 
      setError(error.message); // <-- Corregido acá
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    try { 
      await loginUser(email, password); 
    } catch (error) { 
      setError(error.message); // <-- Corregido acá
    }
  };

  const handleCreateGame = async (e) => {
    e.preventDefault();
    if (!gameName.trim()) return alert('El nombre del juego es obligatorio');
    try {
      await addGame(gameName, gameDesc);
      setGameName('');
      setGameDesc('');
    } catch { // <-- Al sacar la palabra "error", JavaScript sabe que atrapa la falla pero no necesitamos la variable
      alert('Error al guardar en Firestore');
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '600px', margin: '0 auto' }}>
      <h1>🏆 Torneo Board App</h1>
      
      {user ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eee', padding: '10px', borderRadius: '5px' }}>
            <span>👤 {user.email}</span>
            <button onClick={logoutUser} style={{ background: 'red', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>Salir</button>
          </div>

          {/* FORMULARIO PARA CREAR JUEGO */}
          <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #ccc', borderRadius: '5px' }}>
            <h3>Añadir Nuevo Juego de Mesa</h3>
            <form onSubmit={handleCreateGame} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input type="text" placeholder="Nombre (ej: Truco, Pedro)" value={gameName} onChange={(e) => setGameName(e.target.value)} style={{ padding: '8px' }} />
              <input type="text" placeholder="Descripción corta" value={gameDesc} onChange={(e) => setGameDesc(e.target.value)} style={{ padding: '8px' }} />
              <button type="submit" style={{ padding: '10px', background: 'blue', color: 'white', border: 'none', cursor: 'pointer' }}>Guardar Juego</button>
            </form>
          </div>

          {/* LISTADO EN TIEMPO REAL */}
          <div style={{ marginTop: '20px' }}>
            <h3>Juegos Registrados (Firestore):</h3>
            {games.length === 0 ? <p>No hay juegos creados todavía.</p> : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {games.map(game => (
                  <li key={game.id} style={{ background: '#f9f9f9', padding: '10px', marginBottom: '8px', borderLeft: '5px solid blue', borderRadius: '3px' }}>
                    <strong>{game.name}</strong> - {game.description || 'Sin descripción'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: '300px', margin: '0 auto', marginTop: '40px' }}>
          <h3>Ingresar al Sistema</h3>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '8px' }} />
            <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '8px' }} />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleLogin} type="button" style={{ padding: '10px', flex: 1, background: 'green', color: 'white', border: 'none', cursor: 'pointer' }}>Ingresar</button>
              <button onClick={handleRegister} type="button" style={{ padding: '10px', flex: 1, background: 'gray', color: 'white', border: 'none', cursor: 'pointer' }}>Registrarse</button>
            </div>
          </form>
          {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

export default App;