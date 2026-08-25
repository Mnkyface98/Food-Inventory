// Free, self-contained accounts: email/password with bcrypt-hashed
// passwords and a hand-rolled, cookie-based session store backed by
// SQLite — no external auth service, no paid API, same "free and local"
// approach as the rest of this app. Sessions are opaque random tokens
// (crypto.randomBytes), not JWTs, so one can be revoked instantly by
// deleting its row (logout) instead of waiting out a token's own expiry.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');

const SESSION_COOKIE = 'session_token';
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

// Validates signup input without touching the database. Returns either
// {email, password} (cleaned) or {error}.
function validateSignup(email, password) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail || !EMAIL_RE.test(cleanEmail)) {
    return { error: 'Enter a valid email address.' };
  }
  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }
  return { email: cleanEmail, password };
}

function createUser(email, password) {
  const hash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
  const info = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
  return db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
}

function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').get(normalizeEmail(email));
}

function verifyPassword(user, password) {
  return typeof password === 'string' && bcrypt.compareSync(password, user.password_hash);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return token;
}

function destroySession(token) {
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

// Looks up the user behind a session token, checking expiry (and
// cleaning up the row if it's stale) rather than trusting SQLite to
// enforce that on its own.
function getUserForToken(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT users.id, users.email, users.created_at, sessions.expires_at
       FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ?`
    )
    .get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  return { id: row.id, email: row.email, createdAt: row.created_at };
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  // Only require HTTPS for the cookie once actually deployed — running
  // locally over plain http (the common case while developing) would
  // otherwise silently never receive the cookie back.
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  path: '/',
};

function setSessionCookie(res, token) {
  res.cookie(SESSION_COOKIE, token, COOKIE_OPTIONS);
}

function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

// Express middleware for every route that reads/writes a specific
// user's data: attaches req.user on a valid session cookie, otherwise
// responds 401 rather than letting the request through as anonymous.
function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[SESSION_COOKIE];
  const user = getUserForToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Not signed in.' });
  }
  req.user = user;
  next();
}

module.exports = {
  SESSION_COOKIE,
  validateSignup,
  createUser,
  findUserByEmail,
  verifyPassword,
  createSession,
  destroySession,
  getUserForToken,
  setSessionCookie,
  clearSessionCookie,
  requireAuth,
};
