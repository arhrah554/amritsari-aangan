import http from 'node:http';
import crypto from 'node:crypto';
import { createApp } from '../src/app.js';

export const TEST_EVENT = {
  brand: 'DELULU PRODUCTION',
  event: { name: 'Navratri Nights', tagline: 't', date: 'Oct 2026', time: '6 PM', venue: 'Begumpet Hockey Grounds', city: 'Hyderabad' },
  maxPerOrder: 10,
  holdMinutes: 15,
  perks: { food: { label: 'Food', icon: '🍽️' }, sticks: { label: 'Dandiya sticks', icon: '🥢' } },
  passes: [
    { id: 'student', audience: 'student', name: 'Student Pass', price: 299, includes: ['Entry'], redeem: [], capacity: null },
    { id: 'student-food', audience: 'student', name: 'Student Pass + Food', price: 449, includes: ['Entry', 'Food'], redeem: ['food'], capacity: null },
    { id: 'general', audience: 'all', name: 'General Adult Pass', price: 399, includes: ['Entry'], redeem: [], capacity: null },
    { id: 'vip', audience: 'all', name: 'VIP + Food + Sticks', price: 649, includes: ['VIP entry', 'Food', 'Sticks'], redeem: ['food', 'sticks'], capacity: 5 },
  ],
};

/**
 * Starts an isolated app on a random port.
 * Uses in-memory PGlite, or real Postgres when TEST_DATABASE_URL is set (wiped first).
 */
export async function startApp({ env = {}, eventConfig = TEST_EVENT } = {}) {
  const pgUrl = process.env.TEST_DATABASE_URL;
  if (pgUrl) {
    const { default: pg } = await import('pg');
    const c = new pg.Client({ connectionString: pgUrl });
    await c.connect();
    await c.query('DROP TABLE IF EXISTS scan_log, redemptions, tickets, order_items, orders, settings CASCADE');
    await c.end();
  }
  const { app, close, db } = await createApp({
    env: { NODE_ENV: 'test', ADMIN_PASSWORD: 'admin-pass-123', SCANNER_PIN: '4321', DATABASE_URL: pgUrl || '', ...env },
    eventConfig,
    dataDir: 'memory://',
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    db,
    client: () => makeClient(base),
    stop: async () => {
      await new Promise((r) => server.close(r));
      await close();
    },
  };
}

/** fetch wrapper with a cookie jar (for logged-in staff/admin). */
export function makeClient(base) {
  let cookie = '';
  async function req(method, path, body, headers = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined && typeof body !== 'string' ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: res.status, data, headers: res.headers };
  }
  return {
    get: (p, h) => req('GET', p, undefined, h),
    post: (p, b = {}, h) => req('POST', p, b, h),
  };
}

/** A pretend Razorpay API that behaves like the real one for the calls we make. */
export async function startFakeRazorpay() {
  const orders = new Map();
  const payments = new Map(); // orderId -> [payment]
  const calls = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      calls.push(`${req.method} ${req.url}`);
      const send = (status, obj) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(obj));
      };
      if (!req.headers.authorization?.startsWith('Basic ')) return send(401, { error: { description: 'auth' } });
      const body = raw ? JSON.parse(raw) : {};
      let m;
      if (req.method === 'POST' && req.url === '/v1/orders') {
        const id = 'order_' + crypto.randomBytes(6).toString('hex');
        orders.set(id, { id, ...body, status: 'created' });
        return send(200, orders.get(id));
      }
      if (req.method === 'GET' && (m = req.url.match(/^\/v1\/orders\/([^/]+)\/payments$/))) {
        return send(200, { items: payments.get(m[1]) || [] });
      }
      if (req.method === 'GET' && (m = req.url.match(/^\/v1\/payments\/([^/]+)$/))) {
        return send(200, { id: m[1], status: 'captured' });
      }
      if (req.method === 'POST' && (m = req.url.match(/^\/v1\/payments\/([^/]+)\/capture$/))) {
        for (const list of payments.values()) for (const p of list) if (p.id === m[1]) p.status = 'captured';
        return send(200, { id: m[1], status: 'captured' });
      }
      send(404, { error: { description: 'not found' } });
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    apiBase: `http://127.0.0.1:${server.address().port}/v1`,
    orders,
    payments,
    calls,
    addPayment: (orderId, payment) => payments.set(orderId, [...(payments.get(orderId) || []), payment]),
    stop: () => new Promise((r) => server.close(r)),
  };
}

export const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
