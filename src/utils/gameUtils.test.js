import { describe, it, expect } from 'vitest';
import {
  sanitizeNickname,
  validateGameForm,
  buildInitialPlayers,
  extractSharedUids,
  buildFriendList,
  formatMatchDate,
  formatElapsedTime,
  getElapsedSeconds,
} from './gameUtils';

describe('sanitizeNickname', () => {
  it('elimina el @ y los espacios del nickname', () => {
    expect(sanitizeNickname('  @meli  ')).toBe('meli');
  });

  it('devuelve el nickname sin cambios si no tiene @ ni espacios', () => {
    expect(sanitizeNickname('maia')).toBe('maia');
  });
});

describe('validateGameForm', () => {
  it('devuelve error si el nombre está vacío', () => {
    const result = validateGameForm('', 'una descripcion');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('devuelve error si la descripcion está vacía', () => {
    const result = validateGameForm('Truco', '');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('devuelve válido cuando nombre y descripción tienen contenido', () => {
    const result = validateGameForm('Truco', 'Juego de cartas');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });
});

describe('buildInitialPlayers', () => {
  it('crea la cantidad correcta de jugadores', () => {
    const players = buildInitialPlayers(3, 'meli');
    expect(players).toHaveLength(3);
  });

  it('el primer jugador tiene el @ del usuario actual', () => {
    const players = buildInitialPlayers(2, 'meli');
    expect(players[0].name).toBe('@meli');
  });

  it('los jugadores siguientes tienen nombre vacío y 0 puntos', () => {
    const players = buildInitialPlayers(2, 'meli');
    expect(players[1].name).toBe('');
    expect(players[1].points).toBe(0);
  });
});

describe('extractSharedUids', () => {
  const friends = [
    { uid: 'uid-maia', nickname: 'maia' },
    { uid: 'uid-juan', nickname: 'juan' },
  ];

  it('incluye siempre el uid del dueño', () => {
    const uids = extractSharedUids([], friends, 'uid-owner');
    expect(uids).toContain('uid-owner');
  });

  it('resuelve @menciones a UIDs de amigos', () => {
    const players = [{ name: '@maia', points: 10 }];
    const uids = extractSharedUids(players, friends, 'uid-owner');
    expect(uids).toContain('uid-maia');
  });

  it('ignora @menciones que no son amigos', () => {
    const players = [{ name: '@desconocido', points: 5 }];
    const uids = extractSharedUids(players, friends, 'uid-owner');
    expect(uids).toHaveLength(1);
  });
});

describe('buildFriendList', () => {
  it('incluye amigos donde el usuario es el remitente', () => {
    const docs = [{ fromUid: 'uid-yo', toUid: 'uid-maia', toNickname: 'maia', fromNickname: 'yo' }];
    const list = buildFriendList(docs, 'uid-yo');
    expect(list).toHaveLength(1);
    expect(list[0].nickname).toBe('maia');
  });

  it('incluye amigos donde el usuario es el receptor', () => {
    const docs = [{ fromUid: 'uid-maia', toUid: 'uid-yo', toNickname: 'yo', fromNickname: 'maia' }];
    const list = buildFriendList(docs, 'uid-yo');
    expect(list).toHaveLength(1);
    expect(list[0].nickname).toBe('maia');
  });
});

describe('formatElapsedTime', () => {
  it('formatea 0 segundos como 00:00', () => {
    expect(formatElapsedTime(0)).toBe('00:00');
  });

  it('formatea 65 segundos como 01:05', () => {
    expect(formatElapsedTime(65)).toBe('01:05');
  });

  it('formatea 3600 segundos como 60:00', () => {
    expect(formatElapsedTime(3600)).toBe('60:00');
  });
});

describe('formatMatchDate', () => {
  it('devuelve nulls si no hay timestamp', () => {
    const result = formatMatchDate(null);
    expect(result.date).toBeNull();
    expect(result.time).toBeNull();
  });

  it('formatea correctamente un timestamp con toDate()', () => {
    const fakeTimestamp = { toDate: () => new Date('2024-06-15T14:30:00') };
    const result = formatMatchDate(fakeTimestamp);
    expect(result.date).toBeTruthy();
    expect(result.time).toBeTruthy();
  });
});

describe('getElapsedSeconds', () => {
  it('devuelve 0 si no hay timestamp', () => {
    expect(getElapsedSeconds(null)).toBe(0);
  });

  it('devuelve segundos positivos para un timestamp reciente', () => {
    const ahora = new Date(Date.now() - 5000);
    const fakeTimestamp = { toDate: () => ahora };
    const elapsed = getElapsedSeconds(fakeTimestamp);
    expect(elapsed).toBeGreaterThanOrEqual(4);
    expect(elapsed).toBeLessThan(10);
  });
});
