export function sanitizeNickname(input) {
  return input.trim().replace('@', '');
}

export function validateGameForm(name, description) {
  if (!name.trim()) return { valid: false, error: 'El nombre del juego no puede estar vacío.' };
  if (!description.trim()) return { valid: false, error: 'La descripción no puede estar vacía.' };
  return { valid: true, error: null };
}

export function buildInitialPlayers(count, userNickname) {
  return Array.from({ length: count }, (_, idx) => ({
    name: idx === 0 ? `@${userNickname}` : '',
    points: 0,
  }));
}

export function extractSharedUids(players, friends, ownerUid) {
  const uids = [ownerUid];
  for (const player of players) {
    if (player.name.startsWith('@')) {
      const nick = player.name.replace('@', '').trim().toLowerCase();
      const friend = friends.find(f => f.nickname.toLowerCase() === nick);
      if (friend && !uids.includes(friend.uid)) {
        uids.push(friend.uid);
      }
    }
  }
  return uids;
}

export function buildFriendList(docs, currentUid) {
  const list = [];
  docs.forEach(doc => {
    const data = doc.data ? doc.data() : doc;
    if (data.fromUid === currentUid) {
      list.push({ uid: data.toUid, nickname: data.toNickname });
    } else if (data.toUid === currentUid) {
      list.push({ uid: data.fromUid, nickname: data.fromNickname });
    }
  });
  return list;
}

export function formatMatchDate(timestamp) {
  if (!timestamp) return { date: null, time: null };
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return {
    date: d.toLocaleDateString(),
    time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

export function formatElapsedTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getElapsedSeconds(startTimestamp) {
  if (!startTimestamp) return 0;
  const start = startTimestamp.toDate ? startTimestamp.toDate() : new Date(startTimestamp);
  return Math.floor((Date.now() - start.getTime()) / 1000);
}
