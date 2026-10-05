// Small helpers shared by every page.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const rupees = (amount, { paise = true } = {}) =>
  '₹' + (paise ? amount / 100 : amount).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const istTime = (iso, opts = { dateStyle: 'medium', timeStyle: 'short' }) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', ...opts }) : '';

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON (e.g. network proxy page)
  }
  if (!res.ok) {
    const err = new Error(data?.error || `Something went wrong (${res.status}). Please try again.`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Crossed dandiya sticks, used as the DELULU logo mark. Each copy gets its own pattern id. */
let logoCount = 0;
export function sticksSvg() {
  const id = `dl-stripe-${++logoCount}`;
  const stick = (deg) =>
    `<g transform="rotate(${deg} 32 32)"><rect x="28.5" y="3" width="7" height="58" rx="3.5" fill="url(#${id})"/><circle cx="32" cy="5" r="4" fill="#2ed47a"/></g>`;
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs><pattern id="${id}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
    <rect width="8" height="8" fill="#ff2e93"/><rect width="4" height="8" fill="#ffc531"/>
  </pattern></defs>${stick(32)}${stick(-32)}</svg>`;
}

export const brandHtml = (brand = 'DELULU PRODUCTION') => {
  const [first, ...rest] = String(brand).split(' ');
  return `${sticksSvg()}<span><b>${esc(first)}</b><small>${esc(rest.join(' '))}</small></span>`;
};

/** Remembers bookings on this phone so "My passes" survives a closed tab. */
export const myPasses = {
  key: 'delulu.bookings',
  list() {
    try {
      return JSON.parse(localStorage.getItem(this.key) || '[]');
    } catch {
      return [];
    }
  },
  add(token, label) {
    try {
      const list = this.list().filter((b) => b.token !== token);
      list.unshift({ token, label, at: Date.now() });
      localStorage.setItem(this.key, JSON.stringify(list.slice(0, 10)));
    } catch {
      // private mode: fine, the link/email still work
    }
  },
};
