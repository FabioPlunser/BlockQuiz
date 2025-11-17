import { db } from '../db/client';
import { sessions, users } from '../db/schema';
import { eq } from 'drizzle-orm';

const SESSION_EXPIRY_TIME = 1000 * 60 * 60 * 24 * 30; // 30 days

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  role: 'student' | 'teacher' | 'author' | 'admin';
}

export interface ValidatedSession {
  session: Session | null;
  user: User | null;
}

export async function validateSessionToken(sessionToken: string): Promise<ValidatedSession> {
  const now = Date.now();

  const sessionRecord = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionToken))
    .limit(1);

  if (sessionRecord.length === 0) {
    return { session: null, user: null };
  }

  const session = sessionRecord[0];

  // Check if session has expired
  if (now >= session.expiresAt) {
    // Delete expired session
    await db.delete(sessions).where(eq(sessions.id, sessionToken));
    return { session: null, user: null };
  }

  // Get user data
  const userRecord = await db
    .select()
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  if (userRecord.length === 0) {
    // User was deleted, remove session
    await db.delete(sessions).where(eq(sessions.id, sessionToken));
    return { session: null, user: null };
  }

  const user = userRecord[0];

  // Refresh session expiry if it's close to expiring (within 24 hours)
  const sessionExpiresInMs = session.expiresAt - now;
  if (sessionExpiresInMs < 1000 * 60 * 60 * 24) {
    const newExpiryTime = now + SESSION_EXPIRY_TIME;
    await db
      .update(sessions)
      .set({ expiresAt: newExpiryTime })
      .where(eq(sessions.id, sessionToken));
    session.expiresAt = newExpiryTime;
  }

  return {
    session: {
      id: session.id,
      userId: session.userId,
      expiresAt: new Date(session.expiresAt)
    },
    user: {
      id: user.id,
      email: user.email,
      role: user.role as 'student' | 'teacher' | 'author' | 'admin'
    }
  };
}

export async function createSession(userId: string): Promise<Session> {
  const sessionId = generateSessionToken();
  const expiresAt = Date.now() + SESSION_EXPIRY_TIME;

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt
  });

  return {
    id: sessionId,
    userId,
    expiresAt: new Date(expiresAt)
  };
}

export async function invalidateSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function invalidateAllSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export function generateSessionToken(): string {
  const bytes = new Uint8Array(25);
  crypto.getRandomValues(bytes);
  // Convert to base32 lowercase without padding
  return encodeBase32LowerCaseNoPadding(bytes);
}

function encodeBase32LowerCaseNoPadding(input: Uint8Array): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let result = '';
  let bits = 0;
  let value = 0;

  for (let i = 0; i < input.length; i++) {
    value = (value << 8) | input[i];
    bits += 8;

    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }

  return result;
}

export function setSessionCookie(cookies: any, sessionId: string, expiresAt: Date): void {
  cookies.set('session', sessionId, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiresAt
  });
}

export function deleteSessionCookie(cookies: any): void {
  cookies.delete('session', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
}
