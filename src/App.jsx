import { useState, useEffect } from 'react';
import { useLocation, Link, Navigate } from 'react-router-dom';
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
  const activeTab = location.pathname === '/amigos' ? 'amigos' : 'juegos';

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
    if (!user || !selectedGame) return;
    const unsubscribeMatches = getMatchesStream(selectedGame.id, (updatedMatches) => setMatches(updatedMatches));
    return () => unsubscribeMatches();
  }, [user, selectedGame]);

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
        if (selectedGame?.id === gameId) setSelectedGame(null);
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
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid var(--clr-border)', background: 'var(--clr-surface)', boxSizing: 'border-box' }}>
          <span style={{ fontWeight: 'bold', fontSize: '18px' }}>TP2</span>
          <div style={{ position: 'relative' }}
            onMouseEnter={() => setShowLogout(true)}
            onMouseLeave={() => setShowLogout(false)}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--clr-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '16px' }}>
              👤
            </div>
            {showDropdown && (
              <div style={{ position: 'absolute', top: '100%', right: '0', zIndex: 10 }}
                onMouseEnter={() => setDropdownHover(true)}
                onMouseLeave={() => setDropdownHover(false)}>
                <div style={{ marginTop: '8px', background: 'color-mix(in srgb, var(--clr-white) 70%, transparent)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', border: '1px solid color-mix(in srgb, var(--clr-border) 50%, transparent)', borderRadius: '12px', boxShadow: '0 4px 20px color-mix(in srgb, var(--clr-black) 10%, transparent)', minWidth: '160px', overflow: 'hidden' }}>
                  <button onClick={toggleTheme}
                    style={{ width: '100%', padding: '10px 15px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '14px', color: 'var(--clr-text)' }}>
                    {isDark ? '☀️ Modo claro' : '🌙 Modo oscuro'}
                  </button>
                  <button onClick={() => { logoutUser(); setSelectedGame(null); setMatches([]); setPlayerCount(0); }}
                    style={{ width: '100%', padding: '10px 15px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '14px', color: 'var(--clr-danger)' }}>
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {user ? (
        <div style={{ fontFamily: 'sans-serif', background: 'var(--clr-bg)', minHeight: 'calc(100vh - 57px)', padding: '30px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '30px' }}>
            <Link to="/juegos" style={{ textDecoration: 'none', color: 'var(--clr-black)', fontWeight: 'bold', fontSize: '22px', padding: '8px 20px', borderBottom: activeTab === 'juegos' ? '3px solid var(--clr-lilac-light)' : '3px solid transparent' }}>
              Juegos y partidos
            </Link>
            <span style={{ width: '1.5px', height: '24px', background: 'var(--clr-black)', margin: '0 16px' }} />
            <Link to="/amigos" style={{ textDecoration: 'none', color: 'var(--clr-black)', fontWeight: 'bold', fontSize: '22px', padding: '8px 20px', borderBottom: activeTab === 'amigos' ? '3px solid var(--clr-lilac-light)' : '3px solid transparent' }}>
              Amigos
            </Link>
          </div>

          {activeTab === 'juegos' ? (
              <div style={{ maxWidth: '600px', margin: '0 auto' }}>
              <div style={{ width: '100%', padding: '40px', borderRadius: '28px', background: 'color-mix(in srgb, var(--clr-white) 40%, transparent)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid color-mix(in srgb, var(--clr-white) 60%, transparent)', boxShadow: '0 8px 32px color-mix(in srgb, var(--clr-black) 10%, transparent)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                <h2 style={{ textAlign: 'center', color: 'var(--clr-black)', fontSize: '40px', fontWeight: 'bold', margin: '0 0 30px 0' }}>{editingGameId ? gameName : 'Añade juego de mesa'}</h2>
                <form onSubmit={handleSaveGame} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ color: 'var(--clr-black)', fontSize: '15px', fontWeight: '600', display: 'block', textAlign: 'left' }}>Nombre</label>
                    <input type="text" value={gameName} onChange={(e) => setGameName(e.target.value)} style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '25px', border: '1px solid var(--clr-border)', background: 'var(--clr-white)', outline: 'none', color: 'var(--clr-black)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ color: 'var(--clr-black)', fontSize: '15px', fontWeight: '600', display: 'block', textAlign: 'left' }}>Descripcion</label>
                    <input type="text" value={gameDesc} onChange={(e) => setGameDesc(e.target.value)} style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '25px', border: '1px solid var(--clr-border)', background: 'var(--clr-white)', outline: 'none', color: 'var(--clr-black)' }} />
                  </div>
                  <button type="submit" style={{ padding: '12px', fontSize: '15px', background: 'var(--clr-black)', color: 'var(--clr-white)', border: 'none', cursor: 'pointer', borderRadius: '25px', fontWeight: 'bold', marginTop: '4px' }}>
                    {editingGameId ? 'Actualizar' : 'Agregar partida'}
                  </button>
                </form>
              </div>

              <h3 style={{ textAlign: 'center', color: 'var(--clr-black)', fontWeight: 'bold', fontSize: '22px', margin: '40px 0 20px' }}>Mis juegos</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {games.map(game => (
                  <li key={game.id} style={{ background: selectedGame?.id === game.id ? 'color-mix(in srgb, var(--clr-lilac) 20%, transparent)' : 'var(--clr-surface)', padding: '12px 20px', marginBottom: '8px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div onClick={() => { setMatches([]); setSelectedGame(game); setPlayerCount(0); }} style={{ cursor: 'pointer', flex: 1 }}>
                      <strong style={{ color: 'var(--clr-black)' }}>{game.name}</strong> <br />
                      <small style={{ color: 'var(--clr-text-muted)' }}>{game.description || 'Sin descripción'}</small>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button onClick={() => handleStartEditGame(game)} style={{ background: 'var(--clr-warning)', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: '6px' }}>✏️</button>
                      <button onClick={() => handleDeleteGameClick(game.id)} style={{ background: 'var(--clr-danger)', color: 'var(--clr-white)', border: 'none', padding: '4px 8px', cursor: 'pointer', borderRadius: '6px' }}>🗑️</button>
                    </div>
                  </li>
                ))}
              </ul>

              {selectedGame && (
                <div style={{ marginTop: '40px' }}>
                  <h3 style={{ textAlign: 'center', color: 'var(--clr-black)', fontSize: '20px', fontWeight: 'bold', margin: '0 0 20px' }}>{selectedGame.name} - Partidas</h3>
                  {playerCount === 0 ? (
                      <form onSubmit={handleSetPlayerCount} style={{ width: '100%', padding: '30px', borderRadius: '28px', background: 'color-mix(in srgb, var(--clr-white) 40%, transparent)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid color-mix(in srgb, var(--clr-white) 60%, transparent)', boxShadow: '0 8px 32px color-mix(in srgb, var(--clr-black) 10%, transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box' }}>
                        <h4 style={{ textAlign: 'center', color: 'var(--clr-black)', fontWeight: 'bold', margin: '0 0 16px', fontSize: '18px' }}>¿Cuántos jugadores?</h4>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center' }}>
                          <input type="number" name="count" defaultValue="2" min="1" style={{ padding: '12px 16px', borderRadius: '25px', border: '1px solid var(--clr-border)', fontSize: '15px', outline: 'none', color: 'var(--clr-black)', background: 'var(--clr-white)', width: '80px' }} />
                          <button type="submit" style={{ padding: '12px 28px', borderRadius: '25px', background: 'var(--clr-black)', color: 'var(--clr-white)', border: 'none', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>Continuar</button>
                        </div>
                      </form>
                  ) : (
                      <form onSubmit={handleCreateMatch} style={{ width: '100%', padding: '30px', borderRadius: '28px', background: 'color-mix(in srgb, var(--clr-white) 40%, transparent)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid color-mix(in srgb, var(--clr-white) 60%, transparent)', boxShadow: '0 8px 32px color-mix(in srgb, var(--clr-black) 10%, transparent)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
                        <h4 style={{ textAlign: 'center', color: 'var(--clr-black)', fontWeight: 'bold', margin: '0 0 16px', fontSize: '18px' }}>Anotar Puntos</h4>
                        {playersInput.map((player, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ color: 'var(--clr-black)', fontWeight: 'bold' }}>#{idx + 1}</span>
                            <input type="text" placeholder="Nombre o @nickname" value={player.name} onChange={(e) => handlePlayerInputChange(idx, 'name', e.target.value)} style={{ flex: 2, padding: '12px 16px', borderRadius: '25px', border: '1px solid var(--clr-border)', fontSize: '15px', outline: 'none', color: 'var(--clr-black)', background: 'var(--clr-white)' }} />
                            <input type="number" placeholder="Pts" value={player.points} onChange={(e) => handlePlayerInputChange(idx, 'points', e.target.value)} style={{ flex: 1, padding: '12px 16px', borderRadius: '25px', border: '1px solid var(--clr-border)', fontSize: '15px', outline: 'none', color: 'var(--clr-black)', background: 'var(--clr-white)' }} />
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px', justifyContent: 'center' }}>
                          <button type="submit" style={{ padding: '12px 28px', borderRadius: '25px', background: 'var(--clr-black)', color: 'var(--clr-white)', border: 'none', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>Guardar Partida</button>
                          <button type="button" onClick={() => setPlayerCount(0)} style={{ padding: '12px 28px', borderRadius: '25px', background: 'color-mix(in srgb, var(--clr-white) 40%, transparent)', border: '1px solid var(--clr-border)', color: 'var(--clr-black)', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>Atrás</button>
                        </div>
                      </form>
                  )}

                  <h4 style={{ marginTop: '24px', color: 'var(--clr-black)', fontWeight: 'bold' }}>Historial:</h4>
                  {matches.length === 0 ? <p style={{color:'var(--clr-text-muted)'}}>Sin partidas.</p> : (
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                      {matches.map(match => {
                        const matchDate = match.createdAt?.toDate ? match.createdAt.toDate() : null;
                        return (
                          <li key={match.id} style={{ background: 'var(--clr-surface)', border: '1px solid var(--clr-border)', padding: '12px', marginBottom: '8px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <small style={{ color: 'var(--clr-text-muted)' }}>📅 {matchDate ? matchDate.toLocaleDateString() : ''}</small>
                              {match.players?.map((p, i) => <div key={i} style={{ color: 'var(--clr-text)' }}><strong>{p.name}</strong>: {p.points} pts</div>)}
                            </div>
                            <button onClick={() => handleDeleteMatchClick(match.id)} style={{ background: 'var(--clr-danger)', color: 'var(--clr-white)', border: 'none', padding: '6px 10px', cursor: 'pointer', borderRadius: '6px' }}>Borrar</button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div style={{ maxWidth: '600px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' }}>
              <div>
                <div style={{ padding: '20px', borderRadius: '20px', background: 'color-mix(in srgb, var(--clr-white) 40%, transparent)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid color-mix(in srgb, var(--clr-white) 60%, transparent)', boxShadow: '0 8px 32px color-mix(in srgb, var(--clr-black) 10%, transparent)', marginBottom: '20px' }}>
                  <h3 style={{ fontWeight: 'bold', color: 'var(--clr-black)', margin: '0 0 12px' }}>🔍 Buscar Amigos</h3>
                  <form onSubmit={handleSendFriendRequest} style={{ display: 'flex', gap: '10px' }}>
                    <input type="text" placeholder="Buscar por nickname" value={searchNick} onChange={(e) => setSearchNick(e.target.value)} style={{ flex: 1, padding: '12px 16px', borderRadius: '25px', border: '1px solid var(--clr-border)', outline: 'none', color: 'var(--clr-black)', background: 'var(--clr-white)', fontSize: '15px' }} />
                    <button type="submit" style={{ padding: '12px 20px', borderRadius: '25px', background: 'var(--clr-black)', color: 'var(--clr-white)', border: 'none', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>Agregar</button>
                  </form>
                </div>
                <h3 style={{ fontWeight: 'bold', color: 'var(--clr-black)' }}>Mis Amigos:</h3>
                {friends.length === 0 ? <p style={{color:'var(--clr-text-muted)'}}>Sin amigos.</p> : (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {friends.map((f, i) => (
                      <li key={i} style={{ background: 'var(--clr-surface)', padding: '10px 16px', marginBottom: '6px', borderRadius: '12px', borderLeft: '4px solid var(--clr-success)' }}>
                        <strong style={{ color: 'var(--clr-black)' }}>@{f.nickname}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 style={{ fontWeight: 'bold', color: 'var(--clr-black)' }}>📥 Solicitudes</h3>
                {receivedRequests.length === 0 ? <p style={{color:'var(--clr-text-muted)'}}>Sin solicitudes.</p> : (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {receivedRequests.map(req => (
                      <li key={req.id} style={{ background: 'color-mix(in srgb, var(--clr-warning) 12%, transparent)', padding: '12px', marginBottom: '8px', borderRadius: '12px', border: '1px solid color-mix(in srgb, var(--clr-warning) 40%, transparent)' }}>
                        <span style={{ color: 'var(--clr-black)' }}>👋 <strong>@{req.fromNickname}</strong></span>
                        <button onClick={() => handleAcceptFriend(req.id)} style={{ marginTop: '8px', padding: '8px 16px', borderRadius: '25px', background: 'var(--clr-black)', border: 'none', color: 'var(--clr-white)', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>Aceptar</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--clr-white)', overflow: 'hidden' }}>
          <div className="circle-red" />
          <div className="circle-blue" />
          <div className="circle-green" />
          <div style={{ width: '400px', height: '440px', padding: '40px', borderRadius: '28px', background: 'color-mix(in srgb, var(--clr-white) 40%, transparent)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid color-mix(in srgb, var(--clr-white) 60%, transparent)', boxShadow: '0 8px 32px color-mix(in srgb, var(--clr-black) 10%, transparent)', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
            {!isRegistering ? (
              <>
                <h1 style={{ textAlign: 'center', color: 'var(--clr-black)', fontSize: '40px', fontWeight: 'bold', margin: '0 0 30px 0' }}>Inicio de sesión</h1>
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ color: 'var(--clr-black)', fontSize: '15px', fontWeight: '600', display: 'block', textAlign: 'left' }}>Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '25px', border: '1px solid var(--clr-border)', background: 'var(--clr-white)', outline: 'none', color: 'var(--clr-black)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ color: 'var(--clr-black)', fontSize: '15px', fontWeight: '600', display: 'block', textAlign: 'left' }}>contraseña</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '25px', border: '1px solid var(--clr-border)', background: 'var(--clr-white)', outline: 'none', color: 'var(--clr-black)' }} />
                  </div>
                  <button type="submit" style={{ padding: '12px', fontSize: '15px', background: 'var(--clr-black)', color: 'var(--clr-white)', border: 'none', cursor: 'pointer', borderRadius: '25px', fontWeight: 'bold', marginTop: '4px' }}>Inicia sesion</button>
                </form>
                <p style={{ textAlign: 'center', color: 'var(--clr-black)', fontSize: '15px', marginTop: '28px', cursor: 'pointer' }} onClick={() => { setIsRegistering(true); setError(''); }}>No tienes cuenta? <span style={{textDecoration: 'underline'}}>Registrate</span></p>
              </>
            ) : (
              <>
                <h1 style={{ textAlign: 'center', color: 'var(--clr-black)', fontSize: '40px', fontWeight: 'bold', margin: '0 0 22px 0' }}>Registro</h1>
                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ color: 'var(--clr-black)', fontSize: '15px', fontWeight: '600', display: 'block', textAlign: 'left' }}>Nickname</label>
                    <input type="text" value={nicknameInput} onChange={(e) => setNicknameInput(e.target.value)} style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '25px', border: '1px solid var(--clr-border)', background: 'var(--clr-white)', outline: 'none', color: 'var(--clr-black)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ color: 'var(--clr-black)', fontSize: '15px', fontWeight: '600', display: 'block', textAlign: 'left' }}>Email</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '25px', border: '1px solid var(--clr-border)', background: 'var(--clr-white)', outline: 'none', color: 'var(--clr-black)' }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ color: 'var(--clr-black)', fontSize: '15px', fontWeight: '600', display: 'block', textAlign: 'left' }}>contraseña</label>
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ padding: '12px 16px', fontSize: '15px', borderRadius: '25px', border: '1px solid var(--clr-border)', background: 'var(--clr-white)', outline: 'none', color: 'var(--clr-black)' }} />
                  </div>
                  <button type="submit" style={{ padding: '12px', fontSize: '15px', background: 'var(--clr-black)', color: 'var(--clr-white)', border: 'none', cursor: 'pointer', borderRadius: '25px', fontWeight: 'bold', marginTop: '2px' }}>Crear cuenta</button>
                </form>
                <p style={{ textAlign: 'center', color: 'var(--clr-black)', fontSize: '15px', marginTop: '28px', cursor: 'pointer' }} onClick={() => { setIsRegistering(false); setError(''); }}>Ya tenes cuenta? <span style={{textDecoration: 'underline'}}>Inicia sesion</span></p>
              </>
            )}
            {error && <p style={{ color: 'var(--clr-danger)', marginTop: '12px', fontSize: '14px', textAlign: 'center', fontWeight: 'bold' }}>{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}

export default App;