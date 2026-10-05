import crypto from 'node:crypto';

// Crockford base32: no I, L, O, U, so codes read out over a noisy gate are unambiguous.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function randomCode(length) {
  let out = '';
  for (const byte of crypto.randomBytes(length)) out += ALPHABET[byte & 31];
  return out;
}

export const newTicketId = () => randomCode(8); // 40 random bits
export const newOrderId = () => 'DL' + randomCode(8);
export const newAccessToken = () => crypto.randomBytes(18).toString('base64url');
export const newSecret = () => crypto.randomBytes(32).toString('hex');

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** 8-char signature over a ticket id. Only this server can make one, so a typed-up fake QR fails. */
export function ticketSig(secret, id) {
  const mac = crypto.createHmac('sha256', secret).update('ticket:' + id).digest();
  let out = '';
  for (let i = 0; i < 8; i++) out += ALPHABET[mac[i] & 31];
  return out;
}

/** "ID.SIG": used in the QR and in the single-pass share link /t/ID.SIG */
export const ticketCode = (secret, id) => `${id}.${ticketSig(secret, id)}`;
/** What the QR actually contains. Short on purpose: small QRs scan faster on cracked screens at night. */
export const qrPayload = (secret, id) => `DL1.${ticketCode(secret, id)}`;
export const formatTicketId = (id) => `DL-${id.slice(0, 4)}-${id.slice(4)}`;

/**
 * Understands everything a gate might feed it:
 *   DL1.ID.SIG (QR) · …/t/ID.SIG (share link) · DL-XXXX-XXXX or XXXXXXXX (typed by hand)
 * Returns { id, sig } (sig is null for hand-typed ids) or null.
 */
export function parseScan(raw) {
  const s = String(raw || '').trim().toUpperCase();
  const signed = s.match(/([0-9A-Z]{8})\.([0-9A-Z]{8})$/);
  if (signed) return { id: signed[1], sig: signed[2] };

  let typed = s.replace(/[\s-]/g, '');
  if (typed.length === 10 && typed.startsWith('DL')) typed = typed.slice(2);
  // People type O for 0 and I/L for 1; Crockford maps them back.
  typed = typed.replace(/O/g, '0').replace(/[IL]/g, '1');
  if (/^[0-9A-HJKMNP-TV-Z]{8}$/.test(typed)) return { id: typed, sig: null };
  return null;
}

export const verifyTicketSig = (secret, id, sig) => safeEqual(ticketSig(secret, id), sig);
