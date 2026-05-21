import { useState, useEffect } from 'react';
import { auth } from './firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { registerUser, loginUser, logoutUser } from './firebase/authService';
import { 
  addGame, getGamesStream, updateGame, deleteGame,
  addMatch, getMatchesStream, deleteMatch 
} from './firebase/firestoreService';

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Estados para Juegos
  const [games, setGames] = useState([]);
  const [gameName, setGameName] = useState('');
  const [gameDesc, setGameDesc] = useState('');
  const [editingGameId, setEditingGameId] = useState(null);

  // Estados para Partidas
  const [selectedGame, setSelectedGame] = useState(null);
  const [matches, setMatches] = useState([]);
  
  // Flujo dinámico de jugadores para la partida
  const [playerCount, setPlayerCount] = useState(0); 
  const [playersInput, setPlayersInput] = useState([]); // [{name: '', points: 0}]

  // Escuchadores
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribeGames = getGamesStream((updatedGames) => setGames(updatedGames));
    return () => unsubscribeGames();
  }, [user]);

  useEffect(() => {
    if (!user || !selectedGame) return;
    const unsubscribeMatches = getMatchesStream(selectedGame.id, (updatedMatches) => setMatches(updatedMatches));
    return () => unsubscribeMatches();
  }, [user, selectedGame]);

  // Manejo de Auth
  const handleRegister = async (e) => {
    e.preventDefault(); setError('');
    try { await registerUser(email, password); alert('¡Registrado!'); } catch (err) { if (err instanceof Error) setError(err.message); }
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setError('');
    try { await loginUser(email, password); } catch (err) { if (err instanceof Error) setError(err.message); }
  };

  // Guardar / Editar Juego
  const handleSaveGame = async (e) => {
    e.preventDefault();
    if (!gameName.trim()) return alert('El nombre es obligatorio');
    try {
      if (editingGameId) {
        await updateGame(editingGameId, gameName, gameDesc);
        setEditingGameId(null);
      } else {
        await addGame(gameName, gameDesc);
      }
      setGameName(''); setGameDesc('');
    } catch { alert('Error al procesar juego'); }
  };

  const handleStartEditGame = (game) => {
    setEditingGameId(game.id);
    setGameName(game.name);
    setGameDesc(game.description || '');
  };

  const handleDeleteGameClick = async (gameId) => {
    if (confirm('¿Seguro querés eliminar este juego? Se borrará de la lista.')) {
      try {
        if (selectedGame?.id === gameId) setSelectedGame(null);
        await deleteGame(gameId);
      } catch { alert('Error al borrar juego'); }
    }
  };

  // Configurar cantidad de jugadores
  const handleSetPlayerCount = (e) => {
    e.preventDefault();
    const count = parseInt(e.target.count.value);
    if (count < 1) return alert('Mínimo 1 jugador');
    setPlayerCount(count);
    
    // Inicializamos el array con casilleros vacíos para cada jugador
    const emptyPlayers = Array.from({ length: count }, () => ({ name: '', points: 0 }));
    setPlayersInput(emptyPlayers);
  };

  // Actualizar los inputs dinámicos de la partida
  const handlePlayerInputChange = (index, field, value) => {
    const updated = [...playersInput];
    if (field === 'points') {
      updated[index][field] = parseInt(value) || 0;
    } else {
      updated[index][field] = value;
    }
    setPlayersInput(updated);
  };

  // Registrar Partida
  const handleCreateMatch = async (e) => {
    e.preventDefault();
    const incomplete = playersInput.some(p => !p.name.trim());
    if (incomplete) return alert('Completa los nombres de todos los jugadores');

    try {
      await addMatch(selectedGame.id, playersInput);
      // Reseteamos el formulario de partida
      setPlayerCount(0);
      setPlayersInput([]);
      alert('¡Partida registrada!');
    } catch { alert('Error al guardar la partida'); }
  };

  const handleDeleteMatchClick = async (matchId) => {
    if (confirm('¿Querés borrar esta partida del historial?')) {
      try { await deleteMatch(matchId); } catch { alert('Error al eliminar'); }
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <h1>🏆 Torneo Board App</h1>
      
      {user ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* BARRA USUARIO */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eee', padding: '10px', borderRadius: '5px' }}>
            <span>👤 Conectado: <strong>{user.email}</strong></span>
            <button onClick={() => { logoutUser(); setSelectedGame(null); setMatches([]); }} style={{ background: 'red', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>Salir</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
            
            {/* SECCIÓN JUEGOS */}
            <div>
              <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '5px', marginBottom: '20px', background: '#fcfcfc' }}>
                <h3>{editingGameId ? '📝 Editar Juego' : '➕ Añadir Juego de Mesa'}</h3>
                <form onSubmit={handleSaveGame} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input type="text" placeholder="Nombre (ej: Truco, Pedro)" value={gameName} onChange={(e) => setGameName(e.target.value)} style={{ padding: '8px' }} />
                  <input type="text" placeholder="Descripción" value={gameDesc} onChange={(e) => setGameDesc(e.target.value)} style={{ padding: '8px' }} />
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button type="submit" style={{ padding: '10px', background: 'blue', color: 'white', border: 'none', cursor: 'pointer', flex: 1 }}>
                      {editingGameId ? 'Actualizar' : 'Guardar Juego'}
                    </button>
                    {editingGameId && (
                      <button type="button" onClick={() => { setEditingGameId(null); setGameName(''); setGameDesc(''); }} style={{ padding: '10px', background: 'gray', color: 'white', border: 'none', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <h3>Lista de Juegos:</h3>
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {games.map(game => (
                  <li 
                    key={game.id} 
                    style={{ 
                      background: selectedGame?.id === game.id ? '#d1e7dd' : '#f9f9f9', 
                      padding: '12px', marginBottom: '8px', borderLeft: '5px solid blue', borderRadius: '3px',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                  >
                    <div onClick={() => { setMatches([]); setSelectedGame(game); setPlayerCount(0); }} style={{ cursor: 'pointer', flex: 1 }}>
                      <strong>{game.name}</strong> <br />
                      <small style={{ color: '#666' }}>{game.description || 'Sin descripción'}</small>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={() => handleStartEditGame(game)} style={{ background: '#ffc107', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: '3px' }}>✏️</button>
                      <button onClick={() => handleDeleteGameClick(game.id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: '3px' }}>🗑️</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* SECCIÓN PARTIDAS */}
            <div>
              {selectedGame ? (
                <div>
                  <h2>Partidas de: {selectedGame.name}</h2>
                  
                  {/* CONFIGURACIÓN JUGADORES */}
                  <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '5px', background: '#fff', marginBottom: '20px' }}>
                    {playerCount === 0 ? (
                      <form onSubmit={handleSetPlayerCount}>
                        <h4>¿Cuántos jugadores van a jugar?</h4>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <input type="number" name="count" defaultValue="2" min="1" style={{ padding: '6px', width: '60px' }} />
                          <button type="submit" style={{ padding: '6px 12px', background: 'green', color: 'white', border: 'none', cursor: 'pointer' }}>Continuar</button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleCreateMatch} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h4>Anotar Puntos de la Partida</h4>
                        {playersInput.map((player, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <span>#{idx + 1}</span>
                            <input 
                              type="text" 
                              placeholder={`Nombre Jugador ${idx + 1}`} 
                              value={player.name} 
                              onChange={(e) => handlePlayerInputChange(idx, 'name', e.target.value)} 
                              style={{ padding: '6px', flex: 2 }} 
                            />
                            <input 
                              type="number" 
                              placeholder="Puntos" 
                              value={player.points} 
                              onChange={(e) => handlePlayerInputChange(idx, 'points', e.target.value)} 
                              style={{ padding: '6px', flex: 1 }} 
                            />
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                          <button type="submit" style={{ padding: '10px', background: 'green', color: 'white', border: 'none', cursor: 'pointer', flex: 1 }}>
                            Guardar Partida
                          </button>
                          <button type="button" onClick={() => setPlayerCount(0)} style={{ padding: '10px', background: 'gray', color: 'white', border: 'none', cursor: 'pointer' }}>
                            Atrás
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* HISTORIAL */}
                  <h4>Historial de Partidas:</h4>
                  {matches.length === 0 ? <p>No hay partidas registradas.</p> : (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {matches.map(match => {
                        const matchDate = match.createdAt?.toDate ? match.createdAt.toDate() : null;
                        const fechaStr = matchDate ? matchDate.toLocaleDateString() : '';
                        const horaStr = matchDate ? matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                        return (
                          <li key={match.id} style={{ background: '#fff', border: '1px solid #eee', padding: '12px', marginBottom: '8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ marginBottom: '8px' }}>
                                <small style={{ color: '#666', background: '#e9ecef', padding: '3px 6px', borderRadius: '3px', fontWeight: 'bold' }}>
                                  📅 {fechaStr} - ⏰ {horaStr} hs
                                </small>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                {match.players?.map((p, i) => (
                                  <span key={i}>👤 <strong>{p.name}</strong>: {p.points} pts</span>
                                ))}
                              </div>
                            </div>
                            <button onClick={() => handleDeleteMatchClick(match.id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '6px 10px', cursor: 'pointer', borderRadius: '3px' }}>
                              Borrar
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : (
                <div style={{ padding: '40px', textAlign: 'center', color: '#666', border: '2px dashed #ccc', borderRadius: '5px', marginTop: '40px' }}>
                  👈 Seleccioná un juego de la izquierda para ver opciones y cargar sus partidas.
                </div>
              )}
            </div>

          </div>
        </div>
      ) : (
        /* LOGIN */
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