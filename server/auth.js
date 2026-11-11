'use strict';

// Demo sign-in, guest sessions and the bearer token check.

const crypto = require('node:crypto');
const settings = require('./settings');
const { store, findUserByEmail, nextGuestId } = require('./store');
const { sendError } = require('./errors');

function newToken() {
  return `sbx_FAKE_${crypto.randomBytes(12).toString('hex')}`;
}

function createSession(userId, role) {
  const token = newToken();
  store.sessions.set(token, {
    userId,
    role,
    expiresAt: Date.now() + settings.tokenTtlSeconds * 1000,
  });
  return { token, expiresInSeconds: settings.tokenTtlSeconds, role };
}

function signIn(email, password) {
  const user = findUserByEmail(email);
  if (!user || password !== settings.demoPassword) return null;
  return { user, session: createSession(user.id, 'user') };
}

function startGuest() {
  const guestId = nextGuestId();
  return { guestId, session: createSession(guestId, 'guest') };
}

function sessionFrom(req) {
  const header = req.get('authorization') || '';
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return null;
  const session = store.sessions.get(match[1]);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    store.sessions.delete(match[1]);
    return null;
  }
  return session;
}

function requireAuth(req, res, next) {
  const session = sessionFrom(req);
  if (!session) {
    return sendError(res, 401, 'UNAUTHORIZED', 'Missing, invalid or expired token');
  }
  req.auth = session;
  res.locals.log.user = session.userId;
  return next();
}

module.exports = { signIn, startGuest, requireAuth };
