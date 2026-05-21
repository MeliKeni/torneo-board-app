import { useState, useEffect } from 'react';
import { auth, db } from './firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { registerUser, loginUser, logoutUser } from './firebase/authService';
import { 
  addGame, getGamesStream, updateGame, deleteGame,
  getMatchesStream, deleteMatch, getUserNickname 
} from './firebase/firestoreService';
import { 
  collection, query, where, getDocs, addDoc, onSnapshot, doc, updateDoc 
} from 'firebase/firestore';

function App() {
  const [user, setUser] = useState(null);
  const [userNickname, setUserNickname] = useState(''); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nicknameInput, setNicknameInput] = useState(''); 
  const [error, setError] = useState('');
  
  // Navegación de Pestañas e Interfaz Principal
  const [isRegistering, setIsRegistering] = useState(false);
  const [activeTab, setActiveTab] = useState('juegos'); // 'juegos' o 'amigos'

  // Estados para Juegos
  const [games, setGames] = useState([]);
  const [gameName, setGameName] = useState('');
  const [gameDesc, setGameDesc] = useState('');
  const [editingGameId, setEditingGameId] = useState(null);

  // Estados para Partidas
  const [selectedGame, setSelectedGame] = useState(null);
  const [matches, setMatches] = useState([]);
  const [playerCount, setPlayerCount] = useState(0); 
  const [playersInput, setPlayersInput] = useState([]); 

  // Estados para Amigos y Buscador
  const [searchNick, setSearchNick] = useState('');
  const [friends, setFriends] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);

  // Escucha de Autenticación
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const nick = await getUserNickname(currentUser.uid);
        setUserNickname(nick || 'Jugador 1');
      } else {
        setUserNickname('');
        setGames([]);
        setFriends([]);
        setReceivedRequests([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Escucha de Juegos filtrados por usuario logueado
  useEffect(() => {
    if (!user) return;
    const unsubscribeGames = getGamesStream(user.uid, (updatedGames) => setGames(updatedGames));
    return () => unsubscribeGames();
  }, [user]);

  // Escucha de Partidas del juego seleccionado
  useEffect(() => {
    if (!user || !selectedGame) return;
    const unsubscribeMatches = getMatchesStream(selectedGame.id, (updatedMatches) => setMatches(updatedMatches));
    return () => unsubscribeMatches();
  }, [user, selectedGame]);

  // Escucha de Amigos y Solicitudes
  useEffect(() => {
    if (!user) return;

    // Solicitudes recibidas pendientes
    const qRequests = query(collection(db, 'friendRequests'), where('toUid', '==', user.uid), where('status', '==', 'pending'));
    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      setReceivedRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Amigos aceptados
    const qFriends = query(collection(db, 'friendRequests'), where('status', '==', 'accepted'));
    const unsubFriends = onSnapshot(qFriends, (snapshot) => {
      const list = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.fromUid === user.uid) list.push({ uid: data.toUid, nickname: data.toNickname });
        if (data.toUid === user.uid) list.push({ uid: data.fromUid, nickname: data.fromNickname });
      });
      setFriends(list);
    });

    return () => { unsubRequests(); unsubFriends(); };
  }, [user]);

  // Manejo de Auth
  const handleRegister = async (e) => {
    e.preventDefault(); 
    setError('');
    const cleanNick = nicknameInput.trim().replace('@', '');
    if (!email.trim() || !password.trim() || !cleanNick) {
      return alert('Todos los campos son obligatorios para registrarse');
    }
    try { 
      const q = query(collection(db, "users"), where("nickname", "==", cleanNick));
      const snap = await getDocs(q);
      if (!snap.empty) return alert('Ese nickname ya está en uso');

      await registerUser(email, password, cleanNick); 
      alert('¡Cuenta creada con éxito!'); 
      setNicknameInput(''); setEmail(''); setPassword('');
    } catch (err) { 
      if (err instanceof Error) setError(err.message); 
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault(); 
    setError('');
    if (!email.trim() || !password.trim()) return alert('Completá email y contraseña');
    try { 
      await loginUser(email, password); 
      setEmail(''); setPassword('');
    } catch (err) { 
      if (err instanceof Error) setError(err.message); 
    }
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
        await addGame(gameName, gameDesc, user.uid);
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

  // Enviar solicitud de amistad
  const handleSendFriendRequest = async (e) => {
    e.preventDefault();
    const searchTarget = searchNick.trim().replace('@', '');
    if (!searchTarget) return;
    if (searchTarget.toLowerCase() === userNickname.toLowerCase()) return alert('No te podés agregar a vos mismo');

    try {
      const q = query(collection(db, 'users'), where('nickname', '==', searchTarget));
      const snap = await getDocs(q);
      if (snap.empty) return alert('Usuario no encontrado');

      const targetUser = snap.docs[0].data();
      const targetUid = snap.docs[0].id;

      const qCheck = query(collection(db, 'friendRequests'));
      const snapCheck = await getDocs(qCheck);
      const yaExiste = snapCheck.docs.some(doc => {
        const d = doc.data();
        return (d.fromUid === user.uid && d.toUid === targetUid) || (d.fromUid === targetUid && d.toUid === user.uid);
      });

      if (yaExiste) return alert('Ya existe una solicitud o ya son amigos');

      await addDoc(collection(db, 'friendRequests'), {
        fromUid: user.uid,
        fromNickname: userNickname,
        toUid: targetUid,
        toNickname: targetUser.nickname,
        status: 'pending'
      });

      alert('¡Solicitud enviada!');
      setSearchNick('');
    } catch { alert('Error al enviar solicitud'); }
  };

  // Aceptar amigo
  const handleAcceptFriend = async (requestId) => {
    try {
      const docRef = doc(db, 'friendRequests', requestId);
      await updateDoc(docRef, { status: 'accepted' });
      alert('¡Solicitud aceptada!');
    } catch { alert('Error al aceptar'); }
  };

  // Configurar cantidad de jugadores
  const handleSetPlayerCount = (e) => {
    e.preventDefault();
    const count = parseInt(e.target.count.value);
    if (count < 1) return alert('Mínimo 1 jugador');
    setPlayerCount(count);
    
    const initialPlayers = Array.from({ length: count }, (_, idx) => ({
      name: idx === 0 ? `@${userNickname}` : '', 
      points: 0
    }));
    setPlayersInput(initialPlayers);
  };

  const handlePlayerInputChange = (index, field, value) => {
    const updated = [...playersInput];
    if (field === 'points') {
      updated[index][field] = parseInt(value) || 0;
    } else {
      updated[index][field] = value;
    }
    setPlayersInput(updated);
  };

  // Guardar partida cruzando @ con la lista de amigos
  const handleCreateMatch = async (e) => {
    e.preventDefault();
    const incomplete = playersInput.some(p => !p.name.trim());
    if (incomplete) return alert('Completa los nombres de todos los jugadores');

    const sharedUids = [user.uid]; 

    for (let p of playersInput) {
      if (p.name.startsWith('@')) {
        const nickTarget = p.name.replace('@', '').trim();
        const amigoObj = friends.find(f => f.nickname.toLowerCase() === nickTarget.toLowerCase());
        if (amigoObj && !sharedUids.includes(amigoObj.uid)) {
          sharedUids.push(amigoObj.uid);
        }
      }
    }

    try {
      await addDoc(collection(db, `games/${selectedGame.id}/matches`), {
        players: playersInput,
        sharedWith: sharedUids,
        createdAt: new Date()
      });
      setPlayerCount(0);
      setPlayersInput([]);
      alert('¡Partida registrada!');
    } catch { alert('Error al guardar la partida'); }
  };

  const handleDeleteMatchClick = async (matchId) => {
    if (confirm('¿Querés borrar esta partida del historial?')) {
      try { 
        await deleteMatch(selectedGame.id, matchId); 
        alert('Partida eliminada');
      } catch { 
        alert('Error al eliminar'); 
      }
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>🏆 Torneo Board App</h1>
        {user && (
          <div style={{ display: 'flex', gap: '5px' }}>
            <button onClick={() => setActiveTab('juegos')} style={{ padding: '8px 15px', background: activeTab === 'juegos' ? 'blue' : '#ccc', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>Juegos y Partidas</button>
            <button onClick={() => setActiveTab('amigos')} style={{ padding: '8px 15px', background: activeTab === 'amigos' ? 'blue' : '#ccc', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>Amigos ({friends.length})</button>
          </div>
        )}
      </div>
      
      {user ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
          {/* BARRA USUARIO */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eee', padding: '10px', borderRadius: '5px' }}>
            <span>👤 Hola, <strong>@{userNickname}</strong> ({user.email})</span>
            <button onClick={() => { logoutUser(); setSelectedGame(null); setMatches([]); setPlayerCount(0); }} style={{ background: 'red', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer' }}>Salir</button>
          </div>

          {activeTab === 'juegos' ? (
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
                        <button type="button" onClick={() => { setEditingGameId(null); setGameName(''); setGameDesc(''); }} style={{ padding: '10px', background: 'gray', color: 'white', border: 'none', cursor: 'pointer' }}>Cancelar</button>
                      )}
                    </div>
                  </form>
                </div>

                <h3>Mis Juegos:</h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {games.map(game => (
                    <li key={game.id} style={{ background: selectedGame?.id === game.id ? '#d1e7dd' : '#f9f9f9', padding: '12px', marginBottom: '8px', borderLeft: '5px solid blue', borderRadius: '3px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
                          <h4>Anotar Puntos de la Partida <small style={{fontWeight:'normal', color:'#777'}}>(Usa @nickname para amigos)</small></h4>
                          {playersInput.map((player, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                              <span>#{idx + 1}</span>
                              <input type="text" placeholder="Nombre o @nickname" value={player.name} onChange={(e) => handlePlayerInputChange(idx, 'name', e.target.value)} style={{ padding: '6px', flex: 2 }} />
                              <input type="number" placeholder="Puntos" value={player.points} onChange={(e) => handlePlayerInputChange(idx, 'points', e.target.value)} style={{ padding: '6px', flex: 1 }} />
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
                            <button type="submit" style={{ padding: '10px', background: 'green', color: 'white', border: 'none', cursor: 'pointer', flex: 1 }}>Guardar Partida</button>
                            <button type="button" onClick={() => setPlayerCount(0)} style={{ padding: '10px', background: 'gray', color: 'white', border: 'none', cursor: 'pointer' }}>Atrás</button>
                          </div>
                        </form>
                      )}
                    </div>

                    <h4>Historial de Partidas:</h4>
                    {matches.length === 0 ? <p>No hay partidas registradas.</p> : (
                      <ul style={{ listStyle: 'none', padding: 0 }}>
                        {matches.map(match => {
                          const matchDate = match.createdAt?.toDate ? match.createdAt.toDate() : null;
                          return (
                            <li key={match.id} style={{ background: '#fff', border: '1px solid #eee', padding: '12px', marginBottom: '8px', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ marginBottom: '8px' }}>
                                  <small style={{ color: '#666', background: '#e9ecef', padding: '3px 6px', borderRadius: '3px', fontWeight: 'bold' }}>
                                    📅 {matchDate ? matchDate.toLocaleDateString() : ''} - ⏰ {matchDate ? matchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''} hs
                                  </small>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                  {match.players?.map((p, i) => (
                                    <span key={i}>👤 <strong>{p.name}</strong>: {p.points} pts</span>
                                  ))}
                                </div>
                              </div>
                              <button onClick={() => handleDeleteMatchClick(match.id)} style={{ background: '#dc3545', color: 'white', border: 'none', padding: '6px 10px', cursor: 'pointer', borderRadius: '3px' }}>Borrar</button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#666', border: '2px dashed #ccc', borderRadius: '5px', marginTop: '40px' }}>👈 Seleccioná un juego para ver opciones y cargar partidas.</div>
                )}
              </div>
            </div>
          ) : (
            /* PESTAÑA AMIGOS */
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
              <div>
                <div style={{ padding: '15px', border: '1px solid #ccc', borderRadius: '5px', background: '#fff', marginBottom: '20px' }}>
                  <h3>🔍 Buscar Amigos</h3>
                  <form onSubmit={handleSendFriendRequest} style={{ display: 'flex', gap: '10px' }}>
                    <input type="text" placeholder="Buscar por nickname (sin @)" value={searchNick} onChange={(e) => setSearchNick(e.target.value)} style={{ padding: '8px', flex: 1 }} />
                    <button type="submit" style={{ padding: '8px 15px', background: 'blue', color: 'white', border: 'none', cursor: 'pointer' }}>Agregar</button>
                  </form>
                </div>

                <h3>Mis Amigos Conectados:</h3>
                {friends.length === 0 ? <p style={{color:'#666'}}>Aún no tenés amigos agregados.</p> : (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {friends.map((f, i) => (
                      <li key={i} style={{ background: '#f9f9f9', padding: '10px', marginBottom: '5px', borderRadius: '4px', borderLeft: '4px solid green' }}>👤 <strong>@{f.nickname}</strong></li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3>📥 Solicitudes Pendientes</h3>
                {receivedRequests.length === 0 ? <p style={{color:'#666'}}>No tenés solicitudes nuevas.</p> : (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {receivedRequests.map(req => (
                      <li key={req.id} style={{ background: '#fff3cd', padding: '12px', marginBottom: '8px', borderRadius: '4px', border: '1px solid #ffeba2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>👋 <strong>@{req.fromNickname}</strong> quiere ser tu amigo</span>
                        <button onClick={() => handleAcceptFriend(req.id)} style={{ background: 'green', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer', borderRadius: '3px' }}>Aceptar</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* FORMULARIO LOGIN / REGISTRO */
        <div style={{ maxWidth: '350px', margin: '0 auto', marginTop: '40px', padding: '25px', border: '1px solid #ccc', borderRadius: '8px', background: '#f9f9f9' }}>
          <div style={{ display: 'flex', marginBottom: '20px', borderBottom: '1px solid #ccc' }}>
            <button onClick={() => { setIsRegistering(false); setError(''); }} style={{ flex: 1, padding: '10px', background: !isRegistering ? '#fff' : 'none', border: 'none', borderBottom: !isRegistering ? '3px solid green' : 'none', fontWeight: !isRegistering ? 'bold' : 'normal', cursor: 'pointer' }}>Ingresar</button>
            <button onClick={() => { setIsRegistering(true); setError(''); }} style={{ flex: 1, padding: '10px', background: isRegistering ? '#fff' : 'none', border: 'none', borderBottom: isRegistering ? '3px solid blue' : 'none', fontWeight: isRegistering ? 'bold' : 'normal', cursor: 'pointer' }}>Registrarse</button>
          </div>
          {!isRegistering ? (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <button type="submit" style={{ padding: '10px', background: 'green', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}>Entrar al Sistema</button>
            </form>
          ) : (
            <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" placeholder="Nickname (ej: Agus)" value={nicknameInput} onChange={(e) => setNicknameInput(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <input type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }} />
              <button type="submit" style={{ padding: '10px', background: 'blue', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px', fontWeight: 'bold' }}>Registrarme</button>
            </form>
          )}
          {error && <p style={{ color: 'red', marginTop: '15px', fontSize: '14px', textAlign: 'center', fontWeight: 'bold' }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

export default App;