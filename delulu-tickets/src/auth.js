import crypto from 'node:crypto';
import { safeEqual } from './codes.js';

const COOKIE = 'dl_session';

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      // ignore malformed cookies from other sites/tools
    }
  }
  return out;
}

/**
 * Stateless sessions: a signed cookie that says "admin" or "staff".
 * Changing ADMIN_PASSWORD or SCANNER_PIN logs everyone with the old one out.
 */
export function createAuth({ secret, adminPassword, scannerPin, secureCookies }) {
  const mac = (data) => crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const credentialVersion = { admin: mac('v:admin:' + adminPassword).slice(0, 10), staff: mac('v:staff:' + scannerPin).slice(0, 10) };
  // Compare HMACs so both sides are always the same length (no timing hints).
  const matches = (given, expected) => Boolean(expected) && safeEqual(mac('pw:' + String(given ?? '')), mac('pw:' + expected));

  function cookie(value, maxAgeSeconds) {
    return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secureCookies ? '; Secure' : ''}`;
  }

  function login(res, { role, secret: given, gate }) {
    const ok = role === 'admin' ? matches(given, adminPassword) : role === 'staff' ? matches(given, scannerPin) : false;
    if (!ok) return null;
    const hours = role === 'admin' ? 12 : 18;
    const session = { role, gate: String(gate || '').slice(0, 40), v: credentialVersion[role], exp: Date.now() + hours * 3600e3 };
    const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
    res.setHeader('Set-Cookie', cookie(`${payload}.${mac(payload)}`, hours * 3600));
    return session;
  }

  function read(req) {
    const raw = parseCookies(req.headers.cookie)[COOKIE];
    if (!raw) return null;
    const [payload, sig] = raw.split('.');
    if (!payload || !sig || !safeEqual(mac(payload), sig)) return null;
    try {
      const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      return s.exp > Date.now() && s.v === credentialVersion[s.role] ? s : null;
    } catch {
      return null;
    }
  }

  const logout = (res) => res.setHeader('Set-Cookie', cookie('', 0));

  /** 'staff' routes also accept admins. */
  const require = (role) => (req, res, next) => {
    const s = read(req);
    if (!s || (role === 'admin' && s.role !== 'admin')) return res.status(401).json({ error: 'Please log in.' });
    req.session = s;
    next();
  };

  return { login, logout, read, require };
}

/**
 * Tiny in-memory sliding-window limiter. Good enough for one server.
 * limiter(key) records a hit and says whether it was allowed; limiter.blocked(key) only looks.
 */
export function rateLimiter(max, windowMs) {
  const hits = new Map();
  const recent = (key, now) => (hits.get(key) || []).filter((t) => now - t < windowMs);
  const take = (key) => {
    const now = Date.now();
    const list = recent(key, now);
    const allowed = list.length < max;
    if (allowed) list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return allowed;
  };
  take.blocked = (key) => recent(key, Date.now()).length >= max;
  return take;
}

/**
 * Who to rate-limit. Hosts put one or more proxies in front of the app, and if we guessed the
 * hop count wrong every buyer would share one IP and get throttled together during a rush.
 * The first X-Forwarded-For entry is the real client (spoofable, which only lets an abuser
 * dodge the per-client limit; the global login cap below still holds).
 */
export const clientKey = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip;
