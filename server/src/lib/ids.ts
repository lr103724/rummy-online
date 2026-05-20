import { randomBytes, randomUUID } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function generateRoomCode(len = 4): string {
  const bytes = randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i]! % ALPHABET.length];
  return out;
}

export function generateMeldId(): string {
  return `m_${randomUUID().slice(0, 8)}`;
}

export function generatePlayerId(): string {
  return `p_${randomUUID().slice(0, 12)}`;
}
