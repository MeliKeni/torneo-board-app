import { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link, Navigate } from 'react-router-dom';
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
  const [showLogout, setShowLogout] = useState(false);
  const [dropdownHover, setDropdownHover] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
    return document.documentElement.classList.contains('dark');
  });
  
  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    document.documentElement.classList.toggle('light', !next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };
  const [isRegistering, setIsRegistering] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = location.pathname === '/amigos' ? 'amigos' : 'juegos';
  const gameIdFromPath = location.pathname.startsWith('/juegos/') ? location.pathname.split('/')[2] : null;

  const [games, setGames] = useState([]);
  const [gameName, setGameName] = useState('');
  const [gameDesc, setGameDesc] = useState('');
  const [editingGameId, setEditingGameId] = useState(null);

  const [selectedGame, setSelectedGame] = useState(null);
  const [matches, setMatches] = useState([]);
  const [playerCount, setPlayerCount] = useState(0); 
  const [playersInput, setPlayersInput] = useState([]);

  const [searchNick, setSearchNick] = useState('');
  const [friends, setFriends] = useState([]);
  const [receivedRequests, setReceivedRequests] = useState([]);

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

  useEffect(() => {
    if (!user) return;
    const unsubscribeGames = getGamesStream(user.uid, (updatedGames) => setGames(updatedGames));
    return () => unsubscribeGames();
  }, [user]);

  useEffect(() => {
    if (gameIdFromPath) {
      const found = games.find(g => g.id === gameIdFromPath) || null;
      setSelectedGame(found);
    } else {
      setSelectedGame(null);
    }
  }, [gameIdFromPath, games]);

  useEffect(() => {
    if (!user || !gameIdFromPath) {
      setMatches([]);
      return;
    }
    const unsubscribeMatches = getMatchesStream(gameIdFromPath, (updatedMatches) => setMatches(updatedMatches));
    setPlayerCount(0);
    setPlayersInput([]);
    return () => unsubscribeMatches();
  }, [user, gameIdFromPath]);

  useEffect(() => {
    if (!user) return;

    const qRequests = query(collection(db, 'friendRequests'), where('toUid', '==', user.uid), where('status', '==', 'pending'));
    const unsubRequests = onSnapshot(qRequests, (snapshot) => {
      setReceivedRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

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
      setError('contraseña o usuario incorrecto!'); 
    }
  };

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
    } catch (err) { console.error('Error al procesar juego:', err); alert('Error al procesar juego'); }
  };

  const handleStartEditGame = (game) => {
    setEditingGameId(game.id);
    setGameName(game.name);
    setGameDesc(game.description || '');
  };

  const handleDeleteGameClick = async (gameId) => {
    if (confirm('¿Seguro querés eliminar este juego? Se borrará de la lista.')) {
      try {
        if (gameIdFromPath === gameId) navigate('/juegos');
        await deleteGame(gameId);
      } catch { alert('Error al borrar juego'); }
    }
  };

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

  const handleAcceptFriend = async (requestId) => {
    try {
      const docRef = doc(db, 'friendRequests', requestId);
      await updateDoc(docRef, { status: 'accepted' });
      alert('¡Solicitud aceptada!');
    } catch { alert('Error al aceptar'); }
  };

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

  if (!user && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }
  if (user && location.pathname === '/login') {
    return <Navigate to="/juegos" replace />;
  }

  const showDropdown = showLogout || dropdownHover;

  return (
    <>
      {user && (
        <div className="navbar">
          <span className="navbar-brand">TP2</span>
          <div className="dropdown-wrapper"
            onMouseEnter={() => setShowLogout(true)}
            onMouseLeave={() => setShowLogout(false)}>
            <div className="avatar">👤</div>
            {showDropdown && (
              <div className="dropdown-menu"
                onMouseEnter={() => setDropdownHover(true)}
                onMouseLeave={() => setDropdownHover(false)}>
                <button onClick={toggleTheme} className="dropdown-item">
                  {isDark ? '☀️ Modo claro' : '🌙 Modo oscuro'}
                </button>
                <button onClick={() => { logoutUser(); navigate('/login'); }} className="dropdown-item dropdown-item--danger">
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {user ? (
        <div className="app-content">
          <div className="tab-bar">
            <Link to="/juegos" className={`tab-link ${activeTab === 'juegos' ? 'tab-link--active' : ''}`}>
              Juegos y partidos
            </Link>
            <span className="tab-sep" />
            <Link to="/amigos" className={`tab-link ${activeTab === 'amigos' ? 'tab-link--active' : ''}`}>
              Amigos
            </Link>
          </div>

          {activeTab === 'juegos' ? (
            <div className="content-wrapper">
              {gameIdFromPath && selectedGame ? (
                <div>
                  <div className="mb-20">
                    <button onClick={() => navigate('/juegos')} className="btn--back">← Volver</button>
                  </div>
                  <h3 className="heading-md">{selectedGame.name} - Partidas</h3>
                  {playerCount === 0 ? (
                      <form onSubmit={handleSetPlayerCount} className="glass-card glass-card--sm glass-card--center">
                        <h4 className="heading-sm">¿Cuántos jugadores?</h4>
                        <div className="flex-row-center">
                          <input type="number" name="count" defaultValue="2" min="1" className="input--narrow" />
                          <button type="submit" className="btn btn--primary btn--md">Continuar</button>
                        </div>
                      </form>
                  ) : (
                      <form onSubmit={handleCreateMatch} className="glass-card glass-card--sm">
                        <h4 className="heading-sm">Anotar Puntos</h4>
                        {playersInput.map((player, idx) => (
                          <div key={idx} className="player-row">
                            <span className="player-index">#{idx + 1}</span>
                            <input type="text" placeholder="Nombre o @nickname" value={player.name} onChange={(e) => handlePlayerInputChange(idx, 'name', e.target.value)} className="input--flex2" />
                            <input type="number" placeholder="Pts" value={player.points} onChange={(e) => handlePlayerInputChange(idx, 'points', e.target.value)} className="input--flex1" />
                          </div>
                        ))}
                        <div className="btn-group">
                          <button type="submit" className="btn btn--primary btn--md">Guardar Partida</button>
                          <button type="button" onClick={() => setPlayerCount(0)} className="btn btn--ghost btn--md">Atrás</button>
                        </div>
                      </form>
                  )}

                  <h4 className="heading-xs">Historial:</h4>
                  {matches.length === 0 ? <p className="text-muted">Sin partidas.</p> : (
                    <ul className="list-reset">
                      {matches.map(match => {
                        const matchDate = match.createdAt?.toDate ? match.createdAt.toDate() : null;
                        return (
                          <li key={match.id} className="match-item">
                            <div>
                              <small className="match-date">📅 {matchDate ? matchDate.toLocaleDateString() : ''}</small>
                              {match.players?.map((p, i) => <div key={i} className="match-player"><strong>{p.name}</strong>: {p.points} pts</div>)}
                            </div>
                            <button onClick={() => handleDeleteMatchClick(match.id)} className="btn--danger">Borrar</button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : (
                <>
                  <div className="glass-card">
                    <h2 className="heading-xl">{editingGameId ? gameName : 'Añade juego de mesa'}</h2>
                    <form onSubmit={handleSaveGame} className="form-stack">
                      <div className="field-group">
                        <label className="field-label">Nombre</label>
                        <input type="text" value={gameName} onChange={(e) => setGameName(e.target.value)} className="form-input" />
                      </div>
                      <div className="field-group">
                        <label className="field-label">Descripcion</label>
                        <input type="text" value={gameDesc} onChange={(e) => setGameDesc(e.target.value)} className="form-input" />
                      </div>
                      <button type="submit" className="btn btn--primary btn--lg">
                        {editingGameId ? 'Actualizar' : 'Agregar partida'}
                      </button>
                    </form>
                  </div>

                  <h3 className="heading-lg">Mis juegos</h3>
                  <div className="game-grid">
                    {games.map(game => (
                      <div key={game.id} onClick={() => navigate(`/juegos/${game.id}`)} className="game-card">
                        <div className="game-card-body">
                          <strong className="game-card-name">{game.name}</strong>
                          <div className="game-card-desc">{game.description || 'Sin descripción'}</div>
                        </div>
                        <div className="game-card-actions">
                          <button onClick={(e) => { e.stopPropagation(); handleStartEditGame(game); }} className="btn--icon btn--icon-warning">✏️</button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteGameClick(game.id); }} className="btn--icon btn--icon-danger">🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="amigos-grid">
              <div>
                <div className="search-card">
                  <h3 className="sub-heading mb-12">🔍 Buscar Amigos</h3>
                  <form onSubmit={handleSendFriendRequest} className="search-form">
                    <input type="text" placeholder="Buscar por nickname" value={searchNick} onChange={(e) => setSearchNick(e.target.value)} className="search-input" />
                    <button type="submit" className="btn btn--primary btn--sm">Agregar</button>
                  </form>
                </div>
                <h3 className="sub-heading">Mis Amigos:</h3>
                {friends.length === 0 ? <p className="text-muted">Sin amigos.</p> : (
                  <ul className="list-reset">
                    {friends.map((f, i) => (
                      <li key={i} className="friend-item">
                        <strong className="friend-name">@{f.nickname}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="sub-heading">📥 Solicitudes</h3>
                {receivedRequests.length === 0 ? <p className="text-muted">Sin solicitudes.</p> : (
                  <ul className="list-reset">
                    {receivedRequests.map(req => (
                      <li key={req.id} className="request-item">
                        <span className="request-info">👋 <strong>@{req.fromNickname}</strong></span>
                        <button onClick={() => handleAcceptFriend(req.id)} className="btn--accept">Aceptar</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="login-overlay">
          <div className="circle-red" />
          <div className="circle-blue" />
          <div className="circle-green" />
          <div className="login-card">
            {!isRegistering ? (
              <>
                <h1 className="heading-xl">Inicio de sesión</h1>
                <form onSubmit={handleLogin} className="form-stack">
                  <div className="field-group">
                    <label className="field-label">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" />
                  </div>
                  <div className="field-group">
                    <label className="field-label">contraseña</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" />
                  </div>
                  <button type="submit" className="btn btn--primary btn--lg">Inicia sesion</button>
                </form>
                <p className="toggle-text" onClick={() => { setIsRegistering(true); setError(''); }}>No tienes cuenta? <span className="underline">Registrate</span></p>
              </>
            ) : (
              <>
                <h1 className="heading-xl heading-xl--tight">Registro</h1>
                <form onSubmit={handleRegister} className="form-stack--tight">
                  <div className="field-group--tight">
                    <label className="field-label">Nickname</label>
                    <input type="text" value={nicknameInput} onChange={(e) => setNicknameInput(e.target.value)} className="form-input" />
                  </div>
                  <div className="field-group--tight">
                    <label className="field-label">Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" />
                  </div>
                  <div className="field-group--tight">
                    <label className="field-label">contraseña</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="form-input" />
                  </div>
                  <button type="submit" className="btn btn--primary btn--lg mt-2">Crear cuenta</button>
                </form>
                <p className="toggle-text" onClick={() => { setIsRegistering(false); setError(''); }}>Ya tenes cuenta? <span className="underline">Inicia sesion</span></p>
              </>
            )}
            {error && <p className="error-text">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}

export default App;
